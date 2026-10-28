import { cache } from "react";
import { api, consulta, obtenerONulo } from "./api";
import type {
    Alerta,
    Contenido,
    Control,
    Embarazo,
    EventoHistorial,
    Examen,
    Medicion,
    Pagina,
    PanelGestante,
    SerieMediciones,
    Sintoma,
    TipoMedicion,
    TipoSintoma,
    TipoControl,
    TipoExamen,
    Paciente,
    Cita,
    Usuario,
} from "./tipos";

/**
 * Lecturas de la API usadas por las pantallas.
 * `cache` evita repetir la misma petición cuando varios componentes de la
 * misma página la piden.
 */

export const panel = cache(<T>() => api.get<T>("/dashboard"));

export const panelDeGestante = cache(() => api.get<PanelGestante>("/dashboard"));

/** Embarazo activo de la gestante autenticada, o null si aún no registró uno. */
export const embarazoActivo = cache(() =>
    obtenerONulo<Embarazo>("/embarazos/actual"),
);

export const embarazo = cache((id: number) =>
    obtenerONulo<Embarazo>(`/embarazos/${id}`),
);

export const serieMediciones = cache((id: number, tipos: string[]) =>
    api.get<SerieMediciones>(
        `/embarazos/${id}/mediciones/serie${consulta({ tipos: tipos.join(",") })}`,
    ),
);

export const mediciones = cache(
    (id: number, params: Record<string, unknown> = {}) =>
        api.get<Pagina<Medicion>>(`/embarazos/${id}/mediciones${consulta(params)}`),
);

export const sintomas = cache(
    (id: number, params: Record<string, unknown> = {}) =>
        api.get<Pagina<Sintoma>>(`/embarazos/${id}/sintomas${consulta(params)}`),
);

export const examenes = cache(
    (id: number, params: Record<string, unknown> = {}) =>
        api.get<Pagina<Examen>>(`/embarazos/${id}/examenes${consulta(params)}`),
);

export const controles = cache(
    (id: number, params: Record<string, unknown> = {}) =>
        api.get<Pagina<Control>>(`/embarazos/${id}/controles${consulta(params)}`),
);

export const historial = cache(
    (id: number, params: Record<string, unknown> = {}) =>
        api.get<Pagina<EventoHistorial>>(
            `/embarazos/${id}/historial${consulta(params)}`,
        ),
);

export const citasDeEmbarazo = cache(
    (id: number, ambito?: "proximas" | "anteriores") =>
        api.get<Cita[]>(`/embarazos/${id}/citas${consulta({ ambito })}`),
);

export const alertas = cache((params: Record<string, unknown> = {}) =>
    api.get<Pagina<Alerta>>(`/alertas${consulta(params)}`),
);

/** Alertas de un embarazo concreto, para la ficha de la paciente. */
export const alertasDeEmbarazo = cache(
    (id: number, params: Record<string, unknown> = {}) =>
        api.get<Pagina<Alerta>>(`/embarazos/${id}/alertas${consulta(params)}`),
);

export const contenidoDeMiSemana = cache(() =>
    obtenerONulo<{ semana: number; contenidos: Contenido[] }>(
        "/contenido/mi-semana",
    ),
);

export const contenidos = cache((params: Record<string, unknown> = {}) =>
    api.get<Pagina<Contenido>>(`/contenido${consulta(params)}`),
);

export const contenidoPorId = cache((id: number) =>
    obtenerONulo<Contenido>(`/contenido/${id}`),
);

// --- Catálogos: cambian poco, se pueden cachear unos minutos ---------------

export const tiposMedicion = cache(() =>
    api.get<TipoMedicion[]>("/catalogos/tipos-medicion", { revalidar: 300 }),
);

export const tiposSintoma = cache(() =>
    api.get<TipoSintoma[]>("/catalogos/tipos-sintoma", { revalidar: 300 }),
);

/** Usuario autenticado con su perfil (incluye el contacto de emergencia). */
export const usuarioActual = cache(() => api.get<Usuario>("/auth/me"));

// --- Lecturas del profesional ---------------------------------------------

export const pacientes = cache((q?: string) =>
    api.get<Paciente[]>(`/pacientes${consulta({ q })}`),
);

/** Ficha de una paciente asignada: datos personales y sus embarazos. */
export const paciente = cache((gestanteId: number) =>
    obtenerONulo<Usuario & { embarazos: Embarazo[] }>(`/pacientes/${gestanteId}`),
);

/** Agenda propia (profesional) o citas propias (gestante). */
export const citas = cache((params: Record<string, unknown> = {}) =>
    api.get<Pagina<Cita>>(`/citas${consulta(params)}`),
);

export const tiposControl = cache(() =>
    api.get<TipoControl[]>("/catalogos/tipos-control", { revalidar: 300 }),
);

export const tiposExamen = cache(() =>
    api.get<TipoExamen[]>("/catalogos/tipos-examen", { revalidar: 300 }),
);
