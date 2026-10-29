import type { ReactNode } from "react";
import { capitalizar, fechaLarga, primerNombre } from "@/lib/formato";
import { cn } from "@/lib/utils";

/** Encabezado de página: fecha, saludo y acciones rápidas. */
export function Saludo({
    nombre,
    subtitulo,
    titulo,
    acciones,
    conFecha = true,
    ilustracion = false,
}: {
    nombre?: string;
    titulo?: string;
    subtitulo?: ReactNode;
    acciones?: ReactNode;
    /** La fecha de hoy solo tiene sentido en el panel. */
    conFecha?: boolean;
    /**
     * Ilustración de la gestante a la derecha (solo el panel): decorativa, en una
     * caja de tamaño fijo, absoluta para no empujar el layout.
     */
    ilustracion?: boolean;
}) {
    return (
        <div
            className={cn(
                "relative mb-5 mt-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end",
                // La ilustración es más alta que el texto: el margen extra evita que
                // suba hasta el encabezado.
                ilustracion && "sm:mt-12",
            )}
        >
            {ilustracion && (
                <span
                    aria-hidden
                    className="ilustracion-color pointer-events-none absolute right-0 top-0 w-[4.25rem] sm:bottom-0 sm:top-auto sm:w-[6.75rem]"
                />
            )}
            <div className={ilustracion ? "pr-20 sm:pr-0" : undefined}>
                {conFecha && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-deep">
                        {capitalizar(fechaLarga(new Date()))}
                    </p>
                )}
                <h1 className="mt-1 font-display text-3xl font-semibold text-balance sm:text-4xl">
                    {titulo ?? `Hola, ${primerNombre(nombre ?? "")}`}
                </h1>
                {subtitulo && (
                    <p className="mt-1 text-sm text-muted-foreground">{subtitulo}</p>
                )}
            </div>
            {acciones && (
                <div
                    className={
                        ilustracion
                            ? "grid grid-cols-2 gap-3 sm:mr-32 sm:flex sm:flex-wrap sm:gap-2"
                            : "flex flex-wrap gap-2"
                    }
                >
                    {acciones}
                </div>
            )}
        </div>
    );
}
