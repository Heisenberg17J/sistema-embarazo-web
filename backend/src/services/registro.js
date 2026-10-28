const env = require('../config/env');

// Registro de eventos del servidor.
//
// En producción cada línea es un objeto JSON (lo que esperan los servicios gestionados para
// buscar y filtrar); en desarrollo, texto legible. En pruebas se calla, salvo que se pida
// con LOG_PRUEBAS=1.
//
// REGLA: aquí nunca van cuerpos de petición, cabeceras, contraseñas, tokens ni valores
// clínicos. Esta aplicación maneja datos de salud: un registro de eventos que los copiara
// sería otra base de datos de salud, sin ninguno de los controles de acceso de la primera.
// Se registra qué pasó (método, ruta, estado, duración, quién), no el contenido.

const silencio = env.entorno === 'test' && !process.env.LOG_PRUEBAS;

const escribir = (nivel, msg, datos = {}) => {
    if (silencio) return;
    const salida = nivel === 'error' ? process.stderr : process.stdout;
    if (env.entorno === 'production') {
        salida.write(`${JSON.stringify({ ts: new Date().toISOString(), nivel, msg, ...datos })}\n`);
    } else {
        const extra = Object.keys(datos).length ? ` ${JSON.stringify(datos)}` : '';
        salida.write(`[${nivel}] ${msg}${extra}\n`);
    }
};

module.exports = {
    info: (msg, datos) => escribir('info', msg, datos),
    aviso: (msg, datos) => escribir('aviso', msg, datos),
    error: (msg, datos) => escribir('error', msg, datos)
};
