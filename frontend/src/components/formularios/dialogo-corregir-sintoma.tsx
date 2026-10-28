"use client";

import { useEffect, useState } from "react";
import { PencilLine, Save } from "lucide-react";
import { corregirSintoma, type ResultadoCorreccion } from "@/acciones/correcciones";
import { DialogoAccion } from "@/components/formularios/dialogo-accion";
import { AvisoCritico } from "@/components/paneles/aviso-critico";
import { Boton } from "@/components/ui/boton";
import { AvisoError, Campo } from "@/components/ui/campo";
import { useAccion } from "@/lib/usar-accion";
import type { Sintoma, TipoSintoma } from "@/lib/tipos";

const INICIAL: ResultadoCorreccion = {};

const INTENSIDADES = [
    { valor: "1", texto: "1 · Muy leve" },
    { valor: "2", texto: "2 · Leve" },
    { valor: "3", texto: "3 · Moderado" },
    { valor: "4", texto: "4 · Fuerte" },
    { valor: "5", texto: "5 · Muy fuerte" },
];

/**
 * Corrige un síntoma (hasta 24 horas después). Cambiar el tipo o la intensidad anula la
 * alerta del anterior y evalúa el nuevo: si era "sangrado" y era otra cosa, ya no queda
 * como urgencia; y si era una molestia leve y en realidad era un signo de alarma, avisa.
 */
export function DialogoCorregirSintoma({
    embarazoId,
    sintoma,
    tipos,
    contactoNombre,
    contactoTelefono,
}: {
    embarazoId: number;
    sintoma: Sintoma;
    tipos: TipoSintoma[];
    contactoNombre?: string | null;
    contactoTelefono?: string | null;
}) {
    return (
        <DialogoAccion
            titulo="Corregir este síntoma"
            descripcion={sintoma.descripcion}
            cerrarAlExito
            disparador={
                <Boton variante="fantasma" tamano="sm">
                    <PencilLine aria-hidden />
                    Corregir
                </Boton>
            }
        >
            {({ onExito, cerrar }) => (
                <Formulario
                    embarazoId={embarazoId}
                    sintoma={sintoma}
                    tipos={tipos}
                    contactoNombre={contactoNombre}
                    contactoTelefono={contactoTelefono}
                    onExito={onExito}
                    cerrar={cerrar}
                />
            )}
        </DialogoAccion>
    );
}

function Formulario({
    embarazoId,
    sintoma,
    tipos,
    contactoNombre,
    contactoTelefono,
    onExito,
    cerrar,
}: {
    embarazoId: number;
    sintoma: Sintoma;
    tipos: TipoSintoma[];
    contactoNombre?: string | null;
    contactoTelefono?: string | null;
    onExito: () => void;
    cerrar: () => void;
}) {
    const [estado, enviar, enviando] = useAccion(corregirSintoma, INICIAL);
    const [tipo, setTipo] = useState(sintoma.tipo ?? "");
    const criticas = estado.alertas?.filter((a) => a.accion_inmediata) ?? [];

    useEffect(() => {
        if (estado.ok && criticas.length === 0) onExito();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    const alarma = tipos.filter((t) => t.es_signo_alarma);
    const comunes = tipos.filter((t) => !t.es_signo_alarma);

    return (
        <>
            <form onSubmit={enviar} className="space-y-4" noValidate>
                <input type="hidden" name="embarazo_id" value={embarazoId} />
                <input type="hidden" name="sintoma_id" value={sintoma.id} />
                <AvisoError>{estado.error}</AvisoError>

                {/* Si el síntoma se escribió con palabras propias no tiene tipo de la lista:
                    se deja como está salvo que elija uno. */}
                <Campo etiqueta="¿Qué estabas sintiendo?" error={estado.porCampo?.tipo}>
                    {(p) => (
                        <select {...p} name="tipo" value={tipo} onChange={(ev) => setTipo(ev.target.value)}>
                            {!sintoma.tipo && <option value="">{sintoma.descripcion} (como lo escribiste)</option>}
                            {alarma.length > 0 && (
                                <optgroup label="Requieren atención pronta">
                                    {alarma.map((t) => (
                                        <option key={t.codigo} value={t.codigo}>{t.nombre}</option>
                                    ))}
                                </optgroup>
                            )}
                            <optgroup label="Molestias frecuentes">
                                {comunes.map((t) => (
                                    <option key={t.codigo} value={t.codigo}>{t.nombre}</option>
                                ))}
                            </optgroup>
                        </select>
                    )}
                </Campo>

                <Campo
                    etiqueta="¿Qué tan fuerte era?"
                    error={estado.porCampo?.intensidad}
                    ayuda="Las alertas del síntoma anterior quedarán anuladas y se evaluará el corregido."
                >
                    {(p) => (
                        <select {...p} name="intensidad" defaultValue={sintoma.intensidad ? String(sintoma.intensidad) : ""}>
                            <option value="">Prefiero no indicarlo</option>
                            {INTENSIDADES.map((i) => (
                                <option key={i.valor} value={i.valor}>{i.texto}</option>
                            ))}
                        </select>
                    )}
                </Campo>

                <div className="flex flex-col gap-2 sm:flex-row-reverse">
                    <Boton type="submit" tamano="lg" ancho="completo" disabled={enviando}>
                        <Save aria-hidden />
                        {enviando ? "Guardando…" : "Guardar corrección"}
                    </Boton>
                    <Boton variante="vidrio" tamano="lg" ancho="completo" onClick={cerrar}>
                        Cancelar
                    </Boton>
                </div>
            </form>

            {estado.ok && criticas.length > 0 && (
                <AvisoCritico
                    alertas={criticas}
                    contactoNombre={contactoNombre}
                    contactoTelefono={contactoTelefono}
                    onCerrar={onExito}
                />
            )}
        </>
    );
}
