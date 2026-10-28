const { HttpError } = require('../utils/http');

// RNF-10: valida body, query y params con esquemas zod y deja los datos ya normalizados.
const validar = (esquemas) => (req, res, next) => {
    const errores = [];
    for (const parte of ['params', 'query', 'body']) {
        if (!esquemas[parte]) continue;
        const resultado = esquemas[parte].safeParse(req[parte] ?? {});
        if (resultado.success) {
            req[parte] = resultado.data;
        } else {
            for (const issue of resultado.error.issues) {
                errores.push({ campo: issue.path.join('.') || parte, mensaje: issue.message });
            }
        }
    }
    if (errores.length) return next(new HttpError(400, 'Datos inválidos', errores));
    next();
};

module.exports = { validar };
