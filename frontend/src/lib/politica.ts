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
    borrador: false,
    vigenteDesde: "28/10/2026",
    responsable: {
        nombre: "Hejembert Fabian Jaramillo Betancur",
        identificacion: "1105367895",
        direccion: "76002, Cali Valle del Cauca",
        correo: "hejembert.dev@gmail.com",
        telefono: "+573136749128",
    },
} as const;
