import type { CSSProperties } from "react";
import { progresoGestacion } from "@/lib/formato";

/**
 * Anillo de progreso con la semana de gestación, como en el mockup.
 * Se dibuja con un conic-gradient: no necesita SVG ni JavaScript. El valor
 * final va en la variable --progreso (grados) y la clase `.anillo-gestacion`
 * la anima de 0 a ese valor una sola vez, al montar.
 */
export function AnilloGestacion({
    semana,
    edadGestacional,
}: {
    semana: number | null;
    edadGestacional?: string | null;
}) {
    const progreso = progresoGestacion(semana);
    const grados = (progreso / 100) * 360;
    const dias = edadGestacional?.split("+")[1];

    return (
        <div
            className="anillo-gestacion relative grid size-44 shrink-0 place-items-center rounded-full"
            style={{ "--progreso": grados } as CSSProperties}
            role="img"
            aria-label={
                semana == null
                    ? "Sin semana de gestación"
                    : `Semana ${semana} de 40, ${progreso} por ciento del embarazo`
            }
        >
            <div className="absolute inset-3 grid place-items-center rounded-full bg-popover text-center">
                <div>
                    <p className="font-display text-5xl font-semibold leading-none">
                        {semana ?? "—"}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                        Semana
                    </p>
                    {dias && dias !== "0" && (
                        <p className="text-[11px] text-muted-foreground">
                            + {dias} {dias === "1" ? "día" : "días"}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
