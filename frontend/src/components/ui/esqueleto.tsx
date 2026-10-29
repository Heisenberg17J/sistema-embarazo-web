import { cn } from "@/lib/utils";

/** Bloque gris que ocupa el lugar de un dato mientras llega. */
export function Esqueleto({ className }: { className?: string }) {
    return (
        <div
            aria-hidden
            // El brillo es un degradado que cruza el bloque con translateX.
            // Con movimiento reducido se oculta: no queda ninguna franja fija.
            className={cn(
                "relative overflow-hidden rounded-xl bg-surface-strong",
                "after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/45 after:to-transparent after:animate-[brillo_1.4s_linear_infinite] dark:after:via-white/10 motion-reduce:after:hidden",
                className,
            )}
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
