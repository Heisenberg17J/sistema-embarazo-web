const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { pool } = require('../config/db');
const { HttpError } = require('../utils/http');

const verificarToken = async (req) => {
    const cabecera = req.headers.authorization || '';
    const [esquema, token] = cabecera.split(' ');
    if (esquema !== 'Bearer' || !token) throw new HttpError(401, 'Se requiere iniciar sesión');

    let payload;
    try {
        payload = jwt.verify(token, env.jwt.secreto);
    } catch {
        throw new HttpError(401, 'Sesión inválida o expirada');
    }

    // Se consulta el usuario en cada petición para que una desactivación tenga efecto inmediato.
    const { rows } = await pool.query(
        `SELECT u.id, r.codigo AS rol, u.nombre, u.apellido, u.correo, u.activo, u.debe_cambiar_contrasena
           FROM usuario u JOIN rol r ON r.id = u.rol_id
          WHERE u.id = $1`,
        [payload.sub]
    );
    const usuario = rows[0];
    if (!usuario || !usuario.activo) throw new HttpError(401, 'Sesión inválida o expirada');
    return usuario;
};

// Exige sesión válida. Si el usuario tiene una contraseña temporal, solo puede cambiarla.
const autenticar = async (req, res, next) => {
    try {
        req.usuario = await verificarToken(req);
        if (req.usuario.debe_cambiar_contrasena) {
            throw new HttpError(403, 'Debe cambiar su contraseña temporal antes de continuar', {
                codigo: 'CAMBIO_CONTRASENA_REQUERIDO'
            });
        }
        next();
    } catch (error) {
        next(error);
    }
};

// Igual que autenticar, pero permite el acceso con contraseña temporal pendiente.
const autenticarSinBloqueo = async (req, res, next) => {
    try {
        req.usuario = await verificarToken(req);
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = { autenticar, autenticarSinBloqueo };
