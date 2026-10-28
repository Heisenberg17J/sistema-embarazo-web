import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";
import { cerrarSesion } from "@/acciones/auth";
import { Saludo } from "@/components/layout/saludo";
import { Boton } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";
import { NAVEGACION, ROL_TEXTO } from "@/lib/navegacion";
import { exigirSesion } from "@/lib/sesion-servidor";

export const metadata: Metadata = { title: "Más" };

/** Secciones secundarias. En móvil es la pestaña "Más" de la barra inferior. */
export default async function PaginaMas() {
    const sesion = await exigirSesion();
    const { secundarios } = NAVEGACION[sesion.rol];

    return (
        <>
            <Saludo
                titulo="Más opciones"
                subtitulo={`${sesion.nombre} ${sesion.apellido} · ${ROL_TEXTO[sesion.rol]}`}
            />

            <Tarjeta className="p-2 sm:p-2">
                <ul>
                    {secundarios.map((item) => (
                        <li key={item.href}>
                            <Link
                                href={item.href}
                                className="flex items-center gap-3 rounded-2xl px-4 py-4 transition-colors hover:bg-surface-soft"
                            >
                                <item.icono
                                    className="size-5 shrink-0 text-brand-deep"
                                    aria-hidden
                                />
                                <span className="flex-1 font-medium">{item.texto}</span>
                                <ChevronRight
                                    className="size-4 shrink-0 text-muted-foreground"
                                    aria-hidden
                                />
                            </Link>
                        </li>
                    ))}
                </ul>
            </Tarjeta>

            <form action={cerrarSesion} className="mt-4">
                <Boton type="submit" variante="vidrio" ancho="completo" tamano="lg">
                    <LogOut aria-hidden />
                    Cerrar sesión
                </Boton>
            </form>
        </>
    );
}
