"use client";

import { useActionState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useState } from "react";
import { iniciarSesion, type EstadoFormulario } from "@/acciones/auth";
import { Boton } from "@/components/ui/boton";
import { AvisoError, Campo } from "@/components/ui/campo";

const INICIAL: EstadoFormulario = {};

export function FormularioLogin({ siguiente }: { siguiente?: string }) {
    const [estado, enviar, enviando] = useActionState(iniciarSesion, INICIAL);
    const [verClave, setVerClave] = useState(false);

    return (
        <form action={enviar} className="mt-5 space-y-4" noValidate>
            {siguiente && <input type="hidden" name="siguiente" value={siguiente} />}

            <AvisoError>{estado?.error}</AvisoError>

            <Campo
                etiqueta="Correo electrónico"
                obligatorio
                error={estado?.porCampo?.correo}
            >
                {(props) => (
                    <input
                        {...props}
                        name="correo"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        autoCapitalize="none"
                        placeholder="nombre@correo.com"
                        defaultValue={estado?.valores?.correo}
                        required
                    />
                )}
            </Campo>

            <Campo
                etiqueta="Contraseña"
                obligatorio
                error={estado?.porCampo?.contrasena}
            >
                {(props) => (
                    <div className="relative">
                        <input
                            {...props}
                            name="contrasena"
                            type={verClave ? "text" : "password"}
                            autoComplete="current-password"
                            className={`${props.className} pr-12`}
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setVerClave((v) => !v)}
                            className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-2xl text-muted-foreground hover:text-foreground"
                            aria-label={
                                verClave ? "Ocultar contraseña" : "Mostrar contraseña"
                            }
                        >
                            {verClave ? (
                                <EyeOff className="size-4" aria-hidden />
                            ) : (
                                <Eye className="size-4" aria-hidden />
                            )}
                        </button>
                    </div>
                )}
            </Campo>

            <Boton type="submit" ancho="completo" tamano="lg" disabled={enviando}>
                <LogIn aria-hidden />
                {enviando ? "Entrando…" : "Entrar"}
            </Boton>
        </form>
    );
}
