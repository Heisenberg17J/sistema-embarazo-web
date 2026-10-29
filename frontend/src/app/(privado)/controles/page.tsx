import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { Saludo } from "@/components/layout/saludo";
import { SinEmbarazo } from "@/components/paneles/sin-embarazo";
import { Insignia } from "@/components/ui/insignia";
import { ANCLA_LISTA, Paginacion } from "@/components/ui/paginacion";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { controles, embarazoActivo } from "@/lib/datos";
import { capitalizar, fechaLarga } from "@/lib/formato";
import { exigirRol } from "@/lib/sesion-servidor";

export const metadata: Metadata = { title: "Mis controles" };

export default async function PaginaControles({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    await exigirRol("GESTANTE");
    const params = await searchParams;
    const embarazo = await embarazoActivo();

    if (!embarazo) {
        return (
            <>
                <Saludo
                    titulo="Mis controles"
                    conFecha={false}
                    subtitulo="Aquí verás lo que tu profesional registre en cada consulta."
                />
                <SinEmbarazo />
            </>
        );
    }

    const pagina = Number(params.page) || 1;
    const lista = await controles(embarazo.embarazo_id, { page: pagina, limit: 10 });

    return (
        <>
            <Saludo
                titulo="Mis controles"
                conFecha={false}
                subtitulo="Lo que tu profesional de salud registró en cada consulta, de lo más reciente a lo más antiguo."
            />

            <Tarjeta indice={0} id={ANCLA_LISTA} className="scroll-mt-4">
                {lista.datos.length === 0 ? (
                    <Vacio
                        icono={ClipboardList}
                        ilustracion
                        titulo="Todavía no hay controles registrados"
                        descripcion="Después de cada consulta, tu profesional registrará aquí las mediciones y sus observaciones."
                    />
                ) : (
                    <ul className="space-y-3">
                        {lista.datos.map((control) => (
                            <li key={control.id} className="glass-soft rounded-2xl p-4">
                                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                                    <div className="min-w-0">
                                        <p className="font-display text-lg font-medium text-balance">
                                            Semana {control.semana_gestacion}
                                        </p>
                                        <p className="mt-0.5 text-sm text-muted-foreground">
                                            {capitalizar(fechaLarga(control.fecha))}
                                        </p>
                                    </div>
                                    <Insignia>{control.profesional}</Insignia>
                                </div>

                                {control.observaciones && (
                                    <p className="mt-3 whitespace-pre-line rounded-xl bg-surface-soft px-3 py-2.5 text-sm leading-relaxed">
                                        {control.observaciones}
                                    </p>
                                )}

                                {control.mediciones.length > 0 && (
                                    <ul
                                        className="mt-3 flex flex-wrap gap-1.5"
                                        aria-label="Mediciones del control"
                                    >
                                        {control.mediciones.map((m) => (
                                            <li key={m.tipo}>
                                                <Insignia>
                                                    {m.nombre}: {m.valor} {m.unidad}
                                                </Insignia>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        ))}
                    </ul>
                )}

                <Paginacion
                    ruta="/controles"
                    params={params}
                    paginacion={lista.paginacion}
                    etiqueta="controles"
                />
            </Tarjeta>
        </>
    );
}
