const express = require('express');
const ctrl = require('./controller');
const { permitir, ROLES } = require('../../middlewares/roles');
const { validar } = require('../../middlewares/validar');
const { manejar } = require('../../utils/http');
const { z, fecha, texto, textoOpcional, paginacion, noFutura } = require('../../utils/esquemas');

const router = express.Router();

const esquemaCrear = z.object({
    tipo: z.string().trim().toUpperCase().min(1, 'Indique el tipo de examen'),
    fecha: noFutura(fecha),
    resultado: texto(4000),
    observaciones: textoOpcional(4000)
});

router.get('/', validar({ query: paginacion }), manejar(ctrl.listar));
router.post('/', permitir(ROLES.PROFESIONAL), validar({ body: esquemaCrear }), manejar(ctrl.crear));

module.exports = router;
