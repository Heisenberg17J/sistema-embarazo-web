"use server";

import { z } from "zod";
import { ErrorApi, api } from "@/lib/api";

export interface EstadoCancelacion {
    error?: string;
    porCampo?: Record<string, string>;
    ok?: boolean;
}

const esquema = z.object({
    cita_id: z.coerce.number().int().positive(),
    motivo_cancelacion: z
        .string()
        .trim()
        .min(3, "Cuéntanos brevemente por qué no podrás asistir")
        .max(255, "Máximo 255 caracteres"),
});

/**
 * RF-07. La gestante solo puede cancelar, y el backend exige el motivo para
 * que su profesional sepa por qué y pueda reprogramar.
 */
export async function cancelarCita(
    _previo: EstadoCancelacion,
    datos: FormData,
): Promise<EstadoCancelacion> {
    const valido = esquema.safeParse(Object.fromEntries(datos));
    if (!valido.success) {
        return {
            error: "Revisa los datos marcados.",
            porCampo: Object.fromEntries(
                valido.error.issues.map((i) => [i.path.join("."), i.message]),
            ),
        };
    }

    const { cita_id: citaId, motivo_cancelacion: motivo } = valido.data;

    try {
        await api.patch(`/citas/${citaId}/estado`, {
            estado: "CANCELADA",
            motivo_cancelacion: motivo,
        });
    } catch (error) {
        if (error instanceof ErrorApi) return { error: error.message };
        return { error: "No se pudo cancelar la cita. Intenta de nuevo." };
    }

    // El refresco lo pide el diálogo al cerrarse: revalidar aquí lo remontaría
    // y se perdería el resultado de la acción.
    return { ok: true };
}
