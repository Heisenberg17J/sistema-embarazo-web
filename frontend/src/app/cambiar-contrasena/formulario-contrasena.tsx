"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { cambiarContrasena, type EstadoFormulario } from "@/acciones/auth";
import { Boton } from "@/components/ui/boton";
import { AvisoError, Campo } from "@/components/ui/campo";

const INICIAL: EstadoFormulario = {};

export function FormularioContrasena() {
    const [estado, enviar, enviando] = useActionState(cambiarContrasena, INICIAL);
    const e = estado?.porCampo ?? {};

    return (
        <form action={enviar} className="mt-5 space-y-4" noValidate>
            <AvisoError>{estado?.error}</AvisoError>

            <Campo
                etiqueta="Contraseña actual"
                obligatorio
                error={e.contrasena_actual}
            >
                {(p) => (
                    <input
                        {...p}
                        name="contrasena_actual"
                        type="password"
                        autoComplete="current-password"
                        required
                    />
                )}
            </Campo>

            <Campo
                etiqueta="Contraseña nueva"
                obligatorio
                error={e.contrasena_nueva}
                ayuda="Mínimo 8 caracteres, con una letra y un número."
            >
                {(p) => (
                    <input
                        {...p}
                        name="contrasena_nueva"
                        type="password"
                        autoComplete="new-password"
                        required
                    />
                )}
            </Campo>

            <Campo etiqueta="Repetir contraseña nueva" obligatorio error={e.confirmacion}>
                {(p) => (
                    <input
                        {...p}
                        name="confirmacion"
                        type="password"
                        autoComplete="new-password"
                        required
                    />
                )}
            </Campo>

            <Boton type="submit" ancho="completo" tamano="lg" disabled={enviando}>
                <Check aria-hidden />
                {enviando ? "Guardando…" : "Guardar contraseña"}
            </Boton>
        </form>
    );
}
