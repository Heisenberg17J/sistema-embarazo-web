"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ErrorApi, api } from "@/lib/api";
import type { Alerta, Control, Examen, Sintoma } from "@/lib/tipos";

/**
 * Corrección y eliminación de datos clínicos.
 *
 * Corregir un dato que generó una alerta NO borra la alerta: la anula. Las que
 * devuelven un resultado (corregir) no revalidan: hacerlo remontaría el diálogo
 * antes de que se lea la respuesta, y la respuesta puede traer una alerta nueva
 * que hay que mostrar. El diálogo pide `router.refresh()` al cerrarse. Las de un
 * solo paso (eliminar) sí revalidan.
 */

export interface ResultadoCorreccion {
    ok?: boolean;
    error?: string;
    porCampo?: Record<string, string>;
    resumen?: string;
    /** Alertas nuevas que generó el valor corregido. */
    alertas?: Alerta[];
    /** Cuántas alertas del valor anterior quedaron anuladas. */
    anuladas?: number;
}

function errorDe(error: unknown): ResultadoCorreccion {
    if (error instanceof ErrorApi) {
        const porCampo = error.porCampo;
        return Object.keys(porCampo).length
            ? { error: "Revisa los datos marcados.", porCampo }
            : { error: error.message };
    }
    return { error: "No se pudo guardar. Intenta de nuevo." };
}

function errorZod(error: z.ZodError): ResultadoCorreccion {
    const porCampo: Record<string, string> = {};
    for (const i of error.issues) {
        const campo = i.path.join(".") || "general";
        if (!(campo in porCampo)) porCampo[campo] = i.message;
    }
    return { error: "Revisa los datos marcados.", porCampo };
}

const id = z.coerce.number().int().positive();
const vacioEsNada = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const motivo = z.preprocess(vacioEsNada, z.string().trim().max(255, "Máximo 255 caracteres").optional());
const numero = (nombre: string) =>
    z.preprocess(
        (v) => (typeof v === "string" && v.trim() !== "" ? Number(v.replace(",", ".")) : undefined),
        z.number({ error: `Escribe ${nombre}` }).finite(`${nombre} debe ser un número`),
    );

/** Lo que cambia en toda la app al corregir o eliminar un dato. */
const refrescarTodo = () => revalidatePath("/", "layout");

// ---------------------------------------------------------------------------
// Mediciones
// ---------------------------------------------------------------------------

const esquemaMedicion = z.object({
    embarazo_id: id,
    medicion_id: id,
    valor: numero("el valor"),
    motivo,
});

export async function corregirMedicion(
    _previo: ResultadoCorreccion,
    datos: FormData,
): Promise<ResultadoCorreccion> {
    const valido = esquemaMedicion.safeParse(Object.fromEntries(datos));
    if (!valido.success) return errorZod(valido.error);

    const { embarazo_id: e, medicion_id: m, ...cuerpo } = valido.data;
    try {
        const r = await api.patch<{
            medicion: { valor: number };
            alertas: Alerta[];
            alertas_anuladas: number;
        }>(`/embarazos/${e}/mediciones/${m}`, cuerpo);
        return {
            ok: true,
            alertas: r.alertas,
            anuladas: r.alertas_anuladas,
            resumen: `Valor corregido: ${r.medicion.valor}.`,
        };
    } catch (error) {
        return errorDe(error);
    }
}

const esquemaEliminar = z.object({
    embarazo_id: id,
    elemento_id: id,
    motivo,
});

/** Crea la acción de eliminar de un recurso: todas se parecen y cambia solo la ruta. */
function accionEliminar(recurso: string, etiqueta: string, motivoObligatorio = false) {
    return async function eliminar(
        _previo: ResultadoCorreccion,
        datos: FormData,
    ): Promise<ResultadoCorreccion> {
        const valido = esquemaEliminar.safeParse(Object.fromEntries(datos));
        if (!valido.success) return errorZod(valido.error);
        if (motivoObligatorio && !valido.data.motivo) {
            return {
                error: "Revisa los datos marcados.",
                porCampo: { motivo: "Indica por qué se elimina: queda en el historial de la paciente" },
            };
        }

        const { embarazo_id: e, elemento_id: i, motivo: porque } = valido.data;
        try {
            await api.delete(`/embarazos/${e}/${recurso}/${i}`, { motivo: porque });
            refrescarTodo();
            return { ok: true, resumen: `${etiqueta} eliminado.` };
        } catch (error) {
            return errorDe(error);
        }
    };
}

// Las acciones de "use server" deben ser funciones async exportadas directamente.
export async function eliminarMedicion(p: ResultadoCorreccion, d: FormData) {
    return accionEliminar("mediciones", "Registro")(p, d);
}
export async function eliminarSintoma(p: ResultadoCorreccion, d: FormData) {
    return accionEliminar("sintomas", "Síntoma")(p, d);
}
export async function eliminarControl(p: ResultadoCorreccion, d: FormData) {
    return accionEliminar("controles", "Control", true)(p, d);
}
export async function eliminarExamen(p: ResultadoCorreccion, d: FormData) {
    return accionEliminar("examenes", "Examen", true)(p, d);
}

