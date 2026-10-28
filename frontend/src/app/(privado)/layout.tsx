import { MarcoApp } from "@/components/layout/marco-app";
import { exigirSesion } from "@/lib/sesion-servidor";

/**
 * Marco de todas las pantallas con sesión.
 * El middleware ya bloquea las rutas de otros roles; cada página además llama a
 * `exigirRol` como segunda barrera, y el backend es la autoridad final.
 */
export default async function LayoutPrivado({
    children,
}: {
    children: React.ReactNode;
}) {
    const sesion = await exigirSesion();
    return <MarcoApp sesion={sesion}>{children}</MarcoApp>;
}
