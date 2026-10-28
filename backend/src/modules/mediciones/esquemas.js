const { z } = require('../../utils/esquemas');

// El rango técnico de cada tipo lo valida la BD (trigger tg_medicion_rango) con un mensaje claro.
const medicionItem = z.object({
    tipo: z.string().trim().toUpperCase().min(1, 'Falta el tipo de medición'),
    valor: z.number({ invalid_type_error: 'El valor debe ser numérico', required_error: 'El valor es obligatorio' }).finite()
});

module.exports = { medicionItem };
