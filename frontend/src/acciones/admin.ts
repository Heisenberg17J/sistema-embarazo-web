"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ErrorApi, api } from "@/lib/api";
import type { Asignacion, Contenido, Usuario } from "@/lib/tipos";
import { hoyLocal } from "@/lib/formato";

/**
 * Acciones del administrador (RF-14, RF-15, RF-16 y configuración).
 *
 * Las que abren un diálogo con resultado (crear un usuario, una asignación, un
 * contenido…) no revalidan: hacerlo remontaría el diálogo antes de que se lea
 * la respuesta. El diálogo pide `router.refresh()` al cerrarse.
 *
 * Las de un solo paso (desactivar, finalizar, publicar, guardar un parámetro)
 * sí revalidan. Un `router.refresh()` lanzado en el mismo instante en que
 * termina la acción a veces se cancelaba y la lista quedaba desactualizada;
 * con `revalidatePath` los datos frescos llegan en la misma respuesta.
 *
 * Por eso mismo las listas del administrador no van dentro de un <Suspense>:
 * con la lista suspendida, la acción que la revalida o refresca a veces se
 * quedaba en "Guardando…" aunque el servidor ya hubiera respondido. Al
 * cambiar de filtro se sigue viendo la lista anterior hasta que llega la nueva.
 */

const revalidarAdmin = () => revalidatePath("/admin", "layout");

export interface ResultadoAdmin {
    ok?: boolean;
    error?: string;
    porCampo?: Record<string, string>;
    resumen?: string;
    /** Usuario recién creado, para ofrecer ir a su ficha. */
    usuarioId?: number;
    /** Valores escritos, para repintar el formulario tras un error. */
    valores?: Record<string, string>;
}

const SECRETOS = ["contrasena_temporal"];

function valoresDe(datos: FormData): Record<string, string> {
    const valores: Record<string, string> = {};
    for (const [clave, valor] of datos.entries()) {
        if (typeof valor === "string" && !SECRETOS.includes(clave)) {
            valores[clave] = valor;
        }
    }
    return valores;
}

/**
 * Los errores del perfil llegan como `perfil.numero_documento`; el formulario
 * los pinta junto al campo plano.
 */
const sinPrefijo = (campo: string) => campo.replace(/^perfil\./, "");

function aResultado(error: unknown, datos: FormData): ResultadoAdmin {
    const valores = valoresDe(datos);
    if (error instanceof ErrorApi) {
        const porCampo = Object.fromEntries(
            Object.entries(error.porCampo).map(([c, m]) => [sinPrefijo(c), m]),
        );
        return Object.keys(porCampo).length
            ? { error: "Revisa los datos marcados.", porCampo, valores }
            : { error: error.message, valores };
    }
    return { error: "No se pudo guardar. Intenta de nuevo.", valores };
}

function aResultadoZod(error: z.ZodError, datos: FormData): ResultadoAdmin {
    return {
        error: "Revisa los datos marcados.",
        porCampo: Object.fromEntries(
            error.issues.map((i) => [i.path.join(".") || "general", i.message]),
        ),
        valores: valoresDe(datos),
    };
}

// --- Piezas de validación ----------------------------------------------------

const id = z.coerce.number().int().positive();

/** Cadena vacía → undefined, para que un campo opcional sin llenar no se envíe. */
const vacioAIndefinido = (v: unknown) =>
    typeof v === "string" && v.trim() === "" ? undefined : v;

/** Cadena vacía → null: en una edición, vaciar el campo borra el dato. */
const vacioANulo = (v: unknown) =>
    typeof v === "string" && v.trim() === "" ? null : v;

const texto = (max: number, mensaje = "No puede estar vacío") =>
    z.string().trim().min(1, mensaje).max(max, `Máximo ${max} caracteres`);

const textoOpcional = (max: number) =>
    z.preprocess(
        vacioANulo,
        z.string().trim().max(max, `Máximo ${max} caracteres`).nullable().optional(),
    );

