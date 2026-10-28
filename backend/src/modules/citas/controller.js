const { pool, transaccion } = require('../../config/db');
const { HttpError, noEncontrado, prohibido, paginacion, paginado } = require('../../utils/http');
const { ROLES } = require('../../middlewares/roles');
const { exigirActivo } = require('../../middlewares/acceso');
const { registrarAuditoria, ipDe } = require('../../services/auditoria');

const SELECT_CITA = `
    SELECT ci.id, ci.embarazo_id, ci.fecha, to_char(ci.hora, 'HH24:MI') AS hora, ci.duracion_min, ci.estado,
           ci.motivo_cancelacion, tc.codigo AS tipo_control, tc.nombre AS tipo_control_nombre,
           ci.profesional_usuario_id, up.nombre || ' ' || up.apellido AS profesional,
           e.gestante_usuario_id, ug.nombre || ' ' || ug.apellido AS gestante,
           ci.creada_en, ci.actualizado_en
      FROM cita ci
      JOIN tipo_control tc ON tc.id = ci.tipo_control_id
      JOIN usuario up ON up.id = ci.profesional_usuario_id
      JOIN embarazo e ON e.id = ci.embarazo_id
      JOIN usuario ug ON ug.id = e.gestante_usuario_id`;

const VIGENTES = "('PROGRAMADA', 'REPROGRAMADA')";

const exigirFuturo = (fecha, hora) => {
    if (new Date(`${fecha}T${hora}`) < new Date()) throw new HttpError(422, 'La cita debe programarse en una fecha y hora futuras');
};

const obtenerTipoControl = async (db, codigo) => {
    const { rows } = await db.query('SELECT id, duracion_min FROM tipo_control WHERE codigo = $1 AND activo', [codigo]);
    if (!rows[0]) throw new HttpError(400, `Tipo de control no válido: ${codigo}`);
    return rows[0];
};

// --- Rutas bajo /embarazos/:embarazoId/citas -------------------------------------------

const listarPorEmbarazo = async (req, res) => {
    const { ambito } = req.query;
    let filtro = '';
    if (ambito === 'proximas') filtro = `AND ci.estado IN ${VIGENTES} AND ci.fecha + ci.hora >= now()`;
    if (ambito === 'anteriores') filtro = `AND NOT (ci.estado IN ${VIGENTES} AND ci.fecha + ci.hora >= now())`;
    const orden = ambito === 'proximas' ? 'ASC' : 'DESC';
    const { rows } = await pool.query(
        `${SELECT_CITA} WHERE ci.embarazo_id = $1 ${filtro} ORDER BY ci.fecha ${orden}, ci.hora ${orden}`, [req.embarazo.id]
    );
    res.status(200).json(rows);
};

