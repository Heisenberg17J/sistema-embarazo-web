import { marcaTiempo } from "@/lib/formato";
import { ESTILO_SEVERIDAD } from "@/lib/severidad";
import type { Severidad } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/**
 * Tarjeta de una alerta. El borde izquierdo y el icono indican la severidad;
 * las críticas además dicen explícitamente qué hacer.
 */
export function AlertaItem({
    severidad,
    mensaje,
    generadaEn,
    detalle,
    estado,
    className,
}: {
    severidad: Severidad;
    mensaje: string;
    generadaEn?: string;
    detalle?: string | null;
    estado?: string;
    className?: string;
}) {
    const estilo = ESTILO_SEVERIDAD[severidad];

    return (
        <article
            className={cn(
                "glass-soft rounded-2xl border-l-4 p-4",
                estilo.borde,
                className,
            )}
        >
            <div className="flex items-start gap-2.5">
                <estilo.icono
                    className={cn("mt-0.5 size-4 shrink-0", estilo.texto)}
                    aria-hidden
                />
                <div className="min-w-0 flex-1">
                    <p className={cn("text-xs font-semibold uppercase tracking-wide", estilo.texto)}>
                        {estilo.etiqueta}
                    </p>
                    <p className="mt-1 text-sm font-medium leading-snug text-balance">
                        {mensaje}
                    </p>
                    {detalle && (
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {detalle}
                        </p>
                    )}
                    {(generadaEn || estado) && (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                            {generadaEn && marcaTiempo(generadaEn)}
                            {generadaEn && estado && " · "}
                            {estado}
                        </p>
                    )}
                </div>
            </div>
        </article>
    );
}
