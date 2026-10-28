const express = require('express');
const ctrl = require('./controller');
const { autenticar } = require('../../middlewares/auth');
const { permitir, ROLES } = require('../../middlewares/roles');
const { validar } = require('../../middlewares/validar');
const { manejar } = require('../../utils/http');
const { z, id, idParam, booleano, paginacion } = require('../../utils/esquemas');

const router = express.Router();
router.use(autenticar, permitir(ROLES.ADMINISTRADOR));

router.get('/', validar({ query: paginacion.extend({ profesional_id: id.optional(), gestante_id: id.optional(), activa: booleano.optional() }) }), manejar(ctrl.listar));
router.post('/', validar({ body: z.object({ profesional_id: id, gestante_id: id }) }), manejar(ctrl.crear));
router.patch('/:id/finalizar', validar({ params: idParam() }), manejar(ctrl.finalizar));

module.exports = router;
