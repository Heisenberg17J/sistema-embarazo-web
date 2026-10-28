import Link from "next/link";
import { CalendarClock, ChevronRight, TriangleAlert } from "lucide-react";
import { Insignia } from "@/components/ui/insignia";
import { Panel } from "@/components/ui/tarjeta";
import { capitalizar, fechaCorta, marcaTiempo } from "@/lib/formato";
import type { Paciente } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/** Tarjeta de una paciente asignada (RF-13). */
export function TarjetaPaciente({ paciente }: { paciente: Paciente }) {
    const sinEmbarazo = paciente.embarazo_id == null;
    const criticas = paciente.alertas_criticas > 0;

    return (
        <Link
            href={`/pro/pacientes/${paciente.gestante_usuario_id}`}
            className={cn(
                "glass-soft block rounded-2xl p-4 transition-colors hover:bg-surface-strong",
                criticas && "border-l-4 border-l-critica-borde",
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-display text-lg font-medium text-balance">
                        {paciente.gestante}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        {sinEmbarazo
                            ? "Sin embarazo registrado"
                            : `Semana ${paciente.edad_gestacional ?? paciente.semana_actual} · parto estimado ${fechaCorta(paciente.fecha_estimada_parto!)}`}
                    </p>
                </div>
                <ChevronRight
                    className="mt-1 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
                {criticas && (
                    <Insignia tono="critica">
                        <TriangleAlert aria-hidden />
                        {paciente.alertas_criticas} de atención inmediata
                    </Insignia>
                )}
                {paciente.alertas_pendientes > paciente.alertas_criticas && (
                    <Insignia tono="advertencia">
                        {paciente.alertas_pendientes - paciente.alertas_criticas} sin
                        revisar
                    </Insignia>
                )}
                {paciente.proxima_cita ? (
                    <Insignia tono="marca">
                        <CalendarClock aria-hidden />
                        {capitalizar(marcaTiempo(paciente.proxima_cita))}
                    </Insignia>
                ) : (
                    !sinEmbarazo && <Insignia>Sin cita programada</Insignia>
                )}
            </div>
        </Link>
    );
}

/** Resumen compacto para el encabezado de la ficha. */
export function DatoPaciente({
    etiqueta,
    valor,
}: {
    etiqueta: string;
    valor: React.ReactNode;
}) {
    return (
        <Panel>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {etiqueta}
            </p>
            <p className="mt-1 font-medium">{valor}</p>
        </Panel>
    );
}
