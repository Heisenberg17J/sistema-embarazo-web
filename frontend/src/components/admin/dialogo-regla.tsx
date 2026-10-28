"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Save } from "lucide-react";
import { guardarRegla, type ResultadoAdmin } from "@/acciones/admin";
import { Casilla } from "@/components/admin/dialogo-catalogo";
import { DialogoAccion } from "@/components/formularios/dialogo-accion";
import { Boton } from "@/components/ui/boton";
import { AvisoExito } from "@/components/ui/aviso-exito";
import { AvisoError, Campo } from "@/components/ui/campo";
import { SEVERIDAD_TEXTO } from "@/lib/formato";
import { OPERADOR_TEXTO } from "@/lib/reglas";
import type { OperadorRegla, ReglaAlerta, Severidad, TipoMedicion } from "@/lib/tipos";
import { useAccion } from "@/lib/usar-accion";

const INICIAL: ResultadoAdmin = {};

/** RF-11. Crea o edita una regla de alerta sobre una medición. */
export function DialogoRegla({
    regla,
    tipos,
}: {
    regla?: ReglaAlerta;
    /** Mediciones activas a las que se puede aplicar una regla. */
    tipos: TipoMedicion[];
}) {
    return (
        <DialogoAccion
            titulo={regla ? `Editar ${regla.codigo}` : "Nueva regla de alerta"}
            descripcion="Se evalúa cada vez que se registra una medición de ese tipo."
            disparador={
                regla ? (
                    <Boton variante="fantasma" tamano="sm">
                        <Pencil aria-hidden />
                        Editar
                    </Boton>
                ) : (
                    <Boton>
                        <Plus aria-hidden />
                        Nueva regla
                    </Boton>
                )
            }
        >
            {({ onExito }) => <Formulario regla={regla} tipos={tipos} onExito={onExito} />}
        </DialogoAccion>
    );
}

