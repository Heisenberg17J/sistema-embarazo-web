"use client";

import { useEffect, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import type { ResultadoCorreccion } from "@/acciones/correcciones";
import { DialogoAccion } from "@/components/formularios/dialogo-accion";
import { Boton } from "@/components/ui/boton";
import { AvisoError, Campo } from "@/components/ui/campo";
import { useAccion } from "@/lib/usar-accion";

const INICIAL: ResultadoCorreccion = {};

/**
 * Eliminar un registro clínico, con confirmación.
 *
 * Es irreversible desde la aplicación (queda una copia en la auditoría), así que
 * se explica qué pasa con las alertas: no desaparecen, quedan anuladas. Quien
 * registró un dato clínico como profesional debe decir por qué lo elimina.
 */
export function DialogoEliminar({
    titulo,
    descripcion,
    accion,
    embarazoId,
    elementoId,
    motivoObligatorio = false,
    textoBoton = "Eliminar",
    children,
}: {
    titulo: string;
    descripcion?: string;
    accion: (previo: ResultadoCorreccion, datos: FormData) => Promise<ResultadoCorreccion>;
    embarazoId: number;
    elementoId: number;
    motivoObligatorio?: boolean;
    textoBoton?: string;
    /** Consecuencias propias de este tipo de registro. */
    children?: ReactNode;
}) {
    return (
        <DialogoAccion
            titulo={titulo}
            descripcion={descripcion}
            cerrarAlExito
            disparador={
                <Boton variante="fantasma" tamano="sm">
                    <Trash2 aria-hidden />
                    {textoBoton}
                </Boton>
            }
        >
            {({ onExito, cerrar }) => (
                <Formulario
                    accion={accion}
                    embarazoId={embarazoId}
                    elementoId={elementoId}
                    motivoObligatorio={motivoObligatorio}
                    onExito={onExito}
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
    embarazoId,
    elementoId,
    motivoObligatorio,
    onExito,
    cerrar,
    children,
}: {
    accion: (previo: ResultadoCorreccion, datos: FormData) => Promise<ResultadoCorreccion>;
    embarazoId: number;
    elementoId: number;
    motivoObligatorio: boolean;
    onExito: () => void;
    cerrar: () => void;
    children?: ReactNode;
}) {
    const [estado, enviar, enviando] = useAccion(accion, INICIAL);

    useEffect(() => {
        if (estado.ok) onExito();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    return (
        <form onSubmit={enviar} className="space-y-4" noValidate>
            <input type="hidden" name="embarazo_id" value={embarazoId} />
            <input type="hidden" name="elemento_id" value={elementoId} />
            <AvisoError>{estado.error}</AvisoError>

            <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                {children}
                <p>
                    Si este dato generó alertas, <strong className="text-foreground">no se borran</strong>:
                    quedan marcadas como anuladas, con el motivo, para que se vea qué pasó.
                </p>
            </div>

            <Campo
                etiqueta="Motivo"
                obligatorio={motivoObligatorio}
                error={estado.porCampo?.motivo}
                ayuda={motivoObligatorio ? "Queda en el historial de la paciente." : undefined}
            >
                {(p) => <input {...p} name="motivo" maxLength={255} />}
            </Campo>

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Boton type="submit" variante="peligro" ancho="completo" tamano="lg" disabled={enviando}>
                    {enviando ? "Eliminando…" : "Sí, eliminar"}
                </Boton>
                <Boton variante="vidrio" ancho="completo" tamano="lg" onClick={cerrar}>
                    Cancelar
                </Boton>
            </div>
        </form>
    );
}
