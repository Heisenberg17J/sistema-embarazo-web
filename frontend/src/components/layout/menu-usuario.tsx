"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { ChevronDown, LogOut } from "lucide-react";
import { cerrarSesion } from "@/acciones/auth";
import { NAVEGACION, ROL_TEXTO } from "@/lib/navegacion";
import type { Rol } from "@/lib/tipos";
import { iniciales } from "@/lib/formato";

/** Avatar con el menú de secciones secundarias y el cierre de sesión. */
export function MenuUsuario({
    nombre,
    apellido,
    rol,
}: {
    nombre: string;
    apellido: string;
    rol: Rol;
}) {
    const secundarios = NAVEGACION[rol].secundarios;
    return (
        <Menu.Root>
            <Menu.Trigger
                className="toque flex items-center gap-1 rounded-full pl-0 pr-1 text-sm font-semibold transition-colors hover:bg-surface-soft"
                aria-label={`Menú de ${nombre} ${apellido}`}
            >
                <span
                    className="grid size-10 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground"
                    aria-hidden
                >
                    {iniciales(nombre, apellido)}
                </span>
                <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
            </Menu.Trigger>

            <Menu.Portal>
                <Menu.Content
                    align="end"
                    sideOffset={8}
                    className="z-50 min-w-56 origin-[var(--radix-dropdown-menu-content-transform-origin)] overflow-hidden rounded-2xl border border-border-firme bg-popover p-1.5 text-popover-foreground shadow-elevada data-[state=open]:animate-[aparecer-escala_180ms_var(--ease-out)] data-[state=closed]:animate-[desaparecer-escala_120ms_var(--ease-out)_forwards]"
                >
                    <div className="px-3 py-2">
                        <p className="truncate text-sm font-semibold">
                            {nombre} {apellido}
                        </p>
                        <p className="text-xs text-muted-foreground">{ROL_TEXTO[rol]}</p>
                    </div>

                    <Menu.Separator className="my-1 h-px bg-border-firme" />

                    {secundarios.map((item) => (
                        <Menu.Item key={item.href} asChild>
                            <Link
                                href={item.href}
                                className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm outline-none data-highlighted:bg-surface-soft"
                            >
                                <item.icono
                                    className="size-4 text-muted-foreground"
                                    aria-hidden
                                />
                                {item.texto}
                            </Link>
                        </Menu.Item>
                    ))}

                    <Menu.Separator className="my-1 h-px bg-border-firme" />

                    <form action={cerrarSesion}>
                        <ItemCerrarSesion />
                    </form>
                </Menu.Content>
            </Menu.Portal>
        </Menu.Root>
    );
}

/**
 * Al elegir un elemento, Radix cierra el menú y desmonta su contenido en el
 * mismo evento del clic, antes de que el navegador envíe el formulario: el
 * envío se cancelaba y la sesión seguía abierta. Por eso aquí se evita el
 * cierre y el menú queda abierto, con el estado de espera, hasta que la acción
 * redirige al login.
 */
function ItemCerrarSesion() {
    const { pending } = useFormStatus();
    return (
        <Menu.Item asChild onSelect={(evento) => evento.preventDefault()}>
            <button
                type="submit"
                disabled={pending}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-critica outline-none data-highlighted:bg-critica-suave disabled:cursor-wait disabled:opacity-70"
            >
                <LogOut className="size-4" aria-hidden />
                {pending ? "Cerrando sesión…" : "Cerrar sesión"}
            </button>
        </Menu.Item>
    );
}
