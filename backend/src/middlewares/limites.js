const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

// En las pruebas los límites no estorban, salvo en las que los verifican a propósito.
const omitir = () => process.env.NODE_ENV === 'test' && process.env.LIMITES_EN_PRUEBAS !== 'true';

// El frontend llama a la API desde su propio servidor (BFF), así que casi todas las peticiones
// llegan de la misma IP. Un límite por IP castigaría a todas las usuarias por lo que haga una:
// por eso las credenciales se limitan por cuenta (el correo del cuerpo) y el resto por sesión.
const hash = (texto) => crypto.createHash('sha256').update(texto).digest('hex').slice(0, 32);

const porCorreo = (req) => {
    const correo = typeof req.body?.correo === 'string' ? req.body.correo.trim().toLowerCase() : '';
    return correo ? `correo:${hash(correo)}` : `ip:${rateLimit.ipKeyGenerator ? rateLimit.ipKeyGenerator(req.ip) : req.ip}`;
};

const porSesion = (req) => {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    return token ? `token:${hash(token)}` : `ip:${rateLimit.ipKeyGenerator ? rateLimit.ipKeyGenerator(req.ip) : req.ip}`;
};

const crear = ({ ventanaMs, limite, mensaje, key }) => rateLimit({
    windowMs: ventanaMs,
    limit: limite,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: key,
    skip: omitir,
    message: { error: mensaje },
    // La clave ya es un hash o la IP normalizada de arriba.
    validate: { keyGeneratorIpFallback: false }
});

// Fuerza bruta sobre una cuenta: 10 intentos cada 15 minutos por correo.
const limiteCredenciales = crear({
    ventanaMs: 15 * 60 * 1000, limite: 10, key: porCorreo,
    mensaje: 'Demasiados intentos. Inténtalo de nuevo en unos minutos.'
});

// Cada solicitud envía un correo: 5 por hora y por correo, para que nadie inunde un buzón ajeno.
const limiteRecuperacion = crear({
    ventanaMs: 60 * 60 * 1000, limite: 5, key: porCorreo,
    mensaje: 'Demasiados intentos. Inténtalo de nuevo en una hora.'
});

// El enlace de restablecimiento no trae correo y su token no se puede adivinar: basta un freno amplio.
const limiteRestablecer = crear({
    ventanaMs: 60 * 60 * 1000, limite: 60, key: porSesion,
    mensaje: 'Demasiados intentos. Inténtalo de nuevo en una hora.'
});

// Red de seguridad para toda la API: por sesión, no por IP. Ningún uso normal se acerca a esto.
const limiteGeneral = crear({
    ventanaMs: 60 * 1000, limite: 300, key: porSesion,
    mensaje: 'Estás haciendo demasiadas peticiones. Espera un momento e inténtalo de nuevo.'
});

module.exports = { limiteCredenciales, limiteRecuperacion, limiteRestablecer, limiteGeneral };