const telefono = z.preprocess(
    vacioANulo,
    z
        .string()
        .trim()
        .regex(/^[0-9+()\s-]{7,20}$/, "Teléfono inválido")
        .nullable()
        .optional(),
);

const correo = z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Escribe el correo")
    .email("Correo electrónico inválido");

const contrasenaTemporal = z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .max(72, "Máximo 72 caracteres")
    .regex(/[A-Za-z]/, "Debe incluir al menos una letra")
    .regex(/\d/, "Debe incluir al menos un número");

const numero = (mensaje: string) =>
    z.preprocess(
        (v) =>
            typeof v === "string" && v.trim() !== ""
                ? Number(v.trim().replace(",", "."))
                : undefined,
        z.number({ error: mensaje }).refine(Number.isFinite, mensaje),
    );

const numeroOpcional = z.preprocess(
    (v) =>
        typeof v === "string" && v.trim() !== ""
            ? Number(v.trim().replace(",", "."))
            : null,
    z.number({ error: "Debe ser un número" }).nullable(),
);

const entero = (min: number, max: number, mensaje: string) =>
    z.preprocess(
        (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : undefined),
        z
            .number({ error: mensaje })
            .int("Debe ser un número entero")
            .min(min, `Mínimo ${min}`)
            .max(max, `Máximo ${max}`),
    );

const casilla = z.preprocess((v) => v === "on" || v === "true", z.boolean());

const codigo = z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_]{2,30}$/, "Solo mayúsculas, números y guion bajo (2 a 30)");

const hoy = hoyLocal;

// ---------------------------------------------------------------------------
// Usuarios (RF-14)
// ---------------------------------------------------------------------------

const perfilGestante = z.object({
    tipo_documento: z.enum(["CC", "TI", "CE", "PA"], { error: "Elige el tipo" }),
    numero_documento: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9]{4,20}$/, "Entre 4 y 20 letras o números"),
    fecha_nacimiento: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Indica la fecha de nacimiento")
        .refine((v) => v <= hoy(), "La fecha no puede ser futura"),
    telefono,
    direccion: textoOpcional(160),
    eps: textoOpcional(80),
    grupo_sanguineo: z.preprocess(
        vacioANulo,
        z.enum(["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"]).nullable().optional(),
    ),
    contacto_emergencia_nombre: textoOpcional(120),
    contacto_emergencia_telefono: telefono,
});

const perfilProfesional = z.object({
    registro_profesional: texto(30, "Escribe el registro profesional"),
    especialidad: texto(80, "Escribe la especialidad"),
    institucion: textoOpcional(120),
    telefono,
});

const PERFILES = {
    GESTANTE: perfilGestante,
    PROFESIONAL: perfilProfesional,
} as const;

const datosBasicos = z.object({
    nombre: texto(80, "Escribe el nombre"),
    apellido: texto(80, "Escribe el apellido"),
    correo,
});

const rol = z.enum(["GESTANTE", "PROFESIONAL", "ADMINISTRADOR"], {
    error: "Elige el rol",
});

/** Valida los datos comunes y el perfil que corresponde al rol. */
function leerUsuario(datos: FormData, rolUsuario: z.infer<typeof rol>) {
    const entrada = Object.fromEntries(datos);
    const basicos = datosBasicos.safeParse(entrada);
    const perfil =
        rolUsuario === "ADMINISTRADOR"
            ? null
            : PERFILES[rolUsuario].safeParse(entrada);

    const issues = [
        ...(basicos.success ? [] : basicos.error.issues),
        ...(perfil && !perfil.success ? perfil.error.issues : []),
    ];
    if (issues.length) return { error: new z.ZodError(issues) };

    return {
        basicos: basicos.data!,
        perfil: perfil?.success ? perfil.data : undefined,
    };
}

