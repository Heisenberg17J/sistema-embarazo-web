const express = require('express');
const { pool, transaccion } = require('../../config/db');
const { autenticar } = require('../../middlewares/auth');
const { permitir, ROLES } = require('../../middlewares/roles');
const { validar } = require('../../middlewares/validar');
const { registrarAuditoria, ipDe } = require('../../services/auditoria');
const { manejar, noEncontrado, paginacion: pagina, paginado } = require('../../utils/http');
const { z, id, fecha, paginacion } = require('../../utils/esquemas');

const router = express.Router();
router.use(autenticar, permitir(ROLES.ADMINISTRADOR));

// Parámetros globales del sistema.
router.get('/configuracion', manejar(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM configuracion_sistema ORDER BY clave');
    res.status(200).json(rows);
}));

router.patch('/configuracion/:clave', validar({
    params: z.object({ clave: z.string().max(60) }),
    body: z.object({ valor: z.string().trim().min(1).max(255) })
}), manejar(async (req, res) => {
    const fila = await transaccion(async (db) => {
        const { rows } = await db.query(
            `UPDATE configuracion_sistema SET valor = $2, actualizado_por = $3, actualizado_en = now()
              WHERE clave = $1 RETURNING *`, [req.params.clave, req.body.valor, req.usuario.id]
        );
        if (!rows[0]) throw noEncontrado('Parámetro');
        await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'MODIFICAR', entidad: 'configuracion_sistema', detalle: { clave: req.params.clave, valor: req.body.valor }, ip: ipDe(req) });
        return rows[0];
    });
    res.status(200).json(fila);
}));

// RNF-14: consulta de la bitácora de auditoría.
const ACCIONES = ['LOGIN', 'LOGIN_FALLIDO', 'LOGOUT', 'CREAR', 'MODIFICAR', 'DESACTIVAR', 'CONSULTAR_SENSIBLE'];
router.get('/auditoria', validar({
    query: paginacion.extend({
        usuario_id: id.optional(), accion: z.enum(ACCIONES).optional(), entidad: z.string().max(40).optional(),
        desde: fecha.optional(), hasta: fecha.optional()
    })
}), manejar(async (req, res) => {
    const pag = pagina(req.query);
    const valores = [];
    const filtros = [];
    const agregar = (cond, valor) => { valores.push(valor); filtros.push(cond.replace('?', `$${valores.length}`)); };
    if (req.query.usuario_id) agregar('a.usuario_id = ?', req.query.usuario_id);
    if (req.query.accion) agregar('a.accion = ?', req.query.accion);
    if (req.query.entidad) agregar('a.entidad = ?', req.query.entidad);
    if (req.query.desde) agregar('a.ocurrido_en >= ?::date', req.query.desde);
    if (req.query.hasta) agregar('a.ocurrido_en < ?::date + 1', req.query.hasta);
    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    const [{ rows }, conteo] = await Promise.all([
        pool.query(`SELECT a.*, u.correo AS usuario_correo FROM auditoria a LEFT JOIN usuario u ON u.id = a.usuario_id
                    ${where} ORDER BY a.ocurrido_en DESC, a.id DESC LIMIT ${pag.limit} OFFSET ${pag.offset}`, valores),
        pool.query(`SELECT count(*)::int AS total FROM auditoria a ${where}`, valores)
    ]);
    res.status(200).json(paginado(rows, conteo.rows[0].total, pag));
}));

module.exports = router;
