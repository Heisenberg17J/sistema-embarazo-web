const { z } = require('zod');

// Piezas de validación reutilizadas por los módulos (RNF-10).
const id = z.coerce.number({ invalid_type_error: 'Debe ser un número' }).int().positive('Debe ser un identificador válido');
const idParam = (nombre = 'id') => z.object({ [nombre]: id }).passthrough();

const esFechaReal = (v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha AAAA-MM-DD').refine(esFechaReal, 'Fecha inexistente');
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Formato de hora HH:MM');
const texto = (max) => z.string().trim().min(1, 'No puede estar vacío').max(max, `Máximo ${max} caracteres`);
const textoOpcional = (max) => z.string().trim().max(max, `Máximo ${max} caracteres`).optional().nullable();
const correo = z.string().trim().toLowerCase().email('Correo electrónico inválido').max(160);
const contrasena = z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(72, 'La contraseña no puede superar 72 caracteres')
    .regex(/[A-Za-z]/, 'La contraseña debe incluir al menos una letra')
    .regex(/\d/, 'La contraseña debe incluir al menos un número');
const telefono = z.string().trim().regex(/^[0-9+()\s-]{7,20}$/, 'Teléfono inválido');
const booleano = z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]);
const paginacion = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional()
});

const noFutura = (esquema) => esquema.refine((v) => v <= hoyLocal(), 'La fecha no puede ser futura');

// Fecha local del servidor (evita que después de las 7 p. m. en Colombia "hoy" sea mañana en UTC).
const hoyLocal = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

module.exports = {
    z, id, idParam, fecha, hora, texto, textoOpcional, correo, contrasena, telefono, booleano,
    paginacion, noFutura, hoyLocal
};