export async function crearUsuario(
    _previo: ResultadoAdmin,
    datos: FormData,
): Promise<ResultadoAdmin> {
    const rolValido = rol.safeParse(datos.get("rol"));
    if (!rolValido.success) return aResultadoZod(rolValido.error, datos);

    const contrasena = contrasenaTemporal.safeParse(datos.get("contrasena_temporal"));
    const leido = leerUsuario(datos, rolValido.data);
    if ("error" in leido || !contrasena.success) {
        const issues = [
            ...("error" in leido && leido.error ? leido.error.issues : []),
            ...(contrasena.success
                ? []
                : contrasena.error.issues.map((i) => ({
                      ...i,
                      path: ["contrasena_temporal"],
                  }))),
        ];
        return aResultadoZod(new z.ZodError(issues), datos);
    }

    // Al crear, un opcional vacío simplemente no se envía.
    const perfil = leido.perfil
        ? Object.fromEntries(Object.entries(leido.perfil).filter(([, v]) => v != null))
        : undefined;

    try {
        const usuario = await api.post<Usuario>("/usuarios", {
            rol: rolValido.data,
            ...leido.basicos,
            contrasena_temporal: contrasena.data,
            ...(perfil ? { perfil } : {}),
        });
        return {
            ok: true,
            usuarioId: usuario.id,
            resumen: `Cuenta de ${usuario.nombre} ${usuario.apellido} creada. Entrega la contraseña temporal por un canal seguro: la tendrá que cambiar al entrar.`,
        };
    } catch (error) {
        return aResultado(error, datos);
    }
}

export async function editarUsuario(
    _previo: ResultadoAdmin,
    datos: FormData,
): Promise<ResultadoAdmin> {
    const usuarioId = id.safeParse(datos.get("usuario_id"));
    const rolValido = rol.safeParse(datos.get("rol"));
    if (!usuarioId.success || !rolValido.success) {
        return { error: "No se reconoce el usuario.", valores: valoresDe(datos) };
    }

    const leido = leerUsuario(datos, rolValido.data);
    if ("error" in leido && leido.error) return aResultadoZod(leido.error, datos);

    try {
        const usuario = await api.patch<Usuario>(`/usuarios/${usuarioId.data}`, {
            ...leido.basicos,
            ...(leido.perfil ? { perfil: leido.perfil } : {}),
        });
        revalidarAdmin();
        // Se devuelven los valores también al guardar: el formulario sigue
        // abierto y React lo restablece al terminar la acción.
        return {
            ok: true,
            resumen: `Datos de ${usuario.nombre} ${usuario.apellido} guardados.`,
            valores: valoresDe(datos),
        };
    } catch (error) {
        return aResultado(error, datos);
    }
}

export async function cambiarEstadoUsuario(
    _previo: ResultadoAdmin,
    datos: FormData,
): Promise<ResultadoAdmin> {
    const valido = z
        .object({ usuario_id: id, activo: z.enum(["true", "false"]) })
        .safeParse(Object.fromEntries(datos));
    if (!valido.success) return { error: "No se reconoce el usuario." };

    try {
        await api.patch(`/usuarios/${valido.data.usuario_id}/estado`, {
            activo: valido.data.activo === "true",
        });
        revalidarAdmin();
        return { ok: true };
    } catch (error) {
        return aResultado(error, datos);
    }
}

export async function restablecerContrasena(
    _previo: ResultadoAdmin,
    datos: FormData,
): Promise<ResultadoAdmin> {
    const valido = z
        .object({ usuario_id: id, contrasena_temporal: contrasenaTemporal })
        .safeParse(Object.fromEntries(datos));
    if (!valido.success) return aResultadoZod(valido.error, datos);

    try {
        await api.post(`/usuarios/${valido.data.usuario_id}/restablecer-contrasena`, {
            contrasena_temporal: valido.data.contrasena_temporal,
        });
        return {
            ok: true,
            resumen:
                "Contraseña restablecida y sesiones cerradas. Deberá cambiarla la próxima vez que entre.",
        };
    } catch (error) {
        return aResultado(error, datos);
    }
}

