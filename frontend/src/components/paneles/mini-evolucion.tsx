import type { CSSProperties } from "react";
import { TrendingUp } from "lucide-react";
import Link from "next/link";
import { Boton } from "@/components/ui/boton";
import { EncabezadoTarjeta, Panel, Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { variacion } from "@/lib/formato";
import { ESTILO_SEVERIDAD } from "@/lib/severidad";
import type { SerieMediciones } from "@/lib/tipos";
import { porSemana, severidadDeValor, ultimoValor } from "@/lib/umbrales";
import { cn } from "@/lib/utils";

/**
 * Resumen de evolución del panel: barras de peso por semana y las últimas
 * cifras. La gráfica completa, con ejes y umbrales, vive en /evolucion.
 */
export function MiniEvolucion({
    serie,
    indice,
}: {
    serie: SerieMediciones;
    /** Posición en la entrada escalonada del panel. */
    indice?: number;
}) {
    const pesos = porSemana(serie, "PESO");
    const sistolica = ultimoValor(serie, "PA_SISTOLICA");
    const diastolica = ultimoValor(serie, "PA_DIASTOLICA");

    const severidadPresion =
        [
            sistolica && severidadDeValor(sistolica.valor, sistolica.referencias),
            diastolica && severidadDeValor(diastolica.valor, diastolica.referencias),
        ]
            .filter(Boolean)
            .sort()[0] ?? null;

    const maximo = Math.max(...pesos.map((p) => p.valor), 1);
    const minimo = Math.min(...pesos.map((p) => p.valor), maximo);
    // Escala relativa: se deja un 35% de base para que la barra más baja se vea.
    const alto = (valor: number) =>
        maximo === minimo
            ? 70
            : 35 + ((valor - minimo) / (maximo - minimo)) * 60;

    const ultimo = pesos.at(-1);
    const previo = pesos.at(-2);

    return (
        <Tarjeta indice={indice} className="lg:col-span-2">
            <EncabezadoTarjeta
                seccion="Evolución"
                titulo="Peso y presión arterial"
                accion={
                    <Boton comoHijo variante="vidrio" tamano="sm">
                        <Link href="/evolucion">
                            Ver detalle
                            <TrendingUp aria-hidden />
                        </Link>
                    </Boton>
                }
            />

            {pesos.length === 0 ? (
                <Vacio
                    icono={TrendingUp}
                    titulo="Aún no hay mediciones"
                    descripcion="Registra tu peso o tu presión y aquí verás cómo evolucionan semana a semana."
                />
            ) : (
                <ul className="mt-6 flex h-40 items-end gap-2" aria-hidden>
                    {pesos.map((p, i) => (
                        <li
                            key={p.semana}
                            className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                        >
                            <div
                                className={cn(
                                    "barra-crece w-full max-w-14 rounded-t-lg",
                                    i === pesos.length - 1 ? "bg-brand" : "bg-brand/55",
                                )}
                                style={{ height: `${alto(p.valor)}%`, "--i": i } as CSSProperties}
                            />
                            <span className="text-[10px] text-muted-foreground">
                                S{p.semana}
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            {/* Equivalente accesible de las barras. */}
            {pesos.length > 0 && (
                <p className="sr-only">
                    Peso por semana de gestación:{" "}
                    {pesos
                        .map((p) => `semana ${p.semana}, ${p.valor} kilogramos`)
                        .join("; ")}
                    .
                </p>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                <Panel className="rounded-xl p-3 text-center">
                    <p className="text-[11px] text-muted-foreground">Peso actual</p>
                    <p className="mt-1 font-display text-base font-semibold sm:text-xl">
                        {ultimo ? `${ultimo.valor} kg` : "—"}
                    </p>
                </Panel>

                <Panel className="rounded-xl p-3 text-center">
                    <p className="text-[11px] text-muted-foreground">Presión</p>
                    <p
                        className={cn(
                            "mt-1 font-display text-base font-semibold sm:text-xl",
                            severidadPresion && ESTILO_SEVERIDAD[severidadPresion].texto,
                        )}
                    >
                        {sistolica && diastolica
                            ? `${sistolica.valor}/${diastolica.valor}`
                            : "—"}
                    </p>
                </Panel>

                <Panel className="rounded-xl p-3 text-center">
                    <p className="text-[11px] text-muted-foreground">Variación</p>
                    <p className="mt-1 font-display text-base font-semibold sm:text-xl">
                        {ultimo && previo ? variacion(ultimo.valor - previo.valor) : "—"}
                    </p>
                </Panel>
            </div>
        </Tarjeta>
    );
}
