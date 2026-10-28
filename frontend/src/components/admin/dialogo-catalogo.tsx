"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Save } from "lucide-react";
import { guardarCatalogo, type ResultadoAdmin, type RutaCatalogo } from "@/acciones/admin";
import { DialogoAccion } from "@/components/formularios/dialogo-accion";
import { Boton } from "@/components/ui/boton";
import { AvisoExito } from "@/components/ui/aviso-exito";
import { AvisoError, Campo } from "@/components/ui/campo";
import { SEVERIDAD_TEXTO } from "@/lib/formato";
import type { TipoControl, TipoExamen, TipoMedicion, TipoSintoma } from "@/lib/tipos";
import { useAccion } from "@/lib/usar-accion";

const INICIAL: ResultadoAdmin = {};

export type RegistroCatalogo = TipoControl | TipoExamen | TipoSintoma | TipoMedicion;

/** Nombre en singular de lo que contiene cada catálogo. */
export const SINGULAR: Record<RutaCatalogo, string> = {
    "tipos-control": "tipo de control",
    "tipos-examen": "tipo de examen",
    "tipos-sintoma": "síntoma",
    "tipos-medicion": "tipo de medición",
};

/** Crea o edita un registro de un catálogo. */
export function DialogoCatalogo({
    catalogo,
    registro,
}: {
    catalogo: RutaCatalogo;
    registro?: RegistroCatalogo;
}) {
    return (
        <DialogoAccion
            titulo={registro ? `Editar ${registro.nombre}` : `Nuevo ${SINGULAR[catalogo]}`}
            disparador={
                registro ? (
                    <Boton variante="fantasma" tamano="sm">
                        <Pencil aria-hidden />
                        Editar
                    </Boton>
                ) : (
                    <Boton variante="vidrio" tamano="sm">
                        <Plus aria-hidden />
                        Agregar
                    </Boton>
                )
            }
        >
            {({ onExito }) => (
                <Formulario catalogo={catalogo} registro={registro} onExito={onExito} />
            )}
        </DialogoAccion>
    );
}

