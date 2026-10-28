const express = require('express');
const rateLimit = require('express-rate-limit');
const ctrl = require('./controller');
const { autenticar, autenticarSinBloqueo } = require('../../middlewares/auth');
const { validar } = require('../../middlewares/validar');
const { manejar } = require('../../utils/http');
const {
    z, fecha, texto, textoOpcional, correo, contrasena, telefono, noFutura
} = require('../../utils/esquemas');

const router = express.Router();

// Frena ataques de fuerza bruta sobre las credenciales.
const limitador = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    message: { error: 'Demasiados intentos. Intente de nuevo en unos minutos.' }
});

const grupoSanguineo = z.enum(['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']);

const esquemaRegistro = z.object({
    nombre: texto(80),
    apellido: texto(80),
    correo,
    contrasena,
    tipo_documento: z.enum(['CC', 'TI', 'CE', 'PA']).default('CC'),
    numero_documento: z.string().trim().regex(/^[A-Za-z0-9]{4,20}$/, 'Número de documento inválido'),
    fecha_nacimiento: noFutura(fecha),
    telefono: telefono.optional(),
    direccion: textoOpcional(160),
    eps: textoOpcional(80),
    grupo_sanguineo: grupoSanguineo.optional(),
    contacto_emergencia_nombre: textoOpcional(120),
    contacto_emergencia_telefono: telefono.optional()
});

const esquemaPerfil = z.object({
    nombre: texto(80).optional(),
    apellido: texto(80).optional(),
    telefono: telefono.optional().nullable(),
    direccion: textoOpcional(160),
    eps: textoOpcional(80),
    grupo_sanguineo: grupoSanguineo.optional().nullable(),
    contacto_emergencia_nombre: textoOpcional(120),
    contacto_emergencia_telefono: telefono.optional().nullable(),
    institucion: textoOpcional(120)
}).strict('Campo no permitido');

const esquemaRefresh = z.object({ refresh_token: z.string().min(20, 'refresh_token inválido') });

router.post('/registro', limitador, validar({ body: esquemaRegistro }), manejar(ctrl.registro));
router.post('/login', limitador, validar({ body: z.object({ correo, contrasena: z.string().min(1, 'Obligatoria') }) }), manejar(ctrl.login));
router.post('/refresh', validar({ body: esquemaRefresh }), manejar(ctrl.refrescar));
router.post('/logout', autenticarSinBloqueo, validar({ body: esquemaRefresh }), manejar(ctrl.logout));
router.get('/me', autenticarSinBloqueo, manejar(ctrl.yo));
router.patch('/contrasena', autenticarSinBloqueo,
    validar({ body: z.object({ contrasena_actual: z.string().min(1, 'Obligatoria'), contrasena_nueva: contrasena }) }),
    manejar(ctrl.cambiarContrasena));
router.patch('/perfil', autenticar, validar({ body: esquemaPerfil }), manejar(ctrl.actualizarPerfil));

module.exports = router;
