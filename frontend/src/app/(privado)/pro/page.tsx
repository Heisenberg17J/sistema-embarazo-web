import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, CalendarClock, CalendarPlus } from "lucide-react";
import { DialogoControl } from "@/components/formularios/dialogo-control";
import { Saludo } from "@/components/layout/saludo";
import { AlertaItem } from "@/components/paneles/alerta-item";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { EncabezadoTarjeta, Panel, Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { panel, tiposMedicion } from "@/lib/datos";
import { ESTADO_CITA_TEXTO } from "@/lib/formato";
import { exigirRol } from "@/lib/sesion-servidor";
import type { PanelProfesional } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Panel" };

export default async function PaginaPanelProfesional() {
    const sesion = await exigirRol("PROFESIONAL");
    const [datos, catalogoMedicion] = await Promise.all([
        panel<PanelProfesional>(),
        tiposMedicion(),
    ]);

    const { resumen } = datos;
    const vigente = (estado: string) =>
        estado === "PROGRAMADA" || estado === "REPROGRAMADA";

    return (
        <>
            <Saludo
                nombre={sesion.nombre}
                subtitulo={
                    resumen.pacientes === 0
                        ? "Todavía no tienes pacientes asignadas. El administrador se encarga de asignarlas."
                        : `Tienes ${resumen.pacientes} ${resumen.pacientes === 1 ? "paciente asignada" : "pacientes asignadas"}.`
                }
            />

            <div className="space-y-5">
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
                                {datos.citas_hoy.map((cita) => (
                                    <li
                                        key={cita.id}
                                        className="glass-soft rounded-2xl p-4"
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
                                {datos.alertas_prioritarias.slice(0, 5).map((alerta) => (
                                    <Link
                                        key={alerta.id}
                                        href={`/pro/pacientes/${alerta.gestante_usuario_id}?seccion=alertas`}
                                        className="block rounded-2xl transition-opacity hover:opacity-80"
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
            <Panel className="h-full transition-colors hover:bg-surface-strong">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {etiqueta}
                </p>
                <p
                    className={cn(
                        "mt-1 font-display text-3xl font-semibold",
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
