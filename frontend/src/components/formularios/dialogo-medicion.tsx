"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HeartPulse, Plus, Save, Scale } from "lucide-react";
import { registrarMedicion, type ResultadoRegistro } from "@/acciones/registros";
import { CODIGOS_PRESION, TIPO_PRESION } from "@/lib/constantes";
import { AvisoCritico } from "@/components/paneles/aviso-critico";
import { Boton, DISPARADOR_TARJETA } from "@/components/ui/boton";
import { AvisoExito } from "@/components/ui/aviso-exito";
import { AvisoError, Campo } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import type { Alerta, TipoMedicion } from "@/lib/tipos";
import { useAccion } from "@/lib/usar-accion";

const INICIAL: ResultadoRegistro = {};

interface Props {
    tipos: TipoMedicion[];
    contactoNombre?: string | null;
    contactoTelefono?: string | null;
    /** "tarjeta": el disparador es una tarjeta táctil con icono en móvil (panel). */
    presentacion?: "boton" | "tarjeta";
}

export function DialogoMedicion({ tipos, contactoNombre, contactoTelefono, presentacion = "boton" }: Props) {
    const router = useRouter();
    const [abierto, setAbierto] = useState(false);
    const [criticas, setCriticas] = useState<Alerta[]>([]);
    const [generacion, setGeneracion] = useState(0);
    // Hay que volver a pedir los datos del servidor, pero solo cuando la
    // gestante ya vio el resultado: refrescar antes borraría el aviso.
    const [pendienteRefrescar, setPendienteRefrescar] = useState(false);

    const cerrar = (abierto: boolean) => {
        setAbierto(abierto);
        if (!abierto && pendienteRefrescar) {
            setPendienteRefrescar(false);
            setGeneracion((g) => g + 1);
            router.refresh();
        }
    };

    return (
        <>
            <Boton
                variante="vidrio"
                className={presentacion === "tarjeta" ? DISPARADOR_TARJETA : undefined}
                onClick={() => setAbierto(true)}
            >
                {presentacion === "tarjeta" ? <Scale aria-hidden /> : <Plus aria-hidden />}
                Medición
            </Boton>

            <Dialogo
                abierto={abierto}
                onCambio={cerrar}
                titulo="Registrar una medición"
                descripcion="Anota tu peso o tu presión arterial. Tu profesional podrá verlo."
            >
                <Formulario
                    key={generacion}
                    tipos={tipos}
                    onGuardado={() => setPendienteRefrescar(true)}
                    onCritica={(alertas) => {
                        setAbierto(false);
                        setCriticas(alertas);
                    }}
                />
            </Dialogo>

            {criticas.length > 0 && (
                <AvisoCritico
                    alertas={criticas}
                    contactoNombre={contactoNombre}
                    contactoTelefono={contactoTelefono}
                    onCerrar={() => {
                        setCriticas([]);
                        setGeneracion((g) => g + 1);
                        setPendienteRefrescar(false);
                        router.refresh();
                    }}
                />
            )}
        </>
    );
}

function Formulario({
    tipos,
    onCritica,
    onGuardado,
}: {
    tipos: TipoMedicion[];
    onCritica: (alertas: Alerta[]) => void;
    onGuardado: () => void;
}) {
    const [estado, enviar, enviando] = useAccion(registrarMedicion, INICIAL);
    const [tipo, setTipo] = useState(TIPO_PRESION);
    const e = estado.porCampo ?? {};

    // El backend devuelve las alertas que generó el registro. Si alguna pide
    // atención inmediata, se muestra el aviso a pantalla completa.
    useEffect(() => {
        if (!estado.ok) return;
        onGuardado();
        const urgentes = estado.alertas?.filter((a) => a.accion_inmediata) ?? [];
        if (urgentes.length > 0) onCritica(urgentes);
        // Solo depende de `estado`: las funciones cambian de identidad en cada
        // render del componente padre y reejecutarían el efecto en bucle.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    const sueltos = tipos.filter(
        (t) => !(CODIGOS_PRESION as readonly string[]).includes(t.codigo),
    );
    const actual = sueltos.find((t) => t.codigo === tipo);
    const avisos = estado.alertas?.filter((a) => !a.accion_inmediata) ?? [];

    return (
        <form onSubmit={enviar} className="space-y-4" noValidate>
            <AvisoError>{estado.error}</AvisoError>
            {estado.ok && <AvisoExito>{estado.resumen}</AvisoExito>}

            {avisos.map((a) => (
                <p
                    key={a.id}
                    role="status"
                    className="rounded-2xl bg-advertencia-suave px-4 py-3 text-sm font-medium leading-relaxed text-advertencia"
                >
                    {a.mensaje}
                </p>
            ))}

            <Campo etiqueta="¿Qué quieres registrar?" obligatorio error={e.tipo}>
                {(p) => (
                    <select
                        {...p}
                        name="tipo"
                        value={tipo}
                        onChange={(ev) => setTipo(ev.target.value)}
                    >
                        <option value={TIPO_PRESION}>Presión arterial</option>
                        {sueltos.map((t) => (
                            <option key={t.codigo} value={t.codigo}>
                                {t.nombre} ({t.unidad})
                            </option>
                        ))}
                    </select>
                )}
            </Campo>

            {tipo === TIPO_PRESION ? (
                <div className="grid grid-cols-2 gap-4">
                    <Campo
                        etiqueta="Sistólica"
                        obligatorio
                        ayuda="La cifra más alta"
                        error={e.sistolica}
                    >
                        {(p) => (
                            <input
                                {...p}
                                name="sistolica"
                                type="number"
                                inputMode="numeric"
                                min={60}
                                max={260}
                                placeholder="118"
                                required
                            />
                        )}
                    </Campo>
                    <Campo
                        etiqueta="Diastólica"
                        obligatorio
                        ayuda="La cifra más baja"
                        error={e.diastolica}
                    >
                        {(p) => (
                            <input
                                {...p}
                                name="diastolica"
                                type="number"
                                inputMode="numeric"
                                min={30}
                                max={180}
                                placeholder="76"
                                required
                            />
                        )}
                    </Campo>
                </div>
            ) : (
                <Campo
                    etiqueta={`Valor en ${actual?.unidad ?? ""}`}
                    obligatorio
                    error={e.valor}
                    ayuda={
                        actual
                            ? `Entre ${actual.valor_min} y ${actual.valor_max} ${actual.unidad}.`
                            : undefined
                    }
                >
                    {(p) => (
                        <input
                            {...p}
                            name="valor"
                            type="number"
                            inputMode="decimal"
                            step={actual?.decimales ? 0.1 : 1}
                            min={actual?.valor_min}
                            max={actual?.valor_max}
                            required
                        />
                    )}
                </Campo>
            )}

            <Campo etiqueta="Nota" error={e.observaciones}>
                {(p) => (
                    <input
                        {...p}
                        name="observaciones"
                        maxLength={255}
                        placeholder="En reposo, en ayunas…"
                    />
                )}
            </Campo>

            <Boton type="submit" ancho="completo" tamano="lg" disabled={enviando}>
                {tipo === TIPO_PRESION ? (
                    <HeartPulse aria-hidden />
                ) : (
                    <Save aria-hidden />
                )}
                {enviando ? "Guardando…" : "Guardar medición"}
            </Boton>
        </form>
    );
}
