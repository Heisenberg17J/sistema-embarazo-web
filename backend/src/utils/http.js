class HttpError extends Error {
    constructor(status, mensaje, detalles) {
        super(mensaje);
        this.status = status;
        this.detalles = detalles;
    }
}

const noEncontrado = (recurso = 'Recurso') => new HttpError(404, `${recurso} no encontrado`);
const prohibido = (mensaje = 'No tiene permiso para realizar esta acción') => new HttpError(403, mensaje);

// Envuelve controladores async para que los errores lleguen al middleware de errores.
const manejar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Normaliza ?page y ?limit y devuelve el bloque de paginación para la respuesta.
const paginacion = (query) => {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
    return { page, limit, offset: (page - 1) * limit };
};

const paginado = (filas, total, { page, limit }) => ({
    datos: filas,
    paginacion: { page, limit, total, paginas: Math.ceil(total / limit) }
});

module.exports = { HttpError, noEncontrado, prohibido, manejar, paginacion, paginado };
