"use server";

import { z } from "zod";
import { ErrorApi, api } from "@/lib/api";
import type { Rol } from "@/lib/tipos";

export interface EstadoPerfil {
    error?: string;
    porCampo?: Record<string, string>;
    ok?: boolean;
}

const telefono = z
    .string()
    .trim()
    .regex(/^[0-9+()\s-]{7,20}$/, "Teléfono inválido");

/** Un campo vacío significa "borrar el dato", que en la API es null. */
const vacioEsNulo = <T extends z.ZodTypeAny>(esquema: T) =>
    z.preprocess(
        (v) => (typeof v === "string" && v.trim() === "" ? null : v),
        esquema.nullable(),
    );

const esquema = z.object({
    nombre: z.string().trim().min(1, "Escribe tu nombre").max(80),
    apellido: z.string().trim().min(1, "Escribe tu apellido").max(80),
    telefono: vacioEsNulo(telefono),
    direccion: z.string().trim().max(160, "Máximo 160 caracteres").optional(),
    eps: z.string().trim().max(80, "Máximo 80 caracteres").optional(),
    grupo_sanguineo: vacioEsNulo(
        z.enum(["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"]),
    ),
    contacto_emergencia_nombre: z
        .string()
        .trim()
        .max(120, "Máximo 120 caracteres")
        .optional(),
    contacto_emergencia_telefono: vacioEsNulo(telefono),
    institucion: z.string().trim().max(120, "Máximo 120 caracteres").optional(),
});

/** Campos que tiene sentido enviar según el rol: la API rechaza los demás. */
const CAMPOS_POR_ROL: Record<Rol, (keyof z.infer<typeof esquema>)[]> = {
    GESTANTE: [
        "nombre",
        "apellido",
        "telefono",
        "direccion",
        "eps",
        "grupo_sanguineo",
        "contacto_emergencia_nombre",
        "contacto_emergencia_telefono",
    ],
    PROFESIONAL: ["nombre", "apellido", "telefono", "institucion"],
    ADMINISTRADOR: ["nombre", "apellido"],
};

export async function actualizarPerfil(
    _previo: EstadoPerfil,
    datos: FormData,
): Promise<EstadoPerfil> {
    const rol = String(datos.get("rol")) as Rol;
    if (!(rol in CAMPOS_POR_ROL)) return { error: "No se pudo identificar tu cuenta." };

    const valido = esquema.partial().safeParse(Object.fromEntries(datos));
    if (!valido.success) {
        return {
            error: "Revisa los datos marcados.",
            porCampo: Object.fromEntries(
                valido.error.issues.map((i) => [i.path.join("."), i.message]),
            ),
        };
    }

    const cuerpo = Object.fromEntries(
        CAMPOS_POR_ROL[rol]
            .filter((campo) => valido.data[campo] !== undefined)
            .map((campo) => [campo, valido.data[campo]]),
    );

    try {
        await api.patch("/auth/perfil", cuerpo);
    } catch (error) {
        if (error instanceof ErrorApi) {
            const porCampo = error.porCampo;
            return Object.keys(porCampo).length
                ? { error: "Revisa los datos marcados.", porCampo }
                : { error: error.message };
        }
        return { error: "No se pudieron guardar los cambios. Intenta de nuevo." };
    }

    // Igual que en el resto de formularios: el cliente refresca después de
    // mostrar la confirmación.
    return { ok: true };
}
