const express = require('express');
const ctrl = require('./controller');
const { autenticar, autenticarSinBloqueo } = require('../../middlewares/auth');
const { permitir, ROLES } = require('../../middlewares/roles');
const { VERSION_POLITICA } = require('../../config/politica');
const { limiteCredenciales, limiteRecuperacion, limiteRestablecer } = require('../../middlewares/limites');
const { validar } = require('../../middlewares/validar');
const { manejar } = require('../../utils/http');
const {
    z, fecha, texto, textoOpcional, correo, contrasena, telefono, noFutura
} = require('../../utils/esquemas');

const router = express.Router();

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
    contacto_emergencia_telefono: telefono.optional(),
    // Autorización de tratamiento de datos (Ley 1581): expresa y sobre la versión vigente.
    acepto_politica: z.literal(true, { errorMap: () => ({ message: 'Debes aceptar la política de tratamiento de datos para registrarte' }) }),
    version_politica: z.literal(VERSION_POLITICA, { errorMap: () => ({ message: 'La política cambió: recarga la página y vuelve a leerla' }) })
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

router.post('/registro', limiteCredenciales, validar({ body: esquemaRegistro }), manejar(ctrl.registro));
router.post('/login', limiteCredenciales, validar({ body: z.object({ correo, contrasena: z.string().min(1, 'Obligatoria') }) }), manejar(ctrl.login));
router.post('/refresh', validar({ body: esquemaRefresh }), manejar(ctrl.refrescar));
router.post('/logout', autenticarSinBloqueo, validar({ body: esquemaRefresh }), manejar(ctrl.logout));
router.get('/me', autenticarSinBloqueo, manejar(ctrl.yo));
router.patch('/contrasena', autenticarSinBloqueo,
    validar({ body: z.object({ contrasena_actual: z.string().min(1, 'Obligatoria'), contrasena_nueva: contrasena }) }),
    manejar(ctrl.cambiarContrasena));
router.post('/recuperar', limiteRecuperacion, validar({ body: z.object({ correo }) }), manejar(ctrl.recuperar));
router.post('/restablecer', limiteRestablecer,
    validar({ body: z.object({ token: z.string().regex(/^[a-f0-9]{64}$/, 'Enlace inválido'), contrasena_nueva: contrasena }) }),
    manejar(ctrl.restablecer));

// Derechos del titular de los datos (Ley 1581): consulta y supresión.
router.get('/mis-datos', autenticarSinBloqueo, manejar(ctrl.misDatos));
router.get('/solicitud-supresion', autenticar, permitir(ROLES.GESTANTE), manejar(ctrl.estadoSupresion));
router.post('/solicitud-supresion', autenticar, permitir(ROLES.GESTANTE),
    validar({ body: z.object({ motivo: textoOpcional(500) }) }),
    manejar(ctrl.solicitarSupresion));
router.patch('/perfil', autenticar, validar({ body: esquemaPerfil }), manejar(ctrl.actualizarPerfil));

module.exports = router;
