import {
    Activity,
    BellRing,
    CalendarDays,
    ClipboardList,
    FlaskConical,
    type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { marcaTiempo } from "@/lib/formato";
import { ESTADO_CITA_TEXTO } from "@/lib/formato";
import type { EventoHistorial } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const ESTILO: Record<
    EventoHistorial["tipo"],
    { icono: LucideIcon; nombre: string; color: string; fondo: string }
> = {
    CONTROL: {
        icono: ClipboardList,
        nombre: "Control",
        color: "text-brand-deep",
        fondo: "bg-informativa-suave",
    },
    SINTOMA: {
        icono: Activity,
        nombre: "Síntoma",
        color: "text-secondary-foreground",
        fondo: "bg-secondary/60",
    },
    EXAMEN: {
        icono: FlaskConical,
        nombre: "Examen",
        color: "text-exito",
        fondo: "bg-exito-suave",
    },
    CITA: {
        icono: CalendarDays,
        nombre: "Cita",
        color: "text-brand-deep",
        fondo: "bg-surface-strong",
    },
    ALERTA: {
        icono: BellRing,
        nombre: "Alerta",
        color: "text-critica",
        fondo: "bg-critica-suave",
    },
};

/** Pestaña de la ficha de la paciente donde vive cada tipo de registro. */
const SECCION_FICHA: Record<EventoHistorial["tipo"], string> = {
    CONTROL: "controles",
    SINTOMA: "sintomas",
    EXAMEN: "examenes",
    CITA: "citas",
    ALERTA: "alertas",
};

/** Historial cronológico unificado (RF-09). */
export function LineaTiempo({ eventos }: { eventos: EventoHistorial[] }) {
    return (
        <ol className="relative mt-5 space-y-4 pl-9">
            {/* Línea vertical que une los eventos. */}
            <span
                aria-hidden
                className="absolute bottom-2 left-[1.0625rem] top-2 w-px bg-border-firme"
            />

            {eventos.map((evento) => {
                const estilo = ESTILO[evento.tipo];
                // En las citas, el campo estado trae PROGRAMADA, CUMPLIDA, etc.
                const estado =
                    evento.tipo === "CITA" && evento.estado
                        ? ESTADO_CITA_TEXTO[evento.estado]
                        : evento.estado;

                return (
                    <li
                        key={`${evento.tipo}-${evento.registro_id}`}
                        className="relative"
                    >
                        <span
                            className={cn(
                                "absolute -left-9 grid size-[2.125rem] place-items-center rounded-full ring-4 ring-background/0",
                                estilo.fondo,
                            )}
                        >
                            <estilo.icono
                                className={cn("size-4", estilo.color)}
                                aria-hidden
                            />
                        </span>

                        <div className="glass-soft rounded-2xl p-4">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                <p className="text-sm font-semibold">
                                    <span className="sr-only">{estilo.nombre}: </span>
                                    {evento.titulo}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                    {marcaTiempo(evento.fecha)}
                                </p>
                            </div>
                            {evento.gestante && evento.gestante_id && (
                                <p className="mt-1 text-sm">
                                    <Link
                                        href={`/pro/pacientes/${evento.gestante_id}?seccion=${SECCION_FICHA[evento.tipo]}`}
                                        className="font-medium text-brand-deep underline-offset-2 hover:underline"
                                    >
                                        {evento.gestante}
                                    </Link>
                                </p>
                            )}
                            {evento.detalle && (
                                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                    {evento.detalle}
                                </p>
                            )}
                            {estado && (
                                <p className="mt-1.5 text-xs font-medium text-muted-foreground">
                                    {estado}
                                </p>
                            )}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}
