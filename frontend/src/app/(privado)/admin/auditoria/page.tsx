import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { ShieldCheck, X } from "lucide-react";
import { Saludo } from "@/components/layout/saludo";
import { Boton } from "@/components/ui/boton";
import { Filtros, filtroValido, unParam } from "@/components/ui/filtros";
import { Insignia, type TonoInsignia } from "@/components/ui/insignia";
import { ANCLA_LISTA, Paginacion } from "@/components/ui/paginacion";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { auditoria } from "@/lib/datos";
import { fechaCorta, hoyLocal } from "@/lib/formato";
import { exigirRol } from "@/lib/sesion-servidor";
import type { AccionAuditoria, RegistroAuditoria } from "@/lib/tipos";

export const metadata: Metadata = { title: "Auditoría" };

const ACCIONES: { valor: AccionAuditoria; texto: string; tono: TonoInsignia }[] = [
    { valor: "LOGIN", texto: "Inicio de sesión", tono: "neutro" },
    { valor: "LOGIN_FALLIDO", texto: "Intento fallido", tono: "critica" },
    { valor: "LOGOUT", texto: "Cierre de sesión", tono: "neutro" },
    { valor: "CREAR", texto: "Creación", tono: "exito" },
    { valor: "MODIFICAR", texto: "Modificación", tono: "informativa" },
    { valor: "DESACTIVAR", texto: "Desactivación", tono: "advertencia" },
    { valor: "CONSULTAR_SENSIBLE", texto: "Consulta de historia", tono: "marca" },
];

const ENTIDADES: Record<string, string> = {
    usuario: "Usuario",
    asignacion: "Asignación",
    embarazo: "Embarazo",
    control: "Control",
    medicion: "Medición",
    sintoma: "Síntoma",
    examen: "Examen",
    cita: "Cita",
    alerta: "Alerta",
    contenido_educativo: "Contenido",
    configuracion_sistema: "Configuración",
    regla_alerta: "Regla de alerta",
    tipo_control: "Tipo de control",
    tipo_examen: "Tipo de examen",
    tipo_sintoma: "Tipo de síntoma",
    tipo_medicion: "Tipo de medición",
};

const fecha = /^\d{4}-\d{2}-\d{2}$/;

type Params = Record<string, string | string[] | undefined>;

export default async function PaginaAuditoria({
    searchParams,
}: {
    searchParams: Promise<Params>;
}) {
    await exigirRol("ADMINISTRADOR");
    const params = await searchParams;

    const accion = filtroValido(params, "accion", ACCIONES.map((a) => a.valor));
    const desde = unParam(params, "desde");
    const hasta = unParam(params, "hasta");
    const usuarioId = Number(unParam(params, "usuario_id")) || undefined;
    const filtros = {
        accion,
        desde: desde && fecha.test(desde) ? desde : undefined,
        hasta: hasta && fecha.test(hasta) ? hasta : undefined,
        usuario_id: usuarioId,
    };
    const pagina = Number(params.page) || 1;

    // Para quitar el filtro de usuario sin perder los demás.
    const sinUsuario = new URLSearchParams(
        Object.entries(params).flatMap(([k, v]) =>
            k === "usuario_id" || k === "page" || v === undefined
                ? []
                : [[k, Array.isArray(v) ? v[0] : v]],
        ),
    ).toString();

    return (
        <>
            <Saludo
                titulo="Auditoría"
                conFecha={false}
                subtitulo="Quién hizo qué y cuándo (RNF-14). La bitácora es de solo lectura: nadie puede editarla ni borrarla."
            />

            <Tarjeta id={ANCLA_LISTA} className="scroll-mt-4">
                <div className="space-y-3">
                    <Filtros
                        ruta="/admin/auditoria"
                        params={params}
                        nombre="accion"
                        etiqueta="Tipo de acción"
                        opciones={ACCIONES}
                        textoTodos="Todas"
                    />

                    {/* Formulario GET: el rango queda en la URL junto a los demás filtros. */}
                    <Form
                        action="/admin/auditoria"
                        scroll={false}
                        className="flex flex-wrap items-end gap-2"
                    >
                        {accion && <input type="hidden" name="accion" value={accion} />}
                        {usuarioId && (
                            <input type="hidden" name="usuario_id" value={usuarioId} />
                        )}
                        <label className="space-y-1 text-sm font-medium">
                            <span className="block">Desde</span>
                            <input
                                type="date"
                                name="desde"
                                max={hoyLocal()}
                                defaultValue={filtros.desde}
                                className="h-11 rounded-2xl border border-border-firme bg-input px-4 focus:border-ring"
                            />
                        </label>
                        <label className="space-y-1 text-sm font-medium">
                            <span className="block">Hasta</span>
                            <input
                                type="date"
                                name="hasta"
                                max={hoyLocal()}
                                defaultValue={filtros.hasta}
                                className="h-11 rounded-2xl border border-border-firme bg-input px-4 focus:border-ring"
                            />
                        </label>
                        <Boton type="submit" variante="vidrio">
                            Filtrar
                        </Boton>
                        {(filtros.desde || filtros.hasta) && (
                            <Boton comoHijo variante="fantasma">
                                <Link
                                    scroll={false}
                                    href={`/admin/auditoria?${new URLSearchParams({
                                        ...(accion ? { accion } : {}),
                                        ...(usuarioId ? { usuario_id: String(usuarioId) } : {}),
                                    }).toString()}`}
                                >
                                    Quitar fechas
                                </Link>
                            </Boton>
                        )}
                    </Form>

                    {usuarioId && (
                        <p className="flex items-center gap-2 text-sm">
                            Solo las acciones del usuario #{usuarioId}
                            <Link
                                scroll={false}
                                href={`/admin/auditoria${sinUsuario ? `?${sinUsuario}` : ""}`}
                                className="toque inline-grid place-items-center rounded-full text-muted-foreground hover:bg-surface-soft"
                                aria-label="Quitar el filtro de usuario"
                            >
                                <X className="size-4" aria-hidden />
                            </Link>
                        </p>
                    )}
                </div>

                {/* Sin <Suspense> alrededor: ver la nota en acciones/admin.ts. */}
                <Bitacora filtros={filtros} pagina={pagina} params={params} />
            </Tarjeta>
        </>
    );
}

