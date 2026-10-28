import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { Saludo } from "@/components/layout/saludo";
import { Boton } from "@/components/ui/boton";
import { EncabezadoTarjeta, Panel, Tarjeta } from "@/components/ui/tarjeta";
import { panel } from "@/lib/datos";
import { ESTADO_ALERTA_TEXTO, ESTADO_CITA_TEXTO } from "@/lib/formato";
import { ROL_TEXTO } from "@/lib/navegacion";
import { ESTILO_SEVERIDAD } from "@/lib/severidad";
import { exigirRol } from "@/lib/sesion-servidor";
import type { EstadoAlerta, PanelAdministrador, Severidad } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Estadísticas" };

const ESTADO_EMBARAZO_TEXTO: Record<string, string> = {
    ACTIVO: "En curso",
    FINALIZADO: "Finalizados",
    CANCELADO: "Cancelados",
};

const SEVERIDADES: Severidad[] = ["CRITICA", "ADVERTENCIA", "INFORMATIVA"];
const ESTADOS_ALERTA: EstadoAlerta[] = ["PENDIENTE", "REVISADA", "DESCARTADA"];

/**
 * RF-17. Panel del administrador: solo cifras agregadas. El administrador no
 * tiene acceso a los datos clínicos de ninguna gestante (RNF-03).
 */
