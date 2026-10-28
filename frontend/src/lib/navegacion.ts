import {
    Activity,
    BarChart3,
    Bell,
    BellRing,
    BookOpen,
    CalendarDays,
    ClipboardList,
    FlaskConical,
    History,
    Home,
    ListTree,
    Settings,
    ShieldCheck,
    SlidersHorizontal,
    TrendingUp,
    UserCheck,
    User,
    Users,
    type LucideIcon,
} from "lucide-react";
import type { Rol } from "./tipos";

export interface ItemNav {
    href: string;
    texto: string;
    icono: LucideIcon;
    /** Texto corto para la barra inferior en móvil. */
    corto?: string;
}

/**
 * Navegación por rol. `principales` son las pestañas visibles; `secundarios`
 * viven en el menú "Más", para no llenar la barra en pantallas pequeñas.
 */
export const NAVEGACION: Record<
    Rol,
    { principales: ItemNav[]; secundarios: ItemNav[] }
> = {
    GESTANTE: {
        principales: [
            { href: "/panel", texto: "Panel", icono: Home },
            { href: "/citas", texto: "Citas", icono: CalendarDays },
            { href: "/evolucion", texto: "Evolución", icono: TrendingUp },
            { href: "/aprendizaje", texto: "Aprendizaje", icono: BookOpen, corto: "Aprender" },
        ],
        secundarios: [
            { href: "/alertas", texto: "Mis alertas", icono: Bell },
            { href: "/sintomas", texto: "Síntomas", icono: Activity },
            { href: "/examenes", texto: "Exámenes", icono: FlaskConical },
            { href: "/historial", texto: "Historial", icono: History },
            { href: "/perfil", texto: "Mi perfil", icono: User },
        ],
    },
    PROFESIONAL: {
        principales: [
            { href: "/pro", texto: "Panel", icono: Home },
            { href: "/pro/pacientes", texto: "Pacientes", icono: Users },
            { href: "/pro/agenda", texto: "Agenda", icono: CalendarDays },
            { href: "/pro/alertas", texto: "Alertas", icono: BellRing },
        ],
        secundarios: [{ href: "/perfil", texto: "Mi perfil", icono: User }],
    },
    ADMINISTRADOR: {
        principales: [
            { href: "/admin", texto: "Estadísticas", icono: BarChart3, corto: "Inicio" },
            { href: "/admin/usuarios", texto: "Usuarios", icono: Users },
            { href: "/admin/asignaciones", texto: "Asignaciones", icono: UserCheck, corto: "Asignar" },
            { href: "/admin/contenido", texto: "Contenido", icono: BookOpen },
        ],
        secundarios: [
            { href: "/admin/catalogos", texto: "Catálogos", icono: ListTree },
            { href: "/admin/reglas-alerta", texto: "Reglas de alerta", icono: SlidersHorizontal },
            { href: "/admin/auditoria", texto: "Auditoría", icono: ShieldCheck },
            { href: "/admin/configuracion", texto: "Configuración", icono: Settings },
            { href: "/perfil", texto: "Mi perfil", icono: User },
        ],
    },
};

export const ROL_TEXTO: Record<Rol, string> = {
    GESTANTE: "Gestante",
    PROFESIONAL: "Profesional",
    ADMINISTRADOR: "Administrador",
};

export const ICONO_CONTROL = ClipboardList;

/**
 * true si la ruta actual corresponde a este elemento de navegación.
 *
 * Las raíces de cada rol se comparan exactas: si no, "Panel" quedaría marcado
 * en todas las pantallas que cuelgan de ellas.
 */
const RAICES = ["/panel", "/pro", "/admin"];

export const esRutaActiva = (href: string, actual: string) =>
    RAICES.includes(href)
        ? actual === href
        : actual === href || actual.startsWith(`${href}/`);
