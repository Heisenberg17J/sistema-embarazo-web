import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, UserCheck, UserX } from "lucide-react";
import { cambiarEstadoUsuario } from "@/acciones/admin";
import { DialogoConfirmar } from "@/components/admin/dialogo-confirmar";
import {
    DialogoRestablecerContrasena,
    FormularioEditarUsuario,
} from "@/components/admin/formularios-usuario";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { EncabezadoTarjeta, Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { asignaciones, usuarioPorId } from "@/lib/datos";
import { fechaCorta, haceTiempo } from "@/lib/formato";
import { ROL_TEXTO } from "@/lib/navegacion";
import { exigirRol } from "@/lib/sesion-servidor";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const { id } = await params;
    const numero = Number(id);
    const usuario = Number.isInteger(numero) && numero > 0 ? await usuarioPorId(numero) : null;
    return { title: usuario ? `${usuario.nombre} ${usuario.apellido}` : "Usuario" };
}

export default async function PaginaUsuario({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const sesion = await exigirRol("ADMINISTRADOR");
    const { id } = await params;
    const numero = Number(id);
    if (!Number.isInteger(numero) || numero <= 0) notFound();

    const usuario = await usuarioPorId(numero);
    if (!usuario) notFound();

    const nombre = `${usuario.nombre} ${usuario.apellido}`;
    const esPropia = usuario.id === sesion.id;
    // Las asignaciones solo existen entre profesionales y gestantes.
    const filtroAsignacion =
        usuario.rol === "GESTANTE"
            ? { gestante_id: usuario.id }
            : usuario.rol === "PROFESIONAL"
              ? { profesional_id: usuario.id }
              : null;
    const suyas = filtroAsignacion
        ? await asignaciones({ ...filtroAsignacion, limit: 50 })
        : null;

    return (
        <>
            <Boton comoHijo variante="fantasma" tamano="sm" className="mt-7">
                <Link href="/admin/usuarios">
                    <ArrowLeft aria-hidden />
                    Volver a usuarios
                </Link>
            </Boton>

            <div className="mb-5 mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <h1 className="font-display text-3xl font-semibold text-balance sm:text-4xl">
                        {nombre}
                    </h1>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        <Insignia tono="marca">{ROL_TEXTO[usuario.rol]}</Insignia>
                        {usuario.activo ? (
                            <Insignia tono="exito">Activa</Insignia>
                        ) : (
                            <Insignia tono="critica">Desactivada</Insignia>
                        )}
                        {usuario.debe_cambiar_contrasena && (
                            <Insignia tono="advertencia">Contraseña temporal</Insignia>
                        )}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Creada el {fechaCorta(usuario.creado_en)} ·{" "}
                        {usuario.ultimo_acceso
                            ? `último acceso ${haceTiempo(usuario.ultimo_acceso)}`
                            : "nunca ha entrado"}
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <DialogoRestablecerContrasena usuarioId={usuario.id} nombre={nombre} />
                    {/* Un administrador no puede desactivar su propia cuenta. */}
                    {!esPropia &&
                        (usuario.activo ? (
                            <DialogoConfirmar
                                titulo="Desactivar la cuenta"
                                descripcion={nombre}
                                accion={cambiarEstadoUsuario}
                                campos={{ usuario_id: usuario.id, activo: "false" }}
                                textoConfirmar="Desactivar"
                                peligro
                                disparador={
                                    <Boton variante="vidrio">
                                        <UserX aria-hidden />
                                        Desactivar
                                    </Boton>
                                }
                            >
                                No podrá entrar y se cerrarán sus sesiones abiertas. Su
                                información clínica y su historial se conservan, y puedes
                                reactivarla cuando quieras.
                            </DialogoConfirmar>
                        ) : (
                            <DialogoConfirmar
                                titulo="Reactivar la cuenta"
                                descripcion={nombre}
                                accion={cambiarEstadoUsuario}
                                campos={{ usuario_id: usuario.id, activo: "true" }}
                                textoConfirmar="Reactivar"
                                disparador={
                                    <Boton variante="vidrio">
                                        <UserCheck aria-hidden />
                                        Reactivar
                                    </Boton>
                                }
                            >
                                Podrá volver a entrar con su contraseña actual.
                            </DialogoConfirmar>
                        ))}
                </div>
            </div>

            <div className="grid items-start gap-5 lg:grid-cols-[3fr_2fr]">
                <Tarjeta>
                    <EncabezadoTarjeta seccion="Cuenta" titulo="Datos" />
                    <div className="mt-4">
                        <FormularioEditarUsuario usuario={usuario} />
                    </div>
                </Tarjeta>

                {suyas && (
                    <Tarjeta>
                        <EncabezadoTarjeta
                            seccion="Asignaciones"
                            titulo={
                                usuario.rol === "GESTANTE" ? "Su profesional" : "Sus gestantes"
                            }
                            accion={
                                <Boton comoHijo variante="vidrio" tamano="sm">
                                    <Link href="/admin/asignaciones">Gestionar</Link>
                                </Boton>
                            }
                        />
                        {suyas.datos.length === 0 ? (
                            <Vacio
                                icono={UserCheck}
                                titulo="Sin asignaciones"
                                descripcion={
                                    usuario.rol === "GESTANTE"
                                        ? "Ningún profesional puede ver su seguimiento todavía."
                                        : "Aún no tiene gestantes a su cargo."
                                }
                            />
                        ) : (
                            <ul className="mt-4 space-y-2">
                                {suyas.datos.map((a) => {
                                    const otro =
                                        usuario.rol === "GESTANTE"
                                            ? { id: a.profesional_usuario_id, nombre: a.profesional }
                                            : { id: a.gestante_usuario_id, nombre: a.gestante };
                                    return (
                                        <li
                                            key={a.id}
                                            className="glass-soft flex items-center justify-between gap-3 rounded-2xl p-3"
                                        >
                                            <div className="min-w-0">
                                                <Link
                                                    href={`/admin/usuarios/${otro.id}`}
                                                    className="truncate font-medium hover:underline"
                                                >
                                                    {otro.nombre}
                                                </Link>
                                                <p className="text-xs text-muted-foreground">
                                                    Desde el {fechaCorta(a.fecha_inicio)}
                                                    {a.fecha_fin && ` hasta el ${fechaCorta(a.fecha_fin)}`}
                                                </p>
                                            </div>
                                            <Insignia tono={a.activa ? "exito" : "neutro"}>
                                                {a.activa ? "Vigente" : "Finalizada"}
                                            </Insignia>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Tarjeta>
                )}
            </div>
        </>
    );
}
