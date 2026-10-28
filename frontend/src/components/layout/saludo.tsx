import type { ReactNode } from "react";
import { capitalizar, fechaLarga, primerNombre } from "@/lib/formato";

/** Encabezado de página: fecha, saludo y acciones rápidas. */
export function Saludo({
    nombre,
    subtitulo,
    titulo,
    acciones,
    conFecha = true,
}: {
    nombre?: string;
    titulo?: string;
    subtitulo?: ReactNode;
    acciones?: ReactNode;
    /** La fecha de hoy solo tiene sentido en el panel. */
    conFecha?: boolean;
}) {
    return (
        <div className="mb-5 mt-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
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
            {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
        </div>
    );
}
