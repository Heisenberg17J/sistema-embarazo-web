"use client";

import { type ReactNode } from "react";
import type { ResultadoAdmin } from "@/acciones/admin";
import { Boton } from "@/components/ui/boton";
import { useAccion } from "@/lib/usar-accion";

const INICIAL: ResultadoAdmin = {};

/**
 * Botón que ejecuta una acción sin diálogo, para cambios que se deshacen con
 * otro toque (publicar o pasar a borrador). Lo que tiene consecuencias para
 * otras personas pasa por `DialogoConfirmar`. La acción revalida la página, así
 * que no hace falta refrescar desde aquí.
 */
export function BotonAccion({
    accion,
    campos,
    children,
    pendiente = "Guardando…",
}: {
    accion: (previo: ResultadoAdmin, datos: FormData) => Promise<ResultadoAdmin>;
    campos: Record<string, string | number>;
    children: ReactNode;
    pendiente?: string;
}) {
    const [estado, enviar, enviando] = useAccion(accion, INICIAL);

    return (
        <form onSubmit={enviar} className="inline-flex flex-col items-end gap-1">
            {Object.entries(campos).map(([nombre, valor]) => (
                <input key={nombre} type="hidden" name={nombre} value={valor} />
            ))}
            <Boton type="submit" variante="fantasma" tamano="sm" disabled={enviando}>
                {enviando ? pendiente : children}
            </Boton>
            {estado.error && (
                <span role="alert" className="text-xs font-medium text-critica">
                    {estado.error}
                </span>
            )}
        </form>
    );
}
