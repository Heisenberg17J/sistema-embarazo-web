const express = require('express');
const ctrl = require('./controller');
const { permitir, ROLES } = require('../../middlewares/roles');
const { validar } = require('../../middlewares/validar');
const { manejar } = require('../../utils/http');
const { z, fecha, textoOpcional, paginacion, noFutura } = require('../../utils/esquemas');

const router = express.Router();

const esquemaCrear = z.object({
    tipo: z.string().trim().toUpperCase().optional(),
    descripcion: textoOpcional(255),
    intensidad: z.number().int().min(1, 'Intensidad de 1 a 5').max(5, 'Intensidad de 1 a 5').optional().nullable(),
    fecha: noFutura(fecha).optional(),
    observaciones: textoOpcional(2000)
}).refine((d) => d.tipo || d.descripcion, { message: 'Indique el tipo de síntoma o una descripción', path: ['descripcion'] });

router.get('/', validar({ query: paginacion }), manejar(ctrl.listar));
router.post('/', permitir(ROLES.GESTANTE), validar({ body: esquemaCrear }), manejar(ctrl.crear));

module.exports = router;
