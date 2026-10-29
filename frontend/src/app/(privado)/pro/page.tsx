import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, CalendarClock, CalendarPlus, ChevronRight, Stethoscope } from "lucide-react";
import { DialogoControl } from "@/components/formularios/dialogo-control";
import { Saludo } from "@/components/layout/saludo";
import { AlertaItem } from "@/components/paneles/alerta-item";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { EncabezadoTarjeta, Panel, Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { panel, revisionClinica, tiposMedicion } from "@/lib/datos";
import { ESTADO_CITA_TEXTO } from "@/lib/formato";
import { exigirRol } from "@/lib/sesion-servidor";
import type { PanelProfesional } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Panel" };

export default async function PaginaPanelProfesional() {
    const sesion = await exigirRol("PROFESIONAL");
    const [datos, catalogoMedicion, revision] = await Promise.all([
        panel<PanelProfesional>(),
        tiposMedicion(),
        revisionClinica(),
    ]);

    const { resumen } = datos;
    const vigente = (estado: string) =>
        estado === "PROGRAMADA" || estado === "REPROGRAMADA";

    return (
        <>
            <div className="relative">
                {/* Decorativa y a la derecha: el texto del saludo queda fuera de ella. */}
                <span
                    aria-hidden
                    className="fondo-linea-tenue pointer-events-none absolute -top-3 right-0 hidden lg:block"
                />
                <Saludo
                    nombre={sesion.nombre}
                    subtitulo={
                        resumen.pacientes === 0
                            ? "Todavía no tienes pacientes asignadas. El administrador se encarga de asignarlas."
                            : `Tienes ${resumen.pacientes} ${resumen.pacientes === 1 ? "paciente asignada" : "pacientes asignadas"}.`
                    }
                />
            </div>

            <div className="space-y-5">
                {/* Lo que el sistema le dice a las gestantes necesita el aval de un
                    profesional: mientras falte, se lo recordamos aquí. */}
                {revision.pendientes > 0 && (
                    <Link href="/pro/revision-clinica" className="block">
                        <Tarjeta className="border-l-4 border-l-advertencia-borde transition-colors hover:bg-surface-strong">
                            <div className="flex items-center gap-3">
                                <Stethoscope className="size-6 shrink-0 text-advertencia" aria-hidden />
                                <p className="flex-1 text-sm leading-relaxed">
                                    <strong>{revision.pendientes}</strong> reglas de alerta y signos de
                                    alarma esperan tu revisión: es lo que el sistema les dice a las
                                    gestantes y debe estar avalado por un profesional.
                                </p>
                                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                            </div>
                        </Tarjeta>
                    </Link>
                )}

                {/* --- Resumen de la consulta ------------------------------- */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Dato
                        etiqueta="Pacientes"
                        valor={resumen.pacientes}
                        href="/pro/pacientes"
                    />
                    <Dato
                        etiqueta="Alertas sin revisar"
                        valor={resumen.alertas_pendientes}
                        href="/pro/alertas"
                        tono={resumen.alertas_pendientes > 0 ? "advertencia" : undefined}
                    />
                    <Dato
                        etiqueta="De atención inmediata"
                        valor={resumen.alertas_criticas}
                        href="/pro/alertas?severidad=CRITICA"
                        tono={resumen.alertas_criticas > 0 ? "critica" : undefined}
                    />
                    <Dato
                        etiqueta="Sin cita programada"
                        valor={resumen.sin_cita_programada}
                        href="/pro/agenda"
                    />
                </div>

                <div className="grid items-start gap-5 lg:grid-cols-2">
                    {/* --- Citas de hoy ------------------------------------- */}
                    <Tarjeta>
                        <EncabezadoTarjeta
                            seccion="Hoy"
                            titulo="Tus citas de hoy"
                            accion={
                                <Boton comoHijo variante="vidrio" tamano="sm">
                                    <Link href="/pro/agenda">
                                        <CalendarPlus aria-hidden />
                                        Ver agenda
                                    </Link>
                                </Boton>
                            }
                        />

                        {datos.citas_hoy.length === 0 ? (
                            <Vacio
                                icono={CalendarClock}
                                titulo="No tienes citas hoy"
                                descripcion="Las citas que programes aparecerán aquí el día que correspondan."
                            />
                        ) : (
                            <ul className="mt-4 space-y-3">
                                {datos.citas_hoy.map((cita, i) => (
                                    <li
                                        key={cita.id}
                                        className="glass-soft entrada rounded-2xl p-4"
                                        style={{ "--i": i } as CSSProperties}
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                                            <div className="min-w-0">
                                                <p className="font-display text-lg font-medium">
                                                    {cita.hora} · {cita.gestante}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {cita.tipo_control}
                                                </p>
                                            </div>
                                            <Insignia
                                                tono={vigente(cita.estado) ? "marca" : "neutro"}
                                            >
                                                {ESTADO_CITA_TEXTO[cita.estado]}
                                            </Insignia>
                                        </div>

                                        {vigente(cita.estado) && (
                                            <div className="mt-3 flex justify-end">
                                                <DialogoControl
                                                    embarazoId={cita.embarazo_id}
                                                    gestante={cita.gestante}
                                                    citaId={cita.id}
                                                    tipos={catalogoMedicion}
                                                    varianteBoton="vidrio"
                                                />
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Tarjeta>

                    {/* --- Alertas que piden atención ----------------------- */}
                    <Tarjeta>
                        <EncabezadoTarjeta
                            seccion="Pendientes"
                            titulo="Alertas por revisar"
                            accion={
                                datos.alertas_prioritarias.length > 0 ? (
                                    <Boton comoHijo variante="vidrio" tamano="sm">
                                        <Link href="/pro/alertas">Ver todas</Link>
                                    </Boton>
                                ) : undefined
                            }
                        />

                        {datos.alertas_prioritarias.length === 0 ? (
                            <Vacio
                                icono={BellRing}
                                titulo="Nada pendiente"
                                descripcion="Aquí aparecerán las alertas que generen los registros de tus pacientes."
                            />
                        ) : (
                            <div className="mt-4 space-y-3">
                                {datos.alertas_prioritarias.slice(0, 5).map((alerta, i) => (
                                    <Link
                                        key={alerta.id}
                                        href={`/pro/pacientes/${alerta.gestante_usuario_id}?seccion=alertas`}
                                        // Las críticas aparecen de inmediato: la información clínica no espera.
                                        className={cn(
                                            "block rounded-2xl transition-opacity hover:opacity-80",
                                            alerta.severidad !== "CRITICA" && "entrada",
                                        )}
                                        style={
                                            alerta.severidad !== "CRITICA"
                                                ? ({ "--i": i } as CSSProperties)
                                                : undefined
                                        }
                                    >
                                        <AlertaItem
                                            severidad={alerta.severidad}
                                            mensaje={alerta.mensaje}
                                            generadaEn={alerta.generada_en}
                                            detalle={
                                                alerta.valor_detectado != null
                                                    ? `${alerta.gestante} · valor registrado: ${alerta.valor_detectado}`
                                                    : alerta.gestante
                                            }
                                        />
                                    </Link>
                                ))}
                            </div>
                        )}
                    </Tarjeta>
                </div>
            </div>
        </>
    );
}

function Dato({
    etiqueta,
    valor,
    href,
    tono,
}: {
    etiqueta: string;
    valor: number;
    href: string;
    tono?: "advertencia" | "critica";
}) {
    return (
        <Link href={href} className="block">
            <Panel className="elevable h-full hover:bg-surface-strong">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {etiqueta}
                </p>
                <p
                    className={cn(
                        "entrada mt-1 font-display text-3xl font-semibold",
                        tono === "critica" && "text-critica",
                        tono === "advertencia" && "text-advertencia",
                    )}
                >
                    {valor}
                </p>
            </Panel>
        </Link>
    );
}
