import type { Metadata } from "next";
import { FlaskConical } from "lucide-react";
import { Saludo } from "@/components/layout/saludo";
import { SinEmbarazo } from "@/components/paneles/sin-embarazo";
import { Insignia } from "@/components/ui/insignia";
import { Paginacion } from "@/components/ui/paginacion";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { embarazoActivo, examenes } from "@/lib/datos";
import { capitalizar, fechaLarga } from "@/lib/formato";
import { exigirRol } from "@/lib/sesion-servidor";

export const metadata: Metadata = { title: "Mis exámenes" };

export default async function PaginaExamenes({
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
                    titulo="Mis exámenes"
                    conFecha={false}
                    subtitulo="Aquí verás los resultados que registre tu profesional."
                />
                <SinEmbarazo />
            </>
        );
    }

    const pagina = Number(params.page) || 1;
    const lista = await examenes(embarazo.embarazo_id, { page: pagina, limit: 15 });

    return (
        <>
            <Saludo
                titulo="Mis exámenes"
                conFecha={false}
                subtitulo="Resultados registrados por tu profesional de salud. Si algo no te queda claro, pregúntale en tu próximo control."
            />

            <Tarjeta>
                {lista.datos.length === 0 ? (
                    <Vacio
                        icono={FlaskConical}
                        titulo="Todavía no hay exámenes registrados"
                        descripcion="Tu profesional los irá registrando a medida que lleguen los resultados."
                    />
                ) : (
                    <ul className="space-y-3">
                        {lista.datos.map((examen) => (
                            <li key={examen.id} className="glass-soft rounded-2xl p-4">
                                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                                    <div className="min-w-0">
                                        <p className="font-display text-lg font-medium text-balance">
                                            {examen.tipo_nombre}
                                        </p>
                                        <p className="mt-0.5 text-sm text-muted-foreground">
                                            {capitalizar(fechaLarga(examen.fecha))}
                                        </p>
                                    </div>
                                    <Insignia>{examen.profesional}</Insignia>
                                </div>

                                <p className="mt-3 whitespace-pre-line rounded-xl bg-surface-soft px-3 py-2.5 text-sm leading-relaxed">
                                    {examen.resultado}
                                </p>

                                {examen.observaciones && (
                                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                        {examen.observaciones}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                )}

                <Paginacion
                    ruta="/examenes"
                    params={params}
                    paginacion={lista.paginacion}
                    etiqueta="exámenes"
                />
            </Tarjeta>
        </>
    );
}
