"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import { AlertCircle } from "lucide-react";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const baseControl =
    "w-full rounded-2xl border border-border-firme bg-input px-4 text-base text-foreground sm:text-sm placeholder:text-muted-foreground/70 transition-colors focus:border-ring disabled:opacity-60 aria-[invalid=true]:border-critica";

/**
 * Campo de formulario con etiqueta, ayuda y error.
 * La etiqueta siempre es visible: no se usa solo el placeholder, que desaparece
 * al escribir y deja a la usuaria sin saber qué iba en el campo (RNF-07).
 */
export function Campo({
    etiqueta,
    error,
    ayuda,
    obligatorio,
    children,
    className,
    id,
}: {
    etiqueta: string;
    error?: string;
    ayuda?: string;
    obligatorio?: boolean;
    children: (props: {
        id: string;
        "aria-invalid": boolean;
        "aria-describedby": string | undefined;
        className: string;
    }) => ReactNode;
    className?: string;
    id?: string;
}) {
    const generado = useId();
    const idCampo = id ?? generado;
    const idError = `${idCampo}-error`;
    const idAyuda = `${idCampo}-ayuda`;
    const descrito =
        [error ? idError : null, ayuda ? idAyuda : null].filter(Boolean).join(" ") ||
        undefined;

    return (
        <div className={cn("space-y-1.5", className)}>
            <LabelPrimitive.Root
                htmlFor={idCampo}
                className="block text-base font-medium text-foreground sm:text-sm"
            >
                {etiqueta}
                {obligatorio && (
                    <span className="ml-0.5 text-critica" aria-hidden>
                        *
                    </span>
                )}
                {!obligatorio && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        (opcional)
                    </span>
                )}
            </LabelPrimitive.Root>

            {children({
                id: idCampo,
                "aria-invalid": Boolean(error),
                "aria-describedby": descrito,
                className: cn(baseControl, "h-12 sm:h-11"),
            })}

            {ayuda && !error && (
                <p id={idAyuda} className="text-sm text-muted-foreground sm:text-xs">
                    {ayuda}
                </p>
            )}
            {error && (
                <p
                    id={idError}
                    className="flex items-start gap-1.5 text-sm font-medium text-critica sm:text-xs"
                >
                    <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
                    {error}
                </p>
            )}
        </div>
    );
}

export function Entrada({ className, ...props }: ComponentProps<"input">) {
    return <input className={cn(baseControl, "h-12 sm:h-11", className)} {...props} />;
}

export function AreaTexto({ className, ...props }: ComponentProps<"textarea">) {
    return (
        <textarea
            className={cn(baseControl, "min-h-28 py-3 leading-relaxed", className)}
            {...props}
        />
    );
}

export function Seleccion({ className, ...props }: ComponentProps<"select">) {
    return (
        <select
            className={cn(baseControl, "h-12 appearance-none pr-10 sm:h-11", className)}
            {...props}
        />
    );
}

/** Aviso de error general del formulario. */
export function AvisoError({ children }: { children: ReactNode }) {
    if (!children) return null;
    return (
        <p
            role="alert"
            className="animate-[aparecer_var(--dur-entrada)_var(--ease-out)_both] flex items-start gap-2 rounded-2xl bg-critica-suave px-4 py-3 text-base sm:text-sm font-medium text-critica"
        >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {children}
        </p>
    );
}
