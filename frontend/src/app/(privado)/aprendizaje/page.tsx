import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ChevronRight, Search, Sparkles } from "lucide-react";
import { Saludo } from "@/components/layout/saludo";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Paginacion } from "@/components/ui/paginacion";
import { EncabezadoTarjeta, Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { contenidoDeMiSemana, contenidos } from "@/lib/datos";
import { exigirRol } from "@/lib/sesion-servidor";
import type { Contenido } from "@/lib/tipos";

export const metadata: Metadata = { title: "Aprendizaje" };

export default async function PaginaAprendizaje({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    await exigirRol("GESTANTE");
    const params = await searchParams;
    const busqueda = typeof params.q === "string" ? params.q : "";

    const [miSemana, catalogo] = await Promise.all([
        contenidoDeMiSemana(),
        contenidos({ page: Number(params.page) || 1, limit: 12, q: busqueda }),
    ]);

    const idsDeMiSemana = new Set(miSemana?.contenidos.map((c) => c.id) ?? []);

    return (
        <>
            <Saludo
                titulo="Aprendizaje"
                conFecha={false}
                subtitulo="Información sobre tu embarazo, escrita para la etapa en la que estás."
            />

            <div className="space-y-5">
                {miSemana && miSemana.contenidos.length > 0 && (
                    <Tarjeta>
                        <EncabezadoTarjeta
                            seccion={`Semana ${miSemana.semana}`}
                            titulo="Para esta semana"
                            accion={
                                <Insignia tono="marca">
                                    <Sparkles aria-hidden />
                                    {miSemana.contenidos.length}
                                </Insignia>
                            }
                        />
                        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                            {miSemana.contenidos.map((contenido) => (
                                <li key={contenido.id}>
                                    <TarjetaContenido contenido={contenido} />
                                </li>
                            ))}
                        </ul>
                    </Tarjeta>
                )}

                <Tarjeta>
                    <EncabezadoTarjeta
                        seccion="Todos los contenidos"
                        titulo="Biblioteca"
                    />

                    {/* Formulario GET: busca sin JavaScript y deja la búsqueda en la URL. */}
                    <form action="/aprendizaje" className="mt-4 flex gap-2">
                        <div className="relative flex-1">
                            <Search
                                className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                                aria-hidden
                            />
                            <input
                                type="search"
                                name="q"
                                defaultValue={busqueda}
                                placeholder="Buscar por título o contenido"
                                aria-label="Buscar contenidos"
                                className="h-11 w-full rounded-2xl border border-border-firme bg-input pl-11 pr-4 placeholder:text-muted-foreground/70 focus:border-ring"
                            />
                        </div>
                        <Boton type="submit" variante="vidrio">
                            Buscar
                        </Boton>
                    </form>

                    {catalogo.datos.length === 0 ? (
                        <Vacio
                            icono={BookOpen}
                            titulo={
                                busqueda
                                    ? "No encontramos nada con esa búsqueda"
                                    : "Todavía no hay contenidos publicados"
                            }
                            descripcion={
                                busqueda
                                    ? "Prueba con otra palabra."
                                    : "Pronto encontrarás aquí información para cada etapa del embarazo."
                            }
                            accion={
                                busqueda ? (
                                    <Boton comoHijo variante="vidrio">
                                        <Link href="/aprendizaje">Ver todos</Link>
                                    </Boton>
                                ) : undefined
                            }
                        />
                    ) : (
                        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                            {catalogo.datos.map((contenido) => (
                                <li key={contenido.id}>
                                    <TarjetaContenido
                                        contenido={contenido}
                                        destacado={idsDeMiSemana.has(contenido.id)}
                                    />
                                </li>
                            ))}
                        </ul>
                    )}

                    <Paginacion
                        ruta="/aprendizaje"
                        params={params}
                        paginacion={catalogo.paginacion}
                        etiqueta="contenidos"
                    />
                </Tarjeta>
            </div>
        </>
    );
}

function TarjetaContenido({
    contenido,
    destacado,
}: {
    contenido: Contenido;
    destacado?: boolean;
}) {
    return (
        <Link
            href={`/aprendizaje/${contenido.id}`}
            className="glass-soft flex h-full items-start justify-between gap-3 rounded-2xl p-4 transition-colors hover:bg-surface-strong"
        >
            <span className="min-w-0">
                <span className="block font-medium text-balance">
                    {contenido.titulo}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                    {contenido.categoria ? `${contenido.categoria} · ` : ""}
                    semanas {contenido.semana_desde}–{contenido.semana_hasta}
                </span>
                {(contenido.leido || destacado) && (
                    <span className="mt-2 flex flex-wrap gap-1.5">
                        {contenido.leido && <Insignia tono="exito">Leído</Insignia>}
                        {destacado && !contenido.leido && (
                            <Insignia tono="marca">Para tu semana</Insignia>
                        )}
                    </span>
                )}
            </span>
            <ChevronRight
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden
            />
        </Link>
    );
}
