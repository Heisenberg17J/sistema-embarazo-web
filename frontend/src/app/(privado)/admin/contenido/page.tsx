import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Search, Trash2 } from "lucide-react";
import { eliminarContenido, publicarContenido } from "@/acciones/admin";
import { BotonAccion } from "@/components/admin/boton-accion";
import { DialogoConfirmar } from "@/components/admin/dialogo-confirmar";
import { DialogoContenido } from "@/components/admin/dialogo-contenido";
import { Saludo } from "@/components/layout/saludo";
import { Boton } from "@/components/ui/boton";
import { Filtros, filtroValido, unParam } from "@/components/ui/filtros";
import { Insignia } from "@/components/ui/insignia";
import { Paginacion } from "@/components/ui/paginacion";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { contenidos } from "@/lib/datos";
import { exigirRol } from "@/lib/sesion-servidor";

export const metadata: Metadata = { title: "Contenido" };

const ESTADOS = [
    { valor: "true", texto: "Publicados" },
    { valor: "false", texto: "Borradores" },
];

type Params = Record<string, string | string[] | undefined>;

const rangoSemanas = (desde: number, hasta: number) =>
    desde === hasta ? `Semana ${desde}` : `Semanas ${desde} a ${hasta}`;

export default async function PaginaContenido({
    searchParams,
}: {
    searchParams: Promise<Params>;
}) {
    await exigirRol("ADMINISTRADOR");
    const params = await searchParams;

    const publicado = filtroValido(params, "publicado", ESTADOS.map((e) => e.valor));
    const busqueda = (unParam(params, "q") ?? "").trim();
    const pagina = Number(params.page) || 1;

    // Las categorías ya usadas se ofrecen como sugerencia al escribir.
    const todos = await contenidos({ limit: 100 });
    const categorias = [
        ...new Set(todos.datos.map((c) => c.categoria).filter((c): c is string => !!c)),
    ].sort();

    return (
        <>
            <Saludo
                titulo="Contenido educativo"
                conFecha={false}
                subtitulo="Cada gestante ve los contenidos publicados que corresponden a su semana de gestación."
                acciones={<DialogoContenido categorias={categorias} />}
            />

            <Tarjeta>
                <div className="space-y-3">
                    <form action="/admin/contenido" className="flex gap-2">
                        {publicado && <input type="hidden" name="publicado" value={publicado} />}
                        <div className="relative flex-1">
                            <Search
                                className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                                aria-hidden
                            />
                            <input
                                type="search"
                                name="q"
                                defaultValue={busqueda}
                                placeholder="Buscar en el título o el texto"
                                aria-label="Buscar contenido"
                                className="h-11 w-full rounded-2xl border border-border-firme bg-input pl-11 pr-4 placeholder:text-muted-foreground/70 focus:border-ring"
                            />
                        </div>
                        <Boton type="submit" variante="vidrio">
                            Buscar
                        </Boton>
                    </form>

                    <Filtros
                        ruta="/admin/contenido"
                        params={params}
                        nombre="publicado"
                        etiqueta="Estado de publicación"
                        opciones={ESTADOS}
                        textoTodos="Todos"
                    />
                </div>


                {/* Sin <Suspense> alrededor: ver la nota en acciones/admin.ts. */}
                <Lista
                    publicado={publicado}
                    busqueda={busqueda}
                    pagina={pagina}
                    params={params}
                    categorias={categorias}
                />
            </Tarjeta>
        </>
    );
}

async function Lista({
    publicado,
    busqueda,
    pagina,
    params,
    categorias,
}: {
    publicado?: string;
    busqueda: string;
    pagina: number;
    params: Params;
    categorias: string[];
}) {
    const lista = await contenidos({ publicado, q: busqueda, page: pagina, limit: 15 });

    if (lista.datos.length === 0) {
        const filtrado = publicado || busqueda;
        return (
            <Vacio
                icono={BookOpen}
                titulo={filtrado ? "Ningún contenido coincide" : "Todavía no hay contenido"}
                descripcion={
                    filtrado
                        ? "Prueba con otra búsqueda o quita los filtros."
                        : "Crea el primero con “Nuevo contenido”."
                }
                accion={
                    filtrado ? (
                        <Boton comoHijo variante="vidrio">
                            <Link href="/admin/contenido">Ver todos</Link>
                        </Boton>
                    ) : undefined
                }
            />
        );
    }

    return (
        <>
            <ul className="mt-5 space-y-3">
                {lista.datos.map((c) => (
                    <li key={c.id} className="glass-soft rounded-2xl p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="font-display text-lg font-medium text-balance">
                                    {c.titulo}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {[rangoSemanas(c.semana_desde, c.semana_hasta), c.categoria]
                                        .filter(Boolean)
                                        .join(" · ")}
                                </p>
                            </div>
                            <Insignia tono={c.publicado ? "exito" : "neutro"}>
                                {c.publicado ? "Publicado" : "Borrador"}
                            </Insignia>
                        </div>

                        <p className="mt-2 line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">
                            {c.cuerpo}
                        </p>

                        <div className="mt-3 flex flex-wrap items-start justify-end gap-1">
                            <BotonAccion
                                accion={publicarContenido}
                                campos={{ contenido_id: c.id, publicado: String(!c.publicado) }}
                            >
                                {c.publicado ? "Pasar a borrador" : "Publicar"}
                            </BotonAccion>
                            <DialogoContenido contenido={c} categorias={categorias} />
                            <DialogoConfirmar
                                titulo="Eliminar el contenido"
                                descripcion={c.titulo}
                                accion={eliminarContenido}
                                campos={{ contenido_id: c.id }}
                                textoConfirmar="Eliminar"
                                peligro
                                disparador={
                                    <Boton variante="fantasma" tamano="sm">
                                        <Trash2 aria-hidden />
                                        Eliminar
                                    </Boton>
                                }
                            >
                                Se borra definitivamente, junto con el registro de quién lo
                                leyó. Si solo quieres ocultarlo, pásalo a borrador.
                            </DialogoConfirmar>
                        </div>
                    </li>
                ))}
            </ul>

            <Paginacion
                ruta="/admin/contenido"
                params={params}
                paginacion={lista.paginacion}
                etiqueta="contenidos"
            />
        </>
    );
}