// RF-07: el profesional programa la cita en su propia agenda.
const crear = async (req, res) => {
    exigirActivo(req.embarazo);
    const { tipo_control: tipoControl, fecha, hora, duracion_min: duracion } = req.body;
    exigirFuturo(fecha, hora);
    const cita = await transaccion(async (db) => {
        const tipo = await obtenerTipoControl(db, tipoControl);
        const { rows } = await db.query(
            `INSERT INTO cita (embarazo_id, profesional_usuario_id, tipo_control_id, fecha, hora, duracion_min)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [req.embarazo.id, req.usuario.id, tipo.id, fecha, hora, duracion ?? tipo.duracion_min]
        );
        await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'CREAR', entidad: 'cita', entidadId: rows[0].id, detalle: { embarazo_id: req.embarazo.id, fecha, hora }, ip: ipDe(req) });
        return (await db.query(`${SELECT_CITA} WHERE ci.id = $1`, [rows[0].id])).rows[0];
    });
    res.status(201).json(cita);
};

// --- Rutas bajo /citas ------------------------------------------------------------------

// Agenda del profesional o citas de la gestante, con filtros de fecha y estado.
const agenda = async (req, res) => {
    const { desde, hasta, estado } = req.query;
    const pag = paginacion(req.query);
    const valores = [req.usuario.id];
    const filtros = [req.usuario.rol === ROLES.PROFESIONAL ? 'ci.profesional_usuario_id = $1' : 'e.gestante_usuario_id = $1'];
    if (desde) { valores.push(desde); filtros.push(`ci.fecha >= $${valores.length}`); }
    if (hasta) { valores.push(hasta); filtros.push(`ci.fecha <= $${valores.length}`); }
    if (estado) { valores.push(estado); filtros.push(`ci.estado = ANY($${valores.length}::estado_cita[])`); }
    const where = filtros.join(' AND ');
    const [{ rows }, conteo] = await Promise.all([
        pool.query(`${SELECT_CITA} WHERE ${where} ORDER BY ci.fecha, ci.hora LIMIT ${pag.limit} OFFSET ${pag.offset}`, valores),
        pool.query(`SELECT count(*)::int AS total FROM cita ci JOIN embarazo e ON e.id = ci.embarazo_id WHERE ${where}`, valores)
    ]);
    res.status(200).json(paginado(rows, conteo.rows[0].total, pag));
};

const citaPropia = async (db, req) => {
    const { rows } = await db.query(`${SELECT_CITA} WHERE ci.id = $1 FOR UPDATE OF ci`, [req.params.id]);
    const cita = rows[0];
    const esDueno = cita && (req.usuario.rol === ROLES.PROFESIONAL
        ? cita.profesional_usuario_id === req.usuario.id
        : cita.gestante_usuario_id === req.usuario.id);
    if (!esDueno) throw noEncontrado('Cita');
    return cita;
};

// Reprogramación por el profesional: cambia fecha/hora/tipo y queda REPROGRAMADA.
const reprogramar = async (req, res) => {
    const cita = await transaccion(async (db) => {
        const actual = await citaPropia(db, req);
        if (!['PROGRAMADA', 'REPROGRAMADA'].includes(actual.estado)) throw new HttpError(409, 'Solo se pueden reprogramar citas vigentes');
        const fecha = req.body.fecha ?? actual.fecha;
        const hora = req.body.hora ?? actual.hora;
        exigirFuturo(fecha, hora);
        const tipo = req.body.tipo_control ? await obtenerTipoControl(db, req.body.tipo_control) : null;
        await db.query(
            `UPDATE cita SET fecha = $2, hora = $3, tipo_control_id = COALESCE($4, tipo_control_id),
                    duracion_min = COALESCE($5, duracion_min), estado = 'REPROGRAMADA'
              WHERE id = $1`,
            [actual.id, fecha, hora, tipo?.id ?? null, req.body.duracion_min ?? null]
        );
        await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'MODIFICAR', entidad: 'cita', entidadId: actual.id, detalle: { de: { fecha: actual.fecha, hora: actual.hora }, a: { fecha, hora } }, ip: ipDe(req) });
        return (await db.query(`${SELECT_CITA} WHERE ci.id = $1`, [actual.id])).rows[0];
    });
    res.status(200).json(cita);
};

// El profesional marca CUMPLIDA / NO_ASISTIO / CANCELADA; la gestante solo puede cancelar.
const cambiarEstado = async (req, res) => {
    const { estado, motivo_cancelacion: motivo } = req.body;
    if (req.usuario.rol === ROLES.GESTANTE && estado !== 'CANCELADA') throw prohibido('La gestante solo puede cancelar sus citas');
    if (estado === 'CANCELADA' && !motivo) throw new HttpError(400, 'Falta el motivo de la cancelación');

    const cita = await transaccion(async (db) => {
        const actual = await citaPropia(db, req);
        if (!['PROGRAMADA', 'REPROGRAMADA'].includes(actual.estado)) throw new HttpError(409, `La cita ya está ${actual.estado}`);
        await db.query(
            'UPDATE cita SET estado = $2, motivo_cancelacion = $3 WHERE id = $1',
            [actual.id, estado, estado === 'CANCELADA' ? motivo : null]
        );
        await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'MODIFICAR', entidad: 'cita', entidadId: actual.id, detalle: { estado }, ip: ipDe(req) });
        return (await db.query(`${SELECT_CITA} WHERE ci.id = $1`, [actual.id])).rows[0];
    });
    res.status(200).json(cita);
};

module.exports = { listarPorEmbarazo, crear, agenda, reprogramar, cambiarEstado };
