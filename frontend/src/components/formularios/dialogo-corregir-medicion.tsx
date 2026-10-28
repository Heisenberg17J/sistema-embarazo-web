"use client";

import { useEffect } from "react";
import { PencilLine, Save } from "lucide-react";
import { corregirMedicion, type ResultadoCorreccion } from "@/acciones/correcciones";
import { DialogoAccion } from "@/components/formularios/dialogo-accion";
import { AvisoCritico } from "@/components/paneles/aviso-critico";
import { Boton } from "@/components/ui/boton";
import { AvisoError, Campo } from "@/components/ui/campo";
import { useAccion } from "@/lib/usar-accion";

const INICIAL: ResultadoCorreccion = {};

/**
 * Corrige el valor de una medición que la gestante registró (hasta 24 horas después).
 * Si el valor corregido sigue pidiendo atención inmediata, se le dice igual que al
 * registrarlo: corregir no es una forma de silenciar un aviso.
 */
export function DialogoCorregirMedicion({
    embarazoId,
    medicion,
    contactoNombre,
    contactoTelefono,
}: {
    embarazoId: number;
    medicion: { id: number; nombre: string; unidad: string; valor: number };
    contactoNombre?: string | null;
    contactoTelefono?: string | null;
}) {
    return (
        <DialogoAccion
            titulo="Corregir este registro"
            descripcion={`${medicion.nombre}: ${medicion.valor} ${medicion.unidad}`}
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
                    medicion={medicion}
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
    medicion,
    contactoNombre,
    contactoTelefono,
    onExito,
    cerrar,
}: {
    embarazoId: number;
    medicion: { id: number; nombre: string; unidad: string; valor: number };
    contactoNombre?: string | null;
    contactoTelefono?: string | null;
    onExito: () => void;
    cerrar: () => void;
}) {
    const [estado, enviar, enviando] = useAccion(corregirMedicion, INICIAL);
    const criticas = estado.alertas?.filter((a) => a.accion_inmediata) ?? [];

    // Sin alerta crítica no hay nada que leer: se cierra. Con ella, se muestra primero.
    useEffect(() => {
        if (estado.ok && criticas.length === 0) onExito();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    return (
        <>
            <form onSubmit={enviar} className="space-y-4" noValidate>
                <input type="hidden" name="embarazo_id" value={embarazoId} />
                <input type="hidden" name="medicion_id" value={medicion.id} />
                <AvisoError>{estado.error}</AvisoError>

                <Campo
                    etiqueta={`Valor correcto en ${medicion.unidad}`}
                    obligatorio
                    error={estado.porCampo?.valor}
                    ayuda="Si te equivocaste al escribirlo, pon aquí el valor que era. Las alertas del valor anterior quedarán anuladas."
                >
                    {(p) => (
                        <input
                            {...p}
                            name="valor"
                            type="number"
                            inputMode="decimal"
                            step="any"
                            defaultValue={medicion.valor}
                            required
                        />
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
