import type { Metadata } from "next";
import { BellRing } from "lucide-react";
import { Saludo } from "@/components/layout/saludo";
import { AlertaItem } from "@/components/paneles/alerta-item";
import { SinEmbarazo } from "@/components/paneles/sin-embarazo";
import { Filtros, filtroValido } from "@/components/ui/filtros";
import { ANCLA_LISTA, Paginacion } from "@/components/ui/paginacion";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { alertas, embarazoActivo } from "@/lib/datos";
import { ESTADO_ALERTA_TEXTO } from "@/lib/formato";
import { exigirRol } from "@/lib/sesion-servidor";

export const metadata: Metadata = { title: "Mis alertas" };

const ESTADOS = [
    { valor: "PENDIENTE", texto: "Sin revisar" },
    { valor: "REVISADA", texto: "Revisadas" },
    { valor: "DESCARTADA", texto: "Descartadas" },
    { valor: "ANULADA", texto: "Anuladas" },
];

type Params = Record<string, string | string[] | undefined>;

export default async function PaginaAlertas({
    searchParams,
}: {
    searchParams: Promise<Params>;
}) {
    await exigirRol("GESTANTE");
    const params = await searchParams;
    const embarazo = await embarazoActivo();

    if (!embarazo) {
        return (
            <>
                <Saludo
                    titulo="Mis alertas"
                    conFecha={false}
                    subtitulo="Aquí te avisaremos si algún valor que registres sale del rango esperado."
                />
                <SinEmbarazo />
            </>
        );
    }

    const estado = filtroValido(
        params,
        "estado",
        ESTADOS.map((e) => e.valor),
    );
    const pagina = Number(params.page) || 1;

    return (
        <>
            <Saludo
                titulo="Mis alertas"
                conFecha={false}
                subtitulo="Avisos generados por los valores y síntomas que has registrado. Son orientativos, no un diagnóstico."
            />

            <Tarjeta indice={0} id={ANCLA_LISTA} className="scroll-mt-4">
                <Filtros
                    ruta="/alertas"
                    params={params}
                    nombre="estado"
                    etiqueta="Estado de la alerta"
                    opciones={ESTADOS}
                    textoTodos="Todas"
                />

                {/* Sin <Suspense>: con la lista suspendida, las acciones a veces se
                    quedaban en "Guardando…" (ver el README). Los filtros siguen montados:
                    mientras llega la lista nueva se ve la anterior. */}
                <Lista estado={estado} pagina={pagina} params={params} />
            </Tarjeta>
        </>
    );
}

async function Lista({
    estado,
    pagina,
    params,
}: {
    estado?: string;
    pagina: number;
    params: Params;
}) {
    const lista = await alertas({ page: pagina, limit: 15, estado });

    return (
        <>
            {lista.datos.length === 0 ? (
                <Vacio
                    icono={BellRing}
                    titulo={estado ? "No hay alertas con ese estado" : "No tienes alertas"}
                    descripcion={
                        estado
                            ? "Prueba con otro filtro o mira todas tus alertas."
                            : "Te avisaremos aquí si alguna medición o síntoma que registres necesita atención."
                    }
                />
            ) : (
                <div className="mt-5 space-y-3">
                    {lista.datos.map((alerta) => (
                        <AlertaItem
                            key={alerta.id}
                            severidad={alerta.severidad}
                            mensaje={alerta.mensaje}
                            generadaEn={alerta.generada_en}
                            estado={ESTADO_ALERTA_TEXTO[alerta.estado]}
                            anulada={alerta.estado === "ANULADA"}
                            detalle={
                                [
                                    alerta.valor_detectado != null &&
                                        `Valor registrado: ${alerta.valor_detectado}${alerta.unidad ? ` ${alerta.unidad}` : ""}.`,
                                    alerta.revisor && `Revisada por ${alerta.revisor}.`,
                                    alerta.observacion_revision,
                                    alerta.motivo_anulacion,
                                ]
                                    .filter(Boolean)
                                    .join(" ") || null
                            }
                        />
                    ))}
                </div>
            )}

            {lista.aviso && (
                <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                    {lista.aviso}
                </p>
            )}

            <Paginacion
                ruta="/alertas"
                params={params}
                paginacion={lista.paginacion}
                etiqueta="alertas"
            />
        </>
    );
}
