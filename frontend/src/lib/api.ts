import { cookies } from "next/headers";
import { COOKIES } from "./sesion";

/**
 * Cliente de la API para código de servidor (Server Components y Server
 * Actions). El token sale de la cookie httpOnly y nunca llega al navegador.
 *
 * La renovación del token ocurre en `middleware.ts`, antes de que corra este
 * código, así que aquí un 401 significa que la sesión ya no sirve.
 */

export const API_URL = process.env.API_URL ?? "http://localhost:4000/api/v1";

export interface DetalleCampo {
    campo: string;
    mensaje: string;
}

export class ErrorApi extends Error {
    constructor(
        readonly status: number,
        mensaje: string,
        readonly detalles?: DetalleCampo[] | Record<string, unknown>,
    ) {
        super(mensaje);
        this.name = "ErrorApi";
    }

    /** Errores por campo, para pintarlos junto a cada input. */
    get porCampo(): Record<string, string> {
        if (!Array.isArray(this.detalles)) return {};
        return Object.fromEntries(
            this.detalles.map((d) => [d.campo, d.mensaje]),
        );
    }

    get esSesionInvalida() {
        return this.status === 401;
    }
}

type Opciones = Omit<RequestInit, "body"> & {
    body?: unknown;
    /** Segundos de caché. Por defecto no se cachea: son datos clínicos. */
    revalidar?: number;
    /** Permite llamar sin token (login, registro). */
    sinToken?: boolean;
};

async function pedir<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
    const { body, revalidar, sinToken, headers, ...resto } = opciones;

    const cabeceras = new Headers(headers);
    if (body !== undefined) cabeceras.set("Content-Type", "application/json");

    if (!sinToken) {
        const token = (await cookies()).get(COOKIES.acceso)?.value;
        if (!token) throw new ErrorApi(401, "Se requiere iniciar sesión");
        cabeceras.set("Authorization", `Bearer ${token}`);
    }

    let respuesta: Response;
    try {
        respuesta = await fetch(`${API_URL}${ruta}`, {
            ...resto,
            headers: cabeceras,
            body: body === undefined ? undefined : JSON.stringify(body),
            cache: revalidar ? undefined : "no-store",
            next: revalidar ? { revalidate: revalidar } : undefined,
        });
    } catch {
        throw new ErrorApi(
            503,
            "No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.",
        );
    }

    if (respuesta.status === 204) return undefined as T;

    const texto = await respuesta.text();
    let cuerpo: unknown = null;
    if (texto) {
        try {
            cuerpo = JSON.parse(texto);
        } catch {
            cuerpo = null;
        }
    }

    if (!respuesta.ok) {
        const datos = (cuerpo ?? {}) as { error?: string; detalles?: unknown };
        throw new ErrorApi(
            respuesta.status,
            datos.error ?? "Ocurrió un error inesperado",
            datos.detalles as DetalleCampo[] | undefined,
        );
    }

    return cuerpo as T;
}

export const api = {
    get: <T>(ruta: string, opciones?: Opciones) =>
        pedir<T>(ruta, { ...opciones, method: "GET" }),
    post: <T>(ruta: string, body?: unknown, opciones?: Opciones) =>
        pedir<T>(ruta, { ...opciones, method: "POST", body }),
    patch: <T>(ruta: string, body?: unknown, opciones?: Opciones) =>
        pedir<T>(ruta, { ...opciones, method: "PATCH", body }),
    /** El motivo de eliminar un registro clínico viaja en el cuerpo. */
    delete: <T>(ruta: string, body?: unknown, opciones?: Opciones) =>
        pedir<T>(ruta, { ...opciones, method: "DELETE", body }),
};

/**
 * Igual que `api.get` pero devuelve null en lugar de lanzar cuando el recurso
 * no existe o no es accesible. El backend responde 404 también cuando el
 * usuario no tiene permiso, para no revelar que el dato existe.
 */
export async function obtenerONulo<T>(
    ruta: string,
    opciones?: Opciones,
): Promise<T | null> {
    try {
        return await api.get<T>(ruta, opciones);
    } catch (error) {
        if (error instanceof ErrorApi && error.status === 404) return null;
        throw error;
    }
}

/** Convierte un objeto en query string, omitiendo lo vacío. */
export const consulta = (params: Record<string, unknown>) => {
    const sp = new URLSearchParams();
    for (const [clave, valor] of Object.entries(params)) {
        if (valor === undefined || valor === null || valor === "") continue;
        sp.set(clave, String(valor));
    }
    const s = sp.toString();
    return s ? `?${s}` : "";
};
