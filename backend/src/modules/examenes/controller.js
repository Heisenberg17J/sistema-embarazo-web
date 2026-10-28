const { pool, transaccion } = require('../../config/db');
const { HttpError, paginacion, paginado } = require('../../utils/http');
const { registrarAuditoria, ipDe } = require('../../services/auditoria');

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
    res.status(200).json(paginado(rows, conteo.rows[0].total, pag));
};

module.exports = { crear, listar };
