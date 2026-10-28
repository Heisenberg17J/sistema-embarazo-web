const crypto = require('crypto');
const registro = require('../services/registro');

// Identifica cada petición y deja una línea por cada una, al terminar.
//
// El identificador viaja en la cabecera X-Request-Id y en el cuerpo de los errores 500: quien
// reporta "me salió un error" puede dar ese código y se encuentra su petición exacta.
//
// Se registra la ruta SIN la cadena de consulta (podría llevar un término de búsqueda con un
// nombre) y nunca el cuerpo ni las cabeceras (ver services/registro.js).
const registrarSolicitudes = (req, res, next) => {
    req.id = crypto.randomBytes(5).toString('hex');
    res.setHeader('X-Request-Id', req.id);
    const inicio = process.hrtime.bigint();

    res.on('finish', () => {
        // El chequeo de disponibilidad responde cada pocos segundos: no ahoga el registro.
        if (req.originalUrl.startsWith('/api/v1/salud')) return;
        const ms = Number((process.hrtime.bigint() - inicio) / 1000000n);
        const datos = {
            id: req.id,
            metodo: req.method,
            ruta: req.originalUrl.split('?')[0],
            estado: res.statusCode,
            ms,
            usuario: req.usuario?.id ?? null
        };
        // Un error del servidor o una petición muy lenta merecen más atención que el resto.
        if (res.statusCode >= 500) registro.error('petición con error del servidor', datos);
        else if (ms > 2000) registro.aviso('petición lenta', datos);
        else registro.info('petición', datos);
    });
    next();
};

module.exports = { registrarSolicitudes };
