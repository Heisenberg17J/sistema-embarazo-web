"use client";


import { Check } from "lucide-react";
import { restablecerContrasena, type EstadoFormulario } from "@/acciones/auth";
import { Boton } from "@/components/ui/boton";
import { AvisoError, Campo } from "@/components/ui/campo";
import { useAccion } from "@/lib/usar-accion";

const INICIAL: EstadoFormulario = {};

export function FormularioRestablecer({ token }: { token: string }) {
    const [estado, enviar, enviando] = useAccion(restablecerContrasena, INICIAL);
    const e = estado.porCampo ?? {};

    return (
        <form onSubmit={enviar} className="mt-5 space-y-4" noValidate>
            <input type="hidden" name="token" value={token} />
            <AvisoError>{estado.error ?? e.token}</AvisoError>

            <Campo
                etiqueta="Contraseña nueva"
                obligatorio
                error={e.contrasena_nueva}
                ayuda="Mínimo 8 caracteres, con una letra y un número."
            >
                {(p) => (
                    <input {...p} name="contrasena_nueva" type="password" autoComplete="new-password" required />
                )}
            </Campo>

            <Campo etiqueta="Repetir contraseña nueva" obligatorio error={e.confirmacion}>
                {(p) => (
                    <input {...p} name="confirmacion" type="password" autoComplete="new-password" required />
                )}
            </Campo>

            <Boton type="submit" ancho="completo" tamano="lg" disabled={enviando}>
                <Check aria-hidden />
                {enviando ? "Guardando…" : "Guardar contraseña"}
            </Boton>
        </form>
    );
}
