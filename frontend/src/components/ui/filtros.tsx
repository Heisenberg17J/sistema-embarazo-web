import Link from "next/link";
import { cn } from "@/lib/utils";

export interface OpcionFiltro {
    valor: string;
    texto: string;
}

/**
 * Valor que representa "sin filtrar".
 *
 * Va explícito en la URL (`?tipo=todos`) en lugar de quitar el parámetro: un
 * enlace a la ruta desnuda, estando ya en esa ruta con parámetros, no navega a
 * la primera pulsación, y la usuaria se queda viendo el filtro anterior.
 */
export const TODOS = "todos";

/**
 * Filtros en pastilla. Son enlaces que escriben en la URL: funcionan sin
 * JavaScript, se pueden compartir y el botón "atrás" del navegador los deshace.
 */
export function Filtros({
    ruta,
    params,
    nombre,
    opciones,
    etiqueta,
    textoTodos,
    porDefecto,
    className,
}: {
    ruta: string;
    params: Record<string, string | string[] | undefined>;
    /** Clave del searchParam que controla este grupo. */
    nombre: string;
    opciones: OpcionFiltro[];
    etiqueta: string;
    /** Si se indica, aparece una pastilla inicial que quita el filtro. */
    textoTodos?: string;
    /** Opción activa cuando la URL todavía no trae el parámetro. */
    porDefecto?: string;
    className?: string;
}) {
    const actual = unParam(params, nombre) ?? porDefecto ?? TODOS;

    const href = (valor: string) => {
        const sp = new URLSearchParams();
        for (const [clave, v] of Object.entries(params)) {
            // Al cambiar de filtro se vuelve a la primera página.
            if (clave === nombre || clave === "page" || v === undefined) continue;
            sp.set(clave, Array.isArray(v) ? v[0] : v);
        }
        sp.set(nombre, valor);
        return `${ruta}?${sp.toString()}`;
    };

    const pastilla = (activo: boolean) =>
        cn(
            "inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition-colors",
            activo
                ? "bg-primary text-primary-foreground"
                : "glass-soft text-muted-foreground hover:bg-surface-strong hover:text-foreground",
        );

    const todas: OpcionFiltro[] = textoTodos
        ? [{ valor: TODOS, texto: textoTodos }, ...opciones]
        : opciones;

    return (
        <div
            role="group"
            aria-label={etiqueta}
            className={cn("flex flex-wrap gap-2", className)}
        >
            {todas.map((o) => (
                <Link
                    key={o.valor}
                    href={href(o.valor)}
                    // Cambiar de filtro no es cambiar de pantalla: no se sube al inicio.
                    scroll={false}
                    aria-current={actual === o.valor ? "true" : undefined}
                    className={pastilla(actual === o.valor)}
                >
                    {o.texto}
                </Link>
            ))}
        </div>
    );
}

/** Lee un searchParam que puede venir repetido. */
export const unParam = (
    params: Record<string, string | string[] | undefined>,
    nombre: string,
) => {
    const v = params[nombre];
    return Array.isArray(v) ? v[0] : v;
};

/** Valor del filtro, o undefined si está en "todos" o no es válido. */
export const filtroValido = (
    params: Record<string, string | string[] | undefined>,
    nombre: string,
    permitidos: readonly string[],
) => {
    const valor = unParam(params, nombre);
    return valor && valor !== TODOS && permitidos.includes(valor) ? valor : undefined;
};
