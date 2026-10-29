import Link from "next/link";
import { MARCA } from "@/lib/marca";
import { Isotipo } from "./isotipo";
import { cn } from "@/lib/utils";

/**
 * Logo de la app. El nombre sale de `MARCA`, el único archivo a cambiar
 * cuando se defina el nombre definitivo del producto.
 */
export function Logo({
    href,
    conLema = true,
    className,
}: {
    href?: string;
    conLema?: boolean;
    className?: string;
}) {
    const contenido = (
        <>
            <Isotipo className="h-11" />
            <span className="min-w-0">
                <strong className="block truncate font-display text-lg font-semibold leading-tight">
                    <span className="sm:hidden">{MARCA.nombreCorto}</span>
                    <span className="hidden sm:inline">{MARCA.nombre}</span>
                </strong>
                {conLema && (
                    <small className="hidden text-[10px] uppercase tracking-wide text-muted-foreground sm:block">
                        {MARCA.lema}
                    </small>
                )}
            </span>
        </>
    );

    const clases = cn("flex items-center gap-3 text-left", className);

    if (!href) return <div className={clases}>{contenido}</div>;
    return (
        <Link href={href} className={cn(clases, "rounded-2xl")}>
            {contenido}
        </Link>
    );
}
