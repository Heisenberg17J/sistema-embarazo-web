import type { Rol, Usuario } from "./tipos";

/**
 * Parte de la sesión que no depende de Node ni de `next/headers`, para que
 * también pueda usarse desde `middleware.ts` (que corre en el runtime Edge).
 *
 * `acceso` y `refresh` son cookies httpOnly: el JavaScript del navegador nunca
 * las ve, así un fallo de XSS no entrega la sesión ni los datos clínicos
 * (RNF-03).
 *
 * `sesion` SÍ es legible: guarda el rol y el nombre para pintar el encabezado y
 * orientar la navegación sin pedir datos a la API. No es una frontera de
 * seguridad; si alguien la manipula, la API seguirá respondiendo 401 o 403
 * porque la autoridad es el token firmado.
 */
export const COOKIES = {
    acceso: "se_acceso",
    refresh: "se_refresh",
    sesion: "se_sesion",
} as const;

export interface Sesion {
    id: number;
    rol: Rol;
    nombre: string;
    apellido: string;
    /** El usuario entró con una contraseña temporal y debe cambiarla. */
    cambio: boolean;
}

/** Pantalla inicial de cada rol. */
export const RUTA_INICIO: Record<Rol, string> = {
    GESTANTE: "/panel",
    PROFESIONAL: "/pro",
    ADMINISTRADOR: "/admin",
};

/** Prefijo de ruta reservado a cada rol, para el guardián del middleware. */
export const PREFIJOS_ROL: Record<Rol, string[]> = {
    GESTANTE: [
        "/panel",
        "/citas",
        "/evolucion",
        "/sintomas",
        "/examenes",
        "/historial",
        "/alertas",
        "/aprendizaje",
        "/embarazo",
    ],
    PROFESIONAL: ["/pro"],
    ADMINISTRADOR: ["/admin"],
};

/** Rutas accesibles con cualquier rol. */
export const RUTAS_COMUNES = ["/perfil", "/cambiar-contrasena"];

// Codificación base64url que funciona igual en Node y en Edge, y soporta
// tildes y eñes (btoa por sí solo falla con caracteres fuera de Latin-1).
const aBase64Url = (texto: string) => {
    const bytes = new TextEncoder().encode(texto);
    let binario = "";
    for (const b of bytes) binario += String.fromCharCode(b);
    return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const deBase64Url = (valor: string) => {
    const binario = atob(valor.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
};

export const codificarSesion = (usuario: Usuario): string =>
    aBase64Url(
        JSON.stringify({
            id: usuario.id,
            rol: usuario.rol,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            cambio: usuario.debe_cambiar_contrasena,
        } satisfies Sesion),
    );

export const decodificarSesion = (valor: string | undefined): Sesion | null => {
    if (!valor) return null;
    try {
        const sesion = JSON.parse(deBase64Url(valor)) as Sesion;
        return sesion.rol in RUTA_INICIO ? sesion : null;
    } catch {
        return null;
    }
};

/** Opciones comunes de las cookies de sesión. */
export const opcionesCookie = (maxEdadSeg: number, httpOnly = true) =>
    ({
        httpOnly,
        sameSite: "lax" as const,
        // En producción la app va por HTTPS (RNF-04); en desarrollo es http.
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: maxEdadSeg,
    }) as const;

/** Vigencia de las cookies, alineada con REFRESH_DIAS del backend. */
export const DIAS_REFRESH = Number(process.env.REFRESH_DIAS ?? 7);
export const SEG_REFRESH = DIAS_REFRESH * 24 * 60 * 60;
