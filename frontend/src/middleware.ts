import { NextResponse, type NextRequest } from "next/server";
import { porExpirar } from "@/lib/jwt";
import {
    COOKIES,
    PREFIJOS_ROL,
    RUTAS_COMUNES,
    RUTA_INICIO,
    SEG_REFRESH,
    decodificarSesion,
    opcionesCookie,
    type Sesion,
} from "@/lib/sesion";
import type { Rol } from "@/lib/tipos";

const API_URL = process.env.API_URL ?? "http://localhost:4000/api/v1";

const RUTAS_PUBLICAS = ["/login", "/registro"];

/** Minutos de vida del token de acceso; el backend emite 15 min. */
const MARGEN_RENOVACION_SEG = 60;

type CambioCookie =
    | { accion: "set"; nombre: string; valor: string; httpOnly: boolean }
    | { accion: "borrar"; nombre: string };

/** Aplica a la respuesta final las cookies que haya que crear o borrar. */
const aplicar = (respuesta: NextResponse, cambios: CambioCookie[]) => {
    for (const c of cambios) {
        if (c.accion === "borrar") {
            respuesta.cookies.set(c.nombre, "", { ...opcionesCookie(0), maxAge: 0 });
        } else {
            respuesta.cookies.set(
                c.nombre,
                c.valor,
                opcionesCookie(SEG_REFRESH, c.httpOnly),
            );
        }
    }
    return respuesta;
};

export async function middleware(req: NextRequest) {
    const { pathname, search } = req.nextUrl;
    const cambios: CambioCookie[] = [];

    let acceso = req.cookies.get(COOKIES.acceso)?.value;
    const refresh = req.cookies.get(COOKIES.refresh)?.value;
    let sesion: Sesion | null = decodificarSesion(
        req.cookies.get(COOKIES.sesion)?.value,
    );

    // Next precarga los enlaces visibles. Esas peticiones no deben renovar el
    // token: el backend rota el refresh token en cada uso y varias renovaciones
    // en paralelo se invalidarían entre sí.
    const esPrecarga = req.headers.get("next-router-prefetch") === "1";

    // --- Renovación del token (único punto de la app que la hace) -----------
    if (refresh && !esPrecarga && porExpirar(acceso, MARGEN_RENOVACION_SEG)) {
        try {
            const r = await fetch(`${API_URL}/auth/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh_token: refresh }),
                cache: "no-store",
            });
            if (r.ok) {
                const datos = (await r.json()) as {
                    access_token: string;
                    refresh_token: string;
                };
                acceso = datos.access_token;
                cambios.push(
                    { accion: "set", nombre: COOKIES.acceso, valor: datos.access_token, httpOnly: true },
                    { accion: "set", nombre: COOKIES.refresh, valor: datos.refresh_token, httpOnly: true },
                );
            } else if (r.status === 401) {
                // La sesión ya no sirve: se limpia y se vuelve a pedir acceso.
                acceso = undefined;
                sesion = null;
                cambios.push(
                    { accion: "borrar", nombre: COOKIES.acceso },
                    { accion: "borrar", nombre: COOKIES.refresh },
                    { accion: "borrar", nombre: COOKIES.sesion },
                );
            }
            // Si la API no responde (503, red caída) se deja pasar: la pantalla
            // mostrará el error de conexión en lugar de expulsar al usuario.
        } catch {
            // Igual que arriba: no se cierra la sesión por un fallo de red.
        }
    }

    const haySesion = Boolean(acceso && sesion);
    const esPublica = RUTAS_PUBLICAS.some(
        (r) => pathname === r || pathname.startsWith(`${r}/`),
    );

    // --- Sin sesión ---------------------------------------------------------
    if (!haySesion) {
        if (esPublica) return aplicar(NextResponse.next(), cambios);
        const destino = req.nextUrl.clone();
        destino.pathname = "/login";
        destino.search = "";
        if (pathname !== "/") {
            destino.searchParams.set("siguiente", `${pathname}${search}`);
        }
        return aplicar(NextResponse.redirect(destino), cambios);
    }

    const rol = sesion!.rol;
    const irA = (ruta: string) => {
        const destino = req.nextUrl.clone();
        destino.pathname = ruta;
        destino.search = "";
        return aplicar(NextResponse.redirect(destino), cambios);
    };

    // --- Con sesión --------------------------------------------------------
    if (esPublica || pathname === "/") return irA(RUTA_INICIO[rol]);

    // Contraseña temporal: no se puede usar la app hasta cambiarla. El backend
    // responde 403 en todas sus rutas, aquí se evita el viaje en balde.
    if (sesion!.cambio && pathname !== "/cambiar-contrasena") {
        return irA("/cambiar-contrasena");
    }

    // Guardián por rol. Es una ayuda de navegación: la autorización real la
    // aplica el backend en cada endpoint (RNF-02).
    if (!RUTAS_COMUNES.some((r) => pathname.startsWith(r))) {
        const ajenas = (Object.keys(PREFIJOS_ROL) as Rol[])
            .filter((r) => r !== rol)
            .flatMap((r) => PREFIJOS_ROL[r]);
        if (ajenas.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
            return irA(RUTA_INICIO[rol]);
        }
    }

    return aplicar(NextResponse.next(), cambios);
}

export const config = {
    // Se excluyen los recursos estáticos y las rutas de API internas.
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico|icono.svg|robots.txt|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
    ],
};
