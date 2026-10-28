import { PESO_SEVERIDAD } from "./severidad";
import type { Severidad, SerieMediciones } from "./tipos";

type Referencia = SerieMediciones["series"][number]["referencias"][number];

/** Misma lógica que el motor de alertas del backend (`services/alertas.js`). */
const cumple = (regla: Referencia, valor: number) => {
    switch (regla.operador) {
        case "MENOR":
            return regla.valor_referencia != null && valor < regla.valor_referencia;
        case "MENOR_IGUAL":
            return regla.valor_referencia != null && valor <= regla.valor_referencia;
        case "MAYOR":
            return regla.valor_referencia != null && valor > regla.valor_referencia;
        case "MAYOR_IGUAL":
            return regla.valor_referencia != null && valor >= regla.valor_referencia;
        case "FUERA_DE_RANGO":
            return (
                (regla.valor_min != null && valor < regla.valor_min) ||
                (regla.valor_max != null && valor > regla.valor_max)
            );
        default:
            return false;
    }
};

/**
 * Severidad que alcanzaría un valor según los umbrales configurados, o null si
 * está dentro de lo esperado. Sirve para colorear las gráficas con el mismo
 * criterio con el que el backend emite alertas: la pantalla nunca contradice a
 * la API.
 */
export const severidadDeValor = (
    valor: number,
    referencias: Referencia[],
): Severidad | null => {
    const alcanzadas = referencias
        .filter((r) => cumple(r, valor))
        .sort((a, b) => PESO_SEVERIDAD[a.severidad] - PESO_SEVERIDAD[b.severidad]);
    return alcanzadas[0]?.severidad ?? null;
};

/** Último valor de una serie por su código de tipo. */
export const ultimoValor = (serie: SerieMediciones, tipo: string) => {
    const s = serie.series.find((x) => x.tipo === tipo);
    const punto = s?.puntos.at(-1);
    return punto ? { ...punto, unidad: s!.unidad, referencias: s!.referencias } : null;
};

/** Un valor por semana (el más reciente), para las barras del panel. */
export const porSemana = (serie: SerieMediciones, tipo: string, cuantas = 7) => {
    const s = serie.series.find((x) => x.tipo === tipo);
    if (!s) return [];
    const mapa = new Map<number, number>();
    for (const p of s.puntos) {
        if (p.semana != null) mapa.set(p.semana, p.valor);
    }
    return [...mapa.entries()]
        .sort((a, b) => a[0] - b[0])
        .slice(-cuantas)
        .map(([semana, valor]) => ({ semana, valor }));
};
