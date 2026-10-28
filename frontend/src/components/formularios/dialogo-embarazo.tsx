"use client";

import { useEffect, useState } from "react";
import { Baby, CalendarCheck, PencilLine, Save } from "lucide-react";
import {
    actualizarEmbarazo,
    finalizarEmbarazo,
    registrarEmbarazoDePaciente,
    type ResultadoEmbarazo,
} from "@/acciones/embarazo";
import { DialogoAccion } from "@/components/formularios/dialogo-accion";
import { Boton } from "@/components/ui/boton";
import { AvisoError, Campo } from "@/components/ui/campo";
import { hoyLocal } from "@/lib/formato";
import { useAccion } from "@/lib/usar-accion";
import type { Embarazo } from "@/lib/tipos";

const INICIAL: ResultadoEmbarazo = {};

// ---------------------------------------------------------------------------
// Corregir los datos del embarazo
// ---------------------------------------------------------------------------

/**
 * La fecha de la última menstruación decide la semana de gestación, la fecha probable
 * de parto y la posición de cada punto en las gráficas. Al corregirla todo eso se
 * recalcula, y se explica antes de guardar.
 */
export function DialogoEditarEmbarazo({
    embarazo,
    texto = "Corregir los datos",
}: {
    embarazo: Embarazo;
    texto?: string;
}) {
    return (
        <DialogoAccion
            titulo="Corregir los datos del embarazo"
            descripcion="Si cambias la fecha de la última menstruación, la semana de gestación, la fecha probable de parto y las gráficas se recalculan."
            cerrarAlExito
            disparador={
                <Boton variante="vidrio" tamano="sm">
                    <PencilLine aria-hidden />
                    {texto}
                </Boton>
            }
        >
            {({ onExito, cerrar }) => <FormularioEditar embarazo={embarazo} onExito={onExito} cerrar={cerrar} />}
        </DialogoAccion>
    );
}

