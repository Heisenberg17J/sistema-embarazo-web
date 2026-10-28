const express = require('express');
const ctrl = require('./controller');
const { autenticar } = require('../../middlewares/auth');
const { permitir, ROLES } = require('../../middlewares/roles');
const { validar } = require('../../middlewares/validar');
const { manejar } = require('../../utils/http');
const { z, idParam, textoOpcional, paginacion } = require('../../utils/esquemas');

const esquemaFiltro = paginacion.extend({
    estado: z.enum(['PENDIENTE', 'REVISADA', 'DESCARTADA', 'ANULADA']).optional(),
    severidad: z.enum(['INFORMATIVA', 'ADVERTENCIA', 'CRITICA']).optional()
});

// /embarazos/:embarazoId/alertas
const porEmbarazo = express.Router();
porEmbarazo.get('/', validar({ query: esquemaFiltro }), manejar(ctrl.listarPorEmbarazo));

// /alertas
const router = express.Router();
router.use(autenticar);
router.get('/', permitir(ROLES.GESTANTE, ROLES.PROFESIONAL), validar({ query: esquemaFiltro }), manejar(ctrl.listar));
router.patch('/:id/revisar', permitir(ROLES.PROFESIONAL), validar({
    params: idParam(),
    body: z.object({
        estado: z.enum(['REVISADA', 'DESCARTADA'], { errorMap: () => ({ message: 'estado debe ser REVISADA o DESCARTADA' }) }),
        observacion: textoOpcional(255)
    })
}), manejar(ctrl.revisar));

module.exports = { router, porEmbarazo };
