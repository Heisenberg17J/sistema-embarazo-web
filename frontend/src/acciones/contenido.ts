"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";

/**
 * RF-16. Marca un contenido como leído. El backend usa ON CONFLICT DO NOTHING,
 * así que repetirlo no hace daño: se puede llamar al abrir la página sin
 * comprobar antes si ya estaba leído.
 */
export async function marcarLeido(contenidoId: number): Promise<void> {
    try {
        await api.post(`/contenido/${contenidoId}/leido`);
    } catch {
        // Marcarlo como leído es un detalle de comodidad: si falla, la gestante
        // igual puede leer el contenido y no vale la pena interrumpirla.
        return;
    }
    revalidatePath("/aprendizaje");
    revalidatePath("/panel");
}
