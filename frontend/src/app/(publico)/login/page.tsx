import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Tarjeta } from "@/components/ui/tarjeta";
import { FormularioLogin } from "./formulario-login";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function PaginaLogin({
    searchParams,
}: {
    searchParams: Promise<{ siguiente?: string; cambiada?: string }>;
}) {
    const { siguiente, cambiada } = await searchParams;

    return (
        <Tarjeta>
            <h1 className="font-display text-2xl font-semibold">Iniciar sesión</h1>
            <p className="mt-1 text-sm text-muted-foreground">
                Entra con el correo con el que te registraste.
            </p>

            {cambiada && (
                <p
                    role="status"
                    className="mt-4 flex items-start gap-2 rounded-2xl bg-exito-suave px-4 py-3 text-sm font-medium text-exito"
                >
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                    Tu contraseña se actualizó. Inicia sesión de nuevo.
                </p>
            )}

            <FormularioLogin siguiente={siguiente} />

            <p className="mt-6 text-center text-sm text-muted-foreground">
                ¿Es tu primera vez?{" "}
                <Link
                    href="/registro"
                    className="font-semibold text-brand-deep underline-offset-4 hover:underline"
                >
                    Crear una cuenta
                </Link>
            </p>
        </Tarjeta>
    );
}
