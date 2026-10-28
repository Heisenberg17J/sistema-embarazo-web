"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ErrorApi, api } from "@/lib/api";
import type { Alerta, Cita, Control, Examen } from "@/lib/tipos";
import { hoyLocal } from "@/lib/formato";

/**
 * Acciones del profesional de salud.
 *
 * Ninguna llama a `revalidatePath`: hacerlo desde dentro de la acción remonta
 * el diálogo que la invocó y borra su estado, así que el resultado (sobre todo
 * las alertas que genera un control) no llega a verse. El refresco lo pide el
 * cliente cuando ya lo mostró.
 */

export interface ResultadoAccion {
    ok?: boolean;
    error?: string;
    porCampo?: Record<string, string>;
    resumen?: string;
    /** Alertas que generó el registro (RF-11). */
    alertas?: Alerta[];
    /** Valores escritos, para repintar el formulario tras un error. */
    valores?: Record<string, string>;
}

function valoresDe(datos: FormData): Record<string, string> {
    const valores: Record<string, string> = {};
    for (const [clave, valor] of datos.entries()) {
        if (typeof valor === "string" && !clave.startsWith("medicion_")) {
            valores[clave] = valor;
        }
    }
    return valores;
}

function aResultado(error: unknown, datos: FormData): ResultadoAccion {
    const valores = valoresDe(datos);
    if (error instanceof ErrorApi) {
        const porCampo = error.porCampo;
        return Object.keys(porCampo).length
            ? { error: "Revisa los datos marcados.", porCampo, valores }
            : { error: error.message, valores };
    }
    return { error: "No se pudo guardar. Intenta de nuevo.", valores };
}

function aResultadoZod(error: z.ZodError, datos: FormData): ResultadoAccion {
    return {
        error: "Revisa los datos marcados.",
        porCampo: Object.fromEntries(
            error.issues.map((i) => [i.path.join(".") || "general", i.message]),
        ),
        valores: valoresDe(datos),
    };
}

const id = z.coerce.number().int().positive();
const fecha = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Indica la fecha")
    .refine((v) => v <= hoyLocal(), "La fecha no puede ser futura");
