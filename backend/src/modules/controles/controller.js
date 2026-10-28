const { pool, transaccion } = require('../../config/db');
const { HttpError, noEncontrado, paginacion, paginado } = require('../../utils/http');
const { exigirActivo } = require('../../middlewares/acceso');
const { registrarAuditoria, ipDe } = require('../../services/auditoria');
const { registrarMediciones } = require('../../services/mediciones');

const SELECT_CONTROL = `
    SELECT c.id, c.embarazo_id, c.cita_id, c.fecha, c.semana_gestacion, c.observaciones, c.creado_en,
           c.profesional_usuario_id, u.nombre || ' ' || u.apellido AS profesional,
           COALESCE((SELECT json_agg(json_build_object('tipo', t.codigo, 'nombre', t.nombre, 'valor', m.valor, 'unidad', t.unidad)
                                      ORDER BY t.id)
                       FROM medicion m JOIN tipo_medicion t ON t.id = m.tipo_medicion_id
                      WHERE m.control_id = c.id), '[]') AS mediciones
      FROM control c JOIN usuario u ON u.id = c.profesional_usuario_id`;

const listar = async (req, res) => {
    const pag = paginacion(req.query);
    const [{ rows }, conteo] = await Promise.all([
        pool.query(`${SELECT_CONTROL} WHERE c.embarazo_id = $1 ORDER BY c.fecha DESC, c.id DESC LIMIT ${pag.limit} OFFSET ${pag.offset}`, [req.embarazo.id]),
        pool.query('SELECT count(*)::int AS total FROM control WHERE embarazo_id = $1', [req.embarazo.id])
    ]);
    res.status(200).json(paginado(rows, conteo.rows[0].total, pag));
};

const obtener = async (req, res) => {
    const { rows } = await pool.query(`${SELECT_CONTROL} WHERE c.id = $1 AND c.embarazo_id = $2`, [req.params.id, req.embarazo.id]);
    if (!rows[0]) throw noEncontrado('Control');
    res.status(200).json(rows[0]);
};

// RF-05: el control y sus mediciones se guardan juntos; si la cita existe, queda CUMPLIDA.
const crear = async (req, res) => {
    exigirActivo(req.embarazo);
    const { fecha, cita_id: citaId, observaciones, mediciones = [] } = req.body;

    const resultado = await transaccion(async (db) => {
        if (citaId) {
            const { rows } = await db.query(
                `UPDATE cita SET estado = 'CUMPLIDA'
                  WHERE id = $1 AND embarazo_id = $2 AND estado IN ('PROGRAMADA', 'REPROGRAMADA', 'CUMPLIDA')
                  RETURNING id`,
                [citaId, req.embarazo.id]
            );
            if (!rows[0]) throw new HttpError(400, 'La cita no pertenece a este embarazo o está cancelada');
        }
        const { rows } = await db.query(
            `INSERT INTO control (embarazo_id, profesional_usuario_id, cita_id, fecha, semana_gestacion, observaciones)
             VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE),
                     fn_semana_gestacion($5, COALESCE($4::date, CURRENT_DATE)), $6)
             RETURNING id, fecha`,
            [req.embarazo.id, req.usuario.id, citaId ?? null, fecha ?? null, req.embarazo.fecha_inicio, observaciones ?? null]
        );
        const control = rows[0];
        const { alertas } = await registrarMediciones(db, {
            embarazo: req.embarazo, mediciones, origen: 'PROFESIONAL', registradoPor: req.usuario.id,
            controlId: control.id, fechaRegistro: `${control.fecha}T12:00:00`
        });
        await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'CREAR', entidad: 'control', entidadId: control.id, detalle: { embarazo_id: req.embarazo.id, mediciones: mediciones.length }, ip: ipDe(req) });
        const completo = (await db.query(`${SELECT_CONTROL} WHERE c.id = $1`, [control.id])).rows[0];
        return { ...completo, alertas };
    });
    res.status(201).json(resultado);
};

module.exports = { listar, obtener, crear };
