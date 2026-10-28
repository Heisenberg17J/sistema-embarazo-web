"use server";

import { revalidatePath } from "next/cache";
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

    // Se revalida aquí y no con router.refresh() desde el diálogo: un refresco
    // lanzado justo al terminar la acción a veces se perdía y la cita seguía
    // apareciendo como programada. El diálogo se cierra al tener éxito, así que
    // no hay resultado que se pierda al remontarlo.
    revalidatePath("/citas");
    return { ok: true };
}
