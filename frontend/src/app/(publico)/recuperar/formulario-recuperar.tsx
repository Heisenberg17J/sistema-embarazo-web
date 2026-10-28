"use client";


import { Mail } from "lucide-react";
import { solicitarRecuperacion, type EstadoRecuperacion } from "@/acciones/auth";
import { Boton } from "@/components/ui/boton";
import { AvisoExito } from "@/components/ui/aviso-exito";
import { AvisoError, Campo } from "@/components/ui/campo";
import { useAccion } from "@/lib/usar-accion";

const INICIAL: EstadoRecuperacion = {};

export function FormularioRecuperar() {
    const [estado, enviar, enviando] = useAccion(solicitarRecuperacion, INICIAL);

    // Con el correo enviado ya no hay nada que rellenar: se muestra solo el aviso.
    if (estado.ok) {
        return (
            <div className="mt-5 space-y-3">
                <AvisoExito>{estado.mensaje}</AvisoExito>
                <p className="text-xs text-muted-foreground">
                    El enlace vale 60 minutos. Si no llega, espera un minuto y vuelve a
                    pedirlo.
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={enviar} className="mt-5 space-y-4" noValidate>
            <AvisoError>{estado.error}</AvisoError>

            <Campo etiqueta="Correo electrónico" obligatorio error={estado.porCampo?.correo}>
                {(p) => (
                    <input
                        {...p}
                        name="correo"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        autoCapitalize="none"
                        placeholder="nombre@correo.com"
                        defaultValue={estado.valores?.correo}
                        required
                    />
                )}
            </Campo>

            <Boton type="submit" ancho="completo" tamano="lg" disabled={enviando}>
                <Mail aria-hidden />
                {enviando ? "Enviando…" : "Enviarme el enlace"}
            </Boton>
        </form>
    );
}