function FormularioEditar({
    embarazo,
    onExito,
    cerrar,
}: {
    embarazo: Embarazo;
    onExito: () => void;
    cerrar: () => void;
}) {
    const [estado, enviar, enviando] = useAccion(actualizarEmbarazo, INICIAL);
    const e = estado.porCampo ?? {};

    useEffect(() => {
        if (estado.ok) onExito();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    return (
        <form onSubmit={enviar} className="space-y-4" noValidate>
            <input type="hidden" name="embarazo_id" value={embarazo.embarazo_id} />
            {/* Para enviar solo lo que cambió: ver `actualizarEmbarazo`. */}
            <input type="hidden" name="fecha_inicio_original" value={embarazo.fecha_inicio} />
            <input type="hidden" name="fecha_estimada_parto_original" value={embarazo.fecha_estimada_parto} />
            <AvisoError>{estado.error}</AvisoError>

            <Campo etiqueta="Fecha de la última menstruación" obligatorio error={e.fecha_inicio}>
                {(p) => (
                    <input {...p} name="fecha_inicio" type="date" max={hoyLocal()} defaultValue={embarazo.fecha_inicio} required />
                )}
            </Campo>

            <Campo
                etiqueta="Fecha probable de parto"
                error={e.fecha_estimada_parto}
                ayuda="Se calcula sola a partir de la última menstruación. Cámbiala solo si tu profesional te indicó otra."
            >
                {(p) => (
                    <input {...p} name="fecha_estimada_parto" type="date" defaultValue={embarazo.fecha_estimada_parto} />
                )}
            </Campo>

            <div className="grid gap-4 sm:grid-cols-2">
                <Campo etiqueta="Talla en centímetros" error={e.talla_cm}>
                    {(p) => (
                        <input
                            {...p}
                            name="talla_cm"
                            type="number"
                            inputMode="decimal"
                            step="0.5"
                            min={120}
                            max={220}
                            defaultValue={embarazo.talla_cm ?? ""}
                        />
                    )}
                </Campo>
                <Campo etiqueta="Peso antes del embarazo (kg)" error={e.peso_pregestacional_kg}>
                    {(p) => (
                        <input
                            {...p}
                            name="peso_pregestacional_kg"
                            type="number"
                            inputMode="decimal"
                            step="0.1"
                            min={30}
                            max={200}
                            defaultValue={embarazo.peso_pregestacional_kg ?? ""}
                        />
                    )}
                </Campo>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Boton type="submit" tamano="lg" ancho="completo" disabled={enviando}>
                    <Save aria-hidden />
                    {enviando ? "Guardando…" : "Guardar cambios"}
                </Boton>
                <Boton variante="vidrio" tamano="lg" ancho="completo" onClick={cerrar}>
                    Cancelar
                </Boton>
            </div>
        </form>
    );
}

// ---------------------------------------------------------------------------
// Cerrar el embarazo
// ---------------------------------------------------------------------------

/**
 * Cerrar un embarazo es irreversible desde la aplicación, y es lo que permite registrar
 * el siguiente. El texto es cuidadoso a propósito: quien lo lee puede estar viviendo
 * un momento difícil.
 */
export function DialogoFinalizarEmbarazo({ embarazoId, texto = "Cerrar el embarazo" }: { embarazoId: number; texto?: string }) {
    return (
        <DialogoAccion
            titulo="Cerrar este embarazo"
            descripcion="Léelo con calma: no se puede deshacer."
            cerrarAlExito
            disparador={
                <Boton variante="contorno" tamano="sm">
                    <CalendarCheck aria-hidden />
                    {texto}
                </Boton>
            }
        >
            {({ onExito, cerrar }) => <FormularioFinalizar embarazoId={embarazoId} onExito={onExito} cerrar={cerrar} />}
        </DialogoAccion>
    );
}

function FormularioFinalizar({
    embarazoId,
    onExito,
    cerrar,
}: {
    embarazoId: number;
    onExito: () => void;
    cerrar: () => void;
}) {
    const [estado, enviar, enviando] = useAccion(finalizarEmbarazo, INICIAL);
    const [como, setComo] = useState("FINALIZADO");
    const e = estado.porCampo ?? {};

    useEffect(() => {
        if (estado.ok) onExito();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    return (
        <form onSubmit={enviar} className="space-y-4" noValidate>
            <input type="hidden" name="embarazo_id" value={embarazoId} />
            <AvisoError>{estado.error}</AvisoError>

            <Campo etiqueta="¿Cómo terminó?" obligatorio error={e.estado}>
                {(p) => (
                    <select {...p} name="estado" value={como} onChange={(ev) => setComo(ev.target.value)}>
                        <option value="FINALIZADO">Con el nacimiento de mi bebé</option>
                        <option value="CANCELADO">De otra manera (pérdida o interrupción)</option>
                    </select>
                )}
            </Campo>

            <Campo
                etiqueta="Fecha en que terminó"
                error={e.fecha_finalizacion}
                ayuda="Si la dejas en blanco, se usa la de hoy."
            >
                {(p) => <input {...p} name="fecha_finalizacion" type="date" max={hoyLocal()} />}
            </Campo>

            <div className="space-y-2 rounded-2xl bg-surface-soft px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                <p>
                    {como === "CANCELADO"
                        ? "Lamentamos que estés pasando por esto. Tu profesional de salud puede acompañarte."
                        : "¡Felicitaciones!"}
                </p>
                <p>
                    Al cerrarlo se cancelan las citas pendientes y ya no se pueden registrar datos nuevos en
                    este embarazo. Todo lo registrado se conserva. Podrás registrar otro embarazo cuando lo
                    necesites.
                </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Boton type="submit" variante="peligro" tamano="lg" ancho="completo" disabled={enviando}>
                    {enviando ? "Cerrando…" : "Sí, cerrar el embarazo"}
                </Boton>
                <Boton variante="vidrio" tamano="lg" ancho="completo" onClick={cerrar}>
                    Cancelar
                </Boton>
            </div>
        </form>
    );
}

// ---------------------------------------------------------------------------
// El profesional registra el embarazo de una paciente
// ---------------------------------------------------------------------------

export function DialogoRegistrarEmbarazoPaciente({
    gestanteId,
    gestante,
}: {
    gestanteId: number;
    gestante: string;
}) {
    return (
        <DialogoAccion
            titulo="Registrar el embarazo"
            descripcion={`Paciente: ${gestante}. Ella lo verá en su aplicación y podrá corregirlo.`}
            cerrarAlExito
            disparador={
                <Boton tamano="sm">
                    <Baby aria-hidden />
                    Registrar su embarazo
                </Boton>
            }
        >
            {({ onExito, cerrar }) => (
                <FormularioPaciente gestanteId={gestanteId} onExito={onExito} cerrar={cerrar} />
            )}
        </DialogoAccion>
    );
}

function FormularioPaciente({
    gestanteId,
    onExito,
    cerrar,
}: {
    gestanteId: number;
    onExito: () => void;
    cerrar: () => void;
}) {
    const [estado, enviar, enviando] = useAccion(registrarEmbarazoDePaciente, INICIAL);
    const e = estado.porCampo ?? {};

    useEffect(() => {
        if (estado.ok) onExito();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    return (
        <form onSubmit={enviar} className="space-y-4" noValidate>
            <input type="hidden" name="gestante_id" value={gestanteId} />
            <AvisoError>{estado.error}</AvisoError>

            <Campo
                etiqueta="Fecha de la última menstruación"
                obligatorio
                error={e.fecha_inicio}
                ayuda="La fecha probable de parto se calcula sola."
            >
                {(p) => <input {...p} name="fecha_inicio" type="date" max={hoyLocal()} required />}
            </Campo>

            <div className="grid gap-4 sm:grid-cols-2">
                <Campo etiqueta="Talla en centímetros" error={e.talla_cm}>
                    {(p) => <input {...p} name="talla_cm" type="number" inputMode="decimal" step="0.5" min={120} max={220} />}
                </Campo>
                <Campo etiqueta="Peso antes del embarazo (kg)" error={e.peso_pregestacional_kg}>
                    {(p) => (
                        <input {...p} name="peso_pregestacional_kg" type="number" inputMode="decimal" step="0.1" min={30} max={200} />
                    )}
                </Campo>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Boton type="submit" tamano="lg" ancho="completo" disabled={enviando}>
                    <Save aria-hidden />
                    {enviando ? "Guardando…" : "Registrar embarazo"}
                </Boton>
                <Boton variante="vidrio" tamano="lg" ancho="completo" onClick={cerrar}>
                    Cancelar
                </Boton>
            </div>
        </form>
    );
}
