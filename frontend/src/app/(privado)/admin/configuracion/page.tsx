import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { FormularioParametro } from "@/components/admin/formulario-parametro";
import { Saludo } from "@/components/layout/saludo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { configuracion } from "@/lib/datos";
import { marcaTiempo } from "@/lib/formato";
import { exigirRol } from "@/lib/sesion-servidor";

export const metadata: Metadata = { title: "Configuración" };

/** Nombre legible de los parámetros conocidos; los demás muestran su clave. */
const NOMBRES: Record<string, string> = {
    semanas_max_gestacion: "Semana máxima de gestación",
    dias_recordatorio_cita: "Días de aviso antes de una cita",
};

const legible = (clave: string) => {
    if (NOMBRES[clave]) return NOMBRES[clave];
    const texto = clave.replace(/_/g, " ");
    return texto.charAt(0).toUpperCase() + texto.slice(1);
};

export default async function PaginaConfiguracion() {
    await exigirRol("ADMINISTRADOR");
    const parametros = await configuracion();

    return (
        <>
            <Saludo
                titulo="Configuración"
                conFecha={false}
                subtitulo="Parámetros generales del sistema. Cada cambio queda registrado en la auditoría."
            />

            <Tarjeta className="p-2 sm:p-2">
                {parametros.length === 0 ? (
                    <Vacio icono={Settings} titulo="No hay parámetros configurables" />
                ) : (
                    <ul className="divide-y divide-border-firme">
                        {parametros.map((p) => (
                            <li
                                key={p.clave}
                                className="flex flex-col gap-3 px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-4"
                            >
                                <div className="min-w-0">
                                    <p className="font-medium">{legible(p.clave)}</p>
                                    {p.descripcion && (
                                        <p className="text-sm text-muted-foreground">
                                            {p.descripcion}
                                        </p>
                                    )}
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        <span className="font-mono">{p.clave}</span>
                                        {p.actualizado_por &&
                                            ` · cambiado el ${marcaTiempo(p.actualizado_en)}`}
                                    </p>
                                </div>
                                <FormularioParametro parametro={p} />
                            </li>
                        ))}
                    </ul>
                )}
            </Tarjeta>
        </>
    );
}
