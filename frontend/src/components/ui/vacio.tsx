import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Estado vacío: explica qué falta y cómo llenarlo, en lugar de dejar un hueco. */
export function Vacio({
    icono: Icono,
    titulo,
    descripcion,
    accion,
    ilustracion = false,
}: {
    icono: LucideIcon;
    titulo: string;
    descripcion?: string;
    accion?: ReactNode;
    /**
     * Muestra encima del texto la ilustración de la gestante (decorativa): `true`
     * es el arte lineal, discreto; "color" la versión completa, para los estados
     * que invitan a empezar.
     */
    ilustracion?: boolean | "color";
}) {
    return (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
            {ilustracion === "color" ? (
                <span aria-hidden className="ilustracion-color ilustracion-grande w-36" />
            ) : (
                <>
                    {ilustracion && <span aria-hidden className="ilustracion-gestante" />}
                    <span className="grid size-12 place-items-center rounded-2xl bg-surface-soft text-muted-foreground">
                        <Icono className="size-5" aria-hidden />
                    </span>
                </>
            )}
            <div>
                <p className="font-medium">{titulo}</p>
                {descripcion && (
                    <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                        {descripcion}
                    </p>
                )}
            </div>
            {accion}
        </div>
    );
}
