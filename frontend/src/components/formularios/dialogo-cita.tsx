"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, CalendarPlus, PencilLine, Save } from "lucide-react";
import {
    cerrarCita,
    crearCita,
    reprogramarCita,
    type ResultadoAccion,
} from "@/acciones/profesional";
import { DialogoAccion } from "@/components/formularios/dialogo-accion";
import { Boton } from "@/components/ui/boton";
import { AvisoExito } from "@/components/ui/aviso-exito";
import { AvisoError, Campo } from "@/components/ui/campo";
import { hoyLocal } from "@/lib/formato";
import type { Cita, Paciente, TipoControl } from "@/lib/tipos";
import { useAccion } from "@/lib/usar-accion";

const INICIAL: ResultadoAccion = {};

// ---------------------------------------------------------------------------
// Programar una cita nueva
// ---------------------------------------------------------------------------

export function DialogoNuevaCita({
    tipos,
    pacientes,
    embarazoId,
    gestante,
    textoBoton = "Programar cita",
}: {
    tipos: TipoControl[];
    /** Para elegir paciente desde la agenda. */
    pacientes?: Paciente[];
    /** Para programar desde la ficha, con la paciente ya fijada. */
    embarazoId?: number;
    gestante?: string;
    textoBoton?: string;
}) {
    // Solo se puede citar a quien tenga un embarazo activo.
    const elegibles = (pacientes ?? []).filter((p) => p.embarazo_id != null);

    return (
        <DialogoAccion
            titulo="Programar una cita"
            descripcion={
                gestante
                    ? `Paciente: ${gestante}.`
                    : "La gestante la verá en su app y podrá cancelarla indicando el motivo."
            }
            disparador={
                <Boton tamano="sm">
                    <CalendarPlus aria-hidden />
                    {textoBoton}
                </Boton>
            }
        >
            {({ onExito }) => (
                <FormularioNueva
                    tipos={tipos.filter((t) => t.activo)}
                    elegibles={elegibles}
                    embarazoId={embarazoId}
                    onExito={onExito}
                />
            )}
        </DialogoAccion>
    );
}

