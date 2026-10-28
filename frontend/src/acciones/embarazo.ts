"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ErrorApi, api } from "@/lib/api";
import { hoyLocal } from "@/lib/formato";

export interface EstadoEmbarazo {
    error?: string;
    porCampo?: Record<string, string>;
    /** Lo escrito, para repintarlo: React 19 limpia el formulario al terminar. */
    valores?: Record<string, string>;
}

function valoresDe(datos: FormData): Record<string, string> {
    return Object.fromEntries(
        [...datos.entries()].filter(([, v]) => typeof v === "string"),
    ) as Record<string, string>;
}

const opcionalNumero = (min: number, max: number, campo: string) =>
    z.preprocess(
        (v) =>
            typeof v === "string" && v.trim() !== ""
                ? Number(v.replace(",", "."))
                : undefined,
        z
            .number({ error: `${campo} debe ser un número` })
            .min(min, `Mínimo ${min}`)
            .max(max, `Máximo ${max}`)
            .optional(),
    );

const esquema = z.object({
    fecha_inicio: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Indica la fecha de tu última menstruación")
        .refine(
            (v) => v <= hoyLocal(),
            "La fecha no puede ser futura",
        ),
    talla_cm: opcionalNumero(120, 220, "La talla"),
    peso_pregestacional_kg: opcionalNumero(30, 200, "El peso"),
});

/**
 * RF-04. La fecha probable de parto la calcula el backend (FUM + 280 días),
 * así que aquí solo se pide la FUM.
 */
export async function registrarEmbarazo(
    _previo: EstadoEmbarazo,
    datos: FormData,
): Promise<EstadoEmbarazo> {
    const valido = esquema.safeParse(Object.fromEntries(datos));
    if (!valido.success) {
        return {
            error: "Revisa los datos marcados.",
            porCampo: Object.fromEntries(
                valido.error.issues.map((i) => [i.path.join("."), i.message]),
            ),
            valores: valoresDe(datos),
        };
    }

    try {
        await api.post("/embarazos", valido.data);
    } catch (error) {
        const valores = valoresDe(datos);
        if (error instanceof ErrorApi) {
            const porCampo = error.porCampo;
            return Object.keys(porCampo).length
                ? { error: "Revisa los datos marcados.", porCampo, valores }
                : { error: error.message, valores };
        }
        return { error: "No se pudo registrar. Intenta de nuevo.", valores };
    }

    revalidatePath("/panel");
    redirect("/panel");
}

// ---------------------------------------------------------------------------
// Ciclo de vida: corregir, cerrar y (el profesional) registrar el de una paciente
// ---------------------------------------------------------------------------
//
// Ninguna llama a `revalidatePath`: el diálogo que las invoca pide
// `router.refresh()` al cerrarse (ver `DialogoAccion`).

export interface ResultadoEmbarazo {
    ok?: boolean;
    error?: string;
    porCampo?: Record<string, string>;
}

function fallo(error: unknown): ResultadoEmbarazo {
    if (error instanceof ErrorApi) {
        const porCampo = error.porCampo;
        return Object.keys(porCampo).length
            ? { error: "Revisa los datos marcados.", porCampo }
            : { error: error.message };
    }
    return { error: "No se pudo guardar. Intenta de nuevo." };
}

function falloZod(error: z.ZodError): ResultadoEmbarazo {
    const porCampo: Record<string, string> = {};
    for (const i of error.issues) {
        const campo = i.path.join(".") || "general";
        if (!(campo in porCampo)) porCampo[campo] = i.message;
    }
    return { error: "Revisa los datos marcados.", porCampo };
}

const id = z.coerce.number().int().positive();
const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Indica la fecha");
const noFutura = fechaIso.refine((v) => v <= hoyLocal(), "La fecha no puede ser futura");
const vacio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const esquemaEditar = z.object({
    embarazo_id: id,
    fecha_inicio: z.preprocess(vacio, noFutura.optional()),
    fecha_inicio_original: z.preprocess(vacio, z.string().optional()),
    fecha_estimada_parto: z.preprocess(vacio, fechaIso.optional()),
    fecha_estimada_parto_original: z.preprocess(vacio, z.string().optional()),
    talla_cm: opcionalNumero(120, 220, "La talla"),
    peso_pregestacional_kg: opcionalNumero(30, 200, "El peso"),
});

/**
 * Corrige los datos del embarazo. La fecha probable de parto solo se envía si la
 * persona la cambió a propósito: si se enviara siempre el valor viejo, anularía el
 * recálculo automático que el backend hace al corregir la última menstruación.
 */
export async function actualizarEmbarazo(
    _previo: ResultadoEmbarazo,
    datos: FormData,
): Promise<ResultadoEmbarazo> {
    const valido = esquemaEditar.safeParse(Object.fromEntries(datos));
    if (!valido.success) return falloZod(valido.error);

    const d = valido.data;
    const cuerpo: Record<string, unknown> = {};
    if (d.fecha_inicio && d.fecha_inicio !== d.fecha_inicio_original) cuerpo.fecha_inicio = d.fecha_inicio;
    if (d.fecha_estimada_parto && d.fecha_estimada_parto !== d.fecha_estimada_parto_original) {
        cuerpo.fecha_estimada_parto = d.fecha_estimada_parto;
    }
    if (d.talla_cm !== undefined) cuerpo.talla_cm = d.talla_cm;
    if (d.peso_pregestacional_kg !== undefined) cuerpo.peso_pregestacional_kg = d.peso_pregestacional_kg;

    if (Object.keys(cuerpo).length === 0) {
        return { error: "No cambiaste ningún dato.", porCampo: {} };
    }

    try {
        await api.patch(`/embarazos/${d.embarazo_id}`, cuerpo);
        return { ok: true };
    } catch (error) {
        return fallo(error);
    }
}

const esquemaFinalizar = z.object({
    embarazo_id: id,
    estado: z.enum(["FINALIZADO", "CANCELADO"], { error: "Elige cómo terminó" }),
    fecha_finalizacion: z.preprocess(vacio, noFutura.optional()),
    observaciones: z.preprocess(vacio, z.string().trim().max(2000, "Máximo 2000 caracteres").optional()),
});

export async function finalizarEmbarazo(
    _previo: ResultadoEmbarazo,
    datos: FormData,
): Promise<ResultadoEmbarazo> {
    const valido = esquemaFinalizar.safeParse(Object.fromEntries(datos));
    if (!valido.success) return falloZod(valido.error);

    const { embarazo_id: e, ...cuerpo } = valido.data;
    try {
        await api.patch(`/embarazos/${e}/finalizar`, cuerpo);
        return { ok: true };
    } catch (error) {
        return fallo(error);
    }
}

const esquemaDePaciente = z.object({
    gestante_id: id,
    fecha_inicio: noFutura,
    talla_cm: opcionalNumero(120, 220, "La talla"),
    peso_pregestacional_kg: opcionalNumero(30, 200, "El peso"),
});

/** El profesional registra el embarazo de una paciente asignada que aún no lo hizo. */
export async function registrarEmbarazoDePaciente(
    _previo: ResultadoEmbarazo,
    datos: FormData,
): Promise<ResultadoEmbarazo> {
    const valido = esquemaDePaciente.safeParse(Object.fromEntries(datos));
    if (!valido.success) return falloZod(valido.error);

    try {
        await api.post("/embarazos", valido.data);
        return { ok: true };
    } catch (error) {
        return fallo(error);
    }
}
