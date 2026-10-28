"use client";

import { useActionState, useId } from "react";
import { Check, Save } from "lucide-react";
import { guardarParametro, type ResultadoAdmin } from "@/acciones/admin";
import { Boton } from "@/components/ui/boton";
import type { ParametroSistema } from "@/lib/tipos";

const INICIAL: ResultadoAdmin = {};

/** Un parámetro del sistema, editable en su propia fila. */
export function FormularioParametro({ parametro }: { parametro: ParametroSistema }) {
    const [estado, enviar, enviando] = useActionState(guardarParametro, INICIAL);
    const id = useId();
    const error = estado.porCampo?.valor ?? estado.error;
    const numerico = /^-?\d+(\.\d+)?$/.test(parametro.valor);

    return (
        <form action={enviar} className="flex flex-col gap-1.5 sm:items-end">
            <input type="hidden" name="clave" value={parametro.clave} />
            <div className="flex gap-2">
                <label htmlFor={id} className="sr-only">
                    Valor de {parametro.clave}
                </label>
                <input
                    id={id}
                    name="valor"
                    defaultValue={estado.valores?.valor ?? parametro.valor}
                    inputMode={numerico ? "decimal" : undefined}
                    maxLength={255}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className="h-11 w-28 rounded-2xl border border-border-firme bg-input px-4 text-right tabular-nums focus:border-ring aria-[invalid=true]:border-critica"
                    required
                />
                <Boton type="submit" variante="vidrio" disabled={enviando}>
                    {estado.ok && !enviando ? <Check aria-hidden /> : <Save aria-hidden />}
                    {enviando ? "Guardando…" : estado.ok ? "Guardado" : "Guardar"}
                </Boton>
            </div>
            {error && (
                <p id={`${id}-error`} role="alert" className="text-xs font-medium text-critica">
                    {error}
                </p>
            )}
        </form>
    );
}
