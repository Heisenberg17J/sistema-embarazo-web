import {
    Activity,
    BellRing,
    CalendarDays,
    ClipboardList,
    FlaskConical,
    History,
    TrendingUp,
} from "lucide-react";
import { eliminarControl, eliminarExamen } from "@/acciones/correcciones";
import { DialogoCorregirControl } from "@/components/formularios/dialogo-corregir-control";
import { DialogoCorregirExamen } from "@/components/formularios/dialogo-corregir-examen";
import { DialogoEliminar } from "@/components/formularios/dialogo-eliminar";
import { AlertaItem } from "@/components/paneles/alerta-item";
import { GraficaEvolucion } from "@/components/paneles/grafica-evolucion";
import { LineaTiempo } from "@/components/paneles/linea-tiempo";
import { Filtros, filtroValido } from "@/components/ui/filtros";
import { Insignia } from "@/components/ui/insignia";
import { Paginacion } from "@/components/ui/paginacion";
import { Panel } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import {
    alertasDeEmbarazo,
    citasDeEmbarazo,
    controles,
    examenes,
    historial,
    serieMediciones,
    sintomas,
} from "@/lib/datos";
import {
    ESTADO_ALERTA_TEXTO,
    ESTADO_CITA_TEXTO,
    capitalizar,
    fechaCompleta,
    fechaLarga,
    marcaTiempo,
} from "@/lib/formato";
import { ESTILO_SEVERIDAD } from "@/lib/severidad";
import { ultimoValor } from "@/lib/umbrales";

export const SECCIONES = [
    { valor: "historial", texto: "Historial", icono: History },
    { valor: "controles", texto: "Controles", icono: ClipboardList },
    { valor: "mediciones", texto: "Mediciones", icono: TrendingUp },
    { valor: "sintomas", texto: "Síntomas", icono: Activity },
    { valor: "examenes", texto: "Exámenes", icono: FlaskConical },
    { valor: "citas", texto: "Citas", icono: CalendarDays },
    { valor: "alertas", texto: "Alertas", icono: BellRing },
] as const;

interface Props {
    embarazoId: number;
    pagina: number;
    ruta: string;
    params: Record<string, string | string[] | undefined>;
}

const INTENSIDAD = ["", "Muy leve", "Leve", "Moderado", "Fuerte", "Muy fuerte"];

export async function Seccion({
    seccion,
    ...props
}: Props & { seccion: string }) {
    switch (seccion) {
        case "controles":
            return <Controles {...props} />;
        case "mediciones":
            return <Mediciones {...props} />;
        case "sintomas":
            return <Sintomas {...props} />;
        case "examenes":
            return <Examenes {...props} />;
        case "citas":
            return <Citas {...props} />;
        case "alertas":
            return <Alertas {...props} />;
        default:
            return <Historial {...props} />;
    }
}

const TIPOS_HISTORIAL = [
    { valor: "CONTROL", texto: "Controles" },
    { valor: "SINTOMA", texto: "Síntomas" },
    { valor: "EXAMEN", texto: "Exámenes" },
    { valor: "CITA", texto: "Citas" },
    { valor: "ALERTA", texto: "Alertas" },
];

async function Historial({ embarazoId, pagina, ruta, params }: Props) {
    // Un tipo inventado en la URL haría que la API responda 400.
    const tipo = filtroValido(
        params,
        "tipo",
        TIPOS_HISTORIAL.map((t) => t.valor),
    );
    const lista = await historial(embarazoId, { page: pagina, limit: 20, tipo });
    return (
        <>
            <Filtros
                ruta={ruta}
                params={params}
                nombre="tipo"
                etiqueta="Tipo de registro"
                opciones={TIPOS_HISTORIAL}
                textoTodos="Todo"
                className="mt-5"
            />
            {lista.datos.length === 0 ? (
                <Vacio
                    icono={History}
                    titulo={tipo ? "No hay registros de ese tipo" : "Sin registros todavía"}
                    descripcion={
                        tipo
                            ? "Prueba con otro filtro o mira todo el historial."
                            : "Aquí se reúne todo lo que se registre sobre este embarazo."
                    }
                />
            ) : (
                <LineaTiempo eventos={lista.datos} />
            )}
            <Paginacion ruta={ruta} params={params} paginacion={lista.paginacion} etiqueta="registros" />
        </>
    );
}

