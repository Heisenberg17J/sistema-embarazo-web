const express = require('express');
const { pool } = require('../../config/db');
const { autenticar } = require('../../middlewares/auth');
const { permitir, ROLES } = require('../../middlewares/roles');
const { tieneAsignacion } = require('../../middlewares/acceso');
const { validar } = require('../../middlewares/validar');
const { registrarAuditoria, ipDe } = require('../../services/auditoria');
const { obtenerUsuarioCompleto } = require('../../services/usuarios');
const { resumenEmbarazo } = require('../../services/embarazo');
const { manejar, noEncontrado } = require('../../utils/http');
const { z, idParam } = require('../../utils/esquemas');

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

router.get('/', validar({ query: z.object({ q: z.string().trim().max(80).optional() }) }), manejar(listar));
router.get('/:gestanteId', validar({ params: idParam('gestanteId') }), manejar(obtener));

module.exports = router;
