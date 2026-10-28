import type { Metadata } from "next";
import { CalendarClock, CalendarDays, Clock, Stethoscope } from "lucide-react";
import { Saludo } from "@/components/layout/saludo";
import { Insignia, type TonoInsignia } from "@/components/ui/insignia";
import { EncabezadoTarjeta, Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { SinEmbarazo } from "@/components/paneles/sin-embarazo";
import { citasDeEmbarazo, embarazoActivo } from "@/lib/datos";
import { ESTADO_CITA_TEXTO, capitalizar, fechaLarga } from "@/lib/formato";
import { exigirRol } from "@/lib/sesion-servidor";
import type { Cita, EstadoCita } from "@/lib/tipos";
import { BotonCancelar } from "./boton-cancelar";

export const metadata: Metadata = { title: "Mis citas" };

const TONO: Record<EstadoCita, TonoInsignia> = {
    PROGRAMADA: "marca",
    REPROGRAMADA: "marca",
    CUMPLIDA: "exito",
    CANCELADA: "neutro",
    NO_ASISTIO: "advertencia",
};

const VIGENTE = (estado: EstadoCita) =>
    estado === "PROGRAMADA" || estado === "REPROGRAMADA";

export default async function PaginaCitas() {
    await exigirRol("GESTANTE");
    const embarazo = await embarazoActivo();

    if (!embarazo) {
        return (
            <>
                <Saludo
                    titulo="Mis citas"
                    conFecha={false}
                    subtitulo="Aquí verás las citas que agende tu profesional."
                />
                <SinEmbarazo />
            </>
        );
    }

    const [proximas, anteriores] = await Promise.all([
        citasDeEmbarazo(embarazo.embarazo_id, "proximas"),
        citasDeEmbarazo(embarazo.embarazo_id, "anteriores"),
    ]);

    return (
        <>
            <Saludo
                titulo="Mis citas"
                conFecha={false}
                subtitulo="Tus próximas citas y las que ya pasaron. Las agenda tu profesional de salud."
            />

            <div className="space-y-5">
                <Tarjeta>
                    <EncabezadoTarjeta
                        seccion="Próximas"
                        accion={
                            proximas.length > 0 ? (
                                <Insignia tono="marca">
                                    {proximas.length}{" "}
                                    {proximas.length === 1 ? "cita" : "citas"}
                                </Insignia>
                            ) : undefined
                        }
                    />

                    {proximas.length === 0 ? (
                        <Vacio
                            icono={CalendarClock}
                            titulo="No tienes citas programadas"
                            descripcion="Tu profesional de salud agenda los controles prenatales. Aparecerán aquí en cuanto lo haga."
                        />
                    ) : (
                        <ul className="mt-4 space-y-3">
                            {proximas.map((cita) => (
                                <TarjetaCita key={cita.id} cita={cita} proxima />
                            ))}
                        </ul>
                    )}
                </Tarjeta>

                <Tarjeta>
                    <EncabezadoTarjeta seccion="Anteriores" />

                    {anteriores.length === 0 ? (
                        <Vacio
                            icono={CalendarDays}
                            titulo="Aún no hay citas pasadas"
                            descripcion="Cuando asistas a tu primer control aparecerá aquí."
                        />
                    ) : (
                        <ul className="mt-4 space-y-3">
                            {anteriores.map((cita) => (
                                <TarjetaCita key={cita.id} cita={cita} />
                            ))}
                        </ul>
                    )}
                </Tarjeta>
            </div>
        </>
    );
}

function TarjetaCita({ cita, proxima }: { cita: Cita; proxima?: boolean }) {
    return (
        <li className="glass-soft rounded-2xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <div className="min-w-0">
                    <p className="font-display text-lg font-medium text-balance">
                        {cita.tipo_control_nombre}
                    </p>
                    <p className="mt-0.5 text-sm font-medium">
                        {capitalizar(fechaLarga(cita.fecha))} · {cita.hora}
                    </p>
                </div>
                <Insignia tono={TONO[cita.estado]}>
                    {ESTADO_CITA_TEXTO[cita.estado]}
                </Insignia>
            </div>

            <dl className="mt-3 space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                    <dt className="sr-only">Profesional</dt>
                    <Stethoscope className="size-4 shrink-0" aria-hidden />
                    <dd>{cita.profesional}</dd>
                </div>
                <div className="flex items-center gap-2">
                    <dt className="sr-only">Duración</dt>
                    <Clock className="size-4 shrink-0" aria-hidden />
                    <dd>{cita.duracion_min} minutos</dd>
                </div>
            </dl>

            {cita.motivo_cancelacion && (
                <p className="mt-3 rounded-xl bg-surface-soft px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium">Motivo de la cancelación:</span>{" "}
                    {cita.motivo_cancelacion}
                </p>
            )}

            {proxima && VIGENTE(cita.estado) && (
                <div className="mt-3 flex justify-end">
                    <BotonCancelar
                        citaId={cita.id}
                        descripcion={`${cita.tipo_control_nombre} · ${capitalizar(fechaLarga(cita.fecha))} a las ${cita.hora}`}
                    />
                </div>
            )}
        </li>
    );
}
