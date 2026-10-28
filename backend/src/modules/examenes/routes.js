const express = require('express');
const ctrl = require('./controller');
const { permitir, ROLES } = require('../../middlewares/roles');
const { validar } = require('../../middlewares/validar');
const { manejar } = require('../../utils/http');
const { z, idParam, fecha, texto, textoOpcional, paginacion, noFutura } = require('../../utils/esquemas');

const router = express.Router();

const esquemaCrear = z.object({
    tipo: z.string().trim().toUpperCase().min(1, 'Elige el tipo de examen'),
    fecha: noFutura(fecha),
    resultado: texto(4000),
    observaciones: textoOpcional(4000)
});

router.get('/', validar({ query: paginacion }), manejar(ctrl.listar));
router.post('/', permitir(ROLES.PROFESIONAL), validar({ body: esquemaCrear }), manejar(ctrl.crear));

// Corrección: solo el profesional que lo registró, dentro de su ventana.
const esquemaCorregir = z.object({
    resultado: texto(4000).optional(),
    observaciones: textoOpcional(4000),
    fecha: noFutura(fecha).optional(),
    motivo: textoOpcional(255)
}).refine((d) => ['resultado', 'observaciones', 'fecha'].some((c) => d[c] !== undefined), { message: 'Indica qué quieres corregir', path: ['resultado'] });

router.patch('/:id', permitir(ROLES.PROFESIONAL), validar({ params: idParam(), body: esquemaCorregir }), manejar(ctrl.corregir));
router.delete('/:id', permitir(ROLES.PROFESIONAL),
    validar({ params: idParam(), body: z.object({ motivo: textoOpcional(255) }) }), manejar(ctrl.eliminar));

module.exports = router;
