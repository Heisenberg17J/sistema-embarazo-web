const express = require('express');
const ctrl = require('./controller');
const { permitir, ROLES } = require('../../middlewares/roles');
const { validar } = require('../../middlewares/validar');
const { manejar } = require('../../utils/http');
const { z, idParam, fecha, texto, textoOpcional, paginacion, noFutura } = require('../../utils/esquemas');

const router = express.Router();

const esquemaCrear = z.object({
    tipo: z.string().trim().toUpperCase().optional(),
    descripcion: textoOpcional(255),
    intensidad: z.number().int().min(1, 'Intensidad de 1 a 5').max(5, 'Intensidad de 1 a 5').optional().nullable(),
    fecha: noFutura(fecha).optional(),
    observaciones: textoOpcional(2000)
}).refine((d) => d.tipo || d.descripcion, { message: 'Elige un síntoma de la lista o descríbelo', path: ['descripcion'] });

router.get('/', validar({ query: paginacion }), manejar(ctrl.listar));
router.post('/', permitir(ROLES.GESTANTE), validar({ body: esquemaCrear }), manejar(ctrl.crear));

// Solo la gestante dueña corrige sus síntomas (y solo dentro de su ventana: ver services/correcciones).
const esquemaCorregir = z.object({
    tipo: z.string().trim().toUpperCase().min(1).optional(),
    descripcion: texto(255).optional(),
    intensidad: z.number().int().min(1, 'Intensidad de 1 a 5').max(5, 'Intensidad de 1 a 5').nullable().optional(),
    observaciones: textoOpcional(2000),
    motivo: textoOpcional(255)
}).refine((d) => ['tipo', 'descripcion', 'intensidad', 'observaciones'].some((c) => d[c] !== undefined),
    { message: 'Indica qué quieres corregir', path: ['descripcion'] });

router.patch('/:id', permitir(ROLES.GESTANTE), validar({ params: idParam(), body: esquemaCorregir }), manejar(ctrl.corregir));
router.delete('/:id', permitir(ROLES.GESTANTE),
    validar({ params: idParam(), body: z.object({ motivo: textoOpcional(255) }) }), manejar(ctrl.eliminar));

module.exports = router;
