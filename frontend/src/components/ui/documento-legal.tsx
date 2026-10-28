import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Tarjeta } from "@/components/ui/tarjeta";
import { POLITICA, VERSION_POLITICA } from "@/lib/politica";

/** Marco común de las páginas legales: título, versión y aviso de borrador. */
export function DocumentoLegal({
    titulo,
    children,
}: {
    titulo: string;
    children: ReactNode;
}) {
    return (
        <article>
            <h1 className="font-display text-3xl font-semibold text-balance sm:text-4xl">
                {titulo}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
                Versión {VERSION_POLITICA} · vigente desde {POLITICA.vigenteDesde}
            </p>

            {POLITICA.borrador && (
                <p
                    role="note"
                    className="mt-5 flex items-start gap-3 rounded-2xl bg-advertencia-suave px-4 py-3 text-sm font-medium leading-relaxed text-advertencia"
                >
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>
                        Borrador pendiente de revisión jurídica. Los datos entre
                        corchetes los debe completar la institución responsable antes de
                        usar este texto con personas reales.
                    </span>
                </p>
            )}

            <Tarjeta className="mt-6 space-y-7">{children}</Tarjeta>
        </article>
    );
}

export function Seccion({
    titulo,
    children,
}: {
    titulo: string;
    children: ReactNode;
}) {
    return (
        <section>
            <h2 className="font-display text-xl font-semibold">{titulo}</h2>
            <div className="mt-2 space-y-3 text-[15px] leading-relaxed">{children}</div>
        </section>
    );
}
