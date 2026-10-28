import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DatosPaginacion {
    page: number;
    limit: number;
    total: number;
    paginas: number;
}

/**
 * Navegación entre páginas. Son enlaces normales que escriben en la URL, así
 * que funcionan sin JavaScript y la página se puede compartir o recargar.
 */
export function Paginacion({
    ruta,
    params,
    paginacion,
    etiqueta = "registros",
    className,
}: {
    ruta: string;
    /** searchParams actuales, para no perder los filtros al cambiar de página. */
    params: Record<string, string | string[] | undefined>;
    paginacion: DatosPaginacion;
    etiqueta?: string;
    className?: string;
}) {
    const { page, paginas, total, limit } = paginacion;
    if (total === 0) return null;

    const href = (destino: number) => {
        const sp = new URLSearchParams();
        for (const [clave, valor] of Object.entries(params)) {
            if (clave === "page" || valor === undefined) continue;
            sp.set(clave, Array.isArray(valor) ? valor[0] : valor);
        }
        if (destino > 1) sp.set("page", String(destino));
        const cadena = sp.toString();
        return cadena ? `${ruta}?${cadena}` : ruta;
    };

    const desde = (page - 1) * limit + 1;
    const hasta = Math.min(page * limit, total);

    return (
        <nav
            aria-label="Paginación"
            className={cn("mt-5 flex items-center justify-between gap-3", className)}
        >
            <p className="text-xs text-muted-foreground">
                {total === 1
                    ? `1 de 1 ${etiqueta}`
                    : `${desde}–${hasta} de ${total} ${etiqueta}`}
            </p>

            {paginas > 1 && (
                <div className="flex items-center gap-1">
                    <Enlace
                        href={href(page - 1)}
                        activo={page > 1}
                        rel="prev"
                        titulo="Página anterior"
                    >
                        <ChevronLeft className="size-4" aria-hidden />
                    </Enlace>
                    <span className="px-2 text-xs font-medium text-muted-foreground">
                        {page} / {paginas}
                    </span>
                    <Enlace
                        href={href(page + 1)}
                        activo={page < paginas}
                        rel="next"
                        titulo="Página siguiente"
                    >
                        <ChevronRight className="size-4" aria-hidden />
                    </Enlace>
                </div>
            )}
        </nav>
    );
}

function Enlace({
    href,
    activo,
    titulo,
    rel,
    children,
}: {
    href: string;
    activo: boolean;
    titulo: string;
    rel: string;
    children: React.ReactNode;
}) {
    const clases =
        "toque grid place-items-center rounded-full glass-soft transition-colors";

    if (!activo) {
        return (
            <span
                aria-disabled
                aria-label={titulo}
                className={cn(clases, "opacity-40")}
            >
                {children}
            </span>
        );
    }

    return (
        <Link
            href={href}
            rel={rel}
            aria-label={titulo}
            className={cn(clases, "hover:bg-surface-strong")}
        >
            {children}
        </Link>
    );
}
