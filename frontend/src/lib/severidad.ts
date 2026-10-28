import { AlertTriangle, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { Severidad } from "./tipos";
import type { TonoInsignia } from "@/components/ui/insignia";

/**
 * Presentación de cada severidad de alerta (RF-11).
 *
 * El color nunca va solo: cada alerta lleva además icono y etiqueta de texto,
 * para que se entienda sin distinguir colores.
 */
export const ESTILO_SEVERIDAD: Record<
    Severidad,
    {
        etiqueta: string;
        icono: LucideIcon;
        tono: TonoInsignia;
        borde: string;
        fondo: string;
        texto: string;
    }
> = {
    CRITICA: {
        etiqueta: "Atención inmediata",
        icono: TriangleAlert,
        tono: "critica",
        borde: "border-l-critica-borde",
        fondo: "bg-critica-suave",
        texto: "text-critica",
    },
    ADVERTENCIA: {
        etiqueta: "Advertencia",
        icono: AlertTriangle,
        tono: "advertencia",
        borde: "border-l-advertencia-borde",
        fondo: "bg-advertencia-suave",
        texto: "text-advertencia",
    },
    INFORMATIVA: {
        etiqueta: "Informativa",
        icono: Info,
        tono: "informativa",
        borde: "border-l-informativa-borde",
        fondo: "bg-informativa-suave",
        texto: "text-informativa",
    },
};

/** Orden de atención: lo crítico primero. */
export const PESO_SEVERIDAD: Record<Severidad, number> = {
    CRITICA: 0,
    ADVERTENCIA: 1,
    INFORMATIVA: 2,
};
