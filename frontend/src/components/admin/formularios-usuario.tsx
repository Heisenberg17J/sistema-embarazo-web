"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { KeyRound, RefreshCw, Save, UserPlus } from "lucide-react";
import {
    crearUsuario,
    editarUsuario,
    restablecerContrasena,
    type ResultadoAdmin,
} from "@/acciones/admin";
import { DialogoAccion } from "@/components/formularios/dialogo-accion";
import { Boton } from "@/components/ui/boton";
import { AvisoExito } from "@/components/ui/aviso-exito";
import { AvisoError, Campo } from "@/components/ui/campo";
import { hoyLocal } from "@/lib/formato";
import { ROL_TEXTO } from "@/lib/navegacion";
import type { PerfilGestante, PerfilProfesional, Rol, Usuario } from "@/lib/tipos";

const INICIAL: ResultadoAdmin = {};

const TIPOS_DOCUMENTO = [
    { valor: "CC", texto: "Cédula de ciudadanía" },
    { valor: "TI", texto: "Tarjeta de identidad" },
    { valor: "CE", texto: "Cédula de extranjería" },
    { valor: "PA", texto: "Pasaporte" },
];

const GRUPOS_SANGUINEOS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

/**
 * Contraseña temporal legible para dictarla o copiarla: sin caracteres que se
 * confundan (0/O, 1/l) y siempre con letras y números, como exige la política.
 */
function generarContrasena() {
    const letras = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
    const numeros = "23456789";
    const azar = new Uint32Array(10);
    crypto.getRandomValues(azar);
    const parte = (desde: number, n: number, juego: string) =>
        Array.from(azar.slice(desde, desde + n), (x) => juego[x % juego.length]).join("");
    return `${parte(0, 4, letras)}-${parte(4, 4, numeros)}-${parte(8, 2, letras)}`;
}

/** Valores iniciales planos: los del formulario repintado o los guardados. */
type Valores = Record<string, string | null | undefined>;

// ---------------------------------------------------------------------------
// Campos del perfil según el rol
// ---------------------------------------------------------------------------

function CamposGestante({
    v,
    e,
}: {
    v: Valores;
    e: Record<string, string>;
}) {
    // Controlados: React restablece el formulario tras la acción y un <select>
    // no controlado volvería a la primera opción.
    const [tipoDoc, setTipoDoc] = useState(v.tipo_documento ?? "CC");
    const [grupo, setGrupo] = useState(v.grupo_sanguineo ?? "");

    return (
        <fieldset className="space-y-4">
            <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Datos de la gestante
            </legend>

            <div className="grid gap-4 sm:grid-cols-2">
                <Campo etiqueta="Tipo de documento" obligatorio error={e.tipo_documento}>
                    {(p) => (
                        <select
                            {...p}
                            name="tipo_documento"
                            value={tipoDoc}
                            onChange={(ev) => setTipoDoc(ev.target.value)}
                        >
                            {TIPOS_DOCUMENTO.map((t) => (
                                <option key={t.valor} value={t.valor}>
                                    {t.texto}
                                </option>
                            ))}
                        </select>
                    )}
                </Campo>
                <Campo etiqueta="Número de documento" obligatorio error={e.numero_documento}>
                    {(p) => (
                        <input
                            {...p}
                            name="numero_documento"
                            defaultValue={v.numero_documento ?? ""}
                            autoComplete="off"
                            required
                        />
                    )}
                </Campo>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Campo etiqueta="Fecha de nacimiento" obligatorio error={e.fecha_nacimiento}>
                    {(p) => (
                        <input
                            {...p}
                            name="fecha_nacimiento"
                            type="date"
                            max={hoyLocal()}
                            defaultValue={v.fecha_nacimiento ?? ""}
                            required
                        />
                    )}
                </Campo>
                <Campo etiqueta="Teléfono" error={e.telefono}>
                    {(p) => (
                        <input
                            {...p}
                            name="telefono"
                            type="tel"
                            defaultValue={v.telefono ?? ""}
                        />
                    )}
                </Campo>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Campo etiqueta="EPS" error={e.eps}>
                    {(p) => <input {...p} name="eps" defaultValue={v.eps ?? ""} />}
                </Campo>
                <Campo etiqueta="Grupo sanguíneo" error={e.grupo_sanguineo}>
                    {(p) => (
                        <select
                            {...p}
                            name="grupo_sanguineo"
                            value={grupo}
                            onChange={(ev) => setGrupo(ev.target.value)}
                        >
                            <option value="">Sin dato</option>
                            {GRUPOS_SANGUINEOS.map((g) => (
                                <option key={g} value={g}>
                                    {g}
                                </option>
                            ))}
                        </select>
                    )}
                </Campo>
            </div>

            <Campo etiqueta="Dirección" error={e.direccion}>
                {(p) => (
                    <input {...p} name="direccion" defaultValue={v.direccion ?? ""} />
                )}
            </Campo>

            <div className="grid gap-4 sm:grid-cols-2">
                <Campo
                    etiqueta="Contacto de emergencia"
                    error={e.contacto_emergencia_nombre}
                >
                    {(p) => (
                        <input
                            {...p}
                            name="contacto_emergencia_nombre"
                            defaultValue={v.contacto_emergencia_nombre ?? ""}
                        />
                    )}
                </Campo>
                <Campo
                    etiqueta="Teléfono de emergencia"
                    error={e.contacto_emergencia_telefono}
                >
                    {(p) => (
                        <input
                            {...p}
                            name="contacto_emergencia_telefono"
                            type="tel"
                            defaultValue={v.contacto_emergencia_telefono ?? ""}
                        />
                    )}
                </Campo>
            </div>
        </fieldset>
    );
}

