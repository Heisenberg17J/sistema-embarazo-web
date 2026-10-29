import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const variantes = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-base font-semibold transition-colors sm:text-sm disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 sm:[&_svg]:size-4 [&_svg]:shrink-0",
    {
        variants: {
            variante: {
                primario:
                    "bg-primary text-primary-foreground shadow-suave hover:bg-brand-deep",
                vidrio:
                    "glass-soft text-foreground hover:bg-surface-strong",
                fantasma:
                    "text-muted-foreground hover:bg-surface-soft hover:text-foreground",
                contorno:
                    "border border-border-firme bg-transparent text-foreground hover:bg-surface-soft",
                peligro:
                    "bg-destructive text-destructive-foreground hover:brightness-110",
            },
            tamano: {
                sm: "h-11 px-4 sm:h-9",
                md: "toque px-6 sm:px-5",
                lg: "h-14 px-7 text-lg sm:h-12 sm:px-6 sm:text-base",
                icono: "toque px-0",
                iconoSm: "size-11 px-0 sm:size-9",
            },
            ancho: {
                auto: "",
                completo: "w-full",
            },
        },
        defaultVariants: { variante: "primario", tamano: "md", ancho: "auto" },
    },
);

export interface PropsBoton
    extends ComponentProps<"button">,
        VariantProps<typeof variantes> {
    /** Renderiza el hijo (por ejemplo un <Link>) con los estilos del botón. */
    comoHijo?: boolean;
}

export function Boton({
    className,
    variante,
    tamano,
    ancho,
    comoHijo = false,
    type,
    ...props
}: PropsBoton) {
    const Componente = comoHijo ? Slot : "button";
    return (
        <Componente
            // Un <button> sin type dentro de un form envía el formulario sin querer.
            type={comoHijo ? undefined : (type ?? "button")}
            className={cn(variantes({ variante, tamano, ancho }), className)}
            {...props}
        />
    );
}

export { variantes as variantesBoton };
