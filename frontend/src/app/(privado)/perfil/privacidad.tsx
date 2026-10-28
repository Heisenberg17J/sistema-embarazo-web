"use client";

import { useEffect, useState, useTransition } from "react";
import { Download, UserX } from "lucide-react";
import {
    descargarMisDatos,
    solicitarSupresion,
    type ResultadoSupresion,
} from "@/acciones/privacidad";
import { DialogoAccion } from "@/components/formularios/dialogo-accion";
import { Boton } from "@/components/ui/boton";
import { AvisoError, Campo } from "@/components/ui/campo";
import { useAccion } from "@/lib/usar-accion";

/** Derecho de consulta: guarda en el equipo una copia de todo lo que se tiene de la persona. */
export function BotonDescargarDatos() {
    const [descargando, iniciar] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const descargar = () =>
        iniciar(async () => {
            setError(null);
            const r = await descargarMisDatos();
            if (!r.contenido) {
                setError(r.error ?? "No se pudo preparar la descarga.");
                return;
            }
            const url = URL.createObjectURL(new Blob([r.contenido], { type: "application/json" }));
            const enlace = document.createElement("a");
            enlace.href = url;
            enlace.download = r.nombre ?? "mis-datos.json";
            enlace.click();
            URL.revokeObjectURL(url);
        });

    return (
        <div className="space-y-2">
            <Boton variante="vidrio" onClick={descargar} disabled={descargando}>
                <Download aria-hidden />
                {descargando ? "Preparando…" : "Descargar mis datos"}
            </Boton>
            <AvisoError>{error}</AvisoError>
        </div>
    );
}

const INICIAL: ResultadoSupresion = {};

/** Derecho de supresión: la solicitud la atiende el administrador. */
export function DialogoSolicitarSupresion() {
    return (
        <DialogoAccion
            titulo="Eliminar mi cuenta"
            descripcion="Léelo con calma: esto no se puede deshacer."
            cerrarAlExito
            disparador={
                <Boton variante="contorno">
                    <UserX aria-hidden />
                    Eliminar mi cuenta
                </Boton>
            }
        >
            {({ onExito, cerrar }) => <Formulario onExito={onExito} cerrar={cerrar} />}
        </DialogoAccion>
    );
}

function Formulario({ onExito, cerrar }: { onExito: () => void; cerrar: () => void }) {
    const [estado, enviar, enviando] = useAccion(solicitarSupresion, INICIAL);

    useEffect(() => {
        if (estado.ok) onExito();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    return (
        <form onSubmit={enviar} className="space-y-4" noValidate>
            <AvisoError>{estado.error}</AvisoError>

            <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                <p>
                    Cuando el administrador atienda tu solicitud, tu cuenta quedará{" "}
                    <strong className="text-foreground">anonimizada</strong>: se
                    eliminan tu nombre, documento, contacto y dirección, y ya no podrás
                    entrar.
                </p>
                <p>
                    Tu historia clínica no se borra, porque hay una obligación legal de
                    conservarla, pero queda sin tu nombre. Antes de continuar, descarga
                    tus datos si quieres conservar una copia.
                </p>
            </div>

            <Campo
                etiqueta="¿Quieres contarnos el motivo?"
                error={estado.porCampo?.motivo}
            >
                {(p) => (
                    <textarea
                        {...p}
                        name="motivo"
                        rows={3}
                        maxLength={500}
                        defaultValue={estado.valores?.motivo}
                        className={`${p.className} h-auto py-3 leading-relaxed`}
                    />
                )}
            </Campo>

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Boton type="submit" variante="peligro" ancho="completo" tamano="lg" disabled={enviando}>
                    {enviando ? "Enviando…" : "Enviar la solicitud"}
                </Boton>
                <Boton variante="vidrio" ancho="completo" tamano="lg" onClick={cerrar}>
                    Cancelar
                </Boton>
            </div>
        </form>
    );
}
