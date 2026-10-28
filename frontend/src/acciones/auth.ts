"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ErrorApi, api } from "@/lib/api";
import {
    COOKIES,
    RUTA_INICIO,
    SEG_REFRESH,
    codificarSesion,
    opcionesCookie,
} from "@/lib/sesion";
import type { Rol, Usuario } from "@/lib/tipos";

export interface EstadoFormulario {
    error?: string;
    porCampo?: Record<string, string>;
    /**
     * Lo que la usuaria había escrito, para volver a pintarlo.
     *
     * React 19 limpia los campos no controlados cuando termina la acción, así
     * que sin esto un error de validación borraría todo el formulario. Nunca
     * incluye contraseñas.
     */
    valores?: Record<string, string>;
}

const SECRETOS = ["contrasena", "confirmacion", "contrasena_actual", "contrasena_nueva"];

/** Valores del formulario para repintarlo, sin las contraseñas. */
function valoresDe(datos: FormData): Record<string, string> {
    const valores: Record<string, string> = {};
    for (const [clave, valor] of datos.entries()) {
        if (typeof valor === "string" && !SECRETOS.includes(clave)) {
            valores[clave] = valor;
        }
    }
    return valores;
}

interface RespuestaSesion {
    usuario: Usuario;
    access_token: string;
    refresh_token: string;
}

/** Guarda la sesión en cookies. Solo se llama desde el servidor. */
async function guardarSesion(datos: RespuestaSesion) {
    const tarro = await cookies();
    tarro.set(COOKIES.acceso, datos.access_token, opcionesCookie(SEG_REFRESH));
    tarro.set(COOKIES.refresh, datos.refresh_token, opcionesCookie(SEG_REFRESH));
    // Legible por el navegador: solo rol y nombre, para pintar la interfaz.
    tarro.set(
        COOKIES.sesion,
        codificarSesion(datos.usuario),
        opcionesCookie(SEG_REFRESH, false),
    );
}

async function limpiarSesion() {
    const tarro = await cookies();
    for (const nombre of Object.values(COOKIES)) tarro.delete(nombre);
}

/** Traduce un error de la API al estado del formulario. */
function aEstado(error: unknown, datos?: FormData): EstadoFormulario {
    const valores = datos ? valoresDe(datos) : undefined;
    if (error instanceof ErrorApi) {
        const porCampo = error.porCampo;
        return {
            error: Object.keys(porCampo).length
                ? "Revise los datos marcados."
                : error.message,
            porCampo: Object.keys(porCampo).length ? porCampo : undefined,
            valores,
        };
    }
    return { error: "Ocurrió un error inesperado. Intente de nuevo.", valores };
}

/** Convierte los errores de zod al mismo formato por campo. */
function aEstadoZod(error: z.ZodError, datos: FormData): EstadoFormulario {
    return {
        error: "Revise los datos marcados.",
        porCampo: Object.fromEntries(
            error.issues.map((i) => [i.path.join(".") || "general", i.message]),
        ),
        valores: valoresDe(datos),
    };
}

/** Solo rutas internas, para que `siguiente` no sirva de redirección abierta. */
const destinoSeguro = (siguiente: unknown, rol: Rol) => {
    const ruta = typeof siguiente === "string" ? siguiente : "";
    return ruta.startsWith("/") && !ruta.startsWith("//")
        ? ruta
        : RUTA_INICIO[rol];
};

// ---------------------------------------------------------------------------

const esquemaLogin = z.object({
    correo: z.string().trim().min(1, "Escriba su correo").email("Correo electrónico inválido"),
    contrasena: z.string().min(1, "Escriba su contraseña"),
});

export async function iniciarSesion(
    _previo: EstadoFormulario,
    datos: FormData,
): Promise<EstadoFormulario> {
    const valido = esquemaLogin.safeParse({
        correo: datos.get("correo"),
        contrasena: datos.get("contrasena"),
    });
    if (!valido.success) return aEstadoZod(valido.error, datos);

    let sesion: RespuestaSesion;
    try {
        sesion = await api.post<RespuestaSesion>("/auth/login", valido.data, {
            sinToken: true,
        });
        await guardarSesion(sesion);
    } catch (error) {
        return aEstado(error, datos);
    }

    // redirect() lanza una excepción de control: va fuera del try.
    redirect(
        sesion.usuario.debe_cambiar_contrasena
            ? "/cambiar-contrasena"
            : destinoSeguro(datos.get("siguiente"), sesion.usuario.rol),
    );
}