function CamposProfesional({
    v,
    e,
}: {
    v: Valores;
    e: Record<string, string>;
}) {
    return (
        <fieldset className="space-y-4">
            <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Datos del profesional
            </legend>

            <div className="grid gap-4 sm:grid-cols-2">
                <Campo
                    etiqueta="Registro profesional"
                    obligatorio
                    error={e.registro_profesional}
                >
                    {(p) => (
                        <input
                            {...p}
                            name="registro_profesional"
                            defaultValue={v.registro_profesional ?? ""}
                            required
                        />
                    )}
                </Campo>
                <Campo etiqueta="Especialidad" obligatorio error={e.especialidad}>
                    {(p) => (
                        <input
                            {...p}
                            name="especialidad"
                            defaultValue={v.especialidad ?? ""}
                            placeholder="Por ejemplo: Ginecología y obstetricia"
                            required
                        />
                    )}
                </Campo>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Campo etiqueta="Institución" error={e.institucion}>
                    {(p) => (
                        <input {...p} name="institucion" defaultValue={v.institucion ?? ""} />
                    )}
                </Campo>
                <Campo etiqueta="Teléfono" error={e.telefono}>
                    {(p) => (
                        <input
                            {...p}
                            name="telefono"
                            type="tel"
                            defaultValue={v.telefono ?? ""}
                        />
                    )}
                </Campo>
            </div>
        </fieldset>
    );
}

function CamposBasicos({ v, e }: { v: Valores; e: Record<string, string> }) {
    return (
        <>
            <div className="grid gap-4 sm:grid-cols-2">
                <Campo etiqueta="Nombre" obligatorio error={e.nombre}>
                    {(p) => (
                        <input {...p} name="nombre" defaultValue={v.nombre ?? ""} required />
                    )}
                </Campo>
                <Campo etiqueta="Apellido" obligatorio error={e.apellido}>
                    {(p) => (
                        <input
                            {...p}
                            name="apellido"
                            defaultValue={v.apellido ?? ""}
                            required
                        />
                    )}
                </Campo>
            </div>

            <Campo etiqueta="Correo electrónico" obligatorio error={e.correo}>
                {(p) => (
                    <input
                        {...p}
                        name="correo"
                        type="email"
                        autoComplete="off"
                        defaultValue={v.correo ?? ""}
                        required
                    />
                )}
            </Campo>
        </>
    );
}

/** Contraseña temporal visible, con botón para generar una nueva. */
function CampoContrasenaTemporal({ error }: { error?: string }) {
    const [valor, setValor] = useState("");
    return (
        <Campo
            etiqueta="Contraseña temporal"
            obligatorio
            error={error}
            ayuda="Mínimo 8 caracteres, con letras y números. Se pedirá cambiarla al entrar."
        >
            {(p) => (
                <div className="flex gap-2">
                    <input
                        {...p}
                        name="contrasena_temporal"
                        type="text"
                        autoComplete="new-password"
                        spellCheck={false}
                        value={valor}
                        onChange={(ev) => setValor(ev.target.value)}
                        className={`${p.className} font-mono`}
                        required
                    />
                    <Boton
                        variante="vidrio"
                        onClick={() => setValor(generarContrasena())}
                        aria-label="Generar contraseña"
                        title="Generar una contraseña"
                    >
                        <RefreshCw aria-hidden />
                        <span className="hidden sm:inline">Generar</span>
                    </Boton>
                </div>
            )}
        </Campo>
    );
}

// ---------------------------------------------------------------------------
// Crear usuario
// ---------------------------------------------------------------------------

export function DialogoNuevoUsuario({ rolInicial }: { rolInicial?: Rol }) {
    return (
        <DialogoAccion
            titulo="Crear usuario"
            descripcion="Las gestantes también pueden registrarse solas desde la página de inicio."
            disparador={
                <Boton>
                    <UserPlus aria-hidden />
                    Crear usuario
                </Boton>
            }
        >
            {({ onExito }) => <FormularioNuevo rolInicial={rolInicial} onExito={onExito} />}
        </DialogoAccion>
    );
}

