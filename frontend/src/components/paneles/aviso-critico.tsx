"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { PhoneCall, TriangleAlert } from "lucide-react";
import { DESCARGO } from "@/lib/marca";
import { ESTILO_SEVERIDAD } from "@/lib/severidad";
import type { Alerta } from "@/lib/tipos";
import { Boton } from "@/components/ui/boton";

/**
 * Aviso a pantalla completa cuando el backend marca una alerta con
 * `accion_inmediata` (un signo de alarma obstétrico o una presión severa).
 *
 * No se puede cerrar tocando fuera ni con Escape: es el mensaje más importante
 * de la app y cerrarlo sin leerlo por accidente sería grave. Sigue siendo
 * orientación, no un diagnóstico.
 */
export function AvisoCritico({
    alertas,
    contactoNombre,
    contactoTelefono,
    onCerrar,
}: {
    alertas: Alerta[];
    contactoNombre?: string | null;
    contactoTelefono?: string | null;
    onCerrar: () => void;
}) {
    const criticas = alertas.filter((a) => a.accion_inmediata);
    if (criticas.length === 0) return null;

    return (
        <Dialog.Root open onOpenChange={(abierto) => !abierto && onCerrar()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-[60] bg-critica/25 backdrop-blur-md" />
                <Dialog.Content
                    role="alertdialog"
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                    className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[95dvh] flex-col overflow-hidden rounded-t-3xl border-t-4 border-critica-borde bg-popover pb-[env(safe-area-inset-bottom)] text-popover-foreground shadow-elevada sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border-4 sm:pb-0"
                >
                    <div className="overflow-y-auto px-6 py-7 text-center">
                        <span className="mx-auto grid size-16 place-items-center rounded-full bg-critica-suave">
                            <TriangleAlert className="size-8 text-critica" aria-hidden />
                        </span>

                        <Dialog.Title className="mt-4 font-display text-2xl font-semibold text-critica">
                            {ESTILO_SEVERIDAD.CRITICA.etiqueta}
                        </Dialog.Title>

                        <Dialog.Description className="mt-3 space-y-3 text-left">
                            {criticas.map((alerta) => (
                                <span
                                    key={alerta.id}
                                    className="block rounded-2xl bg-critica-suave px-4 py-3 text-sm font-medium leading-relaxed text-critica"
                                >
                                    {alerta.mensaje}
                                </span>
                            ))}
                        </Dialog.Description>

                        {contactoTelefono && (
                            <div className="mt-5 text-left">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Tu contacto de emergencia
                                </p>
                                <Boton
                                    comoHijo
                                    variante="peligro"
                                    tamano="lg"
                                    ancho="completo"
                                    className="mt-2"
                                >
                                    <a href={`tel:${contactoTelefono.replace(/\s/g, "")}`}>
                                        <PhoneCall aria-hidden />
                                        Llamar a {contactoNombre ?? contactoTelefono}
                                    </a>
                                </Boton>
                            </div>
                        )}

                        <Boton
                            variante={contactoTelefono ? "vidrio" : "primario"}
                            tamano="lg"
                            ancho="completo"
                            className="mt-3"
                            onClick={onCerrar}
                            autoFocus
                        >
                            Entendido
                        </Boton>

                        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                            {DESCARGO}
                        </p>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
