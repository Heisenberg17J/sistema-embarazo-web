import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { PieDescargo } from "@/components/layout/pie-descargo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { leerSesion } from "@/lib/sesion-servidor";
import { FormularioContrasena } from "./formulario-contrasena";

export const metadata: Metadata = { title: "Cambiar contraseña" };

export default async function PaginaCambiarContrasena() {
    const sesion = await leerSesion();
    if (!sesion) redirect("/login");

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-8">
            <main className="w-full max-w-md">
                <div className="mb-6 flex justify-center">
                    <Logo />
                </div>
                <Tarjeta>
                    <div className="flex items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-soft text-brand-deep">
                            <KeyRound className="size-5" aria-hidden />
                        </span>
                        <div>
                            <h1 className="font-display text-2xl font-semibold">
                                Cambiar contraseña
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {sesion.cambio
                                    ? "Tu cuenta se creó con una contraseña temporal. Elige una nueva para continuar."
                                    : "Elige una contraseña nueva. Se cerrarán las demás sesiones abiertas."}
                            </p>
                        </div>
                    </div>

                    <FormularioContrasena />
                </Tarjeta>
            </main>
            <PieDescargo className="mt-6" />
        </div>
    );
}
