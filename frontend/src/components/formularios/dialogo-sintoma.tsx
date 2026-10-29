"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity, Plus, Save, TriangleAlert } from "lucide-react";
import { registrarSintoma, type ResultadoRegistro } from "@/acciones/registros";
import { AvisoCritico } from "@/components/paneles/aviso-critico";
import { Boton, DISPARADOR_TARJETA } from "@/components/ui/boton";
import { AvisoExito } from "@/components/ui/aviso-exito";
import { AvisoError, Campo } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import type { Alerta, TipoSintoma } from "@/lib/tipos";
import { useAccion } from "@/lib/usar-accion";

const INICIAL: ResultadoRegistro = {};
const OTRO = "__OTRO__";

const INTENSIDADES = [
    { valor: "1", texto: "1 · Muy leve" },
    { valor: "2", texto: "2 · Leve" },
    { valor: "3", texto: "3 · Moderado" },
    { valor: "4", texto: "4 · Fuerte" },
    { valor: "5", texto: "5 · Muy fuerte" },
];

interface Props {
    tipos: TipoSintoma[];
    contactoNombre?: string | null;
    contactoTelefono?: string | null;
    /** "tarjeta": el disparador es una tarjeta táctil con icono en móvil (panel). */
    presentacion?: "boton" | "tarjeta";
}

export function DialogoSintoma({ tipos, contactoNombre, contactoTelefono, presentacion = "boton" }: Props) {
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
                {presentacion === "tarjeta" ? <Activity aria-hidden /> : <Plus aria-hidden />}
                Síntoma
            </Boton>

            <Dialogo
                abierto={abierto}
                onCambio={cerrar}
                titulo="Registrar un síntoma"
                descripcion="Cuenta cómo te sientes. Algunos síntomas requieren atención inmediata y te avisamos al momento."
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
    tipos: TipoSintoma[];
    onCritica: (alertas: Alerta[]) => void;
    onGuardado: () => void;
}) {
    const [estado, enviar, enviando] = useAccion(registrarSintoma, INICIAL);
    const [tipo, setTipo] = useState("");
    const e = estado.porCampo ?? {};

    useEffect(() => {
        if (!estado.ok) return;
        onGuardado();
        const urgentes = estado.alertas?.filter((a) => a.accion_inmediata) ?? [];
        if (urgentes.length > 0) onCritica(urgentes);
        // Solo depende de `estado`: las funciones cambian de identidad en cada
        // render del componente padre y reejecutarían el efecto en bucle.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    // Los signos de alarma se listan primero y marcados, para que se encuentren
    // rápido justo cuando hacen falta.
    const alarma = tipos.filter((t) => t.es_signo_alarma);
    const comunes = tipos.filter((t) => !t.es_signo_alarma);
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

            <Campo etiqueta="¿Qué está sintiendo?" obligatorio error={e.tipo}>
                {(p) => (
                    <select
                        {...p}
                        name={tipo === OTRO ? "tipo_ignorado" : "tipo"}
                        value={tipo}
                        onChange={(ev) => setTipo(ev.target.value)}
                        required
                    >
                        <option value="" disabled>
                            Elige una opción
                        </option>
                        {alarma.length > 0 && (
                            <optgroup label="Requieren atención pronta">
                                {alarma.map((t) => (
                                    <option key={t.codigo} value={t.codigo}>
                                        {t.nombre}
                                    </option>
                                ))}
                            </optgroup>
                        )}
                        <optgroup label="Molestias frecuentes">
                            {comunes.map((t) => (
                                <option key={t.codigo} value={t.codigo}>
                                    {t.nombre}
                                </option>
                            ))}
                        </optgroup>
                        <option value={OTRO}>Otra cosa (la describo)</option>
                    </select>
                )}
            </Campo>

            {alarma.some((t) => t.codigo === tipo) && (
                <p className="flex items-start gap-2 rounded-2xl bg-critica-suave px-4 py-3 text-xs font-medium leading-relaxed text-critica">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    Al guardarlo te indicamos qué hacer y tu profesional recibe un aviso.
                </p>
            )}

            {tipo === OTRO && (
                <Campo
                    etiqueta="Descríbelo con tus palabras"
                    obligatorio
                    error={e.descripcion}
                >
                    {(p) => (
                        <input
                            {...p}
                            name="descripcion"
                            maxLength={255}
                            placeholder="Por ejemplo: calambres en las piernas de noche"
                            required
                        />
                    )}
                </Campo>
            )}

            <Campo
                etiqueta="¿Qué tan fuerte es?"
                error={e.intensidad}
                ayuda="Si es fuerte, tu profesional lo verá destacado."
            >
                {(p) => (
                    <select {...p} name="intensidad" defaultValue="">
                        <option value="">Prefiero no indicarlo</option>
                        {INTENSIDADES.map((i) => (
                            <option key={i.valor} value={i.valor}>
                                {i.texto}
                            </option>
                        ))}
                    </select>
                )}
            </Campo>

            <Campo etiqueta="Nota" error={e.observaciones}>
                {(p) => (
                    <input
                        {...p}
                        name="observaciones"
                        maxLength={2000}
                        placeholder="Desde cuándo, con qué mejora…"
                    />
                )}
            </Campo>

            <Boton type="submit" ancho="completo" tamano="lg" disabled={enviando}>
                <Save aria-hidden />
                {enviando ? "Guardando…" : "Guardar síntoma"}
            </Boton>
        </form>
    );
}
