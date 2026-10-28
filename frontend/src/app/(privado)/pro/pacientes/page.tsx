import type { Metadata } from "next";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { DialogoNuevaCita } from "@/components/formularios/dialogo-cita";
import { Saludo } from "@/components/layout/saludo";
import { TarjetaPaciente } from "@/components/paneles/tarjeta-paciente";
import { Boton } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { pacientes, tiposControl } from "@/lib/datos";
import { exigirRol } from "@/lib/sesion-servidor";

export const metadata: Metadata = { title: "Mis pacientes" };

export default async function PaginaPacientes({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    await exigirRol("PROFESIONAL");
    const params = await searchParams;
    const busqueda = typeof params.q === "string" ? params.q : "";

    const [lista, catalogoControl] = await Promise.all([
        pacientes(busqueda || undefined),
        tiposControl(),
    ]);

    return (
        <>
            <Saludo
                titulo="Mis pacientes"
                conFecha={false}
                subtitulo="Las gestantes que tienes asignadas. Las que tienen alertas de atención inmediata aparecen primero."
                acciones={
                    <DialogoNuevaCita tipos={catalogoControl} pacientes={lista} />
                }
            />

            <Tarjeta>
                {/* Formulario GET: busca sin JavaScript y deja la búsqueda en la URL. */}
                <form action="/pro/pacientes" className="flex gap-2">
                    <div className="relative flex-1">
                        <Search
                            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden
                        />
                        <input
                            type="search"
                            name="q"
                            defaultValue={busqueda}
                            placeholder="Buscar por nombre"
                            aria-label="Buscar pacientes"
                            className="h-11 w-full rounded-2xl border border-border-firme bg-input pl-11 pr-4 placeholder:text-muted-foreground/70 focus:border-ring"
                        />
                    </div>
                    <Boton type="submit" variante="vidrio">
                        Buscar
                    </Boton>
                </form>

                {lista.length === 0 ? (
                    <Vacio
                        icono={Users}
                        titulo={
                            busqueda
                                ? "Ninguna paciente coincide con esa búsqueda"
                                : "Todavía no tienes pacientes asignadas"
                        }
                        descripcion={
                            busqueda
                                ? "Prueba con otro nombre."
                                : "El administrador del sistema es quien asigna las gestantes a cada profesional."
                        }
                        accion={
                            busqueda ? (
                                <Boton comoHijo variante="vidrio">
                                    <Link href="/pro/pacientes">Ver todas</Link>
                                </Boton>
                            ) : undefined
                        }
                    />
                ) : (
                    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                        {lista.map((paciente) => (
                            <li key={paciente.gestante_usuario_id}>
                                <TarjetaPaciente paciente={paciente} />
                            </li>
                        ))}
                    </ul>
                )}
            </Tarjeta>
        </>
    );
}