// ---------------------------------------------------------------------------
// Asignaciones (RF-15)
// ---------------------------------------------------------------------------

export async function crearAsignacion(
    _previo: ResultadoAdmin,
    datos: FormData,
): Promise<ResultadoAdmin> {
    const valido = z
        .object({
            profesional_id: z.coerce.number({ error: "Elige el profesional" }).int().positive("Elige el profesional"),
            gestante_id: z.coerce.number({ error: "Elige la gestante" }).int().positive("Elige la gestante"),
        })
        .safeParse(Object.fromEntries(datos));
    if (!valido.success) return aResultadoZod(valido.error, datos);

    try {
        const a = await api.post<Asignacion>("/asignaciones", valido.data);
        return {
            ok: true,
            resumen: `${a.gestante} queda asignada a ${a.profesional}. Desde ahora puede ver su seguimiento.`,
        };
    } catch (error) {
        return aResultado(error, datos);
    }
}

export async function finalizarAsignacion(
    _previo: ResultadoAdmin,
    datos: FormData,
): Promise<ResultadoAdmin> {
    const valido = id.safeParse(datos.get("asignacion_id"));
    if (!valido.success) return { error: "No se reconoce la asignación." };

    try {
        await api.patch(`/asignaciones/${valido.data}/finalizar`);
        revalidarAdmin();
        return { ok: true };
    } catch (error) {
        return aResultado(error, datos);
    }
}

// ---------------------------------------------------------------------------
// Contenido educativo (RF-16)
// ---------------------------------------------------------------------------

const esquemaContenido = z
    .object({
        titulo: texto(160, "Escribe el título"),
        categoria: textoOpcional(60),
        semana_desde: entero(0, 45, "Indica la semana inicial"),
        semana_hasta: entero(0, 45, "Indica la semana final"),
        cuerpo: texto(20000, "Escribe el contenido"),
        publicado: casilla,
    })
    .refine((d) => d.semana_desde <= d.semana_hasta, {
        message: "Debe ser igual o posterior a la semana inicial",
        path: ["semana_hasta"],
    });

export async function guardarContenido(
    _previo: ResultadoAdmin,
    datos: FormData,
): Promise<ResultadoAdmin> {
    const contenidoId = z.preprocess(vacioAIndefinido, id.optional()).safeParse(
        datos.get("contenido_id") ?? undefined,
    );
    const valido = esquemaContenido.safeParse(Object.fromEntries(datos));
    if (!valido.success) return aResultadoZod(valido.error, datos);
    if (!contenidoId.success) return { error: "No se reconoce el contenido." };

    try {
        const c = contenidoId.data
            ? await api.patch<Contenido>(`/contenido/${contenidoId.data}`, valido.data)
            : await api.post<Contenido>("/contenido", valido.data);
        return {
            ok: true,
            resumen: c.publicado
                ? `“${c.titulo}” está publicado: lo verán las gestantes entre las semanas ${c.semana_desde} y ${c.semana_hasta}.`
                : `“${c.titulo}” quedó guardado como borrador.`,
        };
    } catch (error) {
        return aResultado(error, datos);
    }
}

export async function publicarContenido(
    _previo: ResultadoAdmin,
    datos: FormData,
): Promise<ResultadoAdmin> {
    const valido = z
        .object({ contenido_id: id, publicado: z.enum(["true", "false"]) })
        .safeParse(Object.fromEntries(datos));
    if (!valido.success) return { error: "No se reconoce el contenido." };

    try {
        await api.patch(`/contenido/${valido.data.contenido_id}`, {
            publicado: valido.data.publicado === "true",
        });
        revalidarAdmin();
        return { ok: true };
    } catch (error) {
        return aResultado(error, datos);
    }
}

