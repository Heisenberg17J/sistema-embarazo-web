const { pool, transaccion } = require('../../config/db');
const { HttpError, noEncontrado, paginacion, paginado } = require('../../utils/http');
const { registrarAuditoria, ipDe } = require('../../services/auditoria');
const { esEditable, exigirCorreccion, exigirMotivo } = require('../../services/correcciones');

const SELECT_EXAMEN = `
    SELECT x.id, x.embarazo_id, te.codigo AS tipo, te.nombre AS tipo_nombre, x.fecha, x.resultado, x.observaciones,
           x.registrado_en, x.profesional_usuario_id, u.nombre || ' ' || u.apellido AS profesional
      FROM examen x
      JOIN tipo_examen te ON te.id = x.tipo_examen_id
      JOIN usuario u ON u.id = x.profesional_usuario_id`;

// RF-08: lo registra el profesional asignado; también se permite sobre embarazos cerrados
// porque los resultados pueden llegar después del parto.
const crear = async (req, res) => {
    const { tipo, fecha, resultado, observaciones } = req.body;
    const examen = await transaccion(async (db) => {
        const { rows: tipos } = await db.query('SELECT id FROM tipo_examen WHERE codigo = $1 AND activo', [tipo]);
        if (!tipos[0]) throw new HttpError(400, `Tipo de examen no válido: ${tipo}`);
        const { rows } = await db.query(
            `INSERT INTO examen (embarazo_id, tipo_examen_id, profesional_usuario_id, fecha, resultado, observaciones)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [req.embarazo.id, tipos[0].id, req.usuario.id, fecha, resultado, observaciones ?? null]
        );
        await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'CREAR', entidad: 'examen', entidadId: rows[0].id, detalle: { embarazo_id: req.embarazo.id, tipo }, ip: ipDe(req) });
        return (await db.query(`${SELECT_EXAMEN} WHERE x.id = $1`, [rows[0].id])).rows[0];
    });
    res.status(201).json(examen);
};

const listar = async (req, res) => {
    const pag = paginacion(req.query);
    const [{ rows }, conteo] = await Promise.all([
        pool.query(`${SELECT_EXAMEN} WHERE x.embarazo_id = $1 ORDER BY x.fecha DESC, x.id DESC LIMIT ${pag.limit} OFFSET ${pag.offset}`, [req.embarazo.id]),
        pool.query('SELECT count(*)::int AS total FROM examen WHERE embarazo_id = $1', [req.embarazo.id])
    ]);
    const filas = rows.map((x) => ({
        ...x,
        editable: esEditable(req.usuario, { propietarioId: x.profesional_usuario_id, creadoEn: x.registrado_en })
    }));
    res.status(200).json(paginado(filas, conteo.rows[0].total, pag));
};

const cargarCorregible = async (db, req) => {
    const { rows } = await db.query(
        'SELECT * FROM examen WHERE id = $1 AND embarazo_id = $2 FOR UPDATE', [req.params.id, req.embarazo.id]
    );
    const examen = rows[0];
    if (!examen) throw noEncontrado('Examen');
    exigirCorreccion(req.usuario, { propietarioId: examen.profesional_usuario_id, creadoEn: examen.registrado_en });
    return examen;
};

// Un examen se corrige sin más: no genera alertas. Queda el valor anterior en la auditoría.
const corregir = async (req, res) => {
    exigirMotivo(req.usuario, req.body.motivo);
    const { resultado, observaciones, fecha, motivo } = req.body;

    const examen = await transaccion(async (db) => {
        const antes = await cargarCorregible(db, req);
        await db.query(
            `UPDATE examen
                SET resultado     = COALESCE($2, resultado),
                    observaciones = CASE WHEN $3::boolean THEN $4 ELSE observaciones END,
                    fecha         = COALESCE($5::date, fecha)
              WHERE id = $1`,
            [antes.id, resultado ?? null, observaciones !== undefined, observaciones ?? null, fecha ?? null]
        );
        await registrarAuditoria(db, {
            usuarioId: req.usuario.id, accion: 'MODIFICAR', entidad: 'examen', entidadId: antes.id,
            detalle: {
                embarazo_id: req.embarazo.id, motivo,
                antes: { resultado: antes.resultado, observaciones: antes.observaciones, fecha: antes.fecha },
                despues: { resultado: resultado ?? antes.resultado, observaciones: observaciones ?? antes.observaciones, fecha: fecha ?? antes.fecha }
            },
            ip: ipDe(req)
        });
        return (await db.query(`${SELECT_EXAMEN} WHERE x.id = $1`, [antes.id])).rows[0];
    });
    res.status(200).json({ ...examen, editable: true });
};

const eliminar = async (req, res) => {
    exigirMotivo(req.usuario, req.body?.motivo);
    const motivo = req.body?.motivo;

    await transaccion(async (db) => {
        const examen = await cargarCorregible(db, req);
        await db.query('DELETE FROM examen WHERE id = $1', [examen.id]);
        await registrarAuditoria(db, {
            usuarioId: req.usuario.id, accion: 'DESACTIVAR', entidad: 'examen', entidadId: examen.id,
            detalle: {
                eliminado: true, embarazo_id: req.embarazo.id, tipo_examen_id: examen.tipo_examen_id, fecha: examen.fecha,
                resultado: examen.resultado, observaciones: examen.observaciones, motivo
            },
            ip: ipDe(req)
        });
    });
    res.status(200).json({ mensaje: 'Examen eliminado' });
};

module.exports = { crear, listar, corregir, eliminar };
