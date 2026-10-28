const { pool, transaccion } = require('../../config/db');
const { HttpError, noEncontrado, paginacion, paginado } = require('../../utils/http');
const { ROLES } = require('../../middlewares/roles');
const { registrarAuditoria, ipDe } = require('../../services/auditoria');
const { AVISO } = require('../../services/alertas');

const SELECT_ALERTA = `
    SELECT a.id, a.embarazo_id, e.gestante_usuario_id, ug.nombre || ' ' || ug.apellido AS gestante,
           a.severidad, a.mensaje, a.valor_detectado, tm.codigo AS tipo_medicion, tm.unidad,
           ts.codigo AS tipo_sintoma, ra.codigo AS regla, a.estado, a.generada_en,
           a.revisada_por, ur.nombre || ' ' || ur.apellido AS revisor, a.fecha_revision, a.observacion_revision,
           a.anulada_en, a.motivo_anulacion,
           (a.severidad = 'CRITICA') AS accion_inmediata
      FROM alerta a
      JOIN embarazo e ON e.id = a.embarazo_id
      JOIN usuario ug ON ug.id = e.gestante_usuario_id
      LEFT JOIN regla_alerta ra ON ra.id = a.regla_alerta_id
      LEFT JOIN medicion m ON m.id = a.medicion_id
      LEFT JOIN tipo_medicion tm ON tm.id = m.tipo_medicion_id
      LEFT JOIN sintoma s ON s.id = a.sintoma_id
      LEFT JOIN tipo_sintoma ts ON ts.id = s.tipo_sintoma_id
      LEFT JOIN usuario ur ON ur.id = a.revisada_por`;

// Las anuladas van al final: son historia, no lo que hay que atender.
const ORDEN = `ORDER BY (a.estado = 'ANULADA'), CASE a.severidad WHEN 'CRITICA' THEN 1 WHEN 'ADVERTENCIA' THEN 2 ELSE 3 END, a.generada_en DESC`;

const responder = (res, rows, total, pag) => res.status(200).json({ ...paginado(rows, total, pag), aviso: AVISO });

const filtrosComunes = (query, valores, filtros) => {
    if (query.estado) { valores.push(query.estado); filtros.push(`a.estado = $${valores.length}`); }
    if (query.severidad) { valores.push(query.severidad); filtros.push(`a.severidad = $${valores.length}`); }
};

const consultar = async (filtros, valores, pag) => {
    const where = filtros.join(' AND ');
    const [{ rows }, conteo] = await Promise.all([
        pool.query(`${SELECT_ALERTA} WHERE ${where} ${ORDEN} LIMIT ${pag.limit} OFFSET ${pag.offset}`, valores),
        pool.query(`SELECT count(*)::int AS total FROM alerta a JOIN embarazo e ON e.id = a.embarazo_id WHERE ${where}`, valores)
    ]);
    return { rows, total: conteo.rows[0].total };
};

const listarPorEmbarazo = async (req, res) => {
    const pag = paginacion(req.query);
    const valores = [req.embarazo.id];
    const filtros = ['a.embarazo_id = $1'];
    filtrosComunes(req.query, valores, filtros);
    const { rows, total } = await consultar(filtros, valores, pag);
    responder(res, rows, total, pag);
};

// RF-12: el profesional ve las alertas de todas sus pacientes asignadas; la gestante, las suyas.
const listar = async (req, res) => {
    const pag = paginacion(req.query);
    const valores = [req.usuario.id];
    const filtros = req.usuario.rol === ROLES.PROFESIONAL
        ? ['EXISTS (SELECT 1 FROM asignacion asg WHERE asg.gestante_usuario_id = e.gestante_usuario_id AND asg.profesional_usuario_id = $1 AND asg.activa)']
        : ['e.gestante_usuario_id = $1'];
    filtrosComunes(req.query, valores, filtros);
    const { rows, total } = await consultar(filtros, valores, pag);
    responder(res, rows, total, pag);
};

const revisar = async (req, res) => {
    const { estado, observacion } = req.body;
    const alerta = await transaccion(async (db) => {
        const { rows } = await db.query(
            `UPDATE alerta a SET estado = $3, revisada_por = $2, fecha_revision = now(), observacion_revision = $4
               FROM embarazo e
              WHERE a.id = $1 AND e.id = a.embarazo_id AND a.estado = 'PENDIENTE'
                AND EXISTS (SELECT 1 FROM asignacion asg WHERE asg.gestante_usuario_id = e.gestante_usuario_id
                             AND asg.profesional_usuario_id = $2 AND asg.activa)
          RETURNING a.id`,
            [req.params.id, req.usuario.id, estado, observacion ?? null]
        );
        if (!rows[0]) {
            const existe = await db.query(
                `SELECT a.estado FROM alerta a JOIN embarazo e ON e.id = a.embarazo_id
                  WHERE a.id = $1 AND EXISTS (SELECT 1 FROM asignacion asg WHERE asg.gestante_usuario_id = e.gestante_usuario_id
                                               AND asg.profesional_usuario_id = $2 AND asg.activa)`,
                [req.params.id, req.usuario.id]
            );
            if (existe.rows[0]) throw new HttpError(409, `La alerta ya fue ${existe.rows[0].estado.toLowerCase()}`);
            throw noEncontrado('Alerta');
        }
        await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'MODIFICAR', entidad: 'alerta', entidadId: rows[0].id, detalle: { estado }, ip: ipDe(req) });
        return (await db.query(`${SELECT_ALERTA} WHERE a.id = $1`, [rows[0].id])).rows[0];
    });
    res.status(200).json(alerta);
};

module.exports = { listarPorEmbarazo, listar, revisar };
