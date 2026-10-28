/**
 * Constantes compartidas entre formularios y acciones.
 *
 * Viven aquí y no en los archivos `"use server"` porque un módulo de Server
 * Actions solo puede exportar funciones asíncronas: exportar una constante
 * desde allí hace que Next descarte todos los exports del módulo.
 */

/** Opción del formulario que registra sistólica y diastólica en una sola toma. */
export const TIPO_PRESION = "PRESION";

/** Códigos de medición que el formulario agrupa bajo "Presión arterial". */
export const CODIGOS_PRESION = ["PA_SISTOLICA", "PA_DIASTOLICA"] as const;
