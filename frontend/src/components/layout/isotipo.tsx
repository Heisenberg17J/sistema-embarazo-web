import { cn } from "@/lib/utils";

/**
 * Isotipo de la marca: una semilla que germina. Vectorizado de
 * assets-fuente/logo_semilla.svg, sin el fondo blanco ni los halos grises del
 * vectorizador y con las coordenadas redondeadas a un decimal.
 *
 * El trazado vive en public/marca/isotipo.v1.svg (cacheado como inmutable) y
 * se usa con <use>: en línea pesaba ~12 KB por cada logo de la página, y se
 * repetía en la carga de RSC, lo que retrasaba el primer pintado en redes
 * lentas. Los tres tonos salen de los tokens --isotipo-* de globals.css, que
 * se heredan dentro del <use>, así que se adapta al modo oscuro.
 */
export function Isotipo({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 322 539" className={cn("h-10 w-auto shrink-0", className)} aria-hidden focusable="false">
            <use href="/marca/isotipo.v1.svg#isotipo" width="322" height="539" />
        </svg>
    );
}
