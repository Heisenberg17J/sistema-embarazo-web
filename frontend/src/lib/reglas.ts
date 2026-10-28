import type { OperadorRegla, ReglaAlerta } from "./tipos";

/** Condiciones de una regla de alerta, en lenguaje llano. */
export const OPERADOR_TEXTO: Record<OperadorRegla, string> = {
    MAYOR_IGUAL: "Igual o mayor que",
    MAYOR: "Mayor que",
    MENOR_IGUAL: "Igual o menor que",
    MENOR: "Menor que",
    FUERA_DE_RANGO: "Fuera del rango",
};

const SIMBOLO: Record<Exclude<OperadorRegla, "FUERA_DE_RANGO">, string> = {
    MAYOR_IGUAL: "≥",
    MAYOR: ">",
    MENOR_IGUAL: "≤",
    MENOR: "<",
};

/** "≥ 140 mmHg" o "Fuera de 110–160 lpm". */
export const condicionRegla = (
    r: Pick<ReglaAlerta, "operador" | "valor_referencia" | "valor_min" | "valor_max" | "unidad">,
) =>
    r.operador === "FUERA_DE_RANGO"
        ? `Fuera de ${r.valor_min}–${r.valor_max} ${r.unidad}`
        : `${SIMBOLO[r.operador]} ${r.valor_referencia} ${r.unidad}`;

/** "Cualquier semana" o "semanas 20 a 45". */
export const semanasRegla = (desde: number, hasta: number) =>
    desde === 0 && hasta >= 45
        ? "Cualquier semana"
        : hasta >= 45
          ? `Desde la semana ${desde}`
          : `Semanas ${desde} a ${hasta}`;
