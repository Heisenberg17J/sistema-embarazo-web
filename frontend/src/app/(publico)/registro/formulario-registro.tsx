"use client";

import Link from "next/link";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { registrarGestante, type EstadoFormulario } from "@/acciones/auth";
import { Boton } from "@/components/ui/boton";
import { AvisoError, Campo } from "@/components/ui/campo";
import { hoyLocal } from "@/lib/formato";
import { useAccion } from "@/lib/usar-accion";

const INICIAL: EstadoFormulario = {};

const GRUPOS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
const DOCUMENTOS = [
    { valor: "CC", texto: "Cédula de ciudadanía" },
    { valor: "TI", texto: "Tarjeta de identidad" },
    { valor: "CE", texto: "Cédula de extranjería" },
    { valor: "PA", texto: "Pasaporte" },
];

function Seccion({
    titulo,
    descripcion,
    children,
}: {
    titulo: string;
    descripcion?: string;
    children: React.ReactNode;
}) {
    return (
        <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {titulo}
            </legend>
            {descripcion && (
                <p className="-mt-2 text-xs text-muted-foreground">{descripcion}</p>
            )}
            {children}
        </fieldset>
    );
}

export function FormularioRegistro() {
    const [estado, enviar, enviando] = useAccion(registrarGestante, INICIAL);
    const e = estado?.porCampo ?? {};
    // React 19 limpia los campos al terminar la acción: se repintan desde el
    // estado para que un error de validación no borre el formulario entero.
    const v = estado?.valores ?? {};
    // Los <select> se controlan con estado: a diferencia de los <input>, no
    // conservan la opción elegida cuando React restablece el formulario.
    const [documento, setDocumento] = useState("CC");
    const [grupo, setGrupo] = useState("");
    // Controlada por la misma razón que los <select>: React restablece el
    // formulario al terminar la acción y una casilla no controlada se desmarcaría.
    const [acepto, setAcepto] = useState(false);

    return (
        <form onSubmit={enviar} className="mt-5 space-y-7" noValidate>
            <AvisoError>{estado?.error}</AvisoError>

            <Seccion titulo="Tus datos">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Campo etiqueta="Nombre" obligatorio error={e.nombre}>
                        {(p) => (
                            <input
                                {...p}
                                name="nombre"
                                autoComplete="given-name"
                                defaultValue={v.nombre}
                                required
                            />
                        )}
                    </Campo>
                    <Campo etiqueta="Apellido" obligatorio error={e.apellido}>
                        {(p) => (
                            <input
                                {...p}
                                name="apellido"
                                autoComplete="family-name"
                                defaultValue={v.apellido}
                                required
                            />
                        )}
                    </Campo>
                </div>

                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                    <Campo etiqueta="Tipo de documento" obligatorio error={e.tipo_documento}>
                        {(p) => (
                            <select
                                {...p}
                                name="tipo_documento"
                                value={documento}
                                onChange={(ev) => setDocumento(ev.target.value)}
                                required
                            >
                                {DOCUMENTOS.map((d) => (
                                    <option key={d.valor} value={d.valor}>
                                        {d.texto}
                                    </option>
                                ))}
                            </select>
                        )}
                    </Campo>
                    <Campo
                        etiqueta="Número de documento"
                        obligatorio
                        error={e.numero_documento}
                    >
                        {(p) => (
                            <input
                                {...p}
                                name="numero_documento"
                                inputMode="numeric"
                                defaultValue={v.numero_documento}
                                required
                            />
                        )}
                    </Campo>
                </div>

                <Campo
                    etiqueta="Fecha de nacimiento"
                    obligatorio
                    error={e.fecha_nacimiento}
                >
                    {(p) => (
                        <input
                            {...p}
                            name="fecha_nacimiento"
                            type="date"
                            autoComplete="bday"
                            max={hoyLocal()}
                            defaultValue={v.fecha_nacimiento}
                            required
                        />
                    )}
                </Campo>
            </Seccion>

            <Seccion titulo="Acceso">
                <Campo etiqueta="Correo electrónico" obligatorio error={e.correo}>
                    {(p) => (
                        <input
                            {...p}
                            name="correo"
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            autoCapitalize="none"
                            placeholder="nombre@correo.com"
                            defaultValue={v.correo}
                            required
                        />
                    )}
                </Campo>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Campo
                        etiqueta="Contraseña"
                        obligatorio
                        error={e.contrasena}
                        ayuda="Mínimo 8 caracteres, con una letra y un número."
                    >
                        {(p) => (
                            <input
                                {...p}
                                name="contrasena"
                                type="password"
                                autoComplete="new-password"
                                required
                            />
                        )}
                    </Campo>
                    <Campo
                        etiqueta="Repetir contraseña"
                        obligatorio
                        error={e.confirmacion}
                    >
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
                </div>
            </Seccion>

            <Seccion
                titulo="Contacto y salud"
                descripcion="Puedes completarlo ahora o más tarde desde tu perfil."
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <Campo etiqueta="Teléfono" error={e.telefono}>
                        {(p) => (
                            <input
                                {...p}
                                name="telefono"
                                type="tel"
                                autoComplete="tel"
                                defaultValue={v.telefono}
                            />
                        )}
                    </Campo>
                    <Campo etiqueta="EPS" error={e.eps}>
                        {(p) => <input {...p} name="eps" defaultValue={v.eps} />}
                    </Campo>
                </div>
                <Campo etiqueta="Grupo sanguíneo" error={e.grupo_sanguineo}>
                    {(p) => (
                        <select
                            {...p}
                            name="grupo_sanguineo"
                            value={grupo}
                            onChange={(ev) => setGrupo(ev.target.value)}
                        >
                            <option value="">Sin especificar</option>
                            {GRUPOS.map((g) => (
                                <option key={g} value={g}>
                                    {g}
                                </option>
                            ))}
                        </select>
                    )}
                </Campo>
            </Seccion>

            <Seccion
                titulo="Contacto de emergencia"
                descripcion="A quién avisar si necesitas ayuda urgente."
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <Campo
                        etiqueta="Nombre"
                        error={e.contacto_emergencia_nombre}
                    >
                        {(p) => <input
                                {...p}
                                name="contacto_emergencia_nombre"
                                defaultValue={v.contacto_emergencia_nombre}
                            />}
                    </Campo>
                    <Campo
                        etiqueta="Teléfono"
                        error={e.contacto_emergencia_telefono}
                    >
                        {(p) => (
                            <input
                                {...p}
                                name="contacto_emergencia_telefono"
                                type="tel"
                                defaultValue={v.contacto_emergencia_telefono}
                            />
                        )}
                    </Campo>
                </div>
            </Seccion>

            <div className="space-y-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl glass-soft p-4">
                    <input
                        type="checkbox"
                        name="acepto_politica"
                        checked={acepto}
                        onChange={(ev) => setAcepto(ev.target.checked)}
                        aria-invalid={Boolean(e.acepto_politica)}
                        aria-describedby={e.acepto_politica ? "error-politica" : undefined}
                        className="mt-0.5 size-5 shrink-0 accent-primary"
                    />
                    <span className="text-sm leading-relaxed">
                        Autorizo el tratamiento de mis datos personales, incluidos mis
                        datos de salud, para el seguimiento de mi embarazo, según la{" "}
                        <Link
                            href="/politica-de-privacidad"
                            target="_blank"
                            rel="noopener"
                            className="font-semibold text-brand-deep underline underline-offset-4"
                        >
                            política de tratamiento de datos
                        </Link>{" "}
                        y los{" "}
                        <Link
                            href="/terminos"
                            target="_blank"
                            rel="noopener"
                            className="font-semibold text-brand-deep underline underline-offset-4"
                        >
                            términos de uso
                        </Link>
                        . Sé que los datos de salud son sensibles y que no estoy
                        obligada a autorizarlos.
                    </span>
                </label>
                {e.acepto_politica && (
                    <p
                        id="error-politica"
                        className="flex items-start gap-1.5 text-xs font-medium text-critica"
                    >
                        {e.acepto_politica}
                    </p>
                )}
            </div>

            <Boton type="submit" ancho="completo" tamano="lg" disabled={enviando}>
                <UserPlus aria-hidden />
                {enviando ? "Creando tu cuenta…" : "Crear cuenta"}
            </Boton>
        </form>
    );
}
