import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";
import { contenidoPorId } from "@/lib/datos";
import { exigirRol } from "@/lib/sesion-servidor";
import { MarcarLeido } from "./marcar-leido";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const { id } = await params;
    const contenido = await contenidoPorId(Number(id));
    return { title: contenido?.titulo ?? "Contenido" };
}

export default async function PaginaContenido({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    await exigirRol("GESTANTE");
    const { id } = await params;

    const numero = Number(id);
    if (!Number.isInteger(numero) || numero <= 0) notFound();

    const contenido = await contenidoPorId(numero);
    if (!contenido) notFound();

    return (
        <article className="mx-auto mt-7 max-w-3xl">
            <Boton comoHijo variante="fantasma" tamano="sm" className="mb-4">
                <Link href="/aprendizaje">
                    <ArrowLeft aria-hidden />
                    Volver a aprendizaje
                </Link>
            </Boton>

            <Tarjeta>
                <div className="flex flex-wrap items-center gap-2">
                    {contenido.categoria && (
                        <Insignia tono="marca">{contenido.categoria}</Insignia>
                    )}
                    <Insignia>
                        Semanas {contenido.semana_desde}–{contenido.semana_hasta}
                    </Insignia>
                </div>

                <h1 className="mt-3 font-display text-3xl font-semibold text-balance">
                    {contenido.titulo}
                </h1>

                {/* `whitespace-pre-line` respeta los saltos de línea que escribió
                    quien redactó el contenido, sin interpretar HTML. */}
                <div className="mt-5 whitespace-pre-line text-[15px] leading-relaxed">
                    {contenido.cuerpo}
                </div>

                <p className="mt-8 border-t border-border-firme pt-4 text-xs leading-relaxed text-muted-foreground">
                    Esta información es general y no reemplaza lo que te indique tu
                    profesional de salud. Si algo te preocupa, consúltalo con él.
                </p>
            </Tarjeta>

            <MarcarLeido contenidoId={contenido.id} />
        </article>
    );
}