const opcional = (max: number) =>
    z.preprocess(
        (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
        z.string().trim().max(max, `Máximo ${max} caracteres`).optional(),
    );

// ---------------------------------------------------------------------------
// Control prenatal con sus mediciones (RF-05)
// ---------------------------------------------------------------------------

const esquemaControl = z.object({
    embarazo_id: id,
    cita_id: z.preprocess(
        (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
        id.optional(),
    ),
    fecha: z.preprocess(
        (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
        fecha.optional(),
    ),
    observaciones: opcional(4000),
});

/** Lee las filas de medición, que vienen como campos repetidos. */
function leerMediciones(datos: FormData) {
    const tipos = datos.getAll("medicion_tipo").map(String);
    const valores = datos.getAll("medicion_valor").map(String);

    const mediciones: { tipo: string; valor: number }[] = [];
    for (let i = 0; i < tipos.length; i++) {
        const tipo = tipos[i]?.trim();
        const crudo = valores[i]?.trim().replace(",", ".");
        // Una fila que quedó sin llenar simplemente no se envía.
        if (!tipo || !crudo) continue;
        const valor = Number(crudo);
        if (!Number.isFinite(valor)) {
            return { error: `El valor de ${tipo} no es un número` as string };
        }
        mediciones.push({ tipo, valor });
    }

    const repetidos = mediciones.map((m) => m.tipo);
    if (new Set(repetidos).size !== repetidos.length) {
        return { error: "Hay una medición repetida en la misma toma" };
    }
    return { mediciones };
}

export async function registrarControl(
    _previo: ResultadoAccion,
    datos: FormData,
): Promise<ResultadoAccion> {
    const valido = esquemaControl.safeParse(Object.fromEntries(datos));
    if (!valido.success) return aResultadoZod(valido.error, datos);

    const leidas = leerMediciones(datos);
    if ("error" in leidas) {
        return { error: leidas.error, valores: valoresDe(datos) };
    }

    const { embarazo_id: embarazoId, ...resto } = valido.data;

    try {
        const control = await api.post<Control>(
            `/embarazos/${embarazoId}/controles`,
            { ...resto, mediciones: leidas.mediciones },
        );
        const alertas = control.alertas ?? [];
        return {
            ok: true,
            alertas,
            resumen:
                `Control de la semana ${control.semana_gestacion} registrado` +
                (leidas.mediciones.length
                    ? ` con ${leidas.mediciones.length} ${leidas.mediciones.length === 1 ? "medición" : "mediciones"}.`
                    : "."),
        };
    } catch (error) {
        return aResultado(error, datos);
    }
}

// ---------------------------------------------------------------------------
// Examen (RF-08)
// ---------------------------------------------------------------------------

const esquemaExamen = z.object({
    embarazo_id: id,
    tipo: z.string().trim().min(1, "Elige el tipo de examen"),
    fecha,
    resultado: z.string().trim().min(1, "Escribe el resultado").max(4000),
    observaciones: opcional(4000),
});

export async function registrarExamen(
    _previo: ResultadoAccion,
    datos: FormData,
): Promise<ResultadoAccion> {
    const valido = esquemaExamen.safeParse(Object.fromEntries(datos));
    if (!valido.success) return aResultadoZod(valido.error, datos);

    const { embarazo_id: embarazoId, ...cuerpo } = valido.data;
    try {
        const examen = await api.post<Examen>(
            `/embarazos/${embarazoId}/examenes`,
            cuerpo,
        );
        return { ok: true, resumen: `${examen.tipo_nombre} registrado.` };
    } catch (error) {
        return aResultado(error, datos);
    }
}

// ---------------------------------------------------------------------------
// Citas (RF-07)
// ---------------------------------------------------------------------------

const hora = z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Indica la hora en formato HH:MM");

const esquemaCita = z.object({
    embarazo_id: id,
    tipo_control: z.string().trim().min(1, "Elige el tipo de control"),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Indica la fecha"),
    hora,
    duracion_min: z.preprocess(
        (v) => (typeof v === "string" && v.trim() === "" ? undefined : Number(v)),
        z.number().int().min(5).max(240).optional(),
    ),
});

export async function crearCita(
    _previo: ResultadoAccion,
    datos: FormData,
): Promise<ResultadoAccion> {
    const valido = esquemaCita.safeParse(Object.fromEntries(datos));
    if (!valido.success) return aResultadoZod(valido.error, datos);

    const { embarazo_id: embarazoId, ...cuerpo } = valido.data;
    try {
        const cita = await api.post<Cita>(`/embarazos/${embarazoId}/citas`, cuerpo);
        return {
            ok: true,
            resumen: `Cita con ${cita.gestante} el ${cita.fecha} a las ${cita.hora}.`,
        };
    } catch (error) {
        return aResultado(error, datos);
    }
}

const esquemaReprogramar = z
    .object({
        cita_id: id,
        fecha: z.preprocess(
            (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").optional(),
        ),
        hora: z.preprocess(
            (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
            hora.optional(),
        ),
        duracion_min: z.preprocess(
            (v) => (typeof v === "string" && v.trim() === "" ? undefined : Number(v)),
            z.number().int().min(5).max(240).optional(),
        ),
    })
    .refine((d) => d.fecha || d.hora || d.duracion_min, {
        message: "Cambia la fecha, la hora o la duración",
        path: ["fecha"],
    });

export async function reprogramarCita(
    _previo: ResultadoAccion,
    datos: FormData,
): Promise<ResultadoAccion> {
    const valido = esquemaReprogramar.safeParse(Object.fromEntries(datos));
    if (!valido.success) return aResultadoZod(valido.error, datos);

    const { cita_id: citaId, ...cuerpo } = valido.data;
    try {
        const cita = await api.patch<Cita>(`/citas/${citaId}`, cuerpo);
        return { ok: true, resumen: `Reprogramada para el ${cita.fecha} a las ${cita.hora}.` };
    } catch (error) {
        return aResultado(error, datos);
    }
}

const esquemaCerrar = z
    .object({
        cita_id: id,
        estado: z.enum(["CUMPLIDA", "NO_ASISTIO", "CANCELADA"]),
        motivo_cancelacion: opcional(255),
    })
    .refine((d) => d.estado !== "CANCELADA" || d.motivo_cancelacion, {
        message: "Indica por qué se cancela",
        path: ["motivo_cancelacion"],
    });

export async function cerrarCita(
    _previo: ResultadoAccion,
    datos: FormData,
): Promise<ResultadoAccion> {
    const valido = esquemaCerrar.safeParse(Object.fromEntries(datos));
    if (!valido.success) return aResultadoZod(valido.error, datos);

    const { cita_id: citaId, ...cuerpo } = valido.data;
    try {
        await api.patch(`/citas/${citaId}/estado`, cuerpo);
        return { ok: true };
    } catch (error) {
        return aResultado(error, datos);
    }
}

// ---------------------------------------------------------------------------
// Revisión de alertas (RF-12)
// ---------------------------------------------------------------------------

const esquemaRevisar = z.object({
    alerta_id: id,
    estado: z.enum(["REVISADA", "DESCARTADA"]),
    observacion: opcional(255),
});

export async function revisarAlerta(
    _previo: ResultadoAccion,
    datos: FormData,
): Promise<ResultadoAccion> {
    const valido = esquemaRevisar.safeParse(Object.fromEntries(datos));
    if (!valido.success) return aResultadoZod(valido.error, datos);

    const { alerta_id: alertaId, ...cuerpo } = valido.data;
    try {
        await api.patch(`/alertas/${alertaId}/revisar`, cuerpo);
        return {
            ok: true,
            resumen:
                cuerpo.estado === "REVISADA"
                    ? "Alerta marcada como revisada."
                    : "Alerta descartada.",
        };
    } catch (error) {
        return aResultado(error, datos);
    }
}

// ---------------------------------------------------------------------------
// Aprobación clínica de reglas y signos de alarma
// ---------------------------------------------------------------------------

const esquemaAprobar = z.object({
    tipo: z.enum(["regla", "signo"]),
    elemento_id: id,
});

/**
 * Deja constancia de que un profesional de salud avala una regla de alerta o un
 * signo de alarma, con el texto que lee la gestante. Es una acción de un solo
 * paso: revalida para que la lista llegue fresca en la misma respuesta.
 */
export async function aprobarElementoClinico(
    _previo: ResultadoAccion,
    datos: FormData,
): Promise<ResultadoAccion> {
    const valido = esquemaAprobar.safeParse(Object.fromEntries(datos));
    if (!valido.success) return { error: "No se reconoce lo que se quiere aprobar." };

    const { tipo, elemento_id: elementoId } = valido.data;
    const ruta = tipo === "regla" ? "reglas-alerta" : "tipos-sintoma";
    try {
        await api.post(`/catalogos/${ruta}/${elementoId}/aprobar`);
        revalidatePath("/pro", "layout");
        revalidatePath("/admin", "layout");
        return { ok: true };
    } catch (error) {
        return aResultado(error, datos);
    }
}
