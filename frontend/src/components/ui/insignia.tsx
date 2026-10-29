import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const variantes = cva(
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] sm:text-xs font-medium [&_svg]:size-3.5",
    {
        variants: {
            tono: {
                neutro: "bg-surface-soft text-muted-foreground",
                marca: "bg-surface-soft text-brand-deep",
                critica: "bg-critica-suave text-critica",
                advertencia: "bg-advertencia-suave text-advertencia",
                informativa: "bg-informativa-suave text-informativa",
                exito: "bg-exito-suave text-exito",
            },
        },
        defaultVariants: { tono: "neutro" },
    },
);

export function Insignia({
    className,
    tono,
    ...props
}: ComponentProps<"span"> & VariantProps<typeof variantes>) {
    return <span className={cn(variantes({ tono }), className)} {...props} />;
}

export type TonoInsignia = NonNullable<VariantProps<typeof variantes>["tono"]>;
