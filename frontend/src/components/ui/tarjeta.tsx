import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Tarjeta de vidrio, la superficie principal de la app. */
export function Tarjeta({ className, ...props }: ComponentProps<"section">) {
    return (
        <section
            className={cn("glass rounded-3xl p-5 sm:p-6", className)}
            {...props}
        />
    );
}

/** Subtarjeta: va dentro de una Tarjeta. */
export function Panel({ className, ...props }: ComponentProps<"div">) {
    return (
        <div className={cn("glass-soft rounded-2xl p-4", className)} {...props} />
    );
}

interface PropsEncabezado {
    /** Texto pequeño en mayúsculas, como en el mockup. */
    seccion?: string;
    titulo?: ReactNode;
    descripcion?: ReactNode;
    /** Acción a la derecha (un botón o una insignia). */
    accion?: ReactNode;
    className?: string;
}

export function EncabezadoTarjeta({
    seccion,
    titulo,
    descripcion,
    accion,
    className,
}: PropsEncabezado) {
    return (
        <div
            className={cn(
                "flex flex-wrap items-start justify-between gap-3",
                className,
            )}
        >
            <div className="min-w-0">
                {seccion && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {seccion}
                    </p>
                )}
                {titulo && (
                    <h2 className="mt-1 font-display text-2xl font-semibold text-balance">
                        {titulo}
                    </h2>
                )}
                {descripcion && (
                    <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p>
                )}
            </div>
            {accion && <div className="shrink-0">{accion}</div>}
        </div>
    );
}

/** Dato destacado: etiqueta pequeña arriba y cifra abajo. */
export function CasillaDato({
    etiqueta,
    valor,
    icono,
    tono,
    className,
}: {
    etiqueta: string;
    valor: ReactNode;
    icono?: ReactNode;
    tono?: "normal" | "alerta";
    className?: string;
}) {
    return (
        <Panel className={className}>
            <div className="flex items-center gap-2 text-brand-deep">
                {icono}
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {etiqueta}
                </p>
            </div>
            <p
                className={cn(
                    "mt-2 font-display text-xl font-medium",
                    tono === "alerta" && "text-critica",
                )}
            >
                {valor}
            </p>
        </Panel>
    );
}
