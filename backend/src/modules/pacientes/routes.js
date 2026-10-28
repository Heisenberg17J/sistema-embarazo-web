const express = require('express');
const { pool } = require('../../config/db');
const { autenticar } = require('../../middlewares/auth');
const { permitir, ROLES } = require('../../middlewares/roles');
const { tieneAsignacion } = require('../../middlewares/acceso');
const { validar } = require('../../middlewares/validar');
const { registrarAuditoria, ipDe } = require('../../services/auditoria');
const { obtenerUsuarioCompleto } = require('../../services/usuarios');
const { resumenEmbarazo } = require('../../services/embarazo');
const { manejar, noEncontrado, paginacion: pagina, paginado } = require('../../utils/http');
const { z, idParam, paginacion } = require('../../utils/esquemas');

const router = express.Router();
router.use(autenticar, permitir(ROLES.PROFESIONAL));

// RF-13: pacientes asignadas, primero las que tienen alertas críticas pendientes.
const listar = async (req, res) => {
    const valores = [req.usuario.id];
    let filtro = '';
    if (req.query.q) { valores.push(`%${req.query.q}%`); filtro = 'AND gestante ILIKE $2'; }
    const { rows } = await pool.query(
        `SELECT * FROM v_pacientes_profesional WHERE profesional_usuario_id = $1 ${filtro}
          ORDER BY alertas_criticas DESC, alertas_pendientes DESC, gestante`, valores
    );
    res.status(200).json(rows);
};

const obtener = async (req, res) => {
    const gestanteId = req.params.gestanteId;
    if (!(await tieneAsignacion(pool, req.usuario.id, gestanteId))) throw noEncontrado('Paciente');
    const usuario = await obtenerUsuarioCompleto(pool, gestanteId);
    const { rows } = await pool.query('SELECT id FROM embarazo WHERE gestante_usuario_id = $1 ORDER BY fecha_inicio DESC', [gestanteId]);
    const embarazos = await Promise.all(rows.map((r) => resumenEmbarazo(pool, r.id)));
    await registrarAuditoria(null, { usuarioId: req.usuario.id, accion: 'CONSULTAR_SENSIBLE', entidad: 'usuario', entidadId: gestanteId, detalle: { recurso: 'paciente' }, ip: ipDe(req) });
    res.status(200).json({ ...usuario, embarazos });
};

const TIPOS_ACTIVIDAD = ['CONTROL', 'SINTOMA', 'EXAMEN', 'CITA', 'ALERTA'];

// Lo último que pasó en todas sus pacientes, de más reciente a más antiguo: la vista general que
// evita entrar paciente por paciente para saber qué se registró. Solo lo ya ocurrido (una cita
// futura no es actividad todavía) y solo de pacientes con asignación vigente.
const actividad = async (req, res) => {
    const pag = pagina(req.query);
    const valores = [req.usuario.id];
    let filtro = '';
    if (req.query.tipo) { valores.push(req.query.tipo); filtro = 'AND h.tipo = ANY($2)'; }
    const desde = `FROM v_historial_embarazo h
                   JOIN embarazo e ON e.id = h.embarazo_id
                   JOIN asignacion asg ON asg.gestante_usuario_id = e.gestante_usuario_id
                                      AND asg.profesional_usuario_id = $1 AND asg.activa
                   JOIN usuario u ON u.id = e.gestante_usuario_id
                  WHERE h.fecha <= now() ${filtro}`;
    const [{ rows }, conteo] = await Promise.all([
        pool.query(
            `SELECT h.*, e.gestante_usuario_id AS gestante_id, u.nombre || ' ' || u.apellido AS gestante
               ${desde} ORDER BY h.fecha DESC, h.tipo, h.registro_id DESC LIMIT ${pag.limit} OFFSET ${pag.offset}`, valores),
        pool.query(`SELECT count(*)::int AS total ${desde}`, valores)
    ]);
    await registrarAuditoria(null, { usuarioId: req.usuario.id, accion: 'CONSULTAR_SENSIBLE', entidad: 'usuario', entidadId: req.usuario.id, detalle: { recurso: 'actividad' }, ip: ipDe(req) });
    res.status(200).json(paginado(rows, conteo.rows[0].total, pag));
};

// Antes de '/:gestanteId': si no, "actividad" se leería como un id.
router.get('/actividad', validar({
    query: paginacion.extend({
        tipo: z.string().toUpperCase().transform((v) => v.split(',').map((t) => t.trim()))
            .refine((v) => v.every((t) => TIPOS_ACTIVIDAD.includes(t)), `tipo debe ser uno o varios de: ${TIPOS_ACTIVIDAD.join(', ')}`).optional()
    })
}), manejar(actividad));
router.get('/', validar({ query: z.object({ q: z.string().trim().max(80).optional() }) }), manejar(listar));
router.get('/:gestanteId', validar({ params: idParam('gestanteId') }), manejar(obtener));

module.exports = router;
