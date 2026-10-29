import type { Metadata } from "next";
import { CircleCheck, ShieldCheck, Stethoscope } from "lucide-react";
import { aprobarElementoClinico } from "@/acciones/profesional";
import { DialogoConfirmar } from "@/components/admin/dialogo-confirmar";
import { Saludo } from "@/components/layout/saludo";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { EncabezadoTarjeta, Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { revisionClinica } from "@/lib/datos";
import { fechaCorta } from "@/lib/formato";
import { condicionRegla, semanasRegla } from "@/lib/reglas";
import { ESTILO_SEVERIDAD } from "@/lib/severidad";
import { exigirRol } from "@/lib/sesion-servidor";
import type { Severidad } from "@/lib/tipos";

export const metadata: Metadata = { title: "Revisión clínica" };

/**
 * Los umbrales y los mensajes que lee la gestante ("acude de inmediato a
 * urgencias") deben estar avalados por quien responde clínicamente por ellos.
 * Aquí un profesional los revisa y deja constancia de su aprobación.
 */
export default async function PaginaRevisionClinica() {
    await exigirRol("PROFESIONAL");
    const revision = await revisionClinica();

    return (
        <>
            <Saludo
                titulo="Revisión clínica"
                conFecha={false}
                subtitulo="Lo que dice el sistema a las gestantes debe estar avalado por un profesional de salud. Revisa cada elemento y, si estás de acuerdo, apruébalo."
            />

            <div className="space-y-5">
                <Tarjeta indice={0}>
                    <div className="flex items-center gap-3">
                        {revision.pendientes === 0 ? (
                            <CircleCheck className="size-6 shrink-0 text-exito" aria-hidden />
                        ) : (
                            <Stethoscope className="size-6 shrink-0 text-advertencia" aria-hidden />
                        )}
                        <p className="text-sm leading-relaxed">
                            {revision.pendientes === 0 ? (
                                <>Todo lo que el sistema le dice a las gestantes está aprobado.</>
                            ) : (
                                <>
                                    <strong>{revision.pendientes}</strong>{" "}
                                    {revision.pendientes === 1 ? "elemento sin aprobar" : "elementos sin aprobar"}.
                                    Mientras no estén aprobados siguen generando alertas, pero nadie
                                    ha respondido clínicamente por ellos.
                                </>
                            )}
                        </p>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                        Si el administrador cambia después un umbral, una severidad o un texto
                        aprobado, la aprobación se retira sola y vuelve a pedirse.
                    </p>
                </Tarjeta>

                <Tarjeta indice={1}>
                    <EncabezadoTarjeta
                        seccion="Valores de referencia"
                        titulo="Reglas de alerta"
                        descripcion="Se evalúan cada vez que se registra una medición."
                    />
                    {revision.reglas.length === 0 ? (
                        <Vacio icono={ShieldCheck} titulo="No hay reglas activas" />
                    ) : (
                        <ul className="mt-4 space-y-3">
                            {revision.reglas.map((r) => (
                                <Fila
                                    key={r.id}
                                    titulo={`${r.medicion}: ${condicionRegla(r)}`}
                                    detalle={`${semanasRegla(r.semana_desde, r.semana_hasta)} · ${r.codigo}`}
                                    severidad={r.severidad}
                                    mensaje={r.mensaje}
                                    aprobadaEn={r.aprobada_en}
                                    aprobadaPor={r.aprobada_por}
                                    tipo="regla"
                                    id={r.id}
                                />
                            ))}
                        </ul>
                    )}
                </Tarjeta>

                <Tarjeta indice={2}>
                    <EncabezadoTarjeta
                        seccion="Síntomas"
                        titulo="Signos de alarma"
                        descripcion="Al registrarlos, la gestante recibe esta indicación de inmediato."
                    />
                    {revision.signos.length === 0 ? (
                        <Vacio icono={ShieldCheck} titulo="No hay signos de alarma activos" />
                    ) : (
                        <ul className="mt-4 space-y-3">
                            {revision.signos.map((s) => (
                                <Fila
                                    key={s.id}
                                    titulo={s.nombre}
                                    detalle={
                                        s.alarma_hasta_semana
                                            ? `Solo antes de la semana ${s.alarma_hasta_semana} · ${s.codigo}`
                                            : s.codigo
                                    }
                                    severidad={s.severidad}
                                    mensaje={s.mensaje_alarma}
                                    aprobadaEn={s.aprobada_en}
                                    aprobadaPor={s.aprobada_por}
                                    tipo="signo"
                                    id={s.id}
                                />
                            ))}
                        </ul>
                    )}
                </Tarjeta>
            </div>
        </>
    );
}

function Fila({
    titulo,
    detalle,
    severidad,
    mensaje,
    aprobadaEn,
    aprobadaPor,
    tipo,
    id,
}: {
    titulo: string;
    detalle: string;
    severidad: Severidad | null;
    mensaje: string;
    aprobadaEn: string | null;
    aprobadaPor: string | null;
    tipo: "regla" | "signo";
    id: number;
}) {
    const estilo = severidad ? ESTILO_SEVERIDAD[severidad] : null;

    return (
        <li className="glass-soft rounded-2xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <div className="min-w-0">
                    <p className="font-medium text-balance">{titulo}</p>
                    <p className="text-xs text-muted-foreground">{detalle}</p>
                </div>
                {estilo && <Insignia tono={estilo.tono}>{estilo.etiqueta}</Insignia>}
            </div>

            <blockquote className="mt-3 rounded-xl bg-surface-soft px-3 py-2.5 text-sm leading-relaxed">
                {mensaje}
            </blockquote>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                {aprobadaEn ? (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-exito">
                        <CircleCheck className="size-4" aria-hidden />
                        Aprobada por {aprobadaPor} el {fechaCorta(aprobadaEn)}
                    </p>
                ) : (
                    <>
                        <Insignia tono="advertencia">Sin aprobar</Insignia>
                        <DialogoConfirmar
                            titulo="Aprobar este elemento"
                            descripcion={titulo}
                            accion={aprobarElementoClinico}
                            campos={{ tipo, elemento_id: id }}
                            textoConfirmar="Sí, lo apruebo"
                            disparador={
                                <Boton variante="vidrio" tamano="sm">
                                    <ShieldCheck aria-hidden />
                                    Aprobar
                                </Boton>
                            }
                        >
                            <p>
                                Quedará registrado que <strong>tú</strong> avalas esta
                                regla y el mensaje que leerá la gestante:
                            </p>
                            <blockquote className="mt-2 rounded-xl bg-surface-soft px-3 py-2 text-foreground">
                                {mensaje}
                            </blockquote>
                        </DialogoConfirmar>
                    </>
                )}
            </div>
        </li>
    );
}
