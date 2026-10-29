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
                            "relative isolate inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                            activo
                                ? "text-brand-deep"
                                : "text-muted-foreground hover:bg-surface-soft hover:text-foreground",
                        )}
                    >
                        {activo && (
                            <span
                                aria-hidden
                                className="absolute inset-0 -z-10 rounded-full bg-surface-strong animate-[aparecer-escala_var(--dur-base)_var(--ease-out)]"
                            />
                        )}
                        <item.icono
                            className={cn(
                                "size-4",
                                activo && "animate-[rebote-icono_320ms_var(--ease-out)]",
                            )}
                            aria-hidden
                        />
                        {item.texto}
                    </Link>
                );
            })}
        </nav>
    );
}