// ---------------------------------------------------------------------------

const contrasenaSegura = z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .max(72, "Máximo 72 caracteres")
    .regex(/[A-Za-z]/, "Debe incluir al menos una letra")
    .regex(/\d/, "Debe incluir al menos un número");

const opcional = (esquema: z.ZodString) =>
    z.preprocess(
        (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
        esquema.optional(),
    );

const esquemaRegistro = z
    .object({
        nombre: z.string().trim().min(1, "Escriba su nombre").max(80),
        apellido: z.string().trim().min(1, "Escriba su apellido").max(80),
        correo: z.string().trim().toLowerCase().email("Correo electrónico inválido"),
        contrasena: contrasenaSegura,
        confirmacion: z.string(),
        tipo_documento: z.enum(["CC", "TI", "CE", "PA"]),
        numero_documento: z
            .string()
            .trim()
            .regex(/^[A-Za-z0-9]{4,20}$/, "Entre 4 y 20 letras o números"),
        fecha_nacimiento: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Indique su fecha de nacimiento")
            .refine((v) => v < new Date().toISOString().slice(0, 10), "La fecha no puede ser futura"),
        telefono: opcional(z.string().trim().regex(/^[0-9+()\s-]{7,20}$/, "Teléfono inválido")),
        eps: opcional(z.string().trim().max(80)),
        grupo_sanguineo: z.preprocess(
            (v) => (v === "" ? undefined : v),
            z.enum(["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"]).optional(),
        ),
        contacto_emergencia_nombre: opcional(z.string().trim().max(120)),
        contacto_emergencia_telefono: opcional(
            z.string().trim().regex(/^[0-9+()\s-]{7,20}$/, "Teléfono inválido"),
        ),
    })
    .refine((d) => d.contrasena === d.confirmacion, {
        message: "Las contraseñas no coinciden",
        path: ["confirmacion"],
    });

export async function registrarGestante(
    _previo: EstadoFormulario,
    datos: FormData,
): Promise<EstadoFormulario> {
    const valido = esquemaRegistro.safeParse(Object.fromEntries(datos));
    if (!valido.success) return aEstadoZod(valido.error, datos);

    const { confirmacion: _c, ...cuerpo } = valido.data;
    try {
        const sesion = await api.post<RespuestaSesion>("/auth/registro", cuerpo, {
            sinToken: true,
        });
        await guardarSesion(sesion);
    } catch (error) {
        return aEstado(error, datos);
    }

    // La gestante aún no tiene embarazo registrado: ese es el primer paso.
    redirect("/embarazo/nuevo");
}

// ---------------------------------------------------------------------------

const esquemaContrasena = z
    .object({
        contrasena_actual: z.string().min(1, "Escriba su contraseña actual"),
        contrasena_nueva: contrasenaSegura,
        confirmacion: z.string(),
    })
    .refine((d) => d.contrasena_nueva === d.confirmacion, {
        message: "Las contraseñas no coinciden",
        path: ["confirmacion"],
    })
    .refine((d) => d.contrasena_actual !== d.contrasena_nueva, {
        message: "La nueva contraseña debe ser distinta de la actual",
        path: ["contrasena_nueva"],
    });

export async function cambiarContrasena(
    _previo: EstadoFormulario,
    datos: FormData,
): Promise<EstadoFormulario> {
    const valido = esquemaContrasena.safeParse(Object.fromEntries(datos));
    if (!valido.success) return aEstadoZod(valido.error, datos);

    const { confirmacion: _c, ...cuerpo } = valido.data;
    try {
        await api.patch("/auth/contrasena", cuerpo);
    } catch (error) {
        return aEstado(error);
    }

    // El backend revoca todas las sesiones al cambiar la contraseña,
    // así que hay que volver a entrar.
    await limpiarSesion();
    redirect("/login?cambiada=1");
}

// ---------------------------------------------------------------------------

export async function cerrarSesion() {
    const tarro = await cookies();
    const refresh = tarro.get(COOKIES.refresh)?.value;
    if (refresh) {
        try {
            await api.post("/auth/logout", { refresh_token: refresh });
        } catch {
            // Si la API no responde, la sesión local se cierra igual.
        }
    }
    await limpiarSesion();
    redirect("/login");
}
