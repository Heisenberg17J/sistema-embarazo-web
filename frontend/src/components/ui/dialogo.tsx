"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Diálogo. En móvil entra desde abajo (hoja), en escritorio se centra:
 * la hoja inferior queda al alcance del pulgar.
 */
export function Dialogo({
    abierto,
    onCambio,
    titulo,
    descripcion,
    children,
    disparador,
    className,
}: {
    abierto?: boolean;
    onCambio?: (abierto: boolean) => void;
    titulo: string;
    descripcion?: string;
    children: ReactNode;
    disparador?: ReactNode;
    className?: string;
}) {
    return (
        <Dialog.Root open={abierto} onOpenChange={onCambio}>
            {disparador && <Dialog.Trigger asChild>{disparador}</Dialog.Trigger>}
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/35 backdrop-blur-sm data-[state=open]:animate-[fundido_var(--dur-base)_var(--ease-out)] data-[state=closed]:animate-[fundido-salida_150ms_var(--ease-out)_forwards]" />
                <Dialog.Content
                    className={cn(
                        "fixed z-50 flex max-h-[92dvh] flex-col overflow-hidden border border-border-firme bg-popover text-popover-foreground shadow-elevada",
                        // Móvil: hoja inferior que sube (320 ms) y baja más rápido (200 ms)
                        "data-[state=open]:animate-[subir-cajon_320ms_var(--ease-cajon)] data-[state=closed]:animate-[bajar-cajon_200ms_var(--ease-cajon)_forwards]",
                        "inset-x-0 bottom-0 rounded-t-3xl pb-[env(safe-area-inset-bottom)]",
                        // Escritorio: tarjeta centrada con inset-0 + margen automático
                        // (sin translate, que la animación de transform pisaría)
                        "sm:inset-0 sm:m-auto sm:h-fit sm:w-full sm:max-w-lg sm:rounded-3xl sm:pb-0",
                        "sm:data-[state=open]:animate-[aparecer-escala_var(--dur-base)_var(--ease-out)] sm:data-[state=closed]:animate-[desaparecer-escala_150ms_var(--ease-out)_forwards]",
                        className,
                    )}
                >
                    <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
                        <div>
                            <Dialog.Title className="font-display text-xl font-semibold">
                                {titulo}
                            </Dialog.Title>
                            {descripcion && (
                                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                                    {descripcion}
                                </Dialog.Description>
                            )}
                        </div>
                        <Dialog.Close
                            className="toque -mr-2 -mt-2 grid place-items-center rounded-full text-muted-foreground hover:bg-surface-soft hover:text-foreground"
                            aria-label="Cerrar"
                        >
                            <X className="size-5" aria-hidden />
                        </Dialog.Close>
                    </div>

                    <div className="overflow-y-auto px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
                        {children}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

export const CerrarDialogo = Dialog.Close;
