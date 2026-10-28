import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, UserCheck, UserRoundX } from "lucide-react";
import { finalizarAsignacion } from "@/acciones/admin";
import { DialogoAsignacion, type OpcionPersona } from "@/components/admin/dialogo-asignacion";
import { DialogoConfirmar } from "@/components/admin/dialogo-confirmar";
import { Saludo } from "@/components/layout/saludo";
import { Boton } from "@/components/ui/boton";
import { Filtros, TODOS, unParam } from "@/components/ui/filtros";
import { Insignia } from "@/components/ui/insignia";
import { Paginacion } from "@/components/ui/paginacion";
import { EncabezadoTarjeta, Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { asignaciones, usuarios } from "@/lib/datos";
import { fechaCorta } from "@/lib/formato";
import { exigirRol } from "@/lib/sesion-servidor";

export const metadata: Metadata = { title: "Asignaciones" };

const ESTADOS = [
    { valor: "true", texto: "Vigentes" },
    { valor: "false", texto: "Finalizadas" },
];

/** Sin filtro en la URL se ven las vigentes, que son las que dan acceso. */
const POR_DEFECTO = "true";

type Params = Record<string, string | string[] | undefined>;

/** Tope de la API por página; suficiente para los selectores de este MVP. */
const MAXIMO = 100;

export default async function PaginaAsignaciones({
    searchParams,
}: {
    searchParams: Promise<Params>;
}) {
    await exigirRol("ADMINISTRADOR");
    const params = await searchParams;

    const valor = unParam(params, "activa");
    const activa =
        valor === TODOS ? undefined : ESTADOS.some((e) => e.valor === valor) ? valor : POR_DEFECTO;
    const pagina = Number(params.page) || 1;

    const [profesionales, gestantes, vigentes] = await Promise.all([
        usuarios({ rol: "PROFESIONAL", activo: true, limit: MAXIMO }),
        usuarios({ rol: "GESTANTE", activo: true, limit: MAXIMO }),
        asignaciones({ activa: true, limit: MAXIMO }),
    ]);

    const conProfesional = new Set(vigentes.datos.map((a) => a.gestante_usuario_id));
    const sinProfesional = gestantes.datos.filter((g) => !conProfesional.has(g.id));

    const opcionesProfesional: OpcionPersona[] = profesionales.datos.map((p) => ({
        id: p.id,
        nombre: `${p.nombre} ${p.apellido}`,
    }));
    // Las que no tienen profesional van primero: son las que hay que atender.
    const opcionesGestante: OpcionPersona[] = [
        ...sinProfesional.map((g) => ({
            id: g.id,
            nombre: `${g.nombre} ${g.apellido}`,
            detalle: "sin profesional",
        })),
        ...gestantes.datos
            .filter((g) => conProfesional.has(g.id))
            .map((g) => ({ id: g.id, nombre: `${g.nombre} ${g.apellido}` })),
    ];

    return (
        <>
            <Saludo
                titulo="Asignaciones"
                conFecha={false}
                subtitulo="Un profesional solo ve el seguimiento de las gestantes que tiene asignadas."
                acciones={
                    <DialogoAsignacion
                        profesionales={opcionesProfesional}
                        gestantes={opcionesGestante}
                    />
                }
            />

            <div className="space-y-5">
                {sinProfesional.length > 0 && (
                    <Tarjeta>
                        <EncabezadoTarjeta
                            seccion="Por atender"
                            titulo="Gestantes sin profesional"
                            descripcion="Nadie puede revisar sus alertas hasta que se les asigne un profesional."
                        />
                        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                            {sinProfesional.map((g) => (
                                <li
                                    key={g.id}
                                    className="glass-soft flex items-center justify-between gap-3 rounded-2xl p-3"
                                >
                                    <Link
                                        href={`/admin/usuarios/${g.id}`}
                                        className="min-w-0 truncate font-medium hover:underline"
                                    >
                                        {g.nombre} {g.apellido}
                                    </Link>
                                    <DialogoAsignacion
                                        profesionales={opcionesProfesional}
                                        gestantes={opcionesGestante}
                                        gestanteInicial={g.id}
                                        textoBoton="Asignar"
                                        varianteBoton="vidrio"
                                    />
                                </li>
                            ))}
                        </ul>
                    </Tarjeta>
                )}

                <Tarjeta>
                    <Filtros
                        ruta="/admin/asignaciones"
                        params={params}
                        nombre="activa"
                        etiqueta="Estado de la asignación"
                        opciones={ESTADOS}
                        porDefecto={POR_DEFECTO}
                        textoTodos="Todas"
                    />

                    {/* Sin <Suspense> alrededor: ver la nota en acciones/admin.ts. */}
                    <Lista activa={activa} pagina={pagina} params={params} />
                </Tarjeta>
            </div>
        </>
    );
}

async function Lista({
    activa,
    pagina,
    params,
}: {
    activa?: string;
    pagina: number;
    params: Params;
}) {
    const lista = await asignaciones({ activa, page: pagina, limit: 20 });

    if (lista.datos.length === 0) {
        return (
            <Vacio
                icono={activa === "false" ? UserRoundX : UserCheck}
                titulo={
                    activa === "false"
                        ? "No hay asignaciones finalizadas"
                        : "Todavía no hay asignaciones"
                }
                descripcion={
                    activa === "false"
                        ? undefined
                        : "Usa “Nueva asignación” para que un profesional atienda a una gestante."
                }
            />
        );
    }

    return (
        <>
            <ul className="mt-5 space-y-2">
                {lista.datos.map((a) => (
                    <li
                        key={a.id}
                        className="glass-soft flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                        <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-x-2 font-medium">
                                <Link
                                    href={`/admin/usuarios/${a.gestante_usuario_id}`}
                                    className="hover:underline"
                                >
                                    {a.gestante}
                                </Link>
                                <ArrowRight
                                    className="size-4 text-muted-foreground"
                                    aria-label="atendida por"
                                />
                                <Link
                                    href={`/admin/usuarios/${a.profesional_usuario_id}`}
                                    className="hover:underline"
                                >
                                    {a.profesional}
                                </Link>
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Desde el {fechaCorta(a.fecha_inicio)}
                                {a.fecha_fin && ` hasta el ${fechaCorta(a.fecha_fin)}`}
                            </p>
                        </div>

                        <div className="flex shrink-0 items-center justify-end gap-2">
                            <Insignia tono={a.activa ? "exito" : "neutro"}>
                                {a.activa ? "Vigente" : "Finalizada"}
                            </Insignia>
                            {a.activa && (
                                <DialogoConfirmar
                                    titulo="Finalizar la asignación"
                                    descripcion={`${a.gestante} · ${a.profesional}`}
                                    accion={finalizarAsignacion}
                                    campos={{ asignacion_id: a.id }}
                                    textoConfirmar="Finalizar"
                                    peligro
                                    disparador={
                                        <Boton variante="fantasma" tamano="sm">
                                            Finalizar
                                        </Boton>
                                    }
                                >
                                    {a.profesional} dejará de ver el seguimiento de{" "}
                                    {a.gestante} desde este momento. El historial y lo que
                                    registró se conservan.
                                </DialogoConfirmar>
                            )}
                        </div>
                    </li>
                ))}
            </ul>

            <Paginacion
                ruta="/admin/asignaciones"
                params={params}
                paginacion={lista.paginacion}
                etiqueta="asignaciones"
            />
        </>
    );
}
