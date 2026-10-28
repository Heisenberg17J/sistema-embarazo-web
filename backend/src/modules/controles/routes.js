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

module.exports = router;
