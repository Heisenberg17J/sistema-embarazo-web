"use client";


import { Check } from "lucide-react";
import { registrarEmbarazo, type EstadoEmbarazo } from "@/acciones/embarazo";
import { Boton } from "@/components/ui/boton";
import { AvisoError, Campo } from "@/components/ui/campo";
import { hoyLocal } from "@/lib/formato";
import { useAccion } from "@/lib/usar-accion";

const INICIAL: EstadoEmbarazo = {};

export function FormularioEmbarazo() {
    const [estado, enviar, enviando] = useAccion(registrarEmbarazo, INICIAL);
    const e = estado.porCampo ?? {};
    const v = estado.valores ?? {};
    const hoy = hoyLocal();

    return (
        <form onSubmit={enviar} className="mt-5 space-y-4" noValidate>
            <AvisoError>{estado.error}</AvisoError>

            <Campo
                etiqueta="Fecha de tu última menstruación"
                obligatorio
                error={e.fecha_inicio}
                ayuda="El primer día de tu último periodo. Si no la recuerdas con exactitud, usa la fecha aproximada y tu profesional la ajustará."
            >
                {(p) => (
                    <input
                        {...p}
                        name="fecha_inicio"
                        type="date"
                        max={hoy}
                        defaultValue={v.fecha_inicio}
                        required
                    />
                )}
            </Campo>

            <div className="grid gap-4 sm:grid-cols-2">
                <Campo
                    etiqueta="Tu talla en centímetros"
                    error={e.talla_cm}
                    ayuda="Para calcular tu IMC."
                >
                    {(p) => (
                        <input
                            {...p}
                            name="talla_cm"
                            type="number"
                            inputMode="decimal"
                            step="0.5"
                            min={120}
                            max={220}
                            placeholder="160"
                            defaultValue={v.talla_cm}
                        />
                    )}
                </Campo>
                <Campo
                    etiqueta="Peso antes del embarazo (kg)"
                    error={e.peso_pregestacional_kg}
                    ayuda="Para seguir tu ganancia de peso."
                >
                    {(p) => (
                        <input
                            {...p}
                            name="peso_pregestacional_kg"
                            type="number"
                            inputMode="decimal"
                            step="0.1"
                            min={30}
                            max={200}
                            placeholder="60"
                            defaultValue={v.peso_pregestacional_kg}
                        />
                    )}
                </Campo>
            </div>

            <Boton type="submit" ancho="completo" tamano="lg" disabled={enviando}>
                <Check aria-hidden />
                {enviando ? "Guardando…" : "Guardar y ver mi panel"}
            </Boton>
        </form>
    );
}