function Formulario({
    regla,
    tipos,
    onExito,
}: {
    regla?: ReglaAlerta;
    tipos: TipoMedicion[];
    onExito: () => void;
}) {
    const [estado, enviar, enviando] = useAccion(guardarRegla, INICIAL);
    const e = estado.porCampo ?? {};
    const v = estado.valores ?? {};
    const inicial = (campo: keyof ReglaAlerta, porDefecto = "") =>
        v[campo] ?? (regla?.[campo] != null ? String(regla[campo]) : porDefecto);

    // Controlados: React restablece el formulario tras un error.
    const [tipo, setTipo] = useState(regla?.tipo_medicion ?? "");
    const [operador, setOperador] = useState<OperadorRegla>(regla?.operador ?? "MAYOR_IGUAL");
    const [severidad, setSeveridad] = useState<Severidad>(regla?.severidad ?? "ADVERTENCIA");
    const [activa, setActiva] = useState(regla?.activa ?? true);

    useEffect(() => {
        if (estado.ok) onExito();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    if (estado.ok) return <AvisoExito>{estado.resumen}</AvisoExito>;

    const unidad = tipos.find((t) => t.codigo === tipo)?.unidad ?? regla?.unidad ?? "";
    const etiquetaValor = (texto: string) => (unidad ? `${texto} (${unidad})` : texto);

    return (
        <form onSubmit={enviar} className="space-y-4" noValidate>
            {regla && <input type="hidden" name="regla_id" value={regla.id} />}
            <AvisoError>{estado.error}</AvisoError>

            <Campo etiqueta="Medición" obligatorio error={e.tipo_medicion}>
                {(p) => (
                    <select
                        {...p}
                        name="tipo_medicion"
                        value={tipo}
                        onChange={(ev) => setTipo(ev.target.value)}
                        required
                    >
                        <option value="" disabled>
                            Elige la medición
                        </option>
                        {tipos.map((t) => (
                            <option key={t.codigo} value={t.codigo}>
                                {t.nombre} ({t.unidad})
                            </option>
                        ))}
                    </select>
                )}
            </Campo>

            {regla ? (
                <input type="hidden" name="codigo" value={regla.codigo} />
            ) : (
                <Campo
                    etiqueta="Código"
                    obligatorio
                    error={e.codigo}
                    ayuda="Identificador en mayúsculas, por ejemplo PESO_GANANCIA_ALTA."
                >
                    {(p) => (
                        <input
                            {...p}
                            name="codigo"
                            maxLength={40}
                            defaultValue={v.codigo ?? ""}
                            spellCheck={false}
                            className={`${p.className} font-mono uppercase`}
                            required
                        />
                    )}
                </Campo>
            )}

            <Campo etiqueta="Se activa cuando el valor es" obligatorio error={e.operador}>
                {(p) => (
                    <select
                        {...p}
                        name="operador"
                        value={operador}
                        onChange={(ev) => setOperador(ev.target.value as OperadorRegla)}
                    >
                        {(Object.keys(OPERADOR_TEXTO) as OperadorRegla[]).map((o) => (
                            <option key={o} value={o}>
                                {OPERADOR_TEXTO[o]}
                            </option>
                        ))}
                    </select>
                )}
            </Campo>

            {operador === "FUERA_DE_RANGO" ? (
                <div className="grid grid-cols-2 gap-4">
                    <Campo etiqueta={etiquetaValor("Mínimo")} obligatorio error={e.valor_min}>
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
                    <Campo etiqueta={etiquetaValor("Máximo")} obligatorio error={e.valor_max}>
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
            ) : (
                <Campo
                    etiqueta={etiquetaValor("Valor de referencia")}
                    obligatorio
                    error={e.valor_referencia}
                >
                    {(p) => (
                        <input
                            {...p}
                            name="valor_referencia"
                            type="number"
                            inputMode="decimal"
                            step="any"
                            defaultValue={inicial("valor_referencia")}
                            required
                        />
                    )}
                </Campo>
            )}

            <div className="grid grid-cols-2 gap-4">
                <Campo etiqueta="Desde la semana" obligatorio error={e.semana_desde}>
                    {(p) => (
                        <input
                            {...p}
                            name="semana_desde"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={45}
                            defaultValue={inicial("semana_desde", "0")}
                            required
                        />
                    )}
                </Campo>
                <Campo etiqueta="Hasta la semana" obligatorio error={e.semana_hasta}>
                    {(p) => (
                        <input
                            {...p}
                            name="semana_hasta"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={45}
                            defaultValue={inicial("semana_hasta", "45")}
                            required
                        />
                    )}
                </Campo>
            </div>

            <Campo
                etiqueta="Severidad"
                obligatorio
                error={e.severidad}
                ayuda="“Atención inmediata” abre un aviso a pantalla completa en la app de la gestante."
            >
                {(p) => (
                    <select
                        {...p}
                        name="severidad"
                        value={severidad}
                        onChange={(ev) => setSeveridad(ev.target.value as Severidad)}
                    >
                        {(["CRITICA", "ADVERTENCIA", "INFORMATIVA"] as const).map((s) => (
                            <option key={s} value={s}>
                                {SEVERIDAD_TEXTO[s]}
                            </option>
                        ))}
                    </select>
                )}
            </Campo>

            <Campo
                etiqueta="Mensaje para la gestante"
                obligatorio
                error={e.mensaje}
                ayuda="Qué hacer, en palabras sencillas. Es orientación, no un diagnóstico."
            >
                {(p) => (
                    <textarea
                        {...p}
                        name="mensaje"
                        rows={3}
                        maxLength={255}
                        defaultValue={inicial("mensaje")}
                        className={`${p.className} h-auto py-3 leading-relaxed`}
                        required
                    />
                )}
            </Campo>

            <Casilla
                nombre="activa"
                marcada={activa}
                onCambio={setActiva}
                titulo="Regla activa"
                detalle="Si la desmarcas, se guarda pero no genera alertas."
            />

            <Boton type="submit" ancho="completo" tamano="lg" disabled={enviando}>
                <Save aria-hidden />
                {enviando ? "Guardando…" : "Guardar regla"}
            </Boton>
        </form>
    );
}
