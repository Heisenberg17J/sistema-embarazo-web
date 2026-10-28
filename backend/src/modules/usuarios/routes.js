const express = require('express');
const ctrl = require('./controller');
const { autenticar } = require('../../middlewares/auth');
const { permitir, ROLES } = require('../../middlewares/roles');
const { validar } = require('../../middlewares/validar');
const { manejar } = require('../../utils/http');
const {
    z, idParam, fecha, texto, textoOpcional, correo, contrasena, telefono, booleano, paginacion, noFutura
} = require('../../utils/esquemas');

const router = express.Router();
router.use(autenticar, permitir(ROLES.ADMINISTRADOR));

const perfilGestante = z.object({
    tipo_documento: z.enum(['CC', 'TI', 'CE', 'PA']).optional(),
    numero_documento: z.string().trim().regex(/^[A-Za-z0-9]{4,20}$/, 'Número de documento inválido'),
    fecha_nacimiento: noFutura(fecha),
    telefono: telefono.optional().nullable(),
    direccion: textoOpcional(160),
    eps: textoOpcional(80),
    grupo_sanguineo: z.enum(['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']).optional().nullable(),
    contacto_emergencia_nombre: textoOpcional(120),
    contacto_emergencia_telefono: telefono.optional().nullable()
});

const perfilProfesional = z.object({
    registro_profesional: texto(30),
    especialidad: texto(80),
    institucion: textoOpcional(120),
    telefono: telefono.optional().nullable()
});

const base = { nombre: texto(80), apellido: texto(80), correo, contrasena_temporal: contrasena };

// El perfil exigido depende del rol.
const esquemaCrear = z.discriminatedUnion('rol', [
    z.object({ rol: z.literal('GESTANTE'), ...base, perfil: perfilGestante }),
    z.object({ rol: z.literal('PROFESIONAL'), ...base, perfil: perfilProfesional }),
    z.object({ rol: z.literal('ADMINISTRADOR'), ...base })
], { errorMap: () => ({ message: 'rol debe ser GESTANTE, PROFESIONAL o ADMINISTRADOR' }) });

const esquemaActualizar = z.object({
    nombre: texto(80).optional(),
    apellido: texto(80).optional(),
    correo: correo.optional(),
    perfil: z.union([perfilGestante.partial(), perfilProfesional.partial()]).optional()
});

const esquemaListar = paginacion.extend({
    rol: z.enum(['GESTANTE', 'PROFESIONAL', 'ADMINISTRADOR']).optional(),
    activo: booleano.optional(),
    q: z.string().trim().max(80).optional()
});

router.get('/', validar({ query: esquemaListar }), manejar(ctrl.listar));
router.get('/:id', validar({ params: idParam() }), manejar(ctrl.obtener));
router.post('/', validar({ body: esquemaCrear }), manejar(ctrl.crear));
router.patch('/:id', validar({ params: idParam(), body: esquemaActualizar }), manejar(ctrl.actualizar));
router.patch('/:id/estado', validar({ params: idParam(), body: z.object({ activo: z.boolean() }) }), manejar(ctrl.cambiarEstado));
router.post('/:id/restablecer-contrasena', validar({ params: idParam(), body: z.object({ contrasena_temporal: contrasena }) }), manejar(ctrl.restablecerContrasena));

module.exports = router;
