import { format, formatDistanceToNowStrict, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Formato en español. Las fechas tipo DATE llegan de la API como "AAAA-MM-DD"
 * y se interpretan en la zona local: `parseISO` de una fecha sin hora devuelve
 * medianoche local, así que no hay corrimiento de un día.
 */

const aFecha = (valor: string | Date): Date | null => {
    if (valor instanceof Date) return isValid(valor) ? valor : null;
    if (!valor) return null;
    const d = parseISO(valor);
    return isValid(d) ? d : null;
};

/** "lunes, 21 de septiembre" */
export const fechaLarga = (valor: string | Date) => {
    const d = aFecha(valor);
    return d ? format(d, "EEEE, d 'de' MMMM", { locale: es }) : "";
};

/** "12 de marzo de 2027" */
export const fechaCompleta = (valor: string | Date) => {
    const d = aFecha(valor);
    return d ? format(d, "d 'de' MMMM 'de' yyyy", { locale: es }) : "";
};

/** "21 sep 2026" */
export const fechaCorta = (valor: string | Date) => {
    const d = aFecha(valor);
    return d ? format(d, "d MMM yyyy", { locale: es }) : "";
};

/** "jue 24 · 09:30" a partir de una fecha y una hora "HH:MM" */
export const fechaConHora = (fecha: string, hora: string) => {
    const d = aFecha(fecha);
    if (!d) return "";
    return `${format(d, "EEE d", { locale: es })} · ${hora.slice(0, 5)}`;
};

/** "21 sep, 14:30" para marcas de tiempo completas */
export const marcaTiempo = (valor: string | Date) => {
    const d = aFecha(valor);
    return d ? format(d, "d MMM, HH:mm", { locale: es }) : "";
};

/** "hace 3 horas" */
export const haceTiempo = (valor: string | Date) => {
    const d = aFecha(valor);
    return d
        ? `hace ${formatDistanceToNowStrict(d, { locale: es })}`
        : "";
};

/** "Semana 21 · 3 días" a partir de la edad gestacional "21+3" de la API. */
export const edadGestacionalLegible = (edad: string | null) => {
    if (!edad) return "";
    const [semanas, dias] = edad.split("+");
    if (!dias || dias === "0") return `Semana ${semanas}`;
    return `Semana ${semanas} · ${dias} ${dias === "1" ? "día" : "días"}`;
};

/** Nombre del trimestre. */
export const nombreTrimestre = (trimestre: number | null) =>
    trimestre ? ["Primer", "Segundo", "Tercer"][trimestre - 1] + " trimestre" : "";

/**
 * Progreso del embarazo sobre 40 semanas, acotado a 100.
 * Se usa para el anillo del panel.
 */
export const progresoGestacion = (semana: number | null) =>
    semana == null ? 0 : Math.min(100, Math.round((semana / 40) * 100));

/** Valor con su unidad: "64.2 kg", "118 mmHg". Respeta los decimales del tipo. */
export const valorConUnidad = (
    valor: number | null | undefined,
    unidad: string,
    decimales = 1,
) => {
    if (valor == null) return "—";
    return `${valor.toFixed(unidad === "mmHg" || unidad === "lpm" ? 0 : decimales)} ${unidad}`;
};

/** Diferencia con signo: "+0.4 kg", "−1.2 kg". */
export const variacion = (valor: number | null | undefined, unidad = "kg") => {
    if (valor == null) return "—";
    const signo = valor > 0 ? "+" : valor < 0 ? "−" : "";
    return `${signo}${Math.abs(valor).toFixed(1)} ${unidad}`;
};

/** Primera letra de nombre y apellido, para el avatar. */
export const iniciales = (nombre: string, apellido?: string) =>
    `${nombre?.[0] ?? ""}${apellido?.[0] ?? ""}`.toUpperCase() || "?";

/** "María Gómez" → "María" */
export const primerNombre = (nombre: string) => nombre.split(" ")[0] ?? nombre;

/** Capitaliza la primera letra (las fechas en español vienen en minúscula). */
export const capitalizar = (texto: string) =>
    texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;

/** Etiqueta legible de los estados de cita. */
export const ESTADO_CITA_TEXTO: Record<string, string> = {
    PROGRAMADA: "Programada",
    REPROGRAMADA: "Reprogramada",
    CUMPLIDA: "Cumplida",
    CANCELADA: "Cancelada",
    NO_ASISTIO: "No asistió",
};

export const SEVERIDAD_TEXTO: Record<string, string> = {
    CRITICA: "Atención inmediata",
    ADVERTENCIA: "Advertencia",
    INFORMATIVA: "Informativa",
};

export const ESTADO_ALERTA_TEXTO: Record<string, string> = {
    PENDIENTE: "Pendiente",
    REVISADA: "Revisada",
    DESCARTADA: "Descartada",
};