function FormularioNuevo({
    rolInicial,
    onExito,
}: {
    rolInicial?: Rol;
    onExito: () => void;
}) {
    const [estado, enviar, enviando] = useActionState(crearUsuario, INICIAL);
    const e = estado.porCampo ?? {};
    const v = estado.valores ?? {};
    const [rol, setRol] = useState<Rol>(rolInicial ?? "PROFESIONAL");

    useEffect(() => {
        if (estado.ok) onExito();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    if (estado.ok) {
        return (
            <div className="space-y-4">
                <AvisoExito>{estado.resumen}</AvisoExito>
                {estado.usuarioId && (
                    <Boton comoHijo variante="vidrio" ancho="completo" tamano="lg">
                        <Link href={`/admin/usuarios/${estado.usuarioId}`}>Ver su ficha</Link>
                    </Boton>
                )}
            </div>
        );
    }

    return (
        <form action={enviar} className="space-y-4" noValidate>
            <AvisoError>{estado.error}</AvisoError>

            <Campo etiqueta="Rol" obligatorio error={e.rol}>
                {(p) => (
                    <select
                        {...p}
                        name="rol"
                        value={rol}
                        onChange={(ev) => setRol(ev.target.value as Rol)}
                    >
                        {(["PROFESIONAL", "GESTANTE", "ADMINISTRADOR"] as Rol[]).map((r) => (
                            <option key={r} value={r}>
                                {ROL_TEXTO[r]}
                            </option>
                        ))}
                    </select>
                )}
            </Campo>

            <CamposBasicos v={v} e={e} />
            <CampoContrasenaTemporal error={e.contrasena_temporal} />

            {/* La clave remonta los campos al cambiar de rol: no se mezclan perfiles. */}
            {rol === "GESTANTE" && <CamposGestante key="g" v={v} e={e} />}
            {rol === "PROFESIONAL" && <CamposProfesional key="p" v={v} e={e} />}
            {rol === "ADMINISTRADOR" && (
                <p className="rounded-2xl bg-advertencia-suave px-4 py-3 text-sm text-advertencia">
                    Un administrador puede crear y desactivar cuentas y cambiar las
                    reglas de alerta. Crea solo las cuentas necesarias.
                </p>
            )}

            <Boton type="submit" ancho="completo" tamano="lg" disabled={enviando}>
                <UserPlus aria-hidden />
                {enviando ? "Creando…" : "Crear cuenta"}
            </Boton>
        </form>
    );
}

// ---------------------------------------------------------------------------
// Editar usuario (en su ficha)
// ---------------------------------------------------------------------------

/** La acción revalida la ficha: no hace falta refrescar desde aquí. */
export function FormularioEditarUsuario({ usuario }: { usuario: Usuario }) {
    const [estado, enviar, enviando] = useActionState(editarUsuario, INICIAL);
    const e = estado.porCampo ?? {};
    const perfil = (usuario.perfil ?? {}) as Partial<PerfilGestante & PerfilProfesional>;
    const v: Valores = estado.valores ?? {
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        ...perfil,
    };

    return (
        <form action={enviar} className="space-y-4" noValidate>
            <input type="hidden" name="usuario_id" value={usuario.id} />
            <input type="hidden" name="rol" value={usuario.rol} />

            <AvisoError>{estado.error}</AvisoError>
            {estado.ok && <AvisoExito>{estado.resumen}</AvisoExito>}

            <CamposBasicos v={v} e={e} />
            {usuario.rol === "GESTANTE" && <CamposGestante v={v} e={e} />}
            {usuario.rol === "PROFESIONAL" && <CamposProfesional v={v} e={e} />}

            <div className="flex justify-end">
                <Boton type="submit" disabled={enviando}>
                    <Save aria-hidden />
                    {enviando ? "Guardando…" : "Guardar cambios"}
                </Boton>
            </div>
        </form>
    );
}

// ---------------------------------------------------------------------------
// Restablecer contraseña
// ---------------------------------------------------------------------------

export function DialogoRestablecerContrasena({
    usuarioId,
    nombre,
}: {
    usuarioId: number;
    nombre: string;
}) {
    return (
        <DialogoAccion
            titulo="Restablecer la contraseña"
            descripcion={`${nombre} tendrá que entrar con la contraseña temporal y cambiarla.`}
            disparador={
                <Boton variante="vidrio">
                    <KeyRound aria-hidden />
                    Restablecer contraseña
                </Boton>
            }
        >
            {({ onExito }) => <FormularioRestablecer usuarioId={usuarioId} onExito={onExito} />}
        </DialogoAccion>
    );
}

function FormularioRestablecer({
    usuarioId,
    onExito,
}: {
    usuarioId: number;
    onExito: () => void;
}) {
    const [estado, enviar, enviando] = useActionState(restablecerContrasena, INICIAL);

    useEffect(() => {
        if (estado.ok) onExito();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    if (estado.ok) return <AvisoExito>{estado.resumen}</AvisoExito>;

    return (
        <form action={enviar} className="space-y-4" noValidate>
            <input type="hidden" name="usuario_id" value={usuarioId} />
            <AvisoError>{estado.error}</AvisoError>

            <CampoContrasenaTemporal error={estado.porCampo?.contrasena_temporal} />

            <p className="text-sm text-muted-foreground">
                Se cerrarán todas sus sesiones abiertas.
            </p>

            <Boton type="submit" ancho="completo" tamano="lg" disabled={enviando}>
                {enviando ? "Guardando…" : "Restablecer"}
            </Boton>
        </form>
    );
}
