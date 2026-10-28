const express = require('express');
const ctrl = require('./controller');
const { validar } = require('../../middlewares/validar');
const { manejar } = require('../../utils/http');
const { z, fecha, textoOpcional, paginacion } = require('../../utils/esquemas');
const { medicionItem } = require('./esquemas');

const router = express.Router();

const esquemaCrear = z.object({
    mediciones: z.array(medicionItem).min(1, 'Debe incluir al menos una medición').max(10),
    fecha_registro: z.string().datetime({ offset: true, message: 'Fecha y hora ISO 8601 inválida' })
        .refine((v) => new Date(v).getTime() <= Date.now() + 5 * 60000, 'La fecha no puede ser futura')
        .optional(),
    observaciones: textoOpcional(255)
});

const esquemaSerie = z.object({
    tipos: z.string().trim().min(1, 'Falta indicar uno o más tipos separados por coma')
        .transform((v) => v.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean))
});

router.get('/', validar({ query: paginacion.extend({ tipo: z.string().trim().toUpperCase().optional(), desde: fecha.optional(), hasta: fecha.optional() }) }), manejar(ctrl.listar));
router.get('/serie', validar({ query: esquemaSerie }), manejar(ctrl.serie));
router.post('/', validar({ body: esquemaCrear }), manejar(ctrl.crear));

module.exports = router;
