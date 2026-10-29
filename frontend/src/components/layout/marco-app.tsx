import { Logo } from "@/components/layout/logo";
import { MenuUsuario } from "@/components/layout/menu-usuario";
import { NavEscritorio } from "@/components/layout/nav-escritorio";
import { NavInferior } from "@/components/layout/nav-inferior";
import { PieDescargo } from "@/components/layout/pie-descargo";
import { ROL_TEXTO } from "@/lib/navegacion";
import { RUTA_INICIO, type Sesion } from "@/lib/sesion";
import type { Rol } from "@/lib/tipos";

/** Intensidad visual por rol: el CSS limita patrón e ilustraciones a la gestante. */
const DATA_ROL: Record<Rol, string> = {
    GESTANTE: "gestante",
    PROFESIONAL: "profesional",
    ADMINISTRADOR: "admin",
};

/**
 * Marco común de las pantallas con sesión: encabezado de vidrio, contenido
 * centrado, barra inferior en móvil y descargo en el pie.
 */
export function MarcoApp({
    sesion,
    children,
}: {
    sesion: Sesion;
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-dvh" data-rol={DATA_ROL[sesion.rol]}>
            <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
                <header className="glass relative z-20 flex items-center justify-between gap-3 rounded-3xl px-4 py-3 sm:px-5">
                    <Logo href={RUTA_INICIO[sesion.rol]} />
                    <NavEscritorio rol={sesion.rol} />
                    <div className="flex items-center gap-2">
                        <span className="hidden text-xs font-medium text-muted-foreground lg:inline">
                            {ROL_TEXTO[sesion.rol]}
                        </span>
                        <MenuUsuario
                            nombre={sesion.nombre}
                            apellido={sesion.apellido}
                            rol={sesion.rol}
                        />
                    </div>
                </header>

                {/* El padding inferior deja aire para la barra de navegación móvil. */}
                <main className="pb-24 md:pb-0">{children}</main>

                <PieDescargo />
            </div>

            <NavInferior rol={sesion.rol} />
        </div>
    );
}
