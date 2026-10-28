const express = require('express');
const { pool, transaccion } = require('../../config/db');
const { autenticar } = require('../../middlewares/auth');
const { permitir, ROLES } = require('../../middlewares/roles');
const { validar } = require('../../middlewares/validar');
const { registrarAuditoria, ipDe } = require('../../services/auditoria');
const { actualizarParcial } = require('../../services/usuarios');
const { manejar, noEncontrado, paginacion: pagina, paginado } = require('../../utils/http');
const { z, idParam, texto, textoOpcional, booleano, paginacion } = require('../../utils/esquemas');

const router = express.Router();
router.use(autenticar);
const soloAdmin = permitir(ROLES.ADMINISTRADOR);

const semana = z.number().int().min(0).max(45);
const esquemaContenido = z.object({
    titulo: texto(160),
    cuerpo: texto(20000),
    categoria: textoOpcional(60),
    semana_desde: semana,
    semana_hasta: semana,
    publicado: z.boolean().optional()
});
const CAMPOS = Object.keys(esquemaContenido.shape);
const rangoValido = (d) => d.semana_desde === undefined || d.semana_hasta === undefined || d.semana_desde <= d.semana_hasta;
const MSG_RANGO = { message: 'semana_desde no puede ser mayor que semana_hasta', path: ['semana_hasta'] };

// RF-16: contenido según la semana de gestación de la gestante autenticada.
router.get('/mi-semana', permitir(ROLES.GESTANTE), manejar(async (req, res) => {
    const { rows: emb } = await pool.query(
        `SELECT fn_semana_gestacion(fecha_inicio, CURRENT_DATE) AS semana FROM embarazo
          WHERE gestante_usuario_id = $1 AND estado = 'ACTIVO'`, [req.usuario.id]
    );
    if (!emb[0]) throw noEncontrado('Embarazo activo');
    const { rows } = await pool.query(
        `SELECT c.id, c.titulo, c.cuerpo, c.categoria, c.semana_desde, c.semana_hasta, (l.usuario_id IS NOT NULL) AS leido
           FROM contenido_educativo c
           LEFT JOIN contenido_lectura l ON l.contenido_id = c.id AND l.usuario_id = $2
          WHERE c.publicado AND $1 BETWEEN c.semana_desde AND c.semana_hasta
          ORDER BY leido, c.semana_desde DESC, c.id`, [emb[0].semana, req.usuario.id]
    );
    res.status(200).json({ semana: emb[0].semana, contenidos: rows });
}));

router.get('/', validar({ query: paginacion.extend({ semana: z.coerce.number().int().min(0).max(45).optional(), categoria: z.string().trim().optional(), q: z.string().trim().max(80).optional(), publicado: booleano.optional() }) }), manejar(async (req, res) => {
    const pag = pagina(req.query);
    const valores = [];
    const filtros = [];
    const esAdmin = req.usuario.rol === ROLES.ADMINISTRADOR;
    if (!esAdmin) filtros.push('publicado');
    else if (req.query.publicado !== undefined) { valores.push(req.query.publicado); filtros.push(`publicado = $${valores.length}`); }
    if (req.query.semana !== undefined) { valores.push(req.query.semana); filtros.push(`$${valores.length} BETWEEN semana_desde AND semana_hasta`); }
    if (req.query.categoria) { valores.push(req.query.categoria); filtros.push(`categoria = $${valores.length}`); }
    if (req.query.q) { valores.push(`%${req.query.q}%`); filtros.push(`(titulo ILIKE $${valores.length} OR cuerpo ILIKE $${valores.length})`); }
    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    const [{ rows }, conteo] = await Promise.all([
        pool.query(`SELECT * FROM contenido_educativo ${where} ORDER BY semana_desde, id LIMIT ${pag.limit} OFFSET ${pag.offset}`, valores),
        pool.query(`SELECT count(*)::int AS total FROM contenido_educativo ${where}`, valores)
    ]);
    res.status(200).json(paginado(rows, conteo.rows[0].total, pag));
}));

router.get('/:id', validar({ params: idParam() }), manejar(async (req, res) => {
    const soloPublicado = req.usuario.rol !== ROLES.ADMINISTRADOR ? 'AND publicado' : '';
    const { rows } = await pool.query(`SELECT * FROM contenido_educativo WHERE id = $1 ${soloPublicado}`, [req.params.id]);
    if (!rows[0]) throw noEncontrado('Contenido');
    res.status(200).json(rows[0]);
}));

router.post('/:id/leido', permitir(ROLES.GESTANTE), validar({ params: idParam() }), manejar(async (req, res) => {
    const { rowCount } = await pool.query('SELECT 1 FROM contenido_educativo WHERE id = $1 AND publicado', [req.params.id]);
    if (!rowCount) throw noEncontrado('Contenido');
    await pool.query(
        'INSERT INTO contenido_lectura (contenido_id, usuario_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.params.id, req.usuario.id]
    );
    res.status(200).json({ mensaje: 'Contenido marcado como leído' });
}));

router.post('/', soloAdmin, validar({ body: esquemaContenido.refine(rangoValido, MSG_RANGO) }), manejar(async (req, res) => {
    const fila = await transaccion(async (db) => {
        const presentes = CAMPOS.filter((c) => req.body[c] !== undefined);
        const { rows } = await db.query(
            `INSERT INTO contenido_educativo (creado_por, ${presentes.join(', ')})
             VALUES ($1, ${presentes.map((_, i) => `$${i + 2}`).join(', ')}) RETURNING *`,
            [req.usuario.id, ...presentes.map((c) => req.body[c])]
        );
        await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'CREAR', entidad: 'contenido_educativo', entidadId: rows[0].id, ip: ipDe(req) });
        return rows[0];
    });
    res.status(201).json(fila);
}));

router.patch('/:id', soloAdmin, validar({ params: idParam(), body: esquemaContenido.partial().refine(rangoValido, MSG_RANGO) }), manejar(async (req, res) => {
    const fila = await transaccion(async (db) => {
        await actualizarParcial(db, 'contenido_educativo', 'id', req.params.id, req.body, CAMPOS);
        const { rows } = await db.query('SELECT * FROM contenido_educativo WHERE id = $1', [req.params.id]);
        if (!rows[0]) throw noEncontrado('Contenido');
        await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'MODIFICAR', entidad: 'contenido_educativo', entidadId: req.params.id, detalle: { campos: Object.keys(req.body) }, ip: ipDe(req) });
        return rows[0];
    });
    res.status(200).json(fila);
}));

router.delete('/:id', soloAdmin, validar({ params: idParam() }), manejar(async (req, res) => {
    await transaccion(async (db) => {
        const { rowCount } = await db.query('DELETE FROM contenido_educativo WHERE id = $1', [req.params.id]);
        if (!rowCount) throw noEncontrado('Contenido');
        await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'DESACTIVAR', entidad: 'contenido_educativo', entidadId: req.params.id, detalle: { eliminado: true }, ip: ipDe(req) });
    });
    res.status(200).json({ mensaje: 'Contenido eliminado' });
}));

module.exports = router;
