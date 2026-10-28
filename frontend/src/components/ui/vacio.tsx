import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Estado vacío: explica qué falta y cómo llenarlo, en lugar de dejar un hueco. */
export function Vacio({
    icono: Icono,
    titulo,
    descripcion,
    accion,
}: {
    icono: LucideIcon;
    titulo: string;
    descripcion?: string;
    accion?: ReactNode;
}) {
    return (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-surface-soft text-muted-foreground">
                <Icono className="size-5" aria-hidden />
            </span>
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
