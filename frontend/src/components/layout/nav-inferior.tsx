"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { NAVEGACION, esRutaActiva } from "@/lib/navegacion";
import type { Rol } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/**
 * Barra inferior en móvil. Va abajo porque es donde alcanza el pulgar:
 * la gestante usa la app de pie, con una mano y a veces con malestar.
 */
export function NavInferior({ rol }: { rol: Rol }) {
    const ruta = usePathname();
    const { principales: items, secundarios } = NAVEGACION[rol];
    const enSecundario = secundarios.some((i) => esRutaActiva(i.href, ruta));

    return (
        <nav
            aria-label="Secciones"
            className="glass fixed inset-x-0 bottom-0 z-40 rounded-t-3xl border-b-0 pb-[env(safe-area-inset-bottom)] md:hidden"
        >
            <ul className="flex items-stretch justify-around">
                {items.map((item) => {
                    const activo = esRutaActiva(item.href, ruta);
                    return (
                        <li key={item.href} className="flex-1">
                            <Link
                                href={item.href}
                                aria-current={activo ? "page" : undefined}
                                className={cn(
                                    "relative isolate flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-semibold transition-colors",
                                    activo ? "text-brand-deep" : "text-muted-foreground",
                                )}
                            >
                                {activo && <Pastilla />}
                                <item.icono
                                    className={cn(
                                        "size-6",
                                        activo && "animate-[rebote-icono_320ms_var(--ease-out)]",
                                    )}
                                    aria-hidden
                                />
                                <span className="truncate">{item.corto ?? item.texto}</span>
                            </Link>
                        </li>
                    );
                })}
                {secundarios.length > 0 && (
                    <li className="flex-1">
                        <Link
                            href="/mas"
                            aria-current={enSecundario ? "page" : undefined}
                            className={cn(
                                "relative isolate flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-semibold transition-colors",
                                enSecundario ? "text-brand-deep" : "text-muted-foreground",
                            )}
                        >
                            {enSecundario && <Pastilla />}
                            <MoreHorizontal
                                className={cn(
                                    "size-6",
                                    enSecundario && "animate-[rebote-icono_320ms_var(--ease-out)]",
                                )}
                                aria-hidden
                            />
                            <span>Más</span>
                        </Link>
                    </li>
                )}
            </ul>
        </nav>
    );
}

/** Fondo del ítem activo: nace al montarse, o sea al pasar a ser el activo. */
function Pastilla() {
    return (
        <span
            aria-hidden
            className="absolute inset-x-2 inset-y-1.5 -z-10 rounded-2xl bg-surface-strong animate-[aparecer-escala_var(--dur-base)_var(--ease-out)]"
        />
    );
}
