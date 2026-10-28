const express = require('express');
const ctrl = require('./controller');
const { autenticar } = require('../../middlewares/auth');
const { permitir, ROLES } = require('../../middlewares/roles');
const { cargarEmbarazo } = require('../../middlewares/acceso');
const { validar } = require('../../middlewares/validar');
const { manejar } = require('../../utils/http');
const { z, id, fecha, textoOpcional, noFutura } = require('../../utils/esquemas');

const router = express.Router();
const clinicos = permitir(ROLES.GESTANTE, ROLES.PROFESIONAL);
router.use(autenticar, clinicos);

const datosAntropometricos = {
    talla_cm: z.number().min(120, 'Talla mínima 120 cm').max(220, 'Talla máxima 220 cm').optional().nullable(),
    peso_pregestacional_kg: z.number().min(30, 'Peso mínimo 30 kg').max(200, 'Peso máximo 200 kg').optional().nullable(),
    observaciones: textoOpcional(2000)
};

const esquemaCrear = z.object({
    gestante_id: id.optional(),
    fecha_inicio: noFutura(fecha),
    fecha_estimada_parto: fecha.optional(),
    ...datosAntropometricos
});

const esquemaActualizar = z.object({
    fecha_inicio: noFutura(fecha).optional(),
    fecha_estimada_parto: fecha.optional(),
    ...datosAntropometricos
}).strict('Campo no permitido');

const esquemaFinalizar = z.object({
    estado: z.enum(['FINALIZADO', 'CANCELADO'], { errorMap: () => ({ message: 'estado debe ser FINALIZADO o CANCELADO' }) }),
    fecha_finalizacion: noFutura(fecha).optional(),
    observaciones: textoOpcional(2000)
});

router.post('/', validar({ body: esquemaCrear }), manejar(ctrl.crear));
router.get('/', validar({ query: z.object({ gestante_id: id.optional() }) }), manejar(ctrl.listar));
router.get('/actual', permitir(ROLES.GESTANTE), manejar(ctrl.actual));

// Todo lo que cuelga de /:embarazoId pasa por el control de acceso (RNF-03).
const porEmbarazo = express.Router({ mergeParams: true });
porEmbarazo.use(cargarEmbarazo);
porEmbarazo.get('/', manejar(ctrl.obtener));
porEmbarazo.patch('/', validar({ body: esquemaActualizar }), manejar(ctrl.actualizar));
porEmbarazo.patch('/finalizar', validar({ body: esquemaFinalizar }), manejar(ctrl.finalizar));
porEmbarazo.use('/controles', require('../controles/routes'));
porEmbarazo.use('/mediciones', require('../mediciones/routes'));
porEmbarazo.use('/sintomas', require('../sintomas/routes'));
porEmbarazo.use('/citas', require('../citas/routes').porEmbarazo);
porEmbarazo.use('/examenes', require('../examenes/routes'));
porEmbarazo.use('/alertas', require('../alertas/routes').porEmbarazo);
porEmbarazo.use('/historial', require('../historial/routes'));

router.use('/:embarazoId(\\d+)', porEmbarazo);

module.exports = router;
