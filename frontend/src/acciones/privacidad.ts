"use server";

import { z } from "zod";
import { ErrorApi, api } from "@/lib/api";
import { hoyLocal } from "@/lib/formato";

/**
 * Derechos del titular de los datos (Ley 1581): consulta y supresión.
 *
 * Ninguna llama a `revalidatePath`: el diálogo que las invoca pide
 * `router.refresh()` al cerrarse (ver `DialogoAccion`).
 */

export interface ResultadoDescarga {
    contenido?: string;
    nombre?: string;
    error?: string;
}

/**
 * Devuelve el archivo como texto y el navegador lo guarda. Va como acción y no
 * como enlace a una ruta porque el token de sesión es una cookie httpOnly: una
 * acción pasa por el middleware, que renueva el token si hace falta.
 */
export async function descargarMisDatos(): Promise<ResultadoDescarga> {
    try {
        const datos = await api.get<unknown>("/auth/mis-datos");
        return {
            contenido: JSON.stringify(datos, null, 2),
            nombre: `mis-datos-${hoyLocal()}.json`,
        };
    } catch (error) {
        return {
            error:
                error instanceof ErrorApi
                    ? error.message
                    : "No se pudo preparar la descarga. Intenta de nuevo.",
        };
    }
}

export interface ResultadoSupresion {
    ok?: boolean;
    error?: string;
    porCampo?: Record<string, string>;
    valores?: Record<string, string>;
}

const esquema = z.object({
    motivo: z.preprocess(
        (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
        z.string().trim().max(500, "Máximo 500 caracteres").optional(),
    ),
});

export async function solicitarSupresion(
    _previo: ResultadoSupresion,
    datos: FormData,
): Promise<ResultadoSupresion> {
    const valido = esquema.safeParse(Object.fromEntries(datos));
    if (!valido.success) {
        return {
            error: "Revisa los datos marcados.",
            porCampo: Object.fromEntries(valido.error.issues.map((i) => [i.path.join("."), i.message])),
            valores: { motivo: String(datos.get("motivo") ?? "") },
        };
    }

    try {
        await api.post("/auth/solicitud-supresion", valido.data);
        return { ok: true };
    } catch (error) {
        return {
            error: error instanceof ErrorApi ? error.message : "No se pudo enviar la solicitud. Intenta de nuevo.",
            valores: { motivo: String(datos.get("motivo") ?? "") },
        };
    }
}
