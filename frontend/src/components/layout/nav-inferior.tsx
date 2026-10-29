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
                                    "flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-semibold transition-colors",
                                    activo ? "text-brand-deep" : "text-muted-foreground",
                                )}
                            >
                                <item.icono className="size-6" aria-hidden />
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
                                "flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-semibold transition-colors",
                                enSecundario ? "text-brand-deep" : "text-muted-foreground",
                            )}
                        >
                            <MoreHorizontal className="size-6" aria-hidden />
                            <span>Más</span>
                        </Link>
                    </li>
                )}
            </ul>
        </nav>
    );
}
