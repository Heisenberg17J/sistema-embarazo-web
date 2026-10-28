"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVEGACION, esRutaActiva } from "@/lib/navegacion";
import type { Rol } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/**
 * Pestañas en pastilla del encabezado. Se ocultan en móvil (barra inferior).
 *
 * Recibe el rol y no la lista de secciones: los iconos son componentes y un
 * componente no se puede pasar como prop de un Server Component a uno de
 * cliente, así que la lista se importa aquí.
 */
export function NavEscritorio({ rol }: { rol: Rol }) {
    const ruta = usePathname();
    const items = NAVEGACION[rol].principales;

    return (
        <nav aria-label="Secciones" className="hidden items-center gap-1 md:flex">
            {items.map((item) => {
                const activo = esRutaActiva(item.href, ruta);
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        aria-current={activo ? "page" : undefined}
                        className={cn(
                            "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                            activo
                                ? "bg-surface-strong text-brand-deep"
                                : "text-muted-foreground hover:bg-surface-soft hover:text-foreground",
                        )}
                    >
                        <item.icono className="size-4" aria-hidden />
                        {item.texto}
                    </Link>
                );
            })}
        </nav>
    );
}
