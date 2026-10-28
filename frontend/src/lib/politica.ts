/**
 * Política de tratamiento de datos y términos de uso.
 *
 * VERSION_POLITICA debe coincidir con backend/src/config/politica.js: el
 * registro guarda qué versión aceptó cada persona y el backend rechaza una
 * aceptación hecha sobre una versión que ya no es la vigente. Se sube cuando el
 * texto cambia de fondo (no por una errata).
 */
export const VERSION_POLITICA = "1.0";

export const POLITICA = {
    /**
     * true mientras el texto sea un borrador sin revisión jurídica ni datos del
     * responsable. Mientras lo sea, las páginas lo dicen con claridad. Ponerlo en
     * false SOLO cuando un abogado haya revisado el texto y se hayan completado
     * los datos de abajo: es un requisito para abrir el piloto con gestantes reales.
     */
    borrador: true,
    vigenteDesde: "[fecha de entrada en vigor]",
    responsable: {
        nombre: "[Nombre de la institución responsable]",
        identificacion: "[NIT]",
        direccion: "[Dirección]",
        correo: "[correo de contacto para datos personales]",
        telefono: "[teléfono]",
    },
} as const;