export async function eliminarContenido(
    _previo: ResultadoAdmin,
    datos: FormData,
): Promise<ResultadoAdmin> {
    const valido = id.safeParse(datos.get("contenido_id"));
    if (!valido.success) return { error: "No se reconoce el contenido." };

    try {
        await api.delete(`/contenido/${valido.data}`);
        revalidarAdmin();
        return { ok: true };
    } catch (error) {
        return aResultado(error, datos);
    }
}

// ---------------------------------------------------------------------------
// Catálogos
// ---------------------------------------------------------------------------

const semanaAlarma = z.preprocess(
    (v) =>
        typeof v === "string" ? (v.trim() !== "" ? Number(v) : null) : undefined,
    z
        .number({ error: "Debe ser un número" })
        .int("Debe ser un número entero")
        .min(1, "Mínimo 1")
        .max(45, "Máximo 45")
        .nullable()
        .optional(),
);

/** Lo que se edita de cada catálogo. El código va aparte: no se cambia al editar. */
const CATALOGOS = {
    "tipos-control": z.object({
        nombre: texto(80, "Escribe el nombre"),
        duracion_min: entero(5, 240, "Indica la duración en minutos"),
    }),
    "tipos-examen": z.object({
        nombre: texto(100, "Escribe el nombre"),
        descripcion: textoOpcional(2000),
    }),
    "tipos-sintoma": z
        .object({
            nombre: texto(80, "Escribe el nombre"),
            es_signo_alarma: casilla,
            // Sin signo de alarma estos campos no se envían y se dejan como están.
            severidad: z.preprocess(
                vacioANulo,
                z.enum(["INFORMATIVA", "ADVERTENCIA", "CRITICA"]).nullable().optional(),
            ),
            mensaje_alarma: textoOpcional(255),
            alarma_hasta_semana: semanaAlarma,
        })
        // Mismo criterio que la restricción ck_tipo_sintoma_alarma de la BD.
        .refine((d) => !d.es_signo_alarma || d.severidad, {
            message: "Un signo de alarma necesita severidad",
            path: ["severidad"],
        })
        .refine((d) => !d.es_signo_alarma || d.mensaje_alarma, {
            message: "Escribe lo que verá la gestante",
            path: ["mensaje_alarma"],
        }),
    "tipos-medicion": z
        .object({
            nombre: texto(80, "Escribe el nombre"),
            unidad: texto(15, "Escribe la unidad"),
            valor_min: numero("Indica el mínimo"),
            valor_max: numero("Indica el máximo"),
            decimales: entero(0, 3, "Indica los decimales"),
            registrable_por_gestante: casilla,
        })
        .refine((d) => d.valor_min < d.valor_max, {
            message: "Debe ser mayor que el mínimo",
            path: ["valor_max"],
        }),
} as const;

export type RutaCatalogo = keyof typeof CATALOGOS;

const rutaCatalogo = z.enum(Object.keys(CATALOGOS) as [RutaCatalogo, ...RutaCatalogo[]]);

export async function guardarCatalogo(
    _previo: ResultadoAdmin,
    datos: FormData,
): Promise<ResultadoAdmin> {
    const ruta = rutaCatalogo.safeParse(datos.get("catalogo"));
    if (!ruta.success) return { error: "Catálogo no válido." };

    const registroId = z
        .preprocess(vacioAIndefinido, id.optional())
        .safeParse(datos.get("registro_id") ?? undefined);
    if (!registroId.success) return { error: "No se reconoce el registro." };

    const entrada = Object.fromEntries(datos);
    const campos = CATALOGOS[ruta.data].safeParse(entrada);
    const nuevo = !registroId.data;
    const cod = nuevo ? codigo.safeParse(entrada.codigo ?? "") : null;

    if (!campos.success || (cod && !cod.success)) {
        const issues = [
            ...(campos.success ? [] : campos.error.issues),
            ...(cod && !cod.success
                ? cod.error.issues.map((i) => ({ ...i, path: ["codigo"] }))
                : []),
        ];
        return aResultadoZod(new z.ZodError(issues), datos);
    }

    try {
        const fila = nuevo
            ? await api.post<{ nombre: string }>(`/catalogos/${ruta.data}`, {
                  codigo: cod!.data,
                  ...campos.data,
              })
            : await api.patch<{ nombre: string }>(
                  `/catalogos/${ruta.data}/${registroId.data}`,
                  campos.data,
              );
        return { ok: true, resumen: `“${fila.nombre}” guardado.` };
    } catch (error) {
        return aResultado(error, datos);
    }
}

