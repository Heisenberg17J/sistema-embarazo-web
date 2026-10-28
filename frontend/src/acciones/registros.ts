"use server";

import { z } from "zod";
import { ErrorApi, api } from "@/lib/api";
import { TIPO_PRESION } from "@/lib/constantes";
import { embarazoActivo } from "@/lib/datos";
import type { Alerta, Medicion, Sintoma } from "@/lib/tipos";

/**
 * Estas acciones NO llaman a `revalidatePath`.
 *
 * Hacerlo desde dentro de la acción remonta el diálogo que la invocó y borra su
 * estado, así que el aviso de atención inmediata y el mensaje de confirmación
 * nunca llegaban a verse. El refresco lo pide el cliente con `router.refresh()`
 * cuando ya mostró el resultado. Como el cliente de la API usa `no-store`, no
 * hay caché de servidor que invalidar.
 */
export interface ResultadoRegistro {
    ok?: boolean;
    error?: string;
    porCampo?: Record<string, string>;
    /** Lo que se guardó, para confirmarlo en pantalla. */
    resumen?: string;
    /** Alertas que generó el backend con este registro (RF-11). */
    alertas?: Alerta[];
}

function aResultado(error: unknown): ResultadoRegistro {
    if (error instanceof ErrorApi) {
        const porCampo = error.porCampo;
        return Object.keys(porCampo).length
            ? { error: "Revise los datos marcados.", porCampo }
            : { error: error.message };
    }
    return { error: "No se pudo guardar. Intente de nuevo." };
}

// ---------------------------------------------------------------------------

const numero = (campo: string) =>
    z.preprocess(
        (v) =>
            typeof v === "string" && v.trim() !== ""
                ? Number(v.replace(",", "."))
                : undefined,
        z
            .number({ error: `Escriba ${campo}` })
            .finite(`${campo} debe ser un número`)
            .positive(`${campo} debe ser mayor que cero`),
    );

const esquemaMedicion = z
    .object({
        tipo: z.string().trim().min(1, "Elija qué desea registrar"),
        valor: z.unknown().optional(),
        sistolica: z.unknown().optional(),
        diastolica: z.unknown().optional(),
        observaciones: z.preprocess(
            (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
            z.string().trim().max(255, "Máximo 255 caracteres").optional(),
        ),
    })
    .superRefine((d, ctx) => {
        if (d.tipo === TIPO_PRESION) {
            for (const campo of ["sistolica", "diastolica"] as const) {
                const r = numero(campo === "sistolica" ? "la sistólica" : "la diastólica").safeParse(
                    d[campo],
                );
                if (!r.success) {
                    ctx.addIssue({ code: "custom", path: [campo], message: r.error.issues[0].message });
                }
            }
        } else {
            const r = numero("el valor").safeParse(d.valor);
            if (!r.success) {
                ctx.addIssue({ code: "custom", path: ["valor"], message: r.error.issues[0].message });
            }
        }
    });

const aNumero = (v: unknown) => Number(String(v).replace(",", "."));

export async function registrarMedicion(
    _previo: ResultadoRegistro,
    datos: FormData,
): Promise<ResultadoRegistro> {
    const valido = esquemaMedicion.safeParse(Object.fromEntries(datos));
    if (!valido.success) {
        return {
            error: "Revise los datos marcados.",
            porCampo: Object.fromEntries(
                valido.error.issues.map((i) => [i.path.join(".") || "tipo", i.message]),
            ),
        };
    }

    const { tipo, valor, sistolica, diastolica, observaciones } = valido.data;

    const embarazo = await embarazoActivo();
    if (!embarazo) {
        return { error: "Primero debe registrar su embarazo." };
    }

    const mediciones =
        tipo === TIPO_PRESION
            ? [
                  { tipo: "PA_SISTOLICA", valor: aNumero(sistolica) },
                  { tipo: "PA_DIASTOLICA", valor: aNumero(diastolica) },
              ]
            : [{ tipo, valor: aNumero(valor) }];

    try {
        const r = await api.post<{ mediciones: Medicion[]; alertas: Alerta[] }>(
            `/embarazos/${embarazo.embarazo_id}/mediciones`,
            { mediciones, observaciones },
        );
        return {
            ok: true,
            alertas: r.alertas,
            resumen:
                tipo === TIPO_PRESION
                    ? `Presión ${aNumero(sistolica)}/${aNumero(diastolica)} mmHg registrada.`
                    : `${r.mediciones[0].nombre ?? "Medición"} registrada: ${r.mediciones[0].valor}.`,
        };
    } catch (error) {
        return aResultado(error);
    }
}

// ---------------------------------------------------------------------------

const esquemaSintoma = z
    .object({
        tipo: z.preprocess(
            (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
            z.string().trim().toUpperCase().optional(),
        ),
        descripcion: z.preprocess(
            (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
            z.string().trim().max(255, "Máximo 255 caracteres").optional(),
        ),
        intensidad: z.preprocess(
            (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : undefined),
            z.number().int().min(1).max(5).optional(),
        ),
        observaciones: z.preprocess(
            (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
            z.string().trim().max(2000, "Máximo 2000 caracteres").optional(),
        ),
    })
    .refine((d) => d.tipo || d.descripcion, {
        message: "Elija un síntoma de la lista o descríbalo",
        path: ["descripcion"],
    });

export async function registrarSintoma(
    _previo: ResultadoRegistro,
    datos: FormData,
): Promise<ResultadoRegistro> {
    const valido = esquemaSintoma.safeParse(Object.fromEntries(datos));
    if (!valido.success) {
        return {
            error: "Revise los datos marcados.",
            porCampo: Object.fromEntries(
                valido.error.issues.map((i) => [i.path.join(".") || "tipo", i.message]),
            ),
        };
    }

    const embarazo = await embarazoActivo();
    if (!embarazo) {
        return { error: "Primero debe registrar su embarazo." };
    }

    try {
        const r = await api.post<Sintoma>(
            `/embarazos/${embarazo.embarazo_id}/sintomas`,
            valido.data,
        );
        return {
            ok: true,
            alertas: r.alerta ? [r.alerta] : [],
            resumen: `Síntoma registrado: ${r.descripcion}.`,
        };
    } catch (error) {
        return aResultado(error);
    }
}
