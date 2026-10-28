const express = require('express');
const ctrl = require('./controller');
const { permitir, ROLES } = require('../../middlewares/roles');
const { validar } = require('../../middlewares/validar');
const { manejar } = require('../../utils/http');
const { z, id, idParam, fecha, textoOpcional, paginacion, noFutura } = require('../../utils/esquemas');
const { medicionItem } = require('../mediciones/esquemas');

const router = express.Router();

const esquemaCrear = z.object({
    fecha: noFutura(fecha).optional(),
    cita_id: id.optional().nullable(),
    observaciones: textoOpcional(4000),
    mediciones: z.array(medicionItem).max(20).optional()
});

router.get('/', validar({ query: paginacion }), manejar(ctrl.listar));
router.get('/:id', validar({ params: idParam() }), manejar(ctrl.obtener));
router.post('/', permitir(ROLES.PROFESIONAL), validar({ body: esquemaCrear }), manejar(ctrl.crear));

// Corrección: solo el profesional que lo registró, dentro de su ventana (services/correcciones).
const esquemaCorregir = z.object({
    observaciones: textoOpcional(4000),
    // Un valor `null` elimina esa medición del control.
    mediciones: z.array(z.object({
        tipo: z.string().trim().toUpperCase().min(1, 'Falta el tipo de medición'),
        valor: z.number({ invalid_type_error: 'El valor debe ser numérico' }).finite().nullable()
    })).max(20).optional(),
    motivo: textoOpcional(255)
}).refine((d) => d.observaciones !== undefined || d.mediciones?.length, { message: 'Indica qué quieres corregir', path: ['observaciones'] });

router.patch('/:id', permitir(ROLES.PROFESIONAL), validar({ params: idParam(), body: esquemaCorregir }), manejar(ctrl.corregir));
router.delete('/:id', permitir(ROLES.PROFESIONAL),
    validar({ params: idParam(), body: z.object({ motivo: textoOpcional(255) }) }), manejar(ctrl.eliminar));

module.exports = router;
