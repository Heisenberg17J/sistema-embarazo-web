const { prohibido } = require('../utils/http');

const ROLES = Object.freeze({
    GESTANTE: 'GESTANTE',
    PROFESIONAL: 'PROFESIONAL',
    ADMINISTRADOR: 'ADMINISTRADOR'
});

const ROL_ID = Object.freeze({ GESTANTE: 1, PROFESIONAL: 2, ADMINISTRADOR: 3 });

// RNF-02: autorización por rol.
const permitir = (...roles) => (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) return next(prohibido());
    next();
};

module.exports = { ROLES, ROL_ID, permitir };
