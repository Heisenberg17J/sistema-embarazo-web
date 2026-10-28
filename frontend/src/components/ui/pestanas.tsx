import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { unParam } from "@/components/ui/filtros";
import { cn } from "@/lib/utils";

export interface Pestana {
    valor: string;
    texto: string;
    icono?: LucideIcon;
    /** Número que se muestra al lado, por ejemplo las alertas sin revisar. */
    contador?: number;
}

/**
 * Pestañas de una ficha. Como los filtros, son enlaces con el valor explícito
 * en la URL: se pueden compartir, el botón "atrás" funciona y no dependen de
 * JavaScript.
 */
export function Pestanas({
    ruta,
    params,
    nombre = "seccion",
    pestanas,
    etiqueta,
    className,
}: {
    ruta: string;
    params: Record<string, string | string[] | undefined>;
    nombre?: string;
    pestanas: Pestana[];
    etiqueta: string;
    className?: string;
}) {
    const actual = unParam(params, nombre) ?? pestanas[0]?.valor;

    const href = (valor: string) => {
        const sp = new URLSearchParams();
        for (const [clave, v] of Object.entries(params)) {
            // Cambiar de pestaña descarta los filtros y la página de la anterior.
            if (clave === nombre || clave === "page" || v === undefined) continue;
            sp.set(clave, Array.isArray(v) ? v[0] : v);
        }
        sp.set(nombre, valor);
        return `${ruta}?${sp.toString()}`;
    };

    return (
        <nav
            aria-label={etiqueta}
            className={cn("-mx-1 overflow-x-auto px-1 pb-1", className)}
        >
            <ul className="flex w-max min-w-full gap-1">
                {pestanas.map((p) => {
                    const activa = actual === p.valor;
                    return (
                        <li key={p.valor}>
                            <Link
                                href={href(p.valor)}
                                // Se cambia de sección sin salir de la ficha: no se sube al inicio.
                                scroll={false}
                                aria-current={activa ? "page" : undefined}
                                className={cn(
                                    "inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                                    activa
                                        ? "bg-surface-strong text-brand-deep"
                                        : "text-muted-foreground hover:bg-surface-soft hover:text-foreground",
                                )}
                            >
                                {p.icono && <p.icono className="size-4" aria-hidden />}
                                {p.texto}
                                {p.contador != null && p.contador > 0 && (
                                    <span className="rounded-full bg-critica-suave px-2 py-0.5 text-[11px] font-bold text-critica">
                                        {p.contador}
                                    </span>
                                )}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

/** Pestaña activa, validada contra las disponibles. */
export const pestanaActiva = (
    params: Record<string, string | string[] | undefined>,
    pestanas: readonly string[],
    nombre = "seccion",
) => {
    const valor = unParam(params, nombre);
    return valor && pestanas.includes(valor) ? valor : pestanas[0];
};
