"use client";

import { useEffect, useRef } from "react";
import { marcarLeido } from "@/acciones/contenido";

/**
 * Marca el contenido como leído al abrirlo. No pinta nada: es solo el registro
 * de lectura que alimenta las estadísticas (RF-16).
 */
export function MarcarLeido({ contenidoId }: { contenidoId: number }) {
    const yaEnviado = useRef(false);

    useEffect(() => {
        if (yaEnviado.current) return;
        yaEnviado.current = true;
        void marcarLeido(contenidoId);
    }, [contenidoId]);

    return null;
}
