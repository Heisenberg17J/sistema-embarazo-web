// Cuánto tiempo después de guardarlo se puede corregir o eliminar un dato.
//
// Corto a propósito: corregir un error de tecleo es razonable, reescribir el
// historial una semana después no. Pasada la ventana, quien se equivocó se lo
// dice a su profesional, que es quien responde por el registro clínico.
module.exports = {
    VENTANA_GESTANTE_HORAS: 24,
    VENTANA_PROFESIONAL_HORAS: 24 * 7
};
