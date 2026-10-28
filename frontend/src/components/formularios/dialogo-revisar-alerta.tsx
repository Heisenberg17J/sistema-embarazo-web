"use client";

import { useActionState, useEffect, useState } from "react";
import { CheckCheck } from "lucide-react";
import { revisarAlerta, type ResultadoAccion } from "@/acciones/profesional";
import { DialogoAccion } from "@/components/formularios/dialogo-accion";
import { Boton } from "@/components/ui/boton";
import { AvisoError, Campo } from "@/components/ui/campo";
import type { Alerta } from "@/lib/tipos";

const INICIAL: ResultadoAccion = {};

/**
 * RF-12. Marca una alerta como revisada o la descarta.
 * La gestante ve el cambio de estado en su propia pantalla de alertas.
 */
export function DialogoRevisarAlerta({ alerta }: { alerta: Alerta }) {
    return (
        <DialogoAccion
            titulo="Revisar la alerta"
            descripcion={`${alerta.gestante ?? "Paciente"} · ${alerta.mensaje}`}
            cerrarAlExito
            disparador={
                <Boton variante="vidrio" tamano="sm">
                    <CheckCheck aria-hidden />
                    Revisar
                </Boton>
            }
        >
            {({ onExito, cerrar }) => (
                <Formulario alertaId={alerta.id} onExito={onExito} cerrar={cerrar} />
            )}
        </DialogoAccion>
    );
}

function Formulario({
    alertaId,
    onExito,
    cerrar,
}: {
    alertaId: number;
    onExito: () => void;
    cerrar: () => void;
}) {
    const [estado, enviar, enviando] = useActionState(revisarAlerta, INICIAL);
    const e = estado.porCampo ?? {};
    const [resultado, setResultado] = useState("REVISADA");

    useEffect(() => {
        if (estado.ok) onExito();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    return (
        <form action={enviar} className="space-y-4" noValidate>
            <input type="hidden" name="alerta_id" value={alertaId} />
            <AvisoError>{estado.error}</AvisoError>

            <Campo etiqueta="Resultado de la revisión" obligatorio error={e.estado}>
                {(p) => (
                    <select
                        {...p}
                        name="estado"
                        value={resultado}
                        onChange={(ev) => setResultado(ev.target.value)}
                        required
                    >
                        <option value="REVISADA">Revisada: la atendí</option>
                        <option value="DESCARTADA">
                            Descartada: no requiere acción
                        </option>
                    </select>
                )}
            </Campo>

            <Campo
                etiqueta="Observación"
                error={e.observacion}
                ayuda="Queda en el historial de la paciente."
            >
                {(p) => (
                    <input
                        {...p}
                        name="observacion"
                        maxLength={255}
                        placeholder="Por ejemplo: se contactó a la paciente y se citó para mañana"
                    />
                )}
            </Campo>

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Boton type="submit" ancho="completo" tamano="lg" disabled={enviando}>
                    {enviando ? "Guardando…" : "Guardar revisión"}
                </Boton>
                <Boton variante="vidrio" ancho="completo" tamano="lg" onClick={cerrar}>
                    Cancelar
                </Boton>
            </div>
        </form>
    );
}
