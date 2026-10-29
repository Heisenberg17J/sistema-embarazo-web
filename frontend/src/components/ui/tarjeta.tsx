import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Fusiona el índice de entrada escalonada (--i) con el style recibido. */
function estiloEntrada(indice: number | undefined, style?: CSSProperties) {
    if (indice === undefined) return style;
    return { "--i": indice, ...style } as CSSProperties;
}

/** Tarjeta de vidrio, la superficie principal de la app. */
export function Tarjeta({
    className,
    indice,
    style,
    ...props
}: ComponentProps<"section"> & { indice?: number }) {
    return (
        <section
            className={cn("glass rounded-3xl p-5 sm:p-6", indice !== undefined && "entrada", className)}
            style={estiloEntrada(indice, style)}
            {...props}
        />
    );
}

/** Subtarjeta: va dentro de una Tarjeta. */
export function Panel({
    className,
    indice,
    style,
    ...props
}: ComponentProps<"div"> & { indice?: number }) {
    return (
        <div
            className={cn("glass-soft rounded-2xl p-4", indice !== undefined && "entrada", className)}
            style={estiloEntrada(indice, style)}
            {...props}
        />
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
