const { pool, transaccion } = require('../../config/db');
const { HttpError, noEncontrado, paginacion, paginado } = require('../../utils/http');
const { registrarAuditoria, ipDe } = require('../../services/auditoria');

const SELECT_ASIGNACION = `
    SELECT a.id, a.profesional_usuario_id, up.nombre || ' ' || up.apellido AS profesional,
           a.gestante_usuario_id, ug.nombre || ' ' || ug.apellido AS gestante,
           a.fecha_inicio, a.fecha_fin, a.activa, a.creada_en, a.asignada_por
      FROM asignacion a
      JOIN usuario up ON up.id = a.profesional_usuario_id
      JOIN usuario ug ON ug.id = a.gestante_usuario_id`;

const listar = async (req, res) => {
    const { profesional_id: profesionalId, gestante_id: gestanteId, activa } = req.query;
    const pag = paginacion(req.query);
    const filtros = [];
    const valores = [];
    if (profesionalId) { valores.push(profesionalId); filtros.push(`a.profesional_usuario_id = $${valores.length}`); }
    if (gestanteId) { valores.push(gestanteId); filtros.push(`a.gestante_usuario_id = $${valores.length}`); }
    if (activa !== undefined) { valores.push(activa); filtros.push(`a.activa = $${valores.length}`); }
    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    const [{ rows }, conteo] = await Promise.all([
        pool.query(`${SELECT_ASIGNACION} ${where} ORDER BY a.creada_en DESC LIMIT ${pag.limit} OFFSET ${pag.offset}`, valores),
        pool.query(`SELECT count(*)::int AS total FROM asignacion a ${where}`, valores)
    ]);
    res.status(200).json(paginado(rows, conteo.rows[0].total, pag));
};

// RF-15. Las FK contra perfil_profesional/perfil_gestante garantizan que los roles sean los correctos.
const crear = async (req, res) => {
    const { profesional_id: profesionalId, gestante_id: gestanteId } = req.body;
    const asignacion = await transaccion(async (db) => {
        const { rows: activos } = await db.query(
            `SELECT
                (SELECT activo FROM usuario u JOIN perfil_profesional p ON p.usuario_id = u.id WHERE u.id = $1) AS prof,
                (SELECT activo FROM usuario u JOIN perfil_gestante g ON g.usuario_id = u.id WHERE u.id = $2) AS gest`,
            [profesionalId, gestanteId]
        );
        if (activos[0].prof == null) throw new HttpError(400, 'El profesional indicado no existe');
        if (activos[0].gest == null) throw new HttpError(400, 'La gestante indicada no existe');
        if (!activos[0].prof || !activos[0].gest) throw new HttpError(400, 'No se puede asignar un usuario desactivado');

        const { rows } = await db.query(
            `INSERT INTO asignacion (profesional_usuario_id, gestante_usuario_id, asignada_por)
             VALUES ($1, $2, $3) RETURNING id`,
            [profesionalId, gestanteId, req.usuario.id]
        );
        await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'CREAR', entidad: 'asignacion', entidadId: rows[0].id, detalle: { profesionalId, gestanteId }, ip: ipDe(req) });
        return (await db.query(`${SELECT_ASIGNACION} WHERE a.id = $1`, [rows[0].id])).rows[0];
    });
    res.status(201).json(asignacion);
};

// Finalizar conserva el histórico; el profesional pierde el acceso a partir de ese momento.
const finalizar = async (req, res) => {
    const asignacion = await transaccion(async (db) => {
        const { rowCount } = await db.query(
            'UPDATE asignacion SET activa = FALSE, fecha_fin = CURRENT_DATE WHERE id = $1 AND activa', [req.params.id]
        );
        if (!rowCount) throw noEncontrado('Asignación activa');
        await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'DESACTIVAR', entidad: 'asignacion', entidadId: req.params.id, ip: ipDe(req) });
        return (await db.query(`${SELECT_ASIGNACION} WHERE a.id = $1`, [req.params.id])).rows[0];
    });
    res.status(200).json(asignacion);
};

module.exports = { listar, crear, finalizar };
