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
    anulada = false,
    className,
}: {
    severidad: Severidad;
    mensaje: string;
    generadaEn?: string;
    detalle?: string | null;
    estado?: string;
    /** El dato que la originó se corrigió o eliminó: se conserva, pero ya no pide nada. */
    anulada?: boolean;
    className?: string;
}) {
    const estilo = ESTILO_SEVERIDAD[severidad];

    return (
        <article
            className={cn(
                "glass-soft rounded-2xl border-l-4 p-4",
                // Una alerta anulada es historia: sin el color de urgencia ni la indicación de actuar.
                anulada ? "border-l-border-firme opacity-75" : estilo.borde,
                className,
            )}
        >
            <div className="flex items-start gap-2.5">
                <estilo.icono
                    className={cn("mt-0.5 size-4 shrink-0", anulada ? "text-muted-foreground" : estilo.texto)}
                    aria-hidden
                />
                <div className="min-w-0 flex-1">
                    <p
                        className={cn(
                            "text-xs font-semibold uppercase tracking-wide",
                            anulada ? "text-muted-foreground" : estilo.texto,
                        )}
                    >
                        {anulada ? `Anulada · ${estilo.etiqueta}` : estilo.etiqueta}
                    </p>
                    <p
                        className={cn(
                            "mt-1 text-sm font-medium leading-snug text-balance",
                            anulada && "text-muted-foreground line-through decoration-1",
                        )}
                    >
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