// ---------------------------------------------------------------------------
// Síntomas
// ---------------------------------------------------------------------------

const esquemaSintoma = z.object({
    embarazo_id: id,
    sintoma_id: id,
    tipo: z.preprocess(vacioEsNada, z.string().trim().toUpperCase().optional()),
    intensidad: z.preprocess(
        // "" significa "prefiero no indicarla": se envía null para borrarla.
        (v) => (typeof v === "string" ? (v.trim() === "" ? null : Number(v)) : undefined),
        z.number().int().min(1).max(5).nullable().optional(),
    ),
    observaciones: motivo,
});

export async function corregirSintoma(
    _previo: ResultadoCorreccion,
    datos: FormData,
): Promise<ResultadoCorreccion> {
    const valido = esquemaSintoma.safeParse(Object.fromEntries(datos));
    if (!valido.success) return errorZod(valido.error);

    const { embarazo_id: e, sintoma_id: s, ...cuerpo } = valido.data;
    try {
        const r = await api.patch<Sintoma & { alertas_anuladas: number }>(
            `/embarazos/${e}/sintomas/${s}`,
            cuerpo,
        );
        return {
            ok: true,
            alertas: r.alerta ? [r.alerta] : [],
            anuladas: r.alertas_anuladas,
            resumen: "Síntoma corregido.",
        };
    } catch (error) {
        return errorDe(error);
    }
}

// ---------------------------------------------------------------------------
// Controles y exámenes (profesional)
// ---------------------------------------------------------------------------

const esquemaControl = z.object({
    embarazo_id: id,
    control_id: id,
    observaciones: z.preprocess(vacioEsNada, z.string().trim().max(4000, "Máximo 4000 caracteres").optional()),
    motivo: z.preprocess(
        vacioEsNada,
        // `error` cubre el campo ausente; `min`, el que llega con muy poco texto.
        z.string({ error: "Indica por qué corriges este control" }).trim().min(3, "Indica por qué corriges este control").max(255),
    ),
});

export async function corregirControl(
    _previo: ResultadoCorreccion,
    datos: FormData,
): Promise<ResultadoCorreccion> {
    const valido = esquemaControl.safeParse(Object.fromEntries(datos));
    if (!valido.success) return errorZod(valido.error);

    // Una fila por medición del control: su valor nuevo, o "quitar" para eliminarla.
    const tipos = datos.getAll("medicion_tipo").map(String);
    const valores = datos.getAll("medicion_valor").map(String);
    const quitar = new Set(datos.getAll("medicion_quitar").map(String));

    const mediciones: { tipo: string; valor: number | null }[] = [];
    for (let i = 0; i < tipos.length; i++) {
        const tipo = tipos[i];
        if (quitar.has(tipo)) {
            mediciones.push({ tipo, valor: null });
            continue;
        }
        const crudo = valores[i]?.trim().replace(",", ".");
        if (!crudo) continue;
        const valor = Number(crudo);
        if (!Number.isFinite(valor)) {
            return { error: "Revisa los datos marcados.", porCampo: { [`medicion_${tipo}`]: "Debe ser un número" } };
        }
        mediciones.push({ tipo, valor });
    }

    const { embarazo_id: e, control_id: c, observaciones, motivo: porque } = valido.data;
    try {
        const r = await api.patch<Control & { alertas_anuladas: number }>(`/embarazos/${e}/controles/${c}`, {
            observaciones,
            mediciones,
            motivo: porque,
        });
        return {
            ok: true,
            alertas: r.alertas ?? [],
            anuladas: r.alertas_anuladas,
            resumen: "Control corregido.",
        };
    } catch (error) {
        return errorDe(error);
    }
}

const esquemaExamen = z.object({
    embarazo_id: id,
    examen_id: id,
    resultado: z.preprocess(vacioEsNada, z.string({ error: "Escribe el resultado" }).trim().min(1, "Escribe el resultado").max(4000)),
    observaciones: z.preprocess(vacioEsNada, z.string().trim().max(4000).optional()),
    motivo: z.preprocess(
        vacioEsNada,
        z.string({ error: "Indica por qué corriges este examen" }).trim().min(3, "Indica por qué corriges este examen").max(255),
    ),
});

export async function corregirExamen(
    _previo: ResultadoCorreccion,
    datos: FormData,
): Promise<ResultadoCorreccion> {
    const valido = esquemaExamen.safeParse(Object.fromEntries(datos));
    if (!valido.success) return errorZod(valido.error);

    const { embarazo_id: e, examen_id: x, ...cuerpo } = valido.data;
    try {
        const r = await api.patch<Examen>(`/embarazos/${e}/examenes/${x}`, cuerpo);
        return { ok: true, resumen: `${r.tipo_nombre} corregido.` };
    } catch (error) {
        return errorDe(error);
    }
}
