"use client";

import { useEffect } from "react";
import { PencilLine, Save } from "lucide-react";
import { corregirExamen, type ResultadoCorreccion } from "@/acciones/correcciones";
import { DialogoAccion } from "@/components/formularios/dialogo-accion";
import { Boton } from "@/components/ui/boton";
import { AvisoError, Campo } from "@/components/ui/campo";
import { useAccion } from "@/lib/usar-accion";
import type { Examen } from "@/lib/tipos";

const INICIAL: ResultadoCorreccion = {};

/** Corrige un examen (hasta 7 días después). La gestante verá el resultado corregido. */
export function DialogoCorregirExamen({
    embarazoId,
    examen,
}: {
    embarazoId: number;
    examen: Examen;
}) {
    return (
        <DialogoAccion
            titulo="Corregir el examen"
            descripcion={examen.tipo_nombre}
            cerrarAlExito
            disparador={
                <Boton variante="fantasma" tamano="sm">
                    <PencilLine aria-hidden />
                    Corregir
                </Boton>
            }
        >
            {({ onExito, cerrar }) => (
                <Formulario embarazoId={embarazoId} examen={examen} onExito={onExito} cerrar={cerrar} />
            )}
        </DialogoAccion>
    );
}

function Formulario({
    embarazoId,
    examen,
    onExito,
    cerrar,
}: {
    embarazoId: number;
    examen: Examen;
    onExito: () => void;
    cerrar: () => void;
}) {
    const [estado, enviar, enviando] = useAccion(corregirExamen, INICIAL);
    const e = estado.porCampo ?? {};

    useEffect(() => {
        if (estado.ok) onExito();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    return (
        <form onSubmit={enviar} className="space-y-4" noValidate>
            <input type="hidden" name="embarazo_id" value={embarazoId} />
            <input type="hidden" name="examen_id" value={examen.id} />
            <AvisoError>{estado.error}</AvisoError>

            <Campo etiqueta="Resultado" obligatorio error={e.resultado}>
                {(p) => (
                    <textarea
                        {...p}
                        name="resultado"
                        rows={4}
                        maxLength={4000}
                        defaultValue={examen.resultado}
                        className={`${p.className} h-auto py-3 leading-relaxed`}
                        required
                    />
                )}
            </Campo>

            <Campo etiqueta="Observaciones" error={e.observaciones}>
                {(p) => (
                    <textarea
                        {...p}
                        name="observaciones"
                        rows={2}
                        maxLength={4000}
                        defaultValue={examen.observaciones ?? ""}
                        className={`${p.className} h-auto py-3 leading-relaxed`}
                    />
                )}
            </Campo>

            <Campo
                etiqueta="¿Por qué se corrige?"
                obligatorio
                error={e.motivo}
                ayuda="Queda en el historial de la paciente junto con el resultado anterior."
            >
                {(p) => <input {...p} name="motivo" maxLength={255} required />}
            </Campo>

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Boton type="submit" ancho="completo" tamano="lg" disabled={enviando}>
                    <Save aria-hidden />
                    {enviando ? "Guardando…" : "Guardar corrección"}
                </Boton>
                <Boton variante="vidrio" ancho="completo" tamano="lg" onClick={cerrar}>
                    Cancelar
                </Boton>
            </div>
        </form>
    );
}
