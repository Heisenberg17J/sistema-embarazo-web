import { cn } from "@/lib/utils";

/** Bloque gris que ocupa el lugar de un dato mientras llega. */
export function Esqueleto({ className }: { className?: string }) {
    return (
        <div
            className={cn("animate-pulse rounded-xl bg-surface-strong", className)}
        />
    );
}

/**
 * Esqueleto de una pantalla de listado: encabezado y unas tarjetas.
 * Se usa en los `loading.tsx` para que la página no salte al cargar.
 */
export function EsqueletoPagina({ filas = 3 }: { filas?: number }) {
    return (
        <div aria-busy="true" aria-live="polite">
            <span className="sr-only">Cargando…</span>

            <div className="mb-5 mt-7 space-y-2">
                <Esqueleto className="h-9 w-56" />
                <Esqueleto className="h-4 w-80 max-w-full" />
            </div>

            <div className="glass space-y-3 rounded-3xl p-5 sm:p-6">
                {Array.from({ length: filas }).map((_, i) => (
                    <Esqueleto key={i} className="h-24 w-full" />
                ))}
            </div>
        </div>
    );
}

/** Esqueleto de la lista de una pantalla con filtros, mientras llega el dato. */
export function EsqueletoLista({ filas = 4 }: { filas?: number }) {
    return (
        <div className="mt-5 space-y-3" aria-busy="true" aria-live="polite">
            <span className="sr-only">Cargando…</span>
            {Array.from({ length: filas }).map((_, i) => (
                <Esqueleto key={i} className="h-24 w-full" />
            ))}
        </div>
    );
}
