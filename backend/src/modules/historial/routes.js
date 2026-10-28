const express = require('express');
const { pool } = require('../../config/db');
const { validar } = require('../../middlewares/validar');
const { ROLES } = require('../../middlewares/roles');
const { registrarAuditoria, ipDe } = require('../../services/auditoria');
const { manejar, paginacion: pagina, paginado } = require('../../utils/http');
const { z, paginacion } = require('../../utils/esquemas');

const router = express.Router();

const TIPOS = ['CONTROL', 'SINTOMA', 'EXAMEN', 'CITA', 'ALERTA'];

// RF-09: historial cronológico unificado (vista v_historial_embarazo).
const historial = async (req, res) => {
    const pag = pagina(req.query);
    const valores = [req.embarazo.id];
    let filtro = '';
    if (req.query.tipo) { valores.push(req.query.tipo); filtro = 'AND tipo = ANY($2)'; }
    const [{ rows }, conteo] = await Promise.all([
        pool.query(`SELECT * FROM v_historial_embarazo WHERE embarazo_id = $1 ${filtro}
                     ORDER BY fecha DESC, tipo, registro_id DESC LIMIT ${pag.limit} OFFSET ${pag.offset}`, valores),
        pool.query(`SELECT count(*)::int AS total FROM v_historial_embarazo WHERE embarazo_id = $1 ${filtro}`, valores)
    ]);
    // RNF-14: consultar la historia clínica de una paciente queda trazado.
    if (req.usuario.rol === ROLES.PROFESIONAL) {
        await registrarAuditoria(null, { usuarioId: req.usuario.id, accion: 'CONSULTAR_SENSIBLE', entidad: 'embarazo', entidadId: req.embarazo.id, detalle: { recurso: 'historial' }, ip: ipDe(req) });
    }
    res.status(200).json(paginado(rows, conteo.rows[0].total, pag));
};

const esquema = paginacion.extend({
    tipo: z.string().toUpperCase().transform((v) => v.split(',').map((t) => t.trim()))
        .refine((v) => v.every((t) => TIPOS.includes(t)), `tipo debe ser uno o varios de: ${TIPOS.join(', ')}`)
        .optional()
});

router.get('/', validar({ query: esquema }), manejar(historial));

module.exports = router;
