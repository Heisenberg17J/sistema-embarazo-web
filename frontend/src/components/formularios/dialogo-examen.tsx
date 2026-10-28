"use client";

import { useActionState, useEffect, useState } from "react";
import { FlaskConical, Save } from "lucide-react";
import { registrarExamen, type ResultadoAccion } from "@/acciones/profesional";
import { DialogoAccion } from "@/components/formularios/dialogo-accion";
import { Boton } from "@/components/ui/boton";
import { AvisoExito } from "@/components/ui/aviso-exito";
import { AvisoError, Campo } from "@/components/ui/campo";
import { hoyLocal } from "@/lib/formato";
import type { TipoExamen } from "@/lib/tipos";

const INICIAL: ResultadoAccion = {};

export function DialogoExamen({
    embarazoId,
    gestante,
    tipos,
}: {
    embarazoId: number;
    gestante: string;
    tipos: TipoExamen[];
}) {
    return (
        <DialogoAccion
            titulo="Registrar un examen"
            descripcion={`Paciente: ${gestante}. Lo verá en su app en cuanto lo guardes.`}
            disparador={
                <Boton variante="vidrio" tamano="sm">
                    <FlaskConical aria-hidden />
                    Registrar examen
                </Boton>
            }
        >
            {({ onExito }) => (
                <Formulario
                    embarazoId={embarazoId}
                    tipos={tipos.filter((t) => t.activo)}
                    onExito={onExito}
                />
            )}
        </DialogoAccion>
    );
}

function Formulario({
    embarazoId,
    tipos,
    onExito,
}: {
    embarazoId: number;
    tipos: TipoExamen[];
    onExito: () => void;
}) {
    const [estado, enviar, enviando] = useActionState(registrarExamen, INICIAL);
    const e = estado.porCampo ?? {};
    const v = estado.valores ?? {};
    // Controlado: si no, pierde la opción elegida cuando React restablece el
    // formulario tras un error.
    const [tipo, setTipo] = useState("");

    useEffect(() => {
        if (estado.ok) onExito();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    return (
        <form action={enviar} className="space-y-4" noValidate>
            <input type="hidden" name="embarazo_id" value={embarazoId} />

            <AvisoError>{estado.error}</AvisoError>
            {estado.ok && <AvisoExito>{estado.resumen}</AvisoExito>}

            {!estado.ok && (
                <>
                    <Campo etiqueta="Tipo de examen" obligatorio error={e.tipo}>
                        {(p) => (
                            <select
                                {...p}
                                name="tipo"
                                value={tipo}
                                onChange={(ev) => setTipo(ev.target.value)}
                                required
                            >
                                <option value="" disabled>
                                    Elige una opción
                                </option>
                                {tipos.map((t) => (
                                    <option key={t.codigo} value={t.codigo}>
                                        {t.nombre}
                                    </option>
                                ))}
                            </select>
                        )}
                    </Campo>

                    <Campo etiqueta="Fecha del examen" obligatorio error={e.fecha}>
                        {(p) => (
                            <input
                                {...p}
                                name="fecha"
                                type="date"
                                max={hoyLocal()}
                                defaultValue={v.fecha ?? hoyLocal()}
                                required
                            />
                        )}
                    </Campo>

                    <Campo
                        etiqueta="Resultado"
                        obligatorio
                        error={e.resultado}
                        ayuda="Lo que leerá la gestante. Escríbelo en términos que pueda entender."
                    >
                        {(p) => (
                            <textarea
                                {...p}
                                name="resultado"
                                rows={4}
                                maxLength={4000}
                                defaultValue={v.resultado}
                                placeholder="Por ejemplo: hemoglobina 11.8 g/dL, dentro de lo esperado."
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
                                defaultValue={v.observaciones}
                                className={`${p.className} h-auto py-3 leading-relaxed`}
                            />
                        )}
                    </Campo>

                    <Boton type="submit" ancho="completo" tamano="lg" disabled={enviando}>
                        <Save aria-hidden />
                        {enviando ? "Guardando…" : "Guardar examen"}
                    </Boton>
                </>
            )}
        </form>
    );
}