export async function cambiarEstadoCatalogo(
    _previo: ResultadoAdmin,
    datos: FormData,
): Promise<ResultadoAdmin> {
    const valido = z
        .object({
            catalogo: rutaCatalogo,
            registro_id: id,
            activo: z.enum(["true", "false"]),
        })
        .safeParse(Object.fromEntries(datos));
    if (!valido.success) return { error: "No se reconoce el registro." };

    const { catalogo, registro_id: registroId, activo } = valido.data;
    try {
        await api.patch(`/catalogos/${catalogo}/${registroId}`, {
            activo: activo === "true",
        });
        revalidarAdmin();
        return { ok: true };
    } catch (error) {
        return aResultado(error, datos);
    }
}

// ---------------------------------------------------------------------------
// Reglas de alerta (RF-11)
// ---------------------------------------------------------------------------

const esquemaRegla = z
    .object({
        tipo_medicion: z.string().trim().min(1, "Elige la medición"),
        codigo: z
            .string()
            .trim()
            .toUpperCase()
            .regex(/^[A-Z0-9_]{2,40}$/, "Solo mayúsculas, números y guion bajo (2 a 40)"),
        operador: z.enum(["MENOR", "MENOR_IGUAL", "MAYOR", "MAYOR_IGUAL", "FUERA_DE_RANGO"], {
            error: "Elige la condición",
        }),
        valor_referencia: numeroOpcional,
        valor_min: numeroOpcional,
        valor_max: numeroOpcional,
        semana_desde: entero(0, 45, "Indica la semana inicial"),
        semana_hasta: entero(0, 45, "Indica la semana final"),
        severidad: z.enum(["INFORMATIVA", "ADVERTENCIA", "CRITICA"], {
            error: "Elige la severidad",
        }),
        mensaje: texto(255, "Escribe el mensaje"),
        activa: casilla,
    })
    .refine((d) => d.semana_desde <= d.semana_hasta, {
        message: "Debe ser igual o posterior a la semana inicial",
        path: ["semana_hasta"],
    })
    // Mismo criterio que la restricción ck_regla_valores de la BD.
    .refine((d) => d.operador === "FUERA_DE_RANGO" || d.valor_referencia != null, {
        message: "Indica el valor de referencia",
        path: ["valor_referencia"],
    })
    .refine((d) => d.operador !== "FUERA_DE_RANGO" || d.valor_min != null, {
        message: "Indica el mínimo del rango",
        path: ["valor_min"],
    })
    .refine((d) => d.operador !== "FUERA_DE_RANGO" || d.valor_max != null, {
        message: "Indica el máximo del rango",
        path: ["valor_max"],
    })
    .refine(
        (d) =>
            d.operador !== "FUERA_DE_RANGO" ||
            d.valor_min == null ||
            d.valor_max == null ||
            d.valor_max > d.valor_min,
        { message: "Debe ser mayor que el mínimo", path: ["valor_max"] },
    );

