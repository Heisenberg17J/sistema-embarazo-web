"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ErrorApi, api } from "@/lib/api";

export interface EstadoEmbarazo {
    error?: string;
    porCampo?: Record<string, string>;
    /** Lo escrito, para repintarlo: React 19 limpia el formulario al terminar. */
    valores?: Record<string, string>;
}

function valoresDe(datos: FormData): Record<string, string> {
    return Object.fromEntries(
        [...datos.entries()].filter(([, v]) => typeof v === "string"),
    ) as Record<string, string>;
}

const opcionalNumero = (min: number, max: number, campo: string) =>
    z.preprocess(
        (v) =>
            typeof v === "string" && v.trim() !== ""
                ? Number(v.replace(",", "."))
                : undefined,
        z
            .number({ error: `${campo} debe ser un número` })
            .min(min, `Mínimo ${min}`)
            .max(max, `Máximo ${max}`)
            .optional(),
    );

const esquema = z.object({
    fecha_inicio: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Indique la fecha de su última menstruación")
        .refine(
            (v) => v <= new Date().toISOString().slice(0, 10),
            "La fecha no puede ser futura",
        ),
    talla_cm: opcionalNumero(120, 220, "La talla"),
    peso_pregestacional_kg: opcionalNumero(30, 200, "El peso"),
});

/**
 * RF-04. La fecha probable de parto la calcula el backend (FUM + 280 días),
 * así que aquí solo se pide la FUM.
 */
export async function registrarEmbarazo(
    _previo: EstadoEmbarazo,
    datos: FormData,
): Promise<EstadoEmbarazo> {
    const valido = esquema.safeParse(Object.fromEntries(datos));
    if (!valido.success) {
        return {
            error: "Revise los datos marcados.",
            porCampo: Object.fromEntries(
                valido.error.issues.map((i) => [i.path.join("."), i.message]),
            ),
            valores: valoresDe(datos),
        };
    }

    try {
        await api.post("/embarazos", valido.data);
    } catch (error) {
        const valores = valoresDe(datos);
        if (error instanceof ErrorApi) {
            const porCampo = error.porCampo;
            return Object.keys(porCampo).length
                ? { error: "Revise los datos marcados.", porCampo, valores }
                : { error: error.message, valores };
        }
        return { error: "No se pudo registrar. Intente de nuevo.", valores };
    }

    revalidatePath("/panel");
    redirect("/panel");
}
