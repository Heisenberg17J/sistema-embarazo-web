"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { Save } from "lucide-react";
import { actualizarPerfil, type EstadoPerfil } from "@/acciones/perfil";
import { Boton } from "@/components/ui/boton";
import { AvisoExito } from "@/components/ui/aviso-exito";
import { AvisoError, Campo } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import type { PerfilGestante, PerfilProfesional, Rol, Usuario } from "@/lib/tipos";

const INICIAL: EstadoPerfil = {};
const GRUPOS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

function Seccion({
    titulo,
    descripcion,
    id,
    destacada,
    children,
}: {
    titulo: string;
    descripcion?: string;
    id?: string;
    /** Resalta la sección cuando falta completarla. */
    destacada?: boolean;
    children: React.ReactNode;
}) {
    return (
        <fieldset
            id={id}
            className={
                "space-y-4 scroll-mt-24" +
                (destacada
                    ? " -mx-2 rounded-2xl border-l-4 border-l-advertencia-borde bg-advertencia-suave/40 px-4 py-4"
                    : "")
            }
        >
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

export function FormularioPerfil({
    usuario,
    faltaContacto,
}: {
    usuario: Usuario;
    faltaContacto?: boolean;
}) {
    const router = useRouter();
    const [estado, enviar, enviando] = useActionState(actualizarPerfil, INICIAL);
    const e = estado.porCampo ?? {};

    // React 19 limpia el formulario al terminar la acción; el refresco vuelve a
    // pintarlo con los datos ya guardados y actualiza el resto de pantallas.
    useEffect(() => {
        if (estado.ok) router.refresh();
    }, [estado, router]);
    const rol: Rol = usuario.rol;
    const gestante = rol === "GESTANTE" ? (usuario.perfil as PerfilGestante | null) : null;
    const profesional =
        rol === "PROFESIONAL" ? (usuario.perfil as PerfilProfesional | null) : null;

    return (
        <Tarjeta>
            <form action={enviar} className="space-y-7" noValidate>
                <input type="hidden" name="rol" value={rol} />

                <AvisoError>{estado.error}</AvisoError>
                {estado.ok && <AvisoExito>Tus datos quedaron guardados.</AvisoExito>}

                <Seccion titulo="Datos personales">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Campo etiqueta="Nombre" obligatorio error={e.nombre}>
                            {(p) => (
                                <input
                                    {...p}
                                    name="nombre"
                                    autoComplete="given-name"
                                    defaultValue={usuario.nombre}
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
                                    defaultValue={usuario.apellido}
                                    required
                                />
                            )}
                        </Campo>
                    </div>

                    <Campo etiqueta="Teléfono" error={e.telefono}>
                        {(p) => (
                            <input
                                {...p}
                                name="telefono"
                                type="tel"
                                autoComplete="tel"
                                defaultValue={
                                    gestante?.telefono ?? profesional?.telefono ?? ""
                                }
                            />
                        )}
                    </Campo>
                </Seccion>

                {gestante && (
                    <>
                        <Seccion
                            titulo="Salud y contacto"
                            descripcion="Tu profesional de salud puede consultar estos datos."
                        >
                            <Campo etiqueta="Dirección" error={e.direccion}>
                                {(p) => (
                                    <input
                                        {...p}
                                        name="direccion"
                                        autoComplete="street-address"
                                        defaultValue={gestante.direccion ?? ""}
                                    />
                                )}
                            </Campo>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Campo etiqueta="EPS" error={e.eps}>
                                    {(p) => (
                                        <input
                                            {...p}
                                            name="eps"
                                            defaultValue={gestante.eps ?? ""}
                                        />
                                    )}
                                </Campo>
                                <Campo
                                    etiqueta="Grupo sanguíneo"
                                    error={e.grupo_sanguineo}
                                >
                                    {(p) => (
                                        <select
                                            {...p}
                                            name="grupo_sanguineo"
                                            defaultValue={gestante.grupo_sanguineo ?? ""}
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
                            </div>
                        </Seccion>

                        <Seccion
                            id="contacto"
                            titulo="Contacto de emergencia"
                            destacada={faltaContacto}
                            descripcion={
                                faltaContacto
                                    ? "Todavía no lo has registrado. Si algún día registras un signo de alarma, te ofrecemos llamar a esta persona con un solo toque."
                                    : "Si registras un signo de alarma, te ofrecemos llamar a esta persona con un solo toque."
                            }
                        >
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Campo
                                    etiqueta="Nombre"
                                    error={e.contacto_emergencia_nombre}
                                >
                                    {(p) => (
                                        <input
                                            {...p}
                                            name="contacto_emergencia_nombre"
                                            placeholder="Por ejemplo: mi esposo Andrés"
                                            defaultValue={
                                                gestante.contacto_emergencia_nombre ?? ""
                                            }
                                        />
                                    )}
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
                                            defaultValue={
                                                gestante.contacto_emergencia_telefono ?? ""
                                            }
                                        />
                                    )}
                                </Campo>
                            </div>
                        </Seccion>
                    </>
                )}

                {profesional && (
                    <Seccion titulo="Datos profesionales">
                        <Campo etiqueta="Institución" error={e.institucion}>
                            {(p) => (
                                <input
                                    {...p}
                                    name="institucion"
                                    defaultValue={profesional.institucion ?? ""}
                                />
                            )}
                        </Campo>
                    </Seccion>
                )}

                <Boton type="submit" tamano="lg" disabled={enviando}>
                    <Save aria-hidden />
                    {enviando ? "Guardando…" : "Guardar cambios"}
                </Boton>
            </form>
        </Tarjeta>
    );
}
