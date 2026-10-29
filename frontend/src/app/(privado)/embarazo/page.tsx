import type { Metadata } from "next";
import Link from "next/link";
import { Baby, CalendarPlus, History } from "lucide-react";
import { DialogoEditarEmbarazo, DialogoFinalizarEmbarazo } from "@/components/formularios/dialogo-embarazo";
import { Saludo } from "@/components/layout/saludo";
import { AnilloGestacion } from "@/components/paneles/anillo-gestacion";
import { Boton } from "@/components/ui/boton";
import { Insignia, type TonoInsignia } from "@/components/ui/insignia";
import { CasillaDato, EncabezadoTarjeta, Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { embarazosPropios } from "@/lib/datos";
import { fechaCompleta, fechaCorta, nombreTrimestre, variacion } from "@/lib/formato";
import { exigirRol } from "@/lib/sesion-servidor";
import type { EstadoEmbarazo } from "@/lib/tipos";

export const metadata: Metadata = { title: "Mi embarazo" };

const ESTADO: Record<EstadoEmbarazo, { texto: string; tono: TonoInsignia }> = {
    ACTIVO: { texto: "En curso", tono: "marca" },
    FINALIZADO: { texto: "Terminó con el nacimiento", tono: "exito" },
    CANCELADO: { texto: "Terminó de otra manera", tono: "neutro" },
};

export default async function PaginaMiEmbarazo() {
    await exigirRol("GESTANTE");
    const todos = await embarazosPropios();

    const actual = todos.find((e) => e.estado === "ACTIVO");
    const anteriores = todos.filter((e) => e.estado !== "ACTIVO");

    return (
        <>
            <Saludo
                titulo="Mi embarazo"
                conFecha={false}
                subtitulo="Los datos de tu embarazo. Si algo está mal escrito, aquí lo puedes corregir."
            />

            <div className="space-y-5">
                {actual ? (
                    <Tarjeta indice={0}>
                        <EncabezadoTarjeta
                            seccion="Embarazo actual"
                            accion={<Insignia tono="marca">{nombreTrimestre(actual.trimestre)}</Insignia>}
                        />

                        <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                            <AnilloGestacion semana={actual.semana_actual} edadGestacional={actual.edad_gestacional} />

                            <div className="grid w-full flex-1 gap-3 sm:grid-cols-2">
                                <CasillaDato
                                    etiqueta="Última menstruación"
                                    valor={fechaCompleta(actual.fecha_inicio)}
                                />
                                <CasillaDato
                                    etiqueta="Fecha probable de parto"
                                    valor={fechaCompleta(actual.fecha_estimada_parto)}
                                />
                                <CasillaDato
                                    etiqueta="Talla"
                                    valor={actual.talla_cm ? `${actual.talla_cm} cm` : "Sin registrar"}
                                />
                                <CasillaDato
                                    etiqueta="Peso antes del embarazo"
                                    valor={
                                        actual.peso_pregestacional_kg
                                            ? `${actual.peso_pregestacional_kg} kg`
                                            : "Sin registrar"
                                    }
                                />
                                {actual.peso && (
                                    <CasillaDato
                                        className="sm:col-span-2"
                                        etiqueta={`Ganancia de peso · ${actual.peso.categoria_imc}`}
                                        valor={
                                            <>
                                                {actual.peso.ganancia_actual_kg != null
                                                    ? variacion(actual.peso.ganancia_actual_kg)
                                                    : "Sin peso registrado"}
                                                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                                                    de {actual.peso.ganancia_recomendada_kg.min}–
                                                    {actual.peso.ganancia_recomendada_kg.max} kg recomendados
                                                </span>
                                            </>
                                        }
                                    />
                                )}
                            </div>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2 border-t border-border-firme pt-4">
                            <DialogoEditarEmbarazo embarazo={actual} />
                            <DialogoFinalizarEmbarazo embarazoId={actual.embarazo_id} />
                        </div>
                    </Tarjeta>
                ) : (
                    <Tarjeta indice={0}>
                        <Vacio
                            icono={Baby}
                            ilustracion="color"
                            titulo="No tienes un embarazo en curso"
                            descripcion={
                                anteriores.length > 0
                                    ? "Tus embarazos anteriores se conservan abajo. Si estás esperando de nuevo, regístralo para empezar el seguimiento."
                                    : "Con la fecha de tu última menstruación calculamos tu semana de gestación y la fecha probable de parto."
                            }
                            accion={
                                <Boton comoHijo tamano="lg">
                                    <Link href="/embarazo/nuevo">
                                        <CalendarPlus aria-hidden />
                                        Registrar un embarazo
                                    </Link>
                                </Boton>
                            }
                        />
                    </Tarjeta>
                )}

                {anteriores.length > 0 && (
                    <Tarjeta indice={1}>
                        <EncabezadoTarjeta
                            seccion="Historial"
                            titulo="Embarazos anteriores"
                            descripcion="Se conservan con todo lo que se registró en ellos."
                        />
                        <ul className="mt-4 space-y-3">
                            {anteriores.map((e) => (
                                <li key={e.embarazo_id} className="glass-soft rounded-2xl p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <History className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                                            <div>
                                                <p className="font-medium">
                                                    {fechaCorta(e.fecha_inicio)}
                                                    {e.fecha_finalizacion && ` — ${fechaCorta(e.fecha_finalizacion)}`}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Parto estimado el {fechaCompleta(e.fecha_estimada_parto)}
                                                </p>
                                            </div>
                                        </div>
                                        <Insignia tono={ESTADO[e.estado].tono}>{ESTADO[e.estado].texto}</Insignia>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </Tarjeta>
                )}
            </div>
        </>
    );
}
