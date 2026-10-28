const { pool } = require('../config/db');
const { HttpError, noEncontrado } = require('../utils/http');
const { ROLES } = require('./roles');

// RNF-03: un profesional solo accede a gestantes con asignación activa.
const tieneAsignacion = async (db, profesionalId, gestanteId) => {
    const { rowCount } = await db.query(
        `SELECT 1 FROM asignacion
          WHERE profesional_usuario_id = $1 AND gestante_usuario_id = $2 AND activa`,
        [profesionalId, gestanteId]
    );
    return rowCount > 0;
};

// Gestante: solo ella misma. Profesional: solo sus asignadas. Administrador: sin acceso clínico.
const puedeVerGestante = async (db, usuario, gestanteId) => {
    if (usuario.rol === ROLES.GESTANTE) return usuario.id === gestanteId;
    if (usuario.rol === ROLES.PROFESIONAL) return tieneAsignacion(db, usuario.id, gestanteId);
    return false;
};

// Devuelve el embarazo si el usuario puede verlo. Sin permiso responde 404 para no revelar que existe.
const obtenerEmbarazoAutorizado = async (db, usuario, embarazoId) => {
    const { rows } = await db.query('SELECT * FROM embarazo WHERE id = $1', [embarazoId]);
    const embarazo = rows[0];
    if (!embarazo || !(await puedeVerGestante(db, usuario, embarazo.gestante_usuario_id))) {
        throw noEncontrado('Embarazo');
    }
    return embarazo;
};

const exigirActivo = (embarazo) => {
    if (embarazo.estado !== 'ACTIVO') {
        throw new HttpError(409, 'El embarazo no está activo; no se pueden registrar datos nuevos');
    }
};

// Middleware para rutas /embarazos/:embarazoId/...
const cargarEmbarazo = async (req, res, next) => {
    try {
        const id = Number(req.params.embarazoId);
        if (!Number.isInteger(id) || id <= 0) throw noEncontrado('Embarazo');
        req.embarazo = await obtenerEmbarazoAutorizado(pool, req.usuario, id);
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = { tieneAsignacion, puedeVerGestante, obtenerEmbarazoAutorizado, exigirActivo, cargarEmbarazo };