async function Bitacora({
    filtros,
    pagina,
    params,
}: {
    filtros: Record<string, unknown>;
    pagina: number;
    params: Params;
}) {
    const lista = await auditoria({ ...filtros, page: pagina, limit: 30 });

    if (lista.datos.length === 0) {
        return (
            <Vacio
                icono={ShieldCheck}
                titulo="No hay registros con esos filtros"
                descripcion="Prueba con otro rango de fechas o tipo de acción."
            />
        );
    }

    return (
        <>
            <ol className="mt-5 divide-y divide-border-firme">
                {lista.datos.map((r) => (
                    <Registro key={r.id} registro={r} />
                ))}
            </ol>

            <Paginacion
                ruta="/admin/auditoria"
                params={params}
                paginacion={lista.paginacion}
                etiqueta="registros"
            />
        </>
    );
}

function Registro({ registro: r }: { registro: RegistroAuditoria }) {
    const accion = ACCIONES.find((a) => a.valor === r.accion);
    const momento = new Date(r.ocurrido_en);
    const detalle = resumirDetalle(r.detalle);

    return (
        <li className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4">
            <time
                dateTime={r.ocurrido_en}
                className="shrink-0 text-xs tabular-nums text-muted-foreground sm:w-32 sm:pt-1"
            >
                {fechaCorta(momento)}
                <span className="sm:block">
                    {" · "}
                    {momento.toLocaleTimeString("es-CO", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: false,
                    })}
                </span>
            </time>

            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Insignia tono={accion?.tono ?? "neutro"}>{accion?.texto ?? r.accion}</Insignia>
                    <span className="text-sm">
                        {ENTIDADES[r.entidad] ?? r.entidad}
                        {r.entidad_id != null && (
                            <span className="text-muted-foreground"> #{r.entidad_id}</span>
                        )}
                    </span>
                </div>
                <p className="mt-1 text-sm">
                    {r.usuario_id ? (
                        <Link
                            href={`/admin/auditoria?usuario_id=${r.usuario_id}#${ANCLA_LISTA}`}
                            className="font-medium hover:underline"
                            title="Ver solo las acciones de este usuario"
                        >
                            {r.usuario_correo}
                        </Link>
                    ) : (
                        <span className="text-muted-foreground">Usuario desconocido</span>
                    )}
                    {r.ip && <span className="text-muted-foreground"> · {r.ip}</span>}
                </p>
                {detalle && (
                    <p className="mt-0.5 break-words text-xs text-muted-foreground">{detalle}</p>
                )}
            </div>
        </li>
    );
}

/** El detalle es JSON libre; se muestra como "clave: valor · clave: valor". */
function resumirDetalle(detalle: Record<string, unknown> | null) {
    if (!detalle) return null;
    const partes = Object.entries(detalle).map(([clave, valor]) => {
        const texto = Array.isArray(valor)
            ? valor.join(", ")
            : valor !== null && typeof valor === "object"
              ? JSON.stringify(valor)
              : String(valor);
        return `${clave.replace(/_/g, " ")}: ${texto}`;
    });
    const unido = partes.join(" · ");
    return unido.length > 240 ? `${unido.slice(0, 240)}…` : unido;
}
