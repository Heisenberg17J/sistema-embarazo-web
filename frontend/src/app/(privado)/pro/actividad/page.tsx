import type { Metadata } from "next";
import { History } from "lucide-react";
import { Saludo } from "@/components/layout/saludo";
import { LineaTiempo } from "@/components/paneles/linea-tiempo";
import { Filtros, filtroValido } from "@/components/ui/filtros";
import { ANCLA_LISTA, Paginacion } from "@/components/ui/paginacion";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { actividad } from "@/lib/datos";
import { exigirRol } from "@/lib/sesion-servidor";

export const metadata: Metadata = { title: "Actividad" };

const TIPOS = [
    { valor: "CONTROL", texto: "Controles" },
    { valor: "EXAMEN", texto: "Exámenes" },
    { valor: "SINTOMA", texto: "Síntomas" },
    { valor: "CITA", texto: "Citas" },
    { valor: "ALERTA", texto: "Alertas" },
];

type Params = Record<string, string | string[] | undefined>;

export default async function PaginaActividad({
    searchParams,
}: {
    searchParams: Promise<Params>;
}) {
    await exigirRol("PROFESIONAL");
    const params = await searchParams;
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
                titulo="Actividad"
                conFecha={false}
                subtitulo="Lo último que se registró en todas tus pacientes, sin entrar paciente por paciente."
            />

            <Tarjeta id={ANCLA_LISTA} className="scroll-mt-4">
                <Filtros
                    ruta="/pro/actividad"
                    params={params}
                    nombre="tipo"
                    etiqueta="Tipo de registro"
                    opciones={TIPOS}
                    textoTodos="Todo"
                />
                <Lista tipo={tipo} pagina={pagina} params={params} />
            </Tarjeta>
        </>
    );
}

async function Lista({
    tipo,
    pagina,
    params,
}: {
    tipo?: string;
    pagina: number;
    params: Params;
}) {
    const lista = await actividad({ page: pagina, limit: 20, tipo });

    return (
        <>
            {lista.datos.length === 0 ? (
                <Vacio
                    icono={History}
                    titulo={tipo ? "No hay registros de ese tipo" : "Todavía no hay actividad"}
                    descripcion={
                        tipo
                            ? "Prueba con otro filtro o mira toda la actividad."
                            : "Cuando tus pacientes registren síntomas y mediciones, o tú registres controles y exámenes, aparecerán aquí."
                    }
                />
            ) : (
                <LineaTiempo eventos={lista.datos} />
            )}
            <Paginacion
                ruta="/pro/actividad"
                params={params}
                paginacion={lista.paginacion}
                etiqueta="registros"
            />
        </>
    );
}
