import type { Metadata } from "next";
import Link from "next/link";
import { Tarjeta } from "@/components/ui/tarjeta";
import { FormularioRegistro } from "./formulario-registro";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function PaginaRegistro() {
    return (
        <div className="w-full">
            <Tarjeta>
                <h1 className="font-display text-2xl font-semibold">Crear cuenta</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Este registro es para gestantes. Si eres profesional de salud, tu
                    cuenta la crea el administrador de la institución.
                </p>

                <FormularioRegistro />

                <p className="mt-6 text-center text-sm text-muted-foreground">
                    ¿Ya tienes cuenta?{" "}
                    <Link
                        href="/login"
                        className="font-semibold text-brand-deep underline-offset-4 hover:underline"
                    >
                        Iniciar sesión
                    </Link>
                </p>
            </Tarjeta>
        </div>
    );
}
