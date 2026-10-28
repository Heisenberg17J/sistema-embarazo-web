import type { Metadata } from "next";
import Link from "next/link";
import { Tarjeta } from "@/components/ui/tarjeta";
import { FormularioRestablecer } from "./formulario-restablecer";

export const metadata: Metadata = {
    title: "Nueva contraseña",
    // El token va en la URL: que no se envíe a otros sitios al hacer clic en un enlace.
    referrer: "no-referrer",
};

export default async function PaginaRestablecer({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;

    return (
        <Tarjeta>
            <h1 className="font-display text-2xl font-semibold">Elige una contraseña nueva</h1>
            <p className="mt-1 text-sm text-muted-foreground">
                Al guardarla se cerrarán las sesiones que tengas abiertas.
            </p>

            <FormularioRestablecer token={token} />

            <p className="mt-6 text-center text-sm text-muted-foreground">
                ¿El enlace venció?{" "}
                <Link
                    href="/recuperar"
                    className="font-semibold text-brand-deep underline-offset-4 hover:underline"
                >
                    Pide uno nuevo
                </Link>
            </p>
        </Tarjeta>
    );
}
