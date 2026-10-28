import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BellRing, ChevronRight } from "lucide-react";
import { DialogoRevisarAlerta } from "@/components/formularios/dialogo-revisar-alerta";
import { Saludo } from "@/components/layout/saludo";
import { AlertaItem } from "@/components/paneles/alerta-item";
import { Boton } from "@/components/ui/boton";
import { EsqueletoLista } from "@/components/ui/esqueleto";
import { Filtros, TODOS, unParam } from "@/components/ui/filtros";
import { Paginacion } from "@/components/ui/paginacion";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { alertas } from "@/lib/datos";
import { ESTADO_ALERTA_TEXTO } from "@/lib/formato";
import { exigirRol } from "@/lib/sesion-servidor";

export const metadata: Metadata = { title: "Alertas" };

const ESTADOS = [
    { valor: "PENDIENTE", texto: "Sin revisar" },
    { valor: "REVISADA", texto: "Revisadas" },
    { valor: "DESCARTADA", texto: "Descartadas" },
];

const SEVERIDADES = [
    { valor: "CRITICA", texto: "Atención inmediata" },
    { valor: "ADVERTENCIA", texto: "Advertencia" },
    { valor: "INFORMATIVA", texto: "Informativa" },
];

type Params = Record<string, string | string[] | undefined>;

/** Sin filtro en la URL se muestran las pendientes, que es lo que hay que atender. */
const POR_DEFECTO = "PENDIENTE";

const leerFiltro = (params: Params, nombre: string, permitidos: string[], porDefecto?: string) => {
    const valor = unParam(params, nombre);
    if (valor === TODOS) return undefined;
    if (valor && permitidos.includes(valor)) return valor;
    return porDefecto;
};

export default async function PaginaBandejaAlertas({
    searchParams,
}: {
    searchParams: Promise<Params>;
}) {
    await exigirRol("PROFESIONAL");
    const params = await searchParams;

    const estado = leerFiltro(params, "estado", ESTADOS.map((e) => e.valor), POR_DEFECTO);
    const severidad = leerFiltro(params, "severidad", SEVERIDADES.map((s) => s.valor));
    const pagina = Number(params.page) || 1;

    return (
        <>
            <Saludo
                titulo="Alertas de mis pacientes"
                conFecha={false}
                subtitulo="Generadas por lo que registran tus pacientes y por los controles. Al revisarlas, ellas ven el cambio en su app."
            />

            <Tarjeta>
                <div className="space-y-3">
                    <Filtros
                        ruta="/pro/alertas"
                        params={params}
                        nombre="estado"
                        etiqueta="Estado de la alerta"
                        opciones={ESTADOS}
                        porDefecto={POR_DEFECTO}
                        textoTodos="Todas"
                    />
                    <Filtros
                        ruta="/pro/alertas"
                        params={params}
                        nombre="severidad"
                        etiqueta="Severidad"
                        opciones={SEVERIDADES}
                        textoTodos="Cualquier severidad"
                    />
                </div>

                {/* Solo la lista espera por el servidor: los filtros siguen montados. */}
                <Suspense
                    key={`${estado ?? "todas"}-${severidad ?? "todas"}-${pagina}`}
                    fallback={<EsqueletoLista filas={4} />}
                >
                    <Bandeja
                        estado={estado}
                        severidad={severidad}
                        pagina={pagina}
                        params={params}
                    />
                </Suspense>
            </Tarjeta>
        </>
    );
}

async function Bandeja({
    estado,
    severidad,
    pagina,
    params,
}: {
    estado?: string;
    severidad?: string;
    pagina: number;
    params: Params;
}) {
    const lista = await alertas({ estado, severidad, page: pagina, limit: 15 });

    if (lista.datos.length === 0) {
        return (
            <Vacio
                icono={BellRing}
                titulo={
                    estado === POR_DEFECTO && !severidad
                        ? "No tienes alertas por revisar"
                        : "No hay alertas con esos filtros"
                }
                descripcion={
                    estado === POR_DEFECTO && !severidad
                        ? "Aquí aparecerán las que generen los registros de tus pacientes."
                        : "Prueba con otra combinación."
                }
            />
        );
    }

    return (
        <>
            <ul className="mt-5 space-y-3">
                {lista.datos.map((alerta) => (
                    <li key={alerta.id}>
                        <AlertaItem
                            severidad={alerta.severidad}
                            mensaje={alerta.mensaje}
                            generadaEn={alerta.generada_en}
                            estado={ESTADO_ALERTA_TEXTO[alerta.estado]}
                            detalle={
                                [
                                    alerta.gestante,
                                    alerta.valor_detectado != null &&
                                        `valor registrado: ${alerta.valor_detectado}${alerta.unidad ? ` ${alerta.unidad}` : ""}`,
                                    alerta.revisor && `revisada por ${alerta.revisor}`,
                                    alerta.observacion_revision,
                                ]
                                    .filter(Boolean)
                                    .join(" · ") || null
                            }
                        />

                        <div className="mt-2 flex flex-wrap justify-end gap-2">
                            {alerta.gestante_usuario_id && (
                                <Boton comoHijo variante="fantasma" tamano="sm">
                                    <Link
                                        href={`/pro/pacientes/${alerta.gestante_usuario_id}?seccion=alertas`}
                                    >
                                        Ver ficha
                                        <ChevronRight aria-hidden />
                                    </Link>
                                </Boton>
                            )}
                            {alerta.estado === "PENDIENTE" && (
                                <DialogoRevisarAlerta alerta={alerta} />
                            )}
                        </div>
                    </li>
                ))}
            </ul>

            {lista.aviso && (
                <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                    {lista.aviso}
                </p>
            )}

            <Paginacion
                ruta="/pro/alertas"
                params={params}
                paginacion={lista.paginacion}
                etiqueta="alertas"
            />
        </>
    );
}
