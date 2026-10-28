import type { Metadata } from "next";
import { ShieldQuestion } from "lucide-react";
import { DialogoAtenderSolicitud } from "@/components/admin/dialogo-atender-solicitud";
import { Saludo } from "@/components/layout/saludo";
import { Filtros, TODOS, unParam } from "@/components/ui/filtros";
import { Insignia, type TonoInsignia } from "@/components/ui/insignia";
import { ANCLA_LISTA, Paginacion } from "@/components/ui/paginacion";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { solicitudesSupresion } from "@/lib/datos";
import { fechaCorta } from "@/lib/formato";
import { exigirRol } from "@/lib/sesion-servidor";
import type { EstadoSolicitud } from "@/lib/tipos";

export const metadata: Metadata = { title: "Solicitudes de supresión" };

const ESTADOS = [
    { valor: "PENDIENTE", texto: "Pendientes" },
    { valor: "ATENDIDA", texto: "Atendidas" },
    { valor: "RECHAZADA", texto: "Rechazadas" },
];

const TONO: Record<EstadoSolicitud, TonoInsignia> = {
    PENDIENTE: "advertencia",
    ATENDIDA: "exito",
    RECHAZADA: "neutro",
};
const TEXTO: Record<EstadoSolicitud, string> = {
    PENDIENTE: "Pendiente",
    ATENDIDA: "Anonimizada",
    RECHAZADA: "Rechazada",
};

type Params = Record<string, string | string[] | undefined>;

/** Sin filtro en la URL se ven las pendientes, que son las que hay que resolver. */
const POR_DEFECTO = "PENDIENTE";

export default async function PaginaSolicitudes({
    searchParams,
}: {
    searchParams: Promise<Params>;
}) {
    await exigirRol("ADMINISTRADOR");
    const params = await searchParams;

    const valor = unParam(params, "estado");
    const estado =
        valor === TODOS ? undefined : ESTADOS.some((e) => e.valor === valor) ? valor : POR_DEFECTO;
    const pagina = Number(params.page) || 1;

    return (
        <>
            <Saludo
                titulo="Solicitudes de supresión"
                conFecha={false}
                subtitulo="Las gestantes pueden pedir que se eliminen sus datos. No se borra la historia clínica: se anonimiza a la persona."
            />

            <Tarjeta id={ANCLA_LISTA} className="scroll-mt-4">
                <Filtros
                    ruta="/admin/solicitudes"
                    params={params}
                    nombre="estado"
                    etiqueta="Estado de la solicitud"
                    opciones={ESTADOS}
                    porDefecto={POR_DEFECTO}
                    textoTodos="Todas"
                />

                {/* Sin <Suspense> alrededor: ver la nota en acciones/admin.ts. */}
                <Lista estado={estado} pagina={pagina} params={params} />
            </Tarjeta>
        </>
    );
}

async function Lista({
    estado,
    pagina,
    params,
}: {
    estado?: string;
    pagina: number;
    params: Params;
}) {
    const lista = await solicitudesSupresion({ estado, page: pagina, limit: 20 });

    if (lista.datos.length === 0) {
        return (
            <Vacio
                icono={ShieldQuestion}
                titulo={estado === POR_DEFECTO ? "No hay solicitudes pendientes" : "No hay solicitudes"}
                descripcion="Cuando una gestante pida eliminar sus datos, aparecerá aquí."
            />
        );
    }

    return (
        <>
            <ul className="mt-5 space-y-3">
                {lista.datos.map((s) => (
                    <li key={s.id} className="glass-soft rounded-2xl p-4">
                        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                            <div className="min-w-0">
                                <p className="font-medium">{s.persona}</p>
                                <p className="text-sm text-muted-foreground">
                                    {s.anonimizado_en ? "Cuenta anonimizada" : s.correo} · solicitada el{" "}
                                    {fechaCorta(s.solicitada_en)}
                                </p>
                            </div>
                            <Insignia tono={TONO[s.estado]}>{TEXTO[s.estado]}</Insignia>
                        </div>

                        {s.motivo && (
                            <p className="mt-2 rounded-xl bg-surface-soft px-3 py-2 text-sm">
                                <span className="font-medium">Motivo:</span> {s.motivo}
                            </p>
                        )}
                        {s.respuesta && (
                            <p className="mt-2 text-sm text-muted-foreground">
                                <span className="font-medium">Respuesta:</span> {s.respuesta}
                            </p>
                        )}

                        {s.estado === "PENDIENTE" && (
                            <div className="mt-3 flex justify-end">
                                <DialogoAtenderSolicitud solicitudId={s.id} persona={s.persona} />
                            </div>
                        )}
                    </li>
                ))}
            </ul>

            <Paginacion
                ruta="/admin/solicitudes"
                params={params}
                paginacion={lista.paginacion}
                etiqueta="solicitudes"
            />
        </>
    );
}
