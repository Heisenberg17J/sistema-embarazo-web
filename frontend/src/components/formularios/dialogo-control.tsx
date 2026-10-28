"use client";

import { useActionState, useEffect, useState } from "react";
import { ClipboardPlus, Plus, Save, X } from "lucide-react";
import { registrarControl, type ResultadoAccion } from "@/acciones/profesional";
import { DialogoAccion } from "@/components/formularios/dialogo-accion";
import { AlertaItem } from "@/components/paneles/alerta-item";
import { Boton } from "@/components/ui/boton";
import { AvisoExito } from "@/components/ui/aviso-exito";
import { AvisoError, Campo } from "@/components/ui/campo";
import { hoyLocal } from "@/lib/formato";
import type { TipoMedicion } from "@/lib/tipos";

const INICIAL: ResultadoAccion = {};

/** Lo que se toma en un control prenatal de rutina; el resto se añade a mano. */
const HABITUALES = [
    "PESO",
    "PA_SISTOLICA",
    "PA_DIASTOLICA",
    "ALTURA_UTERINA",
    "FCF",
];

interface Props {
    embarazoId: number;
    gestante: string;
    tipos: TipoMedicion[];
    /** Si viene de una cita, queda enlazada y la cita pasa a cumplida. */
    citaId?: number;
    textoBoton?: string;
    varianteBoton?: "primario" | "vidrio";
}

export function DialogoControl({
    embarazoId,
    gestante,
    tipos,
    citaId,
    textoBoton = "Registrar control",
    varianteBoton = "primario",
}: Props) {
    return (
        <DialogoAccion
            titulo="Registrar control prenatal"
            descripcion={`Paciente: ${gestante}.${citaId ? " La cita quedará marcada como cumplida." : ""}`}
            disparador={
                <Boton variante={varianteBoton} tamano="sm">
                    <ClipboardPlus aria-hidden />
                    {textoBoton}
                </Boton>
            }
        >
            {({ onExito }) => (
                <Formulario
                    embarazoId={embarazoId}
                    tipos={tipos}
                    citaId={citaId}
                    onExito={onExito}
                />
            )}
        </DialogoAccion>
    );
}

interface Fila {
    clave: number;
    tipo: string;
}

function Formulario({
    embarazoId,
    tipos,
    citaId,
    onExito,
}: {
    embarazoId: number;
    tipos: TipoMedicion[];
    citaId?: number;
    onExito: () => void;
}) {
    const [estado, enviar, enviando] = useActionState(registrarControl, INICIAL);

    const disponibles = tipos.filter((t) => t.activo);
    const [filas, setFilas] = useState<Fila[]>(() =>
        HABITUALES.filter((codigo) => disponibles.some((t) => t.codigo === codigo))
            .map((tipo, i) => ({ clave: i, tipo })),
    );

    useEffect(() => {
        if (estado.ok) onExito();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    const e = estado.porCampo ?? {};
    const sinUsar = disponibles.filter((t) => !filas.some((f) => f.tipo === t.codigo));

    const agregar = () => {
        const siguiente = sinUsar[0];
        if (!siguiente) return;
        setFilas((f) => [
            ...f,
            { clave: Math.max(0, ...f.map((x) => x.clave)) + 1, tipo: siguiente.codigo },
        ]);
    };

    return (
        <form action={enviar} className="space-y-4" noValidate>
            <input type="hidden" name="embarazo_id" value={embarazoId} />
            {citaId && <input type="hidden" name="cita_id" value={citaId} />}

            <AvisoError>{estado.error}</AvisoError>
            {estado.ok && <AvisoExito>{estado.resumen}</AvisoExito>}

            {/* La API devuelve las alertas que generó el control: se muestran
                aquí mismo para que el profesional las vea antes de cerrar. */}
            {estado.alertas && estado.alertas.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Este control generó {estado.alertas.length}{" "}
                        {estado.alertas.length === 1 ? "alerta" : "alertas"}
                    </p>
                    {estado.alertas.map((alerta) => (
                        <AlertaItem
                            key={alerta.id}
                            severidad={alerta.severidad}
                            mensaje={alerta.mensaje}
                            detalle={
                                alerta.valor_detectado != null
                                    ? `Valor registrado: ${alerta.valor_detectado}.`
                                    : null
                            }
                        />
                    ))}
                </div>
            )}

            {!estado.ok && (
                <>
                    <Campo
                        etiqueta="Fecha del control"
                        error={e.fecha}
                        ayuda="En blanco se registra con la fecha de hoy."
                    >
                        {(p) => (
                            <input
                                {...p}
                                name="fecha"
                                type="date"
                                max={hoyLocal()}
                                defaultValue={estado.valores?.fecha}
                            />
                        )}
                    </Campo>

                    <fieldset className="space-y-3">
                        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Mediciones
                        </legend>
                        <p className="-mt-1 text-xs text-muted-foreground">
                            Deja en blanco las que no tomaste.
                        </p>

                        {filas.map((fila) => {
                            const tipo = disponibles.find((t) => t.codigo === fila.tipo);
                            return (
                                <div key={fila.clave} className="flex items-end gap-2">
                                    <div className="min-w-0 flex-1">
                                        <label
                                            htmlFor={`medicion-${fila.clave}`}
                                            className="block text-sm font-medium"
                                        >
                                            {tipo?.nombre ?? fila.tipo}
                                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                                {tipo?.unidad}
                                            </span>
                                        </label>
                                        <input
                                            type="hidden"
                                            name="medicion_tipo"
                                            value={fila.tipo}
                                        />
                                        <input
                                            id={`medicion-${fila.clave}`}
                                            name="medicion_valor"
                                            type="number"
                                            inputMode="decimal"
                                            step={tipo?.decimales ? 0.1 : 1}
                                            min={tipo?.valor_min}
                                            max={tipo?.valor_max}
                                            placeholder={
                                                tipo
                                                    ? `${tipo.valor_min}–${tipo.valor_max}`
                                                    : undefined
                                            }
                                            className="mt-1.5 h-11 w-full rounded-2xl border border-border-firme bg-input px-4 placeholder:text-muted-foreground/70 focus:border-ring"
                                        />
                                    </div>
                                    <Boton
                                        variante="fantasma"
                                        tamano="icono"
                                        aria-label={`Quitar ${tipo?.nombre ?? fila.tipo}`}
                                        onClick={() =>
                                            setFilas((f) =>
                                                f.filter((x) => x.clave !== fila.clave),
                                            )
                                        }
                                    >
                                        <X aria-hidden />
                                    </Boton>
                                </div>
                            );
                        })}

                        {sinUsar.length > 0 && (
                            <Boton variante="vidrio" tamano="sm" onClick={agregar}>
                                <Plus aria-hidden />
                                Añadir {sinUsar[0].nombre.toLowerCase()}
                            </Boton>
                        )}
                    </fieldset>

                    <Campo etiqueta="Observaciones" error={e.observaciones}>
                        {(p) => (
                            <textarea
                                {...p}
                                name="observaciones"
                                rows={3}
                                maxLength={4000}
                                defaultValue={estado.valores?.observaciones}
                                placeholder="Evolución, indicaciones, próximos pasos…"
                                className={`${p.className} h-auto py-3 leading-relaxed`}
                            />
                        )}
                    </Campo>

                    <Boton type="submit" ancho="completo" tamano="lg" disabled={enviando}>
                        <Save aria-hidden />
                        {enviando ? "Guardando…" : "Guardar control"}
                    </Boton>
                </>
            )}
        </form>
    );
}