export async function guardarRegla(
    _previo: ResultadoAdmin,
    datos: FormData,
): Promise<ResultadoAdmin> {
    const reglaId = z
        .preprocess(vacioAIndefinido, id.optional())
        .safeParse(datos.get("regla_id") ?? undefined);
    if (!reglaId.success) return { error: "No se reconoce la regla." };

    const valido = esquemaRegla.safeParse(Object.fromEntries(datos));
    if (!valido.success) return aResultadoZod(valido.error, datos);

    // Solo se envían los valores que usa el operador; los otros quedan vacíos.
    const d = valido.data;
    const rango = d.operador === "FUERA_DE_RANGO";
    const cuerpo = {
        ...d,
        valor_referencia: rango ? null : d.valor_referencia,
        valor_min: rango ? d.valor_min : null,
        valor_max: rango ? d.valor_max : null,
    };

    try {
        if (reglaId.data) await api.patch(`/catalogos/reglas-alerta/${reglaId.data}`, cuerpo);
        else await api.post("/catalogos/reglas-alerta", cuerpo);
        return {
            ok: true,
            resumen: d.activa
                ? `Regla ${d.codigo} guardada. Se aplica a las mediciones que se registren desde ahora.`
                : `Regla ${d.codigo} guardada, pero inactiva: no generará alertas.`,
        };
    } catch (error) {
        return aResultado(error, datos);
    }
}

export async function cambiarEstadoRegla(
    _previo: ResultadoAdmin,
    datos: FormData,
): Promise<ResultadoAdmin> {
    const valido = z
        .object({ regla_id: id, activa: z.enum(["true", "false"]) })
        .safeParse(Object.fromEntries(datos));
    if (!valido.success) return { error: "No se reconoce la regla." };

    try {
        await api.patch(`/catalogos/reglas-alerta/${valido.data.regla_id}`, {
            activa: valido.data.activa === "true",
        });
        revalidarAdmin();
        return { ok: true };
    } catch (error) {
        return aResultado(error, datos);
    }
}

// ---------------------------------------------------------------------------
// Configuración del sistema
// ---------------------------------------------------------------------------

export async function guardarParametro(
    _previo: ResultadoAdmin,
    datos: FormData,
): Promise<ResultadoAdmin> {
    const valido = z
        .object({
            clave: z.string().min(1).max(60),
            valor: texto(255, "El valor no puede quedar vacío"),
        })
        .safeParse(Object.fromEntries(datos));
    if (!valido.success) return aResultadoZod(valido.error, datos);

    try {
        await api.patch(
            `/admin/configuracion/${encodeURIComponent(valido.data.clave)}`,
            { valor: valido.data.valor },
        );
        revalidarAdmin();
        return { ok: true, resumen: "Guardado." };
    } catch (error) {
        return aResultado(error, datos);
    }
}

// ---------------------------------------------------------------------------
// Derecho de supresión (Ley 1581)
// ---------------------------------------------------------------------------

const esquemaAtender = z
    .object({
        solicitud_id: id,
        accion: z.enum(["ANONIMIZAR", "RECHAZAR"], { error: "Elige qué hacer con la solicitud" }),
        respuesta: z.preprocess(
            (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
            z.string().trim().max(500, "Máximo 500 caracteres").optional(),
        ),
    })
    .refine((d) => d.accion !== "RECHAZAR" || d.respuesta, {
        message: "Explica por qué se rechaza: la persona lo leerá",
        path: ["respuesta"],
    });

/**
 * ANONIMIZAR destruye lo que identifica a la persona y deja los registros
 * clínicos sin nombre; no se puede deshacer. RECHAZAR deja la cuenta como está.
 */
export async function atenderSolicitudSupresion(
    _previo: ResultadoAdmin,
    datos: FormData,
): Promise<ResultadoAdmin> {
    const valido = esquemaAtender.safeParse(Object.fromEntries(datos));
    if (!valido.success) {
        return {
            error: "Revisa los datos marcados.",
            porCampo: Object.fromEntries(valido.error.issues.map((i) => [i.path.join("."), i.message])),
            valores: valoresDe(datos),
        };
    }

    const { solicitud_id: solicitudId, ...cuerpo } = valido.data;
    try {
        await api.post(`/admin/solicitudes-supresion/${solicitudId}/atender`, cuerpo);
        revalidarAdmin();
        return { ok: true };
    } catch (error) {
        return aResultado(error, datos);
    }
}
