import type { Metadata } from "next";
import Link from "next/link";
import { Tarjeta } from "@/components/ui/tarjeta";
import { FormularioRecuperar } from "./formulario-recuperar";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function PaginaRecuperar() {
    return (
        <Tarjeta>
            <h1 className="font-display text-2xl font-semibold">¿Olvidaste tu contraseña?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
                Escribe el correo con el que te registraste y te enviamos un enlace para
                elegir una nueva.
            </p>

            <FormularioRecuperar />

            <p className="mt-6 text-center text-sm text-muted-foreground">
                <Link
                    href="/login"
                    className="font-semibold text-brand-deep underline-offset-4 hover:underline"
                >
                    Volver a iniciar sesión
                </Link>
            </p>
        </Tarjeta>
    );
}
