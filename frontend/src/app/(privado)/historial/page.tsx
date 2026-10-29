import type { Metadata } from "next";
import { History } from "lucide-react";
import { Saludo } from "@/components/layout/saludo";
import { LineaTiempo } from "@/components/paneles/linea-tiempo";
import { SinEmbarazo } from "@/components/paneles/sin-embarazo";
import { Filtros, filtroValido } from "@/components/ui/filtros";
import { ANCLA_LISTA, Paginacion } from "@/components/ui/paginacion";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { embarazoActivo, historial } from "@/lib/datos";
import { exigirRol } from "@/lib/sesion-servidor";

export const metadata: Metadata = { title: "Mi historial" };

const TIPOS = [
    { valor: "CONTROL", texto: "Controles" },
    { valor: "SINTOMA", texto: "Síntomas" },
    { valor: "EXAMEN", texto: "Exámenes" },
    { valor: "CITA", texto: "Citas" },
    { valor: "ALERTA", texto: "Alertas" },
];

type Params = Record<string, string | string[] | undefined>;

export default async function PaginaHistorial({
    searchParams,
}: {
    searchParams: Promise<Params>;
}) {
    await exigirRol("GESTANTE");
    const params = await searchParams;
    const embarazo = await embarazoActivo();

    if (!embarazo) {
        return (
            <>
                <Saludo
                    titulo="Mi historial"
                    conFecha={false}
                    subtitulo="Aquí se reunirá todo tu seguimiento en orden."
                />
                <SinEmbarazo />
            </>
        );
    }

    // Un tipo inventado en la URL haría que la API responda 400.
    const tipo = filtroValido(
        params,
        "tipo",
        TIPOS.map((t) => t.valor),
    );
    const pagina = Number(params.page) || 1;

    return (
        <>
            <Saludo
                titulo="Mi historial"
                conFecha={false}
                subtitulo="Todo tu seguimiento en orden, de lo más reciente a lo más antiguo."
            />

            <Tarjeta indice={0} id={ANCLA_LISTA} className="scroll-mt-4">
                <Filtros
                    ruta="/historial"
                    params={params}
                    nombre="tipo"
                    etiqueta="Tipo de registro"
                    opciones={TIPOS}
                    textoTodos="Todo"
                />

                {/* Sin <Suspense>: con la lista suspendida, las acciones a veces se
                    quedaban en "Guardando…" (ver el README). Los filtros siguen montados:
                    mientras llega la lista nueva se ve la anterior. */}
                <Lista
                    embarazoId={embarazo.embarazo_id}
                    tipo={tipo}
                    pagina={pagina}
                    params={params}
                />
            </Tarjeta>
        </>
    );
}

async function Lista({
    embarazoId,
    tipo,
    pagina,
    params,
}: {
    embarazoId: number;
    tipo?: string;
    pagina: number;
    params: Params;
}) {
    const lista = await historial(embarazoId, { page: pagina, limit: 20, tipo });

    return (
        <>
            {lista.datos.length === 0 ? (
                <Vacio
                    icono={History}
                    titulo={tipo ? "No hay registros de ese tipo" : "Tu historial está vacío"}
                    descripcion={
                        tipo
                            ? "Prueba con otro filtro o mira todo el historial."
                            : "A medida que registres síntomas y mediciones, y tu profesional registre controles y exámenes, todo aparecerá aquí."
                    }
                />
            ) : (
                <LineaTiempo eventos={lista.datos} />
            )}

            <Paginacion
                ruta="/historial"
                params={params}
                paginacion={lista.paginacion}
                etiqueta="registros"
            />
        </>
    );
}
