/**
 * Identidad de la aplicación.
 *
 * ÚNICO lugar donde vive el nombre. Cuando se defina el nombre definitivo del
 * producto, basta con cambiar este archivo: el encabezado, el título de las
 * pestañas, el pie de página y los correos lo toman de aquí.
 */
export const MARCA = {
    nombre: "Seguimiento del Embarazo",
    /** Para espacios estrechos, como el encabezado en móvil. */
    nombreCorto: "Embarazo",
    /** Letra del logo circular. */
    inicial: "E",
    lema: "Seguimiento del embarazo",
    descripcion:
        "Organiza y visualiza la información de tu embarazo: controles, citas, mediciones y alertas.",
} as const;

/**
 * Descargo de responsabilidad. Aparece en el pie y junto a cada bloque de
 * alertas: la app no diagnostica (ver el alcance en el README del proyecto).
 */
export const DESCARGO =
    `${MARCA.nombre} organiza y visualiza información. No realiza diagnósticos ni reemplaza la valoración de un profesional de salud.`;
