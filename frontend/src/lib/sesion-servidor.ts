import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
    COOKIES,
    RUTA_INICIO,
    decodificarSesion,
    type Sesion,
} from "./sesion";
import type { Rol } from "./tipos";

/** Lee la sesión en un Server Component. Devuelve null si no hay. */
export async function leerSesion(): Promise<Sesion | null> {
    const tarro = await cookies();
    if (!tarro.get(COOKIES.acceso)?.value) return null;
    return decodificarSesion(tarro.get(COOKIES.sesion)?.value);
}

/** Exige sesión; si no hay, manda al login. */
export async function exigirSesion(): Promise<Sesion> {
    const sesion = await leerSesion();
    if (!sesion) redirect("/login");
    if (sesion.cambio) redirect("/cambiar-contrasena");
    return sesion;
}

/** Exige sesión con uno de los roles indicados. */
export async function exigirRol(...roles: Rol[]): Promise<Sesion> {
    const sesion = await exigirSesion();
    if (!roles.includes(sesion.rol)) redirect(RUTA_INICIO[sesion.rol]);
    return sesion;
}
