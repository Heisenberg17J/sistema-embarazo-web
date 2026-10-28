import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { ChevronRight, Search, Users } from "lucide-react";
import { DialogoNuevoUsuario } from "@/components/admin/formularios-usuario";
import { Saludo } from "@/components/layout/saludo";
import { Boton } from "@/components/ui/boton";
import { Filtros, filtroValido, unParam } from "@/components/ui/filtros";
import { Insignia } from "@/components/ui/insignia";
import { ANCLA_LISTA, Paginacion } from "@/components/ui/paginacion";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { usuarios } from "@/lib/datos";
import { haceTiempo, iniciales } from "@/lib/formato";
import { ROL_TEXTO } from "@/lib/navegacion";
import { exigirRol } from "@/lib/sesion-servidor";
import type { Rol } from "@/lib/tipos";

export const metadata: Metadata = { title: "Usuarios" };

const ROLES = [
    { valor: "GESTANTE", texto: "Gestantes" },
    { valor: "PROFESIONAL", texto: "Profesionales" },
    { valor: "ADMINISTRADOR", texto: "Administradores" },
];

const ESTADOS = [
    { valor: "true", texto: "Activas" },
    { valor: "false", texto: "Desactivadas" },
];

type Params = Record<string, string | string[] | undefined>;

export default async function PaginaUsuarios({
    searchParams,
}: {
    searchParams: Promise<Params>;
}) {
    await exigirRol("ADMINISTRADOR");
    const params = await searchParams;

    const rol = filtroValido(params, "rol", ROLES.map((r) => r.valor));
    const activo = filtroValido(params, "activo", ESTADOS.map((e) => e.valor));
    const busqueda = (unParam(params, "q") ?? "").trim();
    const pagina = Number(params.page) || 1;

    return (
        <>
            <Saludo
                titulo="Usuarios"
                conFecha={false}
                subtitulo="Las cuentas no se borran: se desactivan, para conservar el historial clínico y la trazabilidad."
                acciones={<DialogoNuevoUsuario rolInicial={rol as Rol | undefined} />}
            />

            <Tarjeta id={ANCLA_LISTA} className="scroll-mt-4">
                <div className="space-y-3">
                    {/* Formulario GET: la búsqueda queda en la URL y conserva los filtros.
                        Con next/form navega sin recargar ni subir al inicio. */}
                    <Form scroll={false} action="/admin/usuarios" className="flex gap-2">
                        {rol && <input type="hidden" name="rol" value={rol} />}
                        {activo && <input type="hidden" name="activo" value={activo} />}
                        <div className="relative flex-1">
                            <Search
                                className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                                aria-hidden
                            />
                            <input
                                type="search"
                                name="q"
                                defaultValue={busqueda}
                                placeholder="Nombre o correo"
                                aria-label="Buscar usuarios"
                                className="h-11 w-full rounded-2xl border border-border-firme bg-input pl-11 pr-4 placeholder:text-muted-foreground/70 focus:border-ring"
                            />
                        </div>
                        <Boton type="submit" variante="vidrio">
                            Buscar
                        </Boton>
                    </Form>

                    <Filtros
                        ruta="/admin/usuarios"
                        params={params}
                        nombre="rol"
                        etiqueta="Rol"
                        opciones={ROLES}
                        textoTodos="Todos los roles"
                    />
                    <Filtros
                        ruta="/admin/usuarios"
                        params={params}
                        nombre="activo"
                        etiqueta="Estado de la cuenta"
                        opciones={ESTADOS}
                        textoTodos="Cualquier estado"
                    />
                </div>

                {/* Sin <Suspense> alrededor: ver la nota en acciones/admin.ts. */}
                <Lista
                    rol={rol}
                    activo={activo}
                    busqueda={busqueda}
                    pagina={pagina}
                    params={params}
                />
            </Tarjeta>
        </>
    );
}

async function Lista({
    rol,
    activo,
    busqueda,
    pagina,
    params,
}: {
    rol?: string;
    activo?: string;
    busqueda: string;
    pagina: number;
    params: Params;
}) {
    const lista = await usuarios({ rol, activo, q: busqueda, page: pagina, limit: 20 });

    if (lista.datos.length === 0) {
        const filtrado = rol || activo || busqueda;
        return (
            <Vacio
                icono={Users}
                titulo={filtrado ? "Ningún usuario coincide" : "Todavía no hay usuarios"}
                descripcion={filtrado ? "Prueba con otra búsqueda o quita los filtros." : undefined}
                accion={
                    filtrado ? (
                        <Boton comoHijo variante="vidrio">
                            <Link href="/admin/usuarios">Ver todos</Link>
                        </Boton>
                    ) : undefined
                }
            />
        );
    }

    return (
        <>
            <ul className="mt-5 space-y-2">
                {lista.datos.map((u) => (
                    <li key={u.id}>
                        <Link
                            href={`/admin/usuarios/${u.id}`}
                            className="glass-soft flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-surface-strong sm:p-4"
                        >
                            <span
                                className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground"
                                aria-hidden
                            >
                                {iniciales(u.nombre, u.apellido)}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">
                                    {u.nombre} {u.apellido}
                                </p>
                                <p className="truncate text-sm text-muted-foreground">
                                    {u.correo}
                                </p>
                            </div>
                            <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                                <div className="flex gap-1.5">
                                    <Insignia tono="marca">{ROL_TEXTO[u.rol]}</Insignia>
                                    {!u.activo && <Insignia tono="critica">Desactivada</Insignia>}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {u.ultimo_acceso
                                        ? `Último acceso ${haceTiempo(u.ultimo_acceso)}`
                                        : "Nunca ha entrado"}
                                </p>
                            </div>
                            {/* En móvil solo cabe lo esencial. */}
                            <div className="flex shrink-0 flex-col items-end gap-1 sm:hidden">
                                <span className="text-xs font-medium text-brand-deep">
                                    {ROL_TEXTO[u.rol]}
                                </span>
                                {!u.activo && (
                                    <span className="text-xs font-medium text-critica">
                                        Desactivada
                                    </span>
                                )}
                            </div>
                            <ChevronRight
                                className="size-4 shrink-0 text-muted-foreground"
                                aria-hidden
                            />
                        </Link>
                    </li>
                ))}
            </ul>

            <Paginacion
                ruta="/admin/usuarios"
                params={params}
                paginacion={lista.paginacion}
                etiqueta="usuarios"
            />
        </>
    );
}
