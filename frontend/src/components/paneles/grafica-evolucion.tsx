"use client";

import {
    CartesianGrid,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import type { SerieMediciones } from "@/lib/tipos";
import { severidadDeValor } from "@/lib/umbrales";

type Serie = SerieMediciones["series"][number];
type Referencia = Serie["referencias"][number];

/** Colores de cada línea, tomados de los tokens del tema. */
const COLORES = ["var(--brand-deep)", "var(--exito)", "var(--secondary-foreground)"];

const COLOR_UMBRAL: Record<string, string> = {
    CRITICA: "var(--critica-borde)",
    ADVERTENCIA: "var(--advertencia-borde)",
    INFORMATIVA: "var(--informativa-borde)",
};

/** Valor fijo al que apunta una regla, si lo tiene. */
const valorDeReferencia = (r: Referencia) =>
    r.valor_referencia ?? r.valor_max ?? r.valor_min ?? null;

/**
 * Gráfica de una o varias series de medición sobre la semana de gestación.
 *
 * Las líneas punteadas son los umbrales configurados en el sistema, los mismos
 * que usa el motor de alertas del backend: la gráfica nunca contradice a las
 * alertas que recibe la gestante.
 */
export function GraficaEvolucion({
    series,
    unidad,
    alto = 280,
}: {
    series: Serie[];
    unidad: string;
    alto?: number;
}) {
    // Recharts necesita una fila por punto del eje X: se combinan las series
    // por semana de gestación.
    const porSemana = new Map<number, Record<string, number>>();
    for (const serie of series) {
        for (const punto of serie.puntos) {
            if (punto.semana == null) continue;
            const fila = porSemana.get(punto.semana) ?? { semana: punto.semana };
            fila[serie.tipo] = punto.valor;
            porSemana.set(punto.semana, fila);
        }
    }
    const datos = [...porSemana.values()].sort((a, b) => a.semana - b.semana);

    // Con un solo punto no hay evolución que mostrar: la pantalla deja a la
    // vista la última lectura y se ahorra una gráfica vacía.
    if (datos.length < 2) return null;

    // Un umbral por valor y severidad, sin repetir los que coinciden.
    const umbrales = new Map<string, { valor: number; severidad: string }>();
    for (const serie of series) {
        for (const r of serie.referencias) {
            const valor = valorDeReferencia(r);
            if (valor == null) continue;
            umbrales.set(`${valor}-${r.severidad}`, { valor, severidad: r.severidad });
        }
    }

    const nombrePorTipo = Object.fromEntries(series.map((s) => [s.tipo, s.nombre]));

    return (
        <>
            {/* La gráfica es decorativa para lectores de pantalla: debajo va el
                mismo dato en texto. */}
            <div aria-hidden style={{ height: alto }} className="mt-5 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    {/* Recharts 3 hace enfocable la gráfica (accessibilityLayer); aquí va dentro de un
                        contenedor aria-hidden, y un elemento oculto no puede recibir el foco. */}
                    <LineChart
                        accessibilityLayer={false}
                        data={datos}
                        margin={{ top: 8, right: 12, bottom: 4, left: -12 }}
                    >
                        <CartesianGrid
                            stroke="var(--border-firme)"
                            strokeDasharray="3 3"
                            vertical={false}
                        />
                        <XAxis
                            dataKey="semana"
                            tickFormatter={(v) => `S${v}`}
                            stroke="var(--muted-foreground)"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="var(--muted-foreground)"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            width={44}
                            domain={["dataMin - 5", "dataMax + 5"]}
                        />

                        {[...umbrales.values()].map((u) => (
                            <ReferenceLine
                                key={`${u.valor}-${u.severidad}`}
                                y={u.valor}
                                stroke={COLOR_UMBRAL[u.severidad] ?? "var(--border-firme)"}
                                strokeDasharray="5 4"
                                strokeWidth={1.5}
                            />
                        ))}

                        {series.map((serie, i) => (
                            <Line
                                key={serie.tipo}
                                type="monotone"
                                dataKey={serie.tipo}
                                name={serie.nombre}
                                stroke={COLORES[i % COLORES.length]}
                                strokeWidth={2.5}
                                connectNulls
                                dot={<Punto referencias={serie.referencias} />}
                                activeDot={{ r: 6 }}
                                isAnimationActive={false}
                            />
                        ))}

                        <Tooltip
                            content={<Etiqueta unidad={unidad} nombres={nombrePorTipo} />}
                            cursor={{ stroke: "var(--border-firme)" }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {series.length > 1 && (
                <ul className="mt-1 flex flex-wrap justify-center gap-4">
                    {series.map((serie, i) => (
                        <li
                            key={serie.tipo}
                            className="flex items-center gap-2 text-xs text-muted-foreground"
                        >
                            <span
                                aria-hidden
                                className="h-0.5 w-5 rounded-full"
                                style={{ background: COLORES[i % COLORES.length] }}
                            />
                            {serie.nombre}
                        </li>
                    ))}
                </ul>
            )}

            <p className="sr-only">
                {series
                    .map(
                        (serie) =>
                            `${serie.nombre}: ` +
                            serie.puntos
                                .filter((p) => p.semana != null)
                                .map(
                                    (p) =>
                                        `semana ${p.semana}, ${p.valor} ${serie.unidad}`,
                                )
                                .join("; "),
                    )
                    .join(". ")}
                .
            </p>
        </>
    );
}

/** Punto de la línea; se pinta en rojo o ámbar si cruza un umbral. */
function Punto({
    cx,
    cy,
    value,
    referencias,
}: {
    cx?: number;
    cy?: number;
    value?: number;
    referencias: Referencia[];
}) {
    if (cx == null || cy == null || value == null) return null;

    const severidad = severidadDeValor(value, referencias);
    const color = severidad ? COLOR_UMBRAL[severidad] : "var(--brand-deep)";

    return (
        <circle
            cx={cx}
            cy={cy}
            r={severidad ? 5 : 3.5}
            fill={color}
            stroke="var(--surface-strong)"
            strokeWidth={severidad ? 2 : 1.5}
        />
    );
}

interface PropsEtiqueta {
    active?: boolean;
    label?: number;
    payload?: { dataKey?: string | number; value?: number; color?: string }[];
    unidad: string;
    nombres: Record<string, string>;
}

function Etiqueta({ active, label, payload, unidad, nombres }: PropsEtiqueta) {
    if (!active || !payload?.length) return null;

    return (
        <div className="rounded-2xl border border-border-firme bg-popover px-3 py-2 text-sm shadow-elevada">
            <p className="font-medium">Semana {label}</p>
            <ul className="mt-1 space-y-0.5">
                {payload.map((p) => (
                    <li key={String(p.dataKey)} className="flex items-center gap-2">
                        <span
                            aria-hidden
                            className="size-2 rounded-full"
                            style={{ background: p.color }}
                        />
                        <span className="text-muted-foreground">
                            {nombres[String(p.dataKey)] ?? p.dataKey}:
                        </span>
                        <span className="font-medium">
                            {p.value} {unidad}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