function FormularioNueva({
    tipos,
    elegibles,
    embarazoId,
    onExito,
}: {
    tipos: TipoControl[];
    elegibles: Paciente[];
    embarazoId?: number;
    onExito: () => void;
}) {
    const [estado, enviar, enviando] = useAccion(crearCita, INICIAL);
    const e = estado.porCampo ?? {};
    const v = estado.valores ?? {};
    // Controlados: un <select> no controlado pierde la opción elegida cuando
    // React restablece el formulario tras un error.
    const [paciente, setPaciente] = useState("");
    const [tipoControl, setTipoControl] = useState("");

    useEffect(() => {
        if (estado.ok) onExito();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    if (!embarazoId && elegibles.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                Ninguna de tus pacientes tiene un embarazo registrado todavía, así que
                no hay a quién citar.
            </p>
        );
    }

    return (
        <form onSubmit={enviar} className="space-y-4" noValidate>
            <AvisoError>{estado.error}</AvisoError>
            {estado.ok && <AvisoExito>{estado.resumen}</AvisoExito>}

            {!estado.ok && (
                <>
                    {embarazoId ? (
                        <input type="hidden" name="embarazo_id" value={embarazoId} />
                    ) : (
                        <Campo etiqueta="Paciente" obligatorio error={e.embarazo_id}>
                            {(p) => (
                                <select
                                    {...p}
                                    name="embarazo_id"
                                    value={paciente}
                                    onChange={(ev) => setPaciente(ev.target.value)}
                                    required
                                >
                                    <option value="" disabled>
                                        Elige una paciente
                                    </option>
                                    {elegibles.map((paciente) => (
                                        <option
                                            key={paciente.gestante_usuario_id}
                                            value={String(paciente.embarazo_id)}
                                        >
                                            {paciente.gestante}
                                            {paciente.semana_actual != null &&
                                                ` · semana ${paciente.semana_actual}`}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </Campo>
                    )}

                    <Campo etiqueta="Tipo de control" obligatorio error={e.tipo_control}>
                        {(p) => (
                            <select
                                {...p}
                                name="tipo_control"
                                value={tipoControl}
                                onChange={(ev) => setTipoControl(ev.target.value)}
                                required
                            >
                                <option value="" disabled>
                                    Elige una opción
                                </option>
                                {tipos.map((t) => (
                                    <option key={t.codigo} value={t.codigo}>
                                        {t.nombre} ({t.duracion_min} min)
                                    </option>
                                ))}
                            </select>
                        )}
                    </Campo>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Campo etiqueta="Fecha" obligatorio error={e.fecha}>
                            {(p) => (
                                <input
                                    {...p}
                                    name="fecha"
                                    type="date"
                                    min={hoyLocal()}
                                    defaultValue={v.fecha}
                                    required
                                />
                            )}
                        </Campo>
                        <Campo etiqueta="Hora" obligatorio error={e.hora}>
                            {(p) => (
                                <input
                                    {...p}
                                    name="hora"
                                    type="time"
                                    defaultValue={v.hora}
                                    required
                                />
                            )}
                        </Campo>
                    </div>

                    <Campo
                        etiqueta="Duración en minutos"
                        error={e.duracion_min}
                        ayuda="En blanco se usa la duración propia del tipo de control."
                    >
                        {(p) => (
                            <input
                                {...p}
                                name="duracion_min"
                                type="number"
                                min={5}
                                max={240}
                                step={5}
                                defaultValue={v.duracion_min}
                            />
                        )}
                    </Campo>

                    <Boton type="submit" ancho="completo" tamano="lg" disabled={enviando}>
                        <Save aria-hidden />
                        {enviando ? "Programando…" : "Programar cita"}
                    </Boton>
                </>
            )}
        </form>
    );
}

// ---------------------------------------------------------------------------
// Reprogramar
// ---------------------------------------------------------------------------

export function DialogoReprogramar({ cita }: { cita: Cita }) {
    return (
        <DialogoAccion
            titulo="Reprogramar la cita"
            descripcion={`${cita.gestante} · ${cita.tipo_control_nombre}`}
            disparador={
                <Boton variante="vidrio" tamano="sm">
                    <PencilLine aria-hidden />
                    Reprogramar
                </Boton>
            }
        >
            {({ onExito }) => <FormularioReprogramar cita={cita} onExito={onExito} />}
        </DialogoAccion>
    );
}

function FormularioReprogramar({
    cita,
    onExito,
}: {
    cita: Cita;
    onExito: () => void;
}) {
    const [estado, enviar, enviando] = useAccion(reprogramarCita, INICIAL);
    const e = estado.porCampo ?? {};

    useEffect(() => {
        if (estado.ok) onExito();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    return (
        <form onSubmit={enviar} className="space-y-4" noValidate>
            <input type="hidden" name="cita_id" value={cita.id} />

            <AvisoError>{estado.error}</AvisoError>
            {estado.ok && <AvisoExito>{estado.resumen}</AvisoExito>}

            {!estado.ok && (
                <>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Campo etiqueta="Nueva fecha" error={e.fecha}>
                            {(p) => (
                                <input
                                    {...p}
                                    name="fecha"
                                    type="date"
                                    min={hoyLocal()}
                                    defaultValue={cita.fecha}
                                />
                            )}
                        </Campo>
                        <Campo etiqueta="Nueva hora" error={e.hora}>
                            {(p) => (
                                <input
                                    {...p}
                                    name="hora"
                                    type="time"
                                    defaultValue={cita.hora}
                                />
                            )}
                        </Campo>
                    </div>

                    <Campo etiqueta="Duración en minutos" error={e.duracion_min}>
                        {(p) => (
                            <input
                                {...p}
                                name="duracion_min"
                                type="number"
                                min={5}
                                max={240}
                                step={5}
                                defaultValue={cita.duracion_min}
                            />
                        )}
                    </Campo>

                    <Boton type="submit" ancho="completo" tamano="lg" disabled={enviando}>
                        <Save aria-hidden />
                        {enviando ? "Guardando…" : "Guardar cambios"}
                    </Boton>
                </>
            )}
        </form>
    );
}

// ---------------------------------------------------------------------------
// Cerrar: cumplida, no asistió o cancelada
// ---------------------------------------------------------------------------

export function DialogoCerrarCita({ cita }: { cita: Cita }) {
    return (
        <DialogoAccion
            titulo="Cerrar la cita"
            descripcion={`${cita.gestante} · ${cita.tipo_control_nombre}`}
            cerrarAlExito
            disparador={
                <Boton variante="vidrio" tamano="sm">
                    <CalendarCheck aria-hidden />
                    Cerrar
                </Boton>
            }
        >
            {({ onExito, cerrar }) => (
                <FormularioCerrar cita={cita} onExito={onExito} cerrar={cerrar} />
            )}
        </DialogoAccion>
    );
}

function FormularioCerrar({
    cita,
    onExito,
    cerrar,
}: {
    cita: Cita;
    onExito: () => void;
    cerrar: () => void;
}) {
    const [estado, enviar, enviando] = useAccion(cerrarCita, INICIAL);
    const e = estado.porCampo ?? {};
    const [resultado, setResultado] = useState("CUMPLIDA");

    useEffect(() => {
        if (estado.ok) onExito();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    return (
        <form onSubmit={enviar} className="space-y-4" noValidate>
            <input type="hidden" name="cita_id" value={cita.id} />
            <AvisoError>{estado.error}</AvisoError>

            <Campo etiqueta="¿Qué pasó con la cita?" obligatorio error={e.estado}>
                {(p) => (
                    <select
                        {...p}
                        name="estado"
                        value={resultado}
                        onChange={(ev) => setResultado(ev.target.value)}
                        required
                    >
                        <option value="CUMPLIDA">La paciente asistió</option>
                        <option value="NO_ASISTIO">No asistió</option>
                        <option value="CANCELADA">Se cancela</option>
                    </select>
                )}
            </Campo>

            <Campo
                etiqueta="Motivo"
                error={e.motivo_cancelacion}
                ayuda="Obligatorio solo si se cancela. La gestante lo verá."
            >
                {(p) => <input {...p} name="motivo_cancelacion" maxLength={255} />}
            </Campo>

            <p className="text-xs text-muted-foreground">
                Si asistió, recuerda registrar el control desde la agenda para que
                queden las mediciones.
            </p>

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Boton
                    type="submit"
                    ancho="completo"
                    tamano="lg"
                    disabled={enviando}
                >
                    {enviando ? "Guardando…" : "Guardar"}
                </Boton>
                <Boton
                    variante="vidrio"
                    ancho="completo"
                    tamano="lg"
                    onClick={cerrar}
                >
                    Cancelar
                </Boton>
            </div>
        </form>
    );
}
