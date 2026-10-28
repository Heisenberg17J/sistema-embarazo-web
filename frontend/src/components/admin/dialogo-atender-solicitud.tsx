"use client";

import { useEffect, useState } from "react";
import { Gavel } from "lucide-react";
import { atenderSolicitudSupresion, type ResultadoAdmin } from "@/acciones/admin";
import { DialogoAccion } from "@/components/formularios/dialogo-accion";
import { Boton } from "@/components/ui/boton";
import { AvisoError, Campo } from "@/components/ui/campo";
import { useAccion } from "@/lib/usar-accion";

const INICIAL: ResultadoAdmin = {};

/** Atiende una solicitud de supresión: anonimizar la cuenta o rechazarla explicando por qué. */
export function DialogoAtenderSolicitud({
    solicitudId,
    persona,
}: {
    solicitudId: number;
    persona: string;
}) {
    return (
        <DialogoAccion
            titulo="Atender la solicitud"
            descripcion={`Solicitud de ${persona}.`}
            disparador={
                <Boton variante="vidrio" tamano="sm">
                    <Gavel aria-hidden />
                    Atender
                </Boton>
            }
        >
            {({ cerrar }) => <Formulario solicitudId={solicitudId} cerrar={cerrar} />}
        </DialogoAccion>
    );
}

function Formulario({ solicitudId, cerrar }: { solicitudId: number; cerrar: () => void }) {
    const [estado, enviar, enviando] = useAccion(atenderSolicitudSupresion, INICIAL);
    const e = estado.porCampo ?? {};
    // Controlado: un <select> no controlado pierde la opción tras un error.
    const [accion, setAccion] = useState("ANONIMIZAR");

    useEffect(() => {
        if (estado.ok) cerrar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    return (
        <form onSubmit={enviar} className="space-y-4" noValidate>
            <input type="hidden" name="solicitud_id" value={solicitudId} />
            <AvisoError>{estado.error}</AvisoError>

            <Campo etiqueta="¿Qué se hace?" obligatorio error={e.accion}>
                {(p) => (
                    <select
                        {...p}
                        name="accion"
                        value={accion}
                        onChange={(ev) => setAccion(ev.target.value)}
                    >
                        <option value="ANONIMIZAR">Anonimizar la cuenta</option>
                        <option value="RECHAZAR">Rechazar la solicitud</option>
                    </select>
                )}
            </Campo>

            {accion === "ANONIMIZAR" ? (
                <p className="rounded-2xl bg-critica-suave px-4 py-3 text-sm leading-relaxed text-critica">
                    No se puede deshacer. Se eliminan el nombre, el documento, el
                    contacto y la dirección de la persona, se cierra su cuenta y se
                    finalizan sus asignaciones. Los registros clínicos se conservan sin
                    su nombre.
                </p>
            ) : (
                <p className="text-sm text-muted-foreground">
                    La cuenta queda como está. La persona verá tu respuesta en su perfil.
                </p>
            )}

            <Campo
                etiqueta={accion === "RECHAZAR" ? "Respuesta para la persona" : "Nota interna"}
                obligatorio={accion === "RECHAZAR"}
                error={e.respuesta}
            >
                {(p) => (
                    <textarea
                        {...p}
                        name="respuesta"
                        rows={3}
                        maxLength={500}
                        defaultValue={estado.valores?.respuesta}
                        className={`${p.className} h-auto py-3 leading-relaxed`}
                    />
                )}
            </Campo>

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Boton
                    type="submit"
                    variante={accion === "ANONIMIZAR" ? "peligro" : "primario"}
                    ancho="completo"
                    tamano="lg"
                    disabled={enviando}
                >
                    {enviando
                        ? "Guardando…"
                        : accion === "ANONIMIZAR"
                          ? "Anonimizar la cuenta"
                          : "Rechazar la solicitud"}
                </Boton>
                <Boton variante="vidrio" ancho="completo" tamano="lg" onClick={cerrar}>
                    Cancelar
                </Boton>
            </div>
        </form>
    );
}
