"use client";

import { useEffect } from "react";
import { PencilLine, Save } from "lucide-react";
import { corregirControl, type ResultadoCorreccion } from "@/acciones/correcciones";
import { DialogoAccion } from "@/components/formularios/dialogo-accion";
import { AlertaItem } from "@/components/paneles/alerta-item";
import { Boton } from "@/components/ui/boton";
import { AvisoExito } from "@/components/ui/aviso-exito";
import { AvisoError, Campo } from "@/components/ui/campo";
import { useAccion } from "@/lib/usar-accion";
import type { Control } from "@/lib/tipos";

const INICIAL: ResultadoCorreccion = {};

/**
 * Corrige un control (hasta 7 días después): sus observaciones y el valor de cada
 * medición, o quita una que no correspondía. El motivo es obligatorio: es un registro
 * clínico y queda constancia de qué había antes y por qué se cambió.
 */
export function DialogoCorregirControl({
    embarazoId,
    control,
}: {
    embarazoId: number;
    control: Control;
}) {
    return (
        <DialogoAccion
            titulo="Corregir el control"
            descripcion={`Semana ${control.semana_gestacion}. Si cambias un valor, las alertas del anterior quedan anuladas y se evalúa el nuevo.`}
            disparador={
                <Boton variante="fantasma" tamano="sm">
                    <PencilLine aria-hidden />
                    Corregir
                </Boton>
            }
        >
            {({ onExito }) => <Formulario embarazoId={embarazoId} control={control} onExito={onExito} />}
        </DialogoAccion>
    );
}

function Formulario({
    embarazoId,
    control,
    onExito,
}: {
    embarazoId: number;
    control: Control;
    onExito: () => void;
}) {
    const [estado, enviar, enviando] = useAccion(corregirControl, INICIAL);
    const e = estado.porCampo ?? {};

    useEffect(() => {
        if (estado.ok) onExito();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    return (
        <form onSubmit={enviar} className="space-y-4" noValidate>
            <input type="hidden" name="embarazo_id" value={embarazoId} />
            <input type="hidden" name="control_id" value={control.id} />
            <AvisoError>{estado.error}</AvisoError>
            {estado.ok && <AvisoExito>{estado.resumen}</AvisoExito>}

            {estado.alertas && estado.alertas.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        La corrección generó {estado.alertas.length === 1 ? "una alerta" : `${estado.alertas.length} alertas`}
                    </p>
                    {estado.alertas.map((a) => (
                        <AlertaItem key={a.id} severidad={a.severidad} mensaje={a.mensaje} />
                    ))}
                </div>
            )}

            {!estado.ok && (
                <>
                    {control.mediciones.length > 0 && (
                        <fieldset className="space-y-3">
                            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Mediciones
                            </legend>
                            {control.mediciones.map((m) => (
                                <div key={m.tipo} className="flex items-end gap-3">
                                    <input type="hidden" name="medicion_tipo" value={m.tipo} />
                                    <div className="min-w-0 flex-1">
                                        <label htmlFor={`med-${m.tipo}`} className="block text-sm font-medium">
                                            {m.nombre}
                                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">{m.unidad}</span>
                                        </label>
                                        <input
                                            id={`med-${m.tipo}`}
                                            name="medicion_valor"
                                            type="number"
                                            inputMode="decimal"
                                            step="any"
                                            defaultValue={m.valor}
                                            aria-invalid={Boolean(e[`medicion_${m.tipo}`])}
                                            className="mt-1.5 h-11 w-full rounded-2xl border border-border-firme bg-input px-4 focus:border-ring"
                                        />
                                        {e[`medicion_${m.tipo}`] && (
                                            <p className="mt-1 text-xs font-medium text-critica">{e[`medicion_${m.tipo}`]}</p>
                                        )}
                                    </div>
                                    <label className="toque flex cursor-pointer items-center gap-2 pb-2 text-sm text-muted-foreground">
                                        <input type="checkbox" name="medicion_quitar" value={m.tipo} className="size-5 accent-primary" />
                                        Quitar
                                    </label>
                                </div>
                            ))}
                        </fieldset>
                    )}

                    <Campo etiqueta="Observaciones" error={e.observaciones}>
                        {(p) => (
                            <textarea
                                {...p}
                                name="observaciones"
                                rows={3}
                                maxLength={4000}
                                defaultValue={control.observaciones ?? ""}
                                className={`${p.className} h-auto py-3 leading-relaxed`}
                            />
                        )}
                    </Campo>

                    <Campo
                        etiqueta="¿Por qué se corrige?"
                        obligatorio
                        error={e.motivo}
                        ayuda="Queda en el historial de la paciente junto con el valor anterior."
                    >
                        {(p) => <input {...p} name="motivo" maxLength={255} required />}
                    </Campo>

                    <Boton type="submit" ancho="completo" tamano="lg" disabled={enviando}>
                        <Save aria-hidden />
                        {enviando ? "Guardando…" : "Guardar corrección"}
                    </Boton>
                </>
            )}
        </form>
    );
}