export default async function PaginaEstadisticas() {
    const sesion = await exigirRol("ADMINISTRADOR");
    const datos = await panel<PanelAdministrador>();

    const suma = (filas: { total: number }[]) => filas.reduce((s, f) => s + f.total, 0);
    const usuariosActivos = datos.usuarios_por_rol.reduce((s, r) => s + r.activos, 0);
    const embarazosActivos =
        datos.embarazos_por_estado.find((e) => e.estado === "ACTIVO")?.total ?? 0;
    const pendientes = suma(datos.alertas.filter((a) => a.estado === "PENDIENTE"));
    const criticasPendientes = suma(
        datos.alertas.filter((a) => a.estado === "PENDIENTE" && a.severidad === "CRITICA"),
    );
    const alerta = (severidad: Severidad, estado: EstadoAlerta) =>
        datos.alertas.find((a) => a.severidad === severidad && a.estado === estado)?.total ?? 0;

    return (
        <>
            <Saludo
                nombre={sesion.nombre}
                subtitulo="Resumen general del sistema. Solo cifras: aquí no se ve información clínica de nadie."
            />

            <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Dato
                        etiqueta="Cuentas activas"
                        valor={usuariosActivos}
                        href="/admin/usuarios?activo=true"
                    />
                    <Dato
                        etiqueta="Gestantes sin profesional"
                        valor={datos.gestantes_sin_profesional}
                        href="/admin/asignaciones"
                        tono={datos.gestantes_sin_profesional > 0 ? "advertencia" : undefined}
                    />
                    <Dato etiqueta="Embarazos en curso" valor={embarazosActivos} />
                    <Dato
                        etiqueta="Alertas sin revisar"
                        valor={pendientes}
                        detalle={
                            criticasPendientes > 0
                                ? `${criticasPendientes} de atención inmediata`
                                : undefined
                        }
                        tono={criticasPendientes > 0 ? "critica" : pendientes > 0 ? "advertencia" : undefined}
                    />
                </div>

                <div className="grid items-start gap-5 lg:grid-cols-2">
                    <Tarjeta>
                        <EncabezadoTarjeta seccion="Cuentas" titulo="Usuarios por rol" />
                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                                        <th scope="col" className="py-2 font-semibold">Rol</th>
                                        <th scope="col" className="py-2 text-right font-semibold">Activas</th>
                                        <th scope="col" className="py-2 text-right font-semibold">Desactivadas</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-firme">
                                    {datos.usuarios_por_rol.map((r) => (
                                        <tr key={r.rol}>
                                            <th scope="row" className="py-2.5 text-left font-medium">
                                                <Link
                                                    href={`/admin/usuarios?rol=${r.rol}`}
                                                    className="hover:underline"
                                                >
                                                    {ROL_TEXTO[r.rol]}
                                                </Link>
                                            </th>
                                            <td className="py-2.5 text-right tabular-nums">{r.activos}</td>
                                            <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                                                {r.inactivos}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Tarjeta>

                    <Tarjeta>
                        <EncabezadoTarjeta
                            seccion="Alertas"
                            titulo="Por severidad y estado"
                            descripcion="Las revisan los profesionales asignados."
                        />
                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                                        <th scope="col" className="py-2 font-semibold">Severidad</th>
                                        {ESTADOS_ALERTA.map((e) => (
                                            <th key={e} scope="col" className="py-2 text-right font-semibold">
                                                {ESTADO_ALERTA_TEXTO[e]}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-firme">
                                    {SEVERIDADES.map((s) => {
                                        const estilo = ESTILO_SEVERIDAD[s];
                                        return (
                                            <tr key={s}>
                                                <th scope="row" className="py-2.5 text-left font-medium">
                                                    <span className={cn("inline-flex items-center gap-1.5", estilo.texto)}>
                                                        <estilo.icono className="size-4" aria-hidden />
                                                        {estilo.etiqueta}
                                                    </span>
                                                </th>
                                                {ESTADOS_ALERTA.map((e) => (
                                                    <td
                                                        key={e}
                                                        className={cn(
                                                            "py-2.5 text-right tabular-nums",
                                                            e === "PENDIENTE" && alerta(s, e) > 0
                                                                ? "font-semibold"
                                                                : "text-muted-foreground",
                                                        )}
                                                    >
                                                        {alerta(s, e)}
                                                    </td>
                                                ))}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Tarjeta>

                    <Tarjeta>
                        <EncabezadoTarjeta seccion="Agenda" titulo="Citas por estado" />
                        <Barras
                            filas={Object.keys(ESTADO_CITA_TEXTO).map((estado) => ({
                                etiqueta: ESTADO_CITA_TEXTO[estado],
                                valor:
                                    datos.citas_por_estado.find((c) => c.estado === estado)?.total ?? 0,
                            }))}
                        />
                    </Tarjeta>

                    <div className="space-y-5">
                        <Tarjeta>
                            <EncabezadoTarjeta seccion="Seguimiento" titulo="Embarazos" />
                            <Barras
                                filas={Object.keys(ESTADO_EMBARAZO_TEXTO).map((estado) => ({
                                    etiqueta: ESTADO_EMBARAZO_TEXTO[estado],
                                    valor:
                                        datos.embarazos_por_estado.find((e) => e.estado === estado)
                                            ?.total ?? 0,
                                }))}
                            />
                        </Tarjeta>

                        <Tarjeta>
                            <EncabezadoTarjeta
                                seccion="Aprendizaje"
                                titulo="Contenido educativo"
                                accion={
                                    <Boton comoHijo variante="vidrio" tamano="sm">
                                        <Link href="/admin/contenido">
                                            <BookOpen aria-hidden />
                                            Gestionar
                                        </Link>
                                    </Boton>
                                }
                            />
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <Panel>
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                        Publicados
                                    </p>
                                    <p className="mt-1 font-display text-3xl font-semibold">
                                        {datos.contenido.publicados}
                                    </p>
                                </Panel>
                                <Panel>
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                        Lecturas
                                    </p>
                                    <p className="mt-1 font-display text-3xl font-semibold">
                                        {datos.contenido.lecturas}
                                    </p>
                                </Panel>
                            </div>
                        </Tarjeta>
                    </div>
                </div>
            </div>
        </>
    );
}

function Dato({
    etiqueta,
    valor,
    href,
    detalle,
    tono,
}: {
    etiqueta: string;
    valor: number;
    href?: string;
    detalle?: string;
    tono?: "advertencia" | "critica";
}) {
    const contenido = (
        <Panel className={cn("h-full", href && "transition-colors hover:bg-surface-strong")}>
            <p className="flex items-center justify-between gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                {etiqueta}
                {href && <ChevronRight className="size-3.5" aria-hidden />}
            </p>
            <p
                className={cn(
                    "mt-1 font-display text-3xl font-semibold",
                    tono === "critica" && "text-critica",
                    tono === "advertencia" && "text-advertencia",
                )}
            >
                {valor}
            </p>
            {detalle && <p className="text-xs font-medium text-critica">{detalle}</p>}
        </Panel>
    );
    return href ? (
        <Link href={href} className="block">
            {contenido}
        </Link>
    ) : (
        contenido
    );
}

/** Barras horizontales con la cifra escrita al lado: se leen sin la barra. */
function Barras({ filas }: { filas: { etiqueta: string; valor: number }[] }) {
    const maximo = Math.max(...filas.map((f) => f.valor), 1);
    return (
        <ul className="mt-4 space-y-2.5">
            {filas.map((f) => (
                <li key={f.etiqueta} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 text-sm">
                    <span className="truncate">{f.etiqueta}</span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-surface-soft" aria-hidden>
                        <span
                            className="block h-full rounded-full bg-brand"
                            style={{ width: `${(f.valor / maximo) * 100}%` }}
                        />
                    </span>
                    <span className="text-right tabular-nums">{f.valor}</span>
                </li>
            ))}
        </ul>
    );
}