function Formulario({
    catalogo,
    registro,
    onExito,
}: {
    catalogo: RutaCatalogo;
    registro?: RegistroCatalogo;
    onExito: () => void;
}) {
    const [estado, enviar, enviando] = useAccion(guardarCatalogo, INICIAL);
    const e = estado.porCampo ?? {};
    const v = estado.valores ?? {};
    const r = (registro ?? {}) as Partial<TipoControl & TipoExamen & TipoSintoma & TipoMedicion>;

    /** Valor inicial: lo escrito antes del error o lo guardado. */
    const inicial = (campo: keyof typeof r) =>
        v[campo] ?? (r[campo] != null ? String(r[campo]) : "");

    // Controlados: tras un error React restablece el formulario.
    const [alarma, setAlarma] = useState(r.es_signo_alarma ?? false);
    const [severidad, setSeveridad] = useState(r.severidad ?? "ADVERTENCIA");
    const [registrable, setRegistrable] = useState(r.registrable_por_gestante ?? false);

    useEffect(() => {
        if (estado.ok) onExito();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    if (estado.ok) return <AvisoExito>{estado.resumen}</AvisoExito>;

    return (
        <form onSubmit={enviar} className="space-y-4" noValidate>
            <input type="hidden" name="catalogo" value={catalogo} />
            {registro && <input type="hidden" name="registro_id" value={registro.id} />}
            <AvisoError>{estado.error}</AvisoError>

            {registro ? (
                <p className="text-sm text-muted-foreground">
                    Código <span className="font-mono font-medium text-foreground">{registro.codigo}</span>.
                    No se cambia: lo usan los registros y las reglas que ya existen.
                </p>
            ) : (
                <Campo
                    etiqueta="Código"
                    obligatorio
                    error={e.codigo}
                    ayuda="Identificador interno en mayúsculas, por ejemplo CONTROL_POSPARTO. No se podrá cambiar."
                >
                    {(p) => (
                        <input
                            {...p}
                            name="codigo"
                            maxLength={30}
                            defaultValue={v.codigo ?? ""}
                            autoCapitalize="characters"
                            spellCheck={false}
                            className={`${p.className} font-mono uppercase`}
                            required
                        />
                    )}
                </Campo>
            )}

            <Campo etiqueta="Nombre" obligatorio error={e.nombre}>
                {(p) => (
                    <input {...p} name="nombre" defaultValue={inicial("nombre")} required />
                )}
            </Campo>

            {catalogo === "tipos-control" && (
                <Campo
                    etiqueta="Duración (minutos)"
                    obligatorio
                    error={e.duracion_min}
                    ayuda="Duración por defecto al programar una cita de este tipo."
                >
                    {(p) => (
                        <input
                            {...p}
                            name="duracion_min"
                            type="number"
                            inputMode="numeric"
                            min={5}
                            max={240}
                            step={5}
                            defaultValue={inicial("duracion_min") || "30"}
                            required
                        />
                    )}
                </Campo>
            )}

            {catalogo === "tipos-examen" && (
                <Campo etiqueta="Descripción" error={e.descripcion}>
                    {(p) => (
                        <textarea
                            {...p}
                            name="descripcion"
                            rows={3}
                            maxLength={2000}
                            defaultValue={inicial("descripcion")}
                            className={`${p.className} h-auto py-3 leading-relaxed`}
                        />
                    )}
                </Campo>
            )}

            {catalogo === "tipos-sintoma" && (
                <>
                    <Casilla
                        nombre="es_signo_alarma"
                        marcada={alarma}
                        onCambio={setAlarma}
                        titulo="Es un signo de alarma"
                        detalle="Registrarlo genera una alerta inmediata para la gestante y su profesional."
                    />
                    {alarma && (
                        <>
                            <Campo etiqueta="Severidad" obligatorio error={e.severidad}>
                                {(p) => (
                                    <select
                                        {...p}
                                        name="severidad"
                                        value={severidad}
                                        onChange={(ev) =>
                                            setSeveridad(ev.target.value as typeof severidad)
                                        }
                                    >
                                        {(["CRITICA", "ADVERTENCIA", "INFORMATIVA"] as const).map(
                                            (s) => (
                                                <option key={s} value={s}>
                                                    {SEVERIDAD_TEXTO[s]}
                                                </option>
                                            ),
                                        )}
                                    </select>
                                )}
                            </Campo>
                            <Campo
                                etiqueta="Mensaje para la gestante"
                                obligatorio
                                error={e.mensaje_alarma}
                                ayuda="Qué debe hacer. Lo verá en cuanto registre el síntoma."
                            >
                                {(p) => (
                                    <textarea
                                        {...p}
                                        name="mensaje_alarma"
                                        rows={3}
                                        maxLength={255}
                                        defaultValue={inicial("mensaje_alarma")}
                                        className={`${p.className} h-auto py-3 leading-relaxed`}
                                    />
                                )}
                            </Campo>
                            <Campo
                                etiqueta="Solo antes de la semana"
                                error={e.alarma_hasta_semana}
                                ayuda="Déjalo vacío si es alarma en cualquier semana. Por ejemplo, las contracciones solo antes de la 37."
                            >
                                {(p) => (
                                    <input
                                        {...p}
                                        name="alarma_hasta_semana"
                                        type="number"
                                        inputMode="numeric"
                                        min={1}
                                        max={45}
                                        defaultValue={inicial("alarma_hasta_semana")}
                                    />
                                )}
                            </Campo>
                        </>
                    )}
                </>
            )}

            {catalogo === "tipos-medicion" && (
                <>
                    <div className="grid grid-cols-2 gap-4">
                        <Campo etiqueta="Unidad" obligatorio error={e.unidad}>
                            {(p) => (
                                <input
                                    {...p}
                                    name="unidad"
                                    maxLength={15}
                                    defaultValue={inicial("unidad")}
                                    placeholder="kg, mmHg…"
                                    required
                                />
                            )}
                        </Campo>
                        <Campo etiqueta="Decimales" obligatorio error={e.decimales}>
                            {(p) => (
                                <input
                                    {...p}
                                    name="decimales"
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    max={3}
                                    defaultValue={inicial("decimales") || "1"}
                                    required
                                />
                            )}
                        </Campo>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                        El rango técnico solo rechaza errores de digitación (RNF-10); los
                        umbrales que generan alertas se configuran en Reglas de alerta.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <Campo etiqueta="Valor mínimo" obligatorio error={e.valor_min}>
                            {(p) => (
                                <input
                                    {...p}
                                    name="valor_min"
                                    type="number"
                                    inputMode="decimal"
                                    step="any"
                                    defaultValue={inicial("valor_min")}
                                    required
                                />
                            )}
                        </Campo>
                        <Campo etiqueta="Valor máximo" obligatorio error={e.valor_max}>
                            {(p) => (
                                <input
                                    {...p}
                                    name="valor_max"
                                    type="number"
                                    inputMode="decimal"
                                    step="any"
                                    defaultValue={inicial("valor_max")}
                                    required
                                />
                            )}
                        </Campo>
                    </div>
                    <Casilla
                        nombre="registrable_por_gestante"
                        marcada={registrable}
                        onCambio={setRegistrable}
                        titulo="La gestante puede registrarla"
                        detalle="Si no, solo la registra el profesional durante un control."
                    />
                </>
            )}

            <Boton type="submit" ancho="completo" tamano="lg" disabled={enviando}>
                <Save aria-hidden />
                {enviando ? "Guardando…" : "Guardar"}
            </Boton>
        </form>
    );
}

export function Casilla({
    nombre,
    marcada,
    onCambio,
    titulo,
    detalle,
}: {
    nombre: string;
    marcada: boolean;
    onCambio: (v: boolean) => void;
    titulo: string;
    detalle: string;
}) {
    return (
        <label className="glass-soft flex cursor-pointer items-start gap-3 rounded-2xl p-4">
            <input
                type="checkbox"
                name={nombre}
                checked={marcada}
                onChange={(ev) => onCambio(ev.target.checked)}
                className="mt-0.5 size-5 accent-primary"
            />
            <span>
                <span className="block text-sm font-medium">{titulo}</span>
                <span className="block text-xs text-muted-foreground">{detalle}</span>
            </span>
        </label>
    );
}
