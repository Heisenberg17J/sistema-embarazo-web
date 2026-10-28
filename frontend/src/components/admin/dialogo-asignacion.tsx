"use client";

import { useActionState, useEffect, useState } from "react";
import { UserCheck } from "lucide-react";
import { crearAsignacion, type ResultadoAdmin } from "@/acciones/admin";
import { DialogoAccion } from "@/components/formularios/dialogo-accion";
import { Boton } from "@/components/ui/boton";
import { AvisoExito } from "@/components/ui/aviso-exito";
import { AvisoError, Campo } from "@/components/ui/campo";

const INICIAL: ResultadoAdmin = {};

export interface OpcionPersona {
    id: number;
    nombre: string;
    /** Texto secundario: la especialidad o "sin profesional". */
    detalle?: string;
}

/** RF-15. Asigna una gestante a un profesional de salud. */
export function DialogoAsignacion({
    profesionales,
    gestantes,
    gestanteInicial,
    textoBoton = "Nueva asignación",
    varianteBoton = "primario",
}: {
    profesionales: OpcionPersona[];
    gestantes: OpcionPersona[];
    gestanteInicial?: number;
    textoBoton?: string;
    varianteBoton?: "primario" | "vidrio";
}) {
    return (
        <DialogoAccion
            titulo="Asignar gestante a un profesional"
            descripcion="El profesional podrá ver y registrar su seguimiento desde ese momento."
            disparador={
                <Boton variante={varianteBoton} tamano={varianteBoton === "vidrio" ? "sm" : "md"}>
                    <UserCheck aria-hidden />
                    {textoBoton}
                </Boton>
            }
        >
            {({ onExito }) => (
                <Formulario
                    profesionales={profesionales}
                    gestantes={gestantes}
                    gestanteInicial={gestanteInicial}
                    onExito={onExito}
                />
            )}
        </DialogoAccion>
    );
}

function Formulario({
    profesionales,
    gestantes,
    gestanteInicial,
    onExito,
}: {
    profesionales: OpcionPersona[];
    gestantes: OpcionPersona[];
    gestanteInicial?: number;
    onExito: () => void;
}) {
    const [estado, enviar, enviando] = useActionState(crearAsignacion, INICIAL);
    const e = estado.porCampo ?? {};
    const [profesional, setProfesional] = useState("");
    const [gestante, setGestante] = useState(gestanteInicial ? String(gestanteInicial) : "");

    useEffect(() => {
        if (estado.ok) onExito();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    if (estado.ok) return <AvisoExito>{estado.resumen}</AvisoExito>;

    const etiqueta = (p: OpcionPersona) => (p.detalle ? `${p.nombre} · ${p.detalle}` : p.nombre);

    return (
        <form action={enviar} className="space-y-4" noValidate>
            <AvisoError>{estado.error}</AvisoError>

            <Campo etiqueta="Gestante" obligatorio error={e.gestante_id}>
                {(p) => (
                    <select
                        {...p}
                        name="gestante_id"
                        value={gestante}
                        onChange={(ev) => setGestante(ev.target.value)}
                        required
                    >
                        <option value="" disabled>
                            Elige una gestante
                        </option>
                        {gestantes.map((g) => (
                            <option key={g.id} value={g.id}>
                                {etiqueta(g)}
                            </option>
                        ))}
                    </select>
                )}
            </Campo>

            <Campo etiqueta="Profesional" obligatorio error={e.profesional_id}>
                {(p) => (
                    <select
                        {...p}
                        name="profesional_id"
                        value={profesional}
                        onChange={(ev) => setProfesional(ev.target.value)}
                        required
                    >
                        <option value="" disabled>
                            Elige un profesional
                        </option>
                        {profesionales.map((pr) => (
                            <option key={pr.id} value={pr.id}>
                                {etiqueta(pr)}
                            </option>
                        ))}
                    </select>
                )}
            </Campo>

            <p className="text-xs leading-relaxed text-muted-foreground">
                Una gestante puede tener más de un profesional. Solo aparecen las
                cuentas activas.
            </p>

            <Boton type="submit" ancho="completo" tamano="lg" disabled={enviando}>
                {enviando ? "Asignando…" : "Asignar"}
            </Boton>
        </form>
    );
}
