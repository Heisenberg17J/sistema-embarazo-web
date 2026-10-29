import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { DialogoControl } from "@/components/formularios/dialogo-control";
import {
    DialogoCerrarCita,
    DialogoNuevaCita,
    DialogoReprogramar,
} from "@/components/formularios/dialogo-cita";
import { Saludo } from "@/components/layout/saludo";
import { Boton } from "@/components/ui/boton";
import { Insignia, type TonoInsignia } from "@/components/ui/insignia";
import { EncabezadoTarjeta, Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { citas, pacientes, tiposControl, tiposMedicion } from "@/lib/datos";
import {
    ESTADO_CITA_TEXTO,
    capitalizar,
    enDias,
    fechaLarga,
    hoyLocal,
} from "@/lib/formato";
import { exigirRol } from "@/lib/sesion-servidor";
import type { Cita, EstadoCita } from "@/lib/tipos";

export const metadata: Metadata = { title: "Mi agenda" };

const TONO: Record<EstadoCita, TonoInsignia> = {
    PROGRAMADA: "marca",
    REPROGRAMADA: "marca",
    CUMPLIDA: "exito",
    CANCELADA: "neutro",
    NO_ASISTIO: "advertencia",
};

const VIGENTE = (estado: EstadoCita) =>
    estado === "PROGRAMADA" || estado === "REPROGRAMADA";

const soloFecha = (v: string | string[] | undefined, porDefecto: string) =>
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : porDefecto;

export default async function PaginaAgenda({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    await exigirRol("PROFESIONAL");
    const params = await searchParams;

    // Por defecto, la semana que viene.
    const desde = soloFecha(params.desde, hoyLocal());
    const hasta = soloFecha(params.hasta, enDias(7));

    const [agenda, listaPacientes, catalogoControl, catalogoMedicion] =
        await Promise.all([
            citas({ desde, hasta, limit: 100 }),
            pacientes(),
            tiposControl(),
            tiposMedicion(),
        ]);

    // La API ya devuelve las citas ordenadas por fecha y hora.
    const porDia = new Map<string, Cita[]>();
    for (const cita of agenda.datos) {
        const dia = porDia.get(cita.fecha) ?? [];
        dia.push(cita);
        porDia.set(cita.fecha, dia);
    }

    return (
        <>
            <Saludo
                titulo="Mi agenda"
                conFecha={false}
                subtitulo="Tus citas programadas. Al registrar el control de una cita, queda marcada como cumplida."
                acciones={
                    <DialogoNuevaCita
                        tipos={catalogoControl}
                        pacientes={listaPacientes}
                    />
                }
            />

            <div className="space-y-5">
                <Tarjeta indice={0}>
                    {/* Formulario GET: el rango queda en la URL y se puede compartir. */}
                    <form
                        action="/pro/agenda"
                        className="flex flex-wrap items-end gap-3"
                    >
                        <div className="min-w-36 flex-1">
                            <label
                                htmlFor="desde"
                                className="block text-sm font-medium"
                            >
                                Desde
                            </label>
                            <input
                                id="desde"
                                name="desde"
                                type="date"
                                defaultValue={desde}
                                className="mt-1.5 h-11 w-full rounded-2xl border border-border-firme bg-input px-4 focus:border-ring"
                            />
                        </div>
                        <div className="min-w-36 flex-1">
                            <label
                                htmlFor="hasta"
                                className="block text-sm font-medium"
                            >
                                Hasta
                            </label>
                            <input
                                id="hasta"
                                name="hasta"
                                type="date"
                                defaultValue={hasta}
                                className="mt-1.5 h-11 w-full rounded-2xl border border-border-firme bg-input px-4 focus:border-ring"
                            />
                        </div>
                        <Boton type="submit" variante="vidrio">
                            Ver
                        </Boton>
                    </form>

                    {porDia.size === 0 && (
                        <Vacio
                            icono={CalendarDays}
                            titulo="No hay citas en estas fechas"
                            descripcion="Cambia el rango o programa una cita nueva."
                        />
                    )}
                </Tarjeta>

                {[...porDia.entries()].map(([dia, citasDelDia]) => (
                    <Tarjeta key={dia}>
                        <EncabezadoTarjeta
                            seccion={dia === hoyLocal() ? "Hoy" : undefined}
                            titulo={capitalizar(fechaLarga(dia))}
                            accion={
                                <Insignia>
                                    {citasDelDia.length}{" "}
                                    {citasDelDia.length === 1 ? "cita" : "citas"}
                                </Insignia>
                            }
                        />

                        <ul className="mt-4 space-y-3">
                            {citasDelDia.map((cita) => (
                                <li key={cita.id} className="glass-soft rounded-2xl p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                                        <div className="min-w-0">
                                            <p className="font-display text-lg font-medium">
                                                {cita.hora} ·{" "}
                                                <Link
                                                    href={`/pro/pacientes/${cita.gestante_usuario_id}`}
                                                    className="underline-offset-4 hover:underline"
                                                >
                                                    {cita.gestante}
                                                </Link>
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {cita.tipo_control_nombre} ·{" "}
                                                {cita.duracion_min} minutos
                                            </p>
                                        </div>
                                        <Insignia tono={TONO[cita.estado]}>
                                            {ESTADO_CITA_TEXTO[cita.estado]}
                                        </Insignia>
                                    </div>

                                    {cita.motivo_cancelacion && (
                                        <p className="mt-2 rounded-xl bg-surface-soft px-3 py-2 text-xs text-muted-foreground">
                                            <span className="font-medium">Motivo:</span>{" "}
                                            {cita.motivo_cancelacion}
                                        </p>
                                    )}

                                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                                        {VIGENTE(cita.estado) ? (
                                            <>
                                                <DialogoCerrarCita cita={cita} />
                                                <DialogoReprogramar cita={cita} />
                                                <DialogoControl
                                                    embarazoId={cita.embarazo_id}
                                                    gestante={cita.gestante}
                                                    citaId={cita.id}
                                                    tipos={catalogoMedicion}
                                                />
                                            </>
                                        ) : (
                                            <Boton
                                                comoHijo
                                                variante="fantasma"
                                                tamano="sm"
                                            >
                                                <Link
                                                    href={`/pro/pacientes/${cita.gestante_usuario_id}`}
                                                >
                                                    Ver ficha
                                                    <ChevronRight aria-hidden />
                                                </Link>
                                            </Boton>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </Tarjeta>
                ))}
            </div>
        </>
    );
}
