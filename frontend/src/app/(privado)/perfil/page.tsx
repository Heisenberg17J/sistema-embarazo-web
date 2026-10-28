import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Mail } from "lucide-react";
import { Saludo } from "@/components/layout/saludo";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Panel, Tarjeta } from "@/components/ui/tarjeta";
import { solicitudSupresionPropia, usuarioActual } from "@/lib/datos";
import { fechaCompleta, fechaCorta } from "@/lib/formato";
import { ROL_TEXTO } from "@/lib/navegacion";
import { exigirSesion } from "@/lib/sesion-servidor";
import type { PerfilGestante, PerfilProfesional } from "@/lib/tipos";
import { BotonDescargarDatos, DialogoSolicitarSupresion } from "./privacidad";
import { FormularioPerfil } from "./formulario-perfil";

export const metadata: Metadata = { title: "Mi perfil" };

const DOCUMENTO: Record<string, string> = {
    CC: "Cédula de ciudadanía",
    TI: "Tarjeta de identidad",
    CE: "Cédula de extranjería",
    PA: "Pasaporte",
};

export default async function PaginaPerfil() {
    await exigirSesion();
    const usuario = await usuarioActual();
    // Solo las gestantes pueden pedir la supresión de su cuenta.
    const solicitud = usuario.rol === "GESTANTE" ? await solicitudSupresionPropia() : null;

    const gestante =
        usuario.rol === "GESTANTE" ? (usuario.perfil as PerfilGestante | null) : null;
    const profesional =
        usuario.rol === "PROFESIONAL"
            ? (usuario.perfil as PerfilProfesional | null)
            : null;

    return (
        <>
            <Saludo
                titulo="Mi perfil"
                conFecha={false}
                subtitulo="Tus datos personales y de contacto."
            />

            <div className="space-y-5">
                {/* Datos que no se editan desde aquí: los corrige el administrador. */}
                <Tarjeta>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="font-display text-xl font-semibold">
                                {usuario.nombre} {usuario.apellido}
                            </h2>
                            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                                <Mail className="size-4 shrink-0" aria-hidden />
                                {usuario.correo}
                            </p>
                        </div>
                        <Insignia tono="marca">{ROL_TEXTO[usuario.rol]}</Insignia>
                    </div>

                    {(gestante || profesional) && (
                        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                            {gestante && (
                                <>
                                    <Panel>
                                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                                            Documento
                                        </dt>
                                        <dd className="mt-1 font-medium">
                                            {DOCUMENTO[gestante.tipo_documento] ??
                                                gestante.tipo_documento}{" "}
                                            {gestante.numero_documento}
                                        </dd>
                                    </Panel>
                                    <Panel>
                                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                                            Fecha de nacimiento
                                        </dt>
                                        <dd className="mt-1 font-medium">
                                            {fechaCompleta(gestante.fecha_nacimiento)}
                                        </dd>
                                    </Panel>
                                </>
                            )}
                            {profesional && (
                                <Panel className="sm:col-span-2">
                                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                                        Registro profesional
                                    </dt>
                                    <dd className="mt-1 font-medium">
                                        {profesional.registro_profesional} ·{" "}
                                        {profesional.especialidad}
                                    </dd>
                                </Panel>
                            )}
                        </dl>
                    )}

                    <p className="mt-3 text-xs text-muted-foreground">
                        Si algún dato de arriba está mal, pídele al administrador que lo
                        corrija.
                    </p>
                </Tarjeta>

                <FormularioPerfil
                    usuario={usuario}
                    faltaContacto={Boolean(
                        gestante && !gestante.contacto_emergencia_telefono,
                    )}
                />

                <Tarjeta>
                    <h2 className="font-medium">Tus datos y privacidad</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Tienes derecho a conocer qué datos guardamos de ti y a pedir que
                        se supriman. Lee la{" "}
                        <Link
                            href="/politica-de-privacidad"
                            className="font-semibold text-brand-deep underline-offset-4 hover:underline"
                        >
                            política de tratamiento de datos
                        </Link>
                        .
                    </p>

                    <div className="mt-4 flex flex-wrap items-start gap-3">
                        <BotonDescargarDatos />
                        {usuario.rol === "GESTANTE" && solicitud?.estado !== "PENDIENTE" && (
                            <DialogoSolicitarSupresion />
                        )}
                    </div>

                    {solicitud?.estado === "PENDIENTE" && (
                        <p
                            role="status"
                            className="mt-4 rounded-2xl bg-advertencia-suave px-4 py-3 text-sm font-medium text-advertencia"
                        >
                            Tu solicitud de eliminación está pendiente desde el{" "}
                            {fechaCorta(solicitud.solicitada_en)}. El administrador la
                            atenderá pronto.
                        </p>
                    )}
                    {solicitud?.estado === "RECHAZADA" && (
                        <p className="mt-4 rounded-2xl bg-surface-soft px-4 py-3 text-sm leading-relaxed">
                            <span className="font-medium">
                                Tu última solicitud no se pudo atender:
                            </span>{" "}
                            {solicitud.respuesta}
                        </p>
                    )}
                </Tarjeta>

                <Tarjeta>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="font-medium">Contraseña</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Al cambiarla se cerrarán tus otras sesiones abiertas.
                            </p>
                        </div>
                        <Boton comoHijo variante="vidrio">
                            <Link href="/cambiar-contrasena">
                                <KeyRound aria-hidden />
                                Cambiar contraseña
                            </Link>
                        </Boton>
                    </div>
                </Tarjeta>
            </div>
        </>
    );
}
