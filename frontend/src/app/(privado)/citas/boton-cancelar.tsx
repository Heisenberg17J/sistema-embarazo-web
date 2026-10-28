"use client";

import { useActionState, useEffect, useState } from "react";
import { CalendarX } from "lucide-react";
import { cancelarCita, type EstadoCancelacion } from "@/acciones/citas";
import { Boton } from "@/components/ui/boton";
import { AvisoError, Campo } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";

const INICIAL: EstadoCancelacion = {};

export function BotonCancelar({
    citaId,
    descripcion,
}: {
    citaId: number;
    descripcion: string;
}) {
    const [abierto, setAbierto] = useState(false);
    // Remontar el formulario tras una cancelación deja el estado limpio por si
    // la gestante vuelve a abrir el diálogo en otra cita.
    const [generacion, setGeneracion] = useState(0);

    return (
        <>
            <Boton variante="fantasma" tamano="sm" onClick={() => setAbierto(true)}>
                <CalendarX aria-hidden />
                Cancelar
            </Boton>

            <Dialogo
                abierto={abierto}
                onCambio={setAbierto}
                titulo="Cancelar esta cita"
                descripcion={descripcion}
            >
                <Formulario
                    key={generacion}
                    citaId={citaId}
                    onExito={() => {
                        setAbierto(false);
                        // La cita ya cancelada llega con la respuesta de la
                        // acción, que revalida /citas.
                        setGeneracion((g) => g + 1);
                    }}
                    onCerrar={() => setAbierto(false)}
                />
            </Dialogo>
        </>
    );
}

function Formulario({
    citaId,
    onExito,
    onCerrar,
}: {
    citaId: number;
    onExito: () => void;
    onCerrar: () => void;
}) {
    const [estado, enviar, enviando] = useActionState(cancelarCita, INICIAL);

    useEffect(() => {
        if (estado.ok) onExito();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    return (
        <form action={enviar} className="space-y-4" noValidate>
            <input type="hidden" name="cita_id" value={citaId} />
            <AvisoError>{estado.error}</AvisoError>

            <Campo
                etiqueta="¿Por qué no podrás asistir?"
                obligatorio
                error={estado.porCampo?.motivo_cancelacion}
                ayuda="Tu profesional lo verá y podrá agendarte otra fecha."
            >
                {(p) => (
                    <input
                        {...p}
                        name="motivo_cancelacion"
                        maxLength={255}
                        placeholder="Por ejemplo: tengo un viaje ese día"
                        required
                    />
                )}
            </Campo>

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Boton
                    type="submit"
                    variante="peligro"
                    tamano="lg"
                    ancho="completo"
                    disabled={enviando}
                >
                    {enviando ? "Cancelando…" : "Sí, cancelar la cita"}
                </Boton>
                <Boton
                    variante="vidrio"
                    tamano="lg"
                    ancho="completo"
                    onClick={onCerrar}
                >
                    Mantener la cita
                </Boton>
            </div>
        </form>
    );
}