async function Controles({ embarazoId, pagina, ruta, params }: Props) {
    const lista = await controles(embarazoId, { page: pagina, limit: 10 });
    if (lista.datos.length === 0) {
        return (
            <Vacio
                icono={ClipboardList}
                titulo="Sin controles registrados"
                descripcion="Registra el primer control prenatal desde el botón de arriba."
            />
        );
    }
    return (
        <>
            <ul className="mt-5 space-y-3">
                {lista.datos.map((control) => (
                    <li key={control.id} className="glass-soft rounded-2xl p-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <p className="font-display text-lg font-medium">
                                Semana {control.semana_gestacion}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {capitalizar(fechaLarga(control.fecha))} · {control.profesional}
                            </p>
                        </div>
                        {control.observaciones && (
                            <p className="mt-2 text-sm leading-relaxed">{control.observaciones}</p>
                        )}
                        {control.mediciones.length > 0 && (
                            <ul className="mt-3 flex flex-wrap gap-1.5">
                                {control.mediciones.map((m) => (
                                    <li key={m.tipo}>
                                        <Insignia>
                                            {m.nombre}: {m.valor} {m.unidad}
                                        </Insignia>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {/* Solo el profesional que lo registró y durante 7 días: lo decide el servidor. */}
                        {control.editable && (
                            <div className="mt-3 flex justify-end gap-1 border-t border-border-firme pt-2">
                                <DialogoCorregirControl embarazoId={embarazoId} control={control} />
                                <DialogoEliminar
                                    titulo="Eliminar el control"
                                    descripcion={`Semana ${control.semana_gestacion} · ${fechaCompleta(control.fecha)}`}
                                    accion={eliminarControl}
                                    embarazoId={embarazoId}
                                    elementoId={control.id}
                                    motivoObligatorio
                                >
                                    <p>
                                        Se eliminan también sus mediciones. Queda una copia de lo que había en
                                        la auditoría, con tu nombre y el motivo.
                                    </p>
                                </DialogoEliminar>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
            <Paginacion ruta={ruta} params={params} paginacion={lista.paginacion} etiqueta="controles" />
        </>
    );
}

const TIPOS_GRAFICA = [
    { codigos: ["PESO"], titulo: "Peso corporal", unidad: "kg" },
    { codigos: ["PA_SISTOLICA", "PA_DIASTOLICA"], titulo: "Presión arterial", unidad: "mmHg" },
    { codigos: ["ALTURA_UTERINA"], titulo: "Altura uterina", unidad: "cm" },
    { codigos: ["FCF"], titulo: "Frecuencia cardiaca fetal", unidad: "lpm" },
];

async function Mediciones({ embarazoId }: Props) {
    const serie = await serieMediciones(
        embarazoId,
        TIPOS_GRAFICA.flatMap((g) => g.codigos),
    );
    const conDatos = TIPOS_GRAFICA.filter((g) =>
        g.codigos.some(
            (c) => (serie.series.find((s) => s.tipo === c)?.puntos.length ?? 0) > 0,
        ),
    );

    if (conDatos.length === 0) {
        return (
            <Vacio
                icono={TrendingUp}
                titulo="Sin mediciones registradas"
                descripcion="Aparecerán aquí a medida que se registren, tanto en los controles como desde la app de la gestante."
            />
        );
    }

    return (
        <div className="mt-5 space-y-6">
            {conDatos.map((grupo) => (
                <section key={grupo.titulo}>
                    <h3 className="font-display text-lg font-medium">{grupo.titulo}</h3>
                    <GraficaEvolucion
                        series={serie.series.filter((s) => grupo.codigos.includes(s.tipo))}
                        unidad={grupo.unidad}
                        alto={220}
                    />
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {grupo.codigos.map((codigo) => {
                            const ultimo = ultimoValor(serie, codigo);
                            if (!ultimo) return null;
                            const info = serie.series.find((s) => s.tipo === codigo);
                            return (
                                <Panel key={codigo} className="flex items-baseline justify-between gap-3">
                                    <span className="text-xs text-muted-foreground">
                                        {info?.nombre}
                                        <span className="ml-1.5 text-[11px]">
                                            · {marcaTiempo(ultimo.fecha)}
                                        </span>
                                    </span>
                                    <span className="font-display text-lg font-semibold">
                                        {ultimo.valor} {ultimo.unidad}
                                    </span>
                                </Panel>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
}

async function Sintomas({ embarazoId, pagina, ruta, params }: Props) {
    const lista = await sintomas(embarazoId, { page: pagina, limit: 15 });
    if (lista.datos.length === 0) {
        return (
            <Vacio
                icono={Activity}
                titulo="No ha registrado síntomas"
                descripcion="La gestante los registra desde su app."
            />
        );
    }
    return (
        <>
            <ul className="mt-5 space-y-3">
                {lista.datos.map((sintoma) => {
                    const estilo = sintoma.alerta_severidad
                        ? ESTILO_SEVERIDAD[sintoma.alerta_severidad]
                        : null;
                    return (
                        <li key={sintoma.id} className="glass-soft rounded-2xl p-4">
                            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                                <div className="min-w-0">
                                    <p className="font-medium text-balance">{sintoma.descripcion}</p>
                                    <p className="mt-0.5 text-sm text-muted-foreground">
                                        {capitalizar(fechaLarga(sintoma.fecha))}
                                        {sintoma.semana_gestacion != null &&
                                            ` · semana ${sintoma.semana_gestacion}`}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {sintoma.intensidad && (
                                        <Insignia>{INTENSIDAD[sintoma.intensidad]}</Insignia>
                                    )}
                                    {estilo && (
                                        <Insignia tono={estilo.tono}>{estilo.etiqueta}</Insignia>
                                    )}
                                </div>
                            </div>
                            {sintoma.observaciones && (
                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                    {sintoma.observaciones}
                                </p>
                            )}
                        </li>
                    );
                })}
            </ul>
            <Paginacion ruta={ruta} params={params} paginacion={lista.paginacion} etiqueta="síntomas" />
        </>
    );
}

async function Examenes({ embarazoId, pagina, ruta, params }: Props) {
    const lista = await examenes(embarazoId, { page: pagina, limit: 10 });
    if (lista.datos.length === 0) {
        return (
            <Vacio
                icono={FlaskConical}
                titulo="Sin exámenes registrados"
                descripcion="Registra el primero desde el botón de arriba."
            />
        );
    }
    return (
        <>
            <ul className="mt-5 space-y-3">
                {lista.datos.map((examen) => (
                    <li key={examen.id} className="glass-soft rounded-2xl p-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <p className="font-display text-lg font-medium">{examen.tipo_nombre}</p>
                            <p className="text-sm text-muted-foreground">
                                {capitalizar(fechaLarga(examen.fecha))} · {examen.profesional}
                            </p>
                        </div>
                        <p className="mt-2 whitespace-pre-line rounded-xl bg-surface-soft px-3 py-2.5 text-sm leading-relaxed">
                            {examen.resultado}
                        </p>
                        {examen.observaciones && (
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                {examen.observaciones}
                            </p>
                        )}

                        {examen.editable && (
                            <div className="mt-3 flex justify-end gap-1 border-t border-border-firme pt-2">
                                <DialogoCorregirExamen embarazoId={embarazoId} examen={examen} />
                                <DialogoEliminar
                                    titulo="Eliminar el examen"
                                    descripcion={examen.tipo_nombre}
                                    accion={eliminarExamen}
                                    embarazoId={embarazoId}
                                    elementoId={examen.id}
                                    motivoObligatorio
                                >
                                    <p>La paciente dejará de verlo. Queda una copia en la auditoría.</p>
                                </DialogoEliminar>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
            <Paginacion ruta={ruta} params={params} paginacion={lista.paginacion} etiqueta="exámenes" />
        </>
    );
}

async function Citas({ embarazoId }: Props) {
    const lista = await citasDeEmbarazo(embarazoId);
    if (lista.length === 0) {
        return (
            <Vacio
                icono={CalendarDays}
                titulo="Sin citas"
                descripcion="Programa la primera desde el botón de arriba."
            />
        );
    }
    return (
        <ul className="mt-5 space-y-3">
            {lista.map((cita) => (
                <li key={cita.id} className="glass-soft rounded-2xl p-4">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                        <div className="min-w-0">
                            <p className="font-medium">{cita.tipo_control_nombre}</p>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                                {capitalizar(fechaLarga(cita.fecha))} · {cita.hora} ·{" "}
                                {cita.profesional}
                            </p>
                        </div>
                        <Insignia
                            tono={
                                cita.estado === "CUMPLIDA"
                                    ? "exito"
                                    : cita.estado === "NO_ASISTIO"
                                      ? "advertencia"
                                      : cita.estado === "CANCELADA"
                                        ? "neutro"
                                        : "marca"
                            }
                        >
                            {ESTADO_CITA_TEXTO[cita.estado]}
                        </Insignia>
                    </div>
                    {cita.motivo_cancelacion && (
                        <p className="mt-2 rounded-xl bg-surface-soft px-3 py-2 text-xs text-muted-foreground">
                            <span className="font-medium">Motivo:</span>{" "}
                            {cita.motivo_cancelacion}
                        </p>
                    )}
                </li>
            ))}
        </ul>
    );
}

async function Alertas({ embarazoId, pagina, ruta, params }: Props) {
    const lista = await alertasDeEmbarazo(embarazoId, { page: pagina, limit: 15 });
    if (lista.datos.length === 0) {
        return (
            <Vacio
                icono={BellRing}
                titulo="Sin alertas"
                descripcion="No se ha generado ninguna alerta para este embarazo."
            />
        );
    }
    return (
        <>
            <div className="mt-5 space-y-3">
                {lista.datos.map((alerta) => (
                    <AlertaItem
                        key={alerta.id}
                        severidad={alerta.severidad}
                        mensaje={alerta.mensaje}
                        generadaEn={alerta.generada_en}
                        estado={ESTADO_ALERTA_TEXTO[alerta.estado]}
                        anulada={alerta.estado === "ANULADA"}
                        detalle={
                            [
                                alerta.valor_detectado != null &&
                                    `Valor registrado: ${alerta.valor_detectado}${alerta.unidad ? ` ${alerta.unidad}` : ""}.`,
                                alerta.revisor && `Revisada por ${alerta.revisor}.`,
                                alerta.observacion_revision,
                                alerta.motivo_anulacion,
                            ]
                                .filter(Boolean)
                                .join(" ") || null
                        }
                    />
                ))}
            </div>
            {lista.aviso && (
                <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                    {lista.aviso}
                </p>
            )}
            <Paginacion ruta={ruta} params={params} paginacion={lista.paginacion} etiqueta="alertas" />
        </>
    );
}

export { fechaCompleta };
