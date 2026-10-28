const express = require('express');
const ctrl = require('./controller');
const { autenticar } = require('../../middlewares/auth');
const { permitir, ROLES } = require('../../middlewares/roles');
const { validar } = require('../../middlewares/validar');
const { manejar } = require('../../utils/http');
const { z, idParam, fecha, hora, paginacion } = require('../../utils/esquemas');

const tipoControl = z.string().trim().toUpperCase().min(1, 'Indique el tipo de control');
const duracion = z.number().int().min(5, 'Duración mínima 5 minutos').max(240, 'Duración máxima 240 minutos');
const ESTADOS = ['PROGRAMADA', 'REPROGRAMADA', 'CUMPLIDA', 'CANCELADA', 'NO_ASISTIO'];

// /embarazos/:embarazoId/citas
const porEmbarazo = express.Router();
porEmbarazo.get('/', validar({ query: z.object({ ambito: z.enum(['proximas', 'anteriores']).optional() }) }), manejar(ctrl.listarPorEmbarazo));
porEmbarazo.post('/', permitir(ROLES.PROFESIONAL),
    validar({ body: z.object({ tipo_control: tipoControl, fecha, hora, duracion_min: duracion.optional() }) }),
    manejar(ctrl.crear));

// /citas
const router = express.Router();
router.use(autenticar, permitir(ROLES.GESTANTE, ROLES.PROFESIONAL));
router.get('/', validar({
    query: paginacion.extend({
        desde: fecha.optional(),
        hasta: fecha.optional(),
        estado: z.string().toUpperCase().transform((v) => v.split(',').map((e) => e.trim()))
            .refine((v) => v.every((e) => ESTADOS.includes(e)), `estado debe ser uno de: ${ESTADOS.join(', ')}`).optional()
    })
}), manejar(ctrl.agenda));
router.patch('/:id', permitir(ROLES.PROFESIONAL), validar({
    params: idParam(),
    body: z.object({ fecha: fecha.optional(), hora: hora.optional(), tipo_control: tipoControl.optional(), duracion_min: duracion.optional() })
        .refine((d) => Object.keys(d).length > 0, 'Envíe al menos un campo para reprogramar')
}), manejar(ctrl.reprogramar));
router.patch('/:id/estado', validar({
    params: idParam(),
    body: z.object({
        estado: z.enum(['CUMPLIDA', 'CANCELADA', 'NO_ASISTIO'], { errorMap: () => ({ message: 'estado debe ser CUMPLIDA, CANCELADA o NO_ASISTIO' }) }),
        motivo_cancelacion: z.string().trim().min(3).max(255).optional()
    })
}), manejar(ctrl.cambiarEstado));

module.exports = { router, porEmbarazo };
