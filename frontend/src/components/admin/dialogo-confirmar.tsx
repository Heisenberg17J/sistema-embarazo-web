"use client";

import { useActionState, useEffect, type ReactNode } from "react";
import type { ResultadoAdmin } from "@/acciones/admin";
import { DialogoAccion } from "@/components/formularios/dialogo-accion";
import { Boton } from "@/components/ui/boton";
import { AvisoError } from "@/components/ui/campo";

const INICIAL: ResultadoAdmin = {};

/**
 * Confirmación de una acción de un solo paso (desactivar, finalizar, eliminar…).
 *
 * Pedir confirmación evita que un toque accidental deje a una gestante sin su
 * profesional o a alguien sin acceso. Se cierra sola al terminar; los datos
 * frescos llegan con la respuesta de la acción, que revalida la página.
 */
export function DialogoConfirmar({
    titulo,
    descripcion,
    disparador,
    accion,
    campos,
    textoConfirmar,
    peligro = false,
    children,
}: {
    titulo: string;
    descripcion?: string;
    disparador: ReactNode;
    accion: (previo: ResultadoAdmin, datos: FormData) => Promise<ResultadoAdmin>;
    /** Campos ocultos que identifican el registro. */
    campos: Record<string, string | number>;
    textoConfirmar: string;
    peligro?: boolean;
    /** Explicación de las consecuencias. */
    children?: ReactNode;
}) {
    return (
        <DialogoAccion
            titulo={titulo}
            descripcion={descripcion}
            disparador={disparador}
        >
            {({ cerrar }) => (
                <Formulario
                    accion={accion}
                    campos={campos}
                    textoConfirmar={textoConfirmar}
                    peligro={peligro}
                    cerrar={cerrar}
                >
                    {children}
                </Formulario>
            )}
        </DialogoAccion>
    );
}

function Formulario({
    accion,
    campos,
    textoConfirmar,
    peligro,
    cerrar,
    children,
}: {
    accion: (previo: ResultadoAdmin, datos: FormData) => Promise<ResultadoAdmin>;
    campos: Record<string, string | number>;
    textoConfirmar: string;
    peligro: boolean;
    cerrar: () => void;
    children?: ReactNode;
}) {
    const [estado, enviar, enviando] = useActionState(accion, INICIAL);

    useEffect(() => {
        if (estado.ok) cerrar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    return (
        <form action={enviar} className="space-y-4">
            {Object.entries(campos).map(([nombre, valor]) => (
                <input key={nombre} type="hidden" name={nombre} value={valor} />
            ))}

            <AvisoError>{estado.error}</AvisoError>
            {children && (
                <div className="text-sm leading-relaxed text-muted-foreground">
                    {children}
                </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Boton
                    type="submit"
                    variante={peligro ? "peligro" : "primario"}
                    ancho="completo"
                    tamano="lg"
                    disabled={enviando}
                >
                    {enviando ? "Guardando…" : textoConfirmar}
                </Boton>
                <Boton variante="vidrio" ancho="completo" tamano="lg" onClick={cerrar}>
                    Cancelar
                </Boton>
            </div>
        </form>
    );
}
