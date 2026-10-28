import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Baby, Mail, Phone, PhoneCall } from "lucide-react";
import { DialogoControl } from "@/components/formularios/dialogo-control";
import { DialogoExamen } from "@/components/formularios/dialogo-examen";
import { DialogoNuevaCita } from "@/components/formularios/dialogo-cita";
import { AnilloGestacion } from "@/components/paneles/anillo-gestacion";
import { DatoPaciente } from "@/components/paneles/tarjeta-paciente";
import { Boton } from "@/components/ui/boton";
import { EsqueletoLista } from "@/components/ui/esqueleto";
import { Insignia } from "@/components/ui/insignia";
import { Pestanas, pestanaActiva } from "@/components/ui/pestanas";
import { EncabezadoTarjeta, Panel, Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { paciente, tiposControl, tiposExamen, tiposMedicion } from "@/lib/datos";
import { fechaCompleta, nombreTrimestre, variacion } from "@/lib/formato";
import { exigirRol } from "@/lib/sesion-servidor";
import type { PerfilGestante } from "@/lib/tipos";
import { SECCIONES, Seccion } from "./secciones";

type Params = Record<string, string | string[] | undefined>;

export async function generateMetadata({
    params,
}: {
    params: Promise<{ gestanteId: string }>;
}): Promise<Metadata> {
    const { gestanteId } = await params;
    const datos = await paciente(Number(gestanteId));
    return {
        title: datos ? `${datos.nombre} ${datos.apellido}` : "Paciente",
    };
}

export default async function PaginaFicha({
    params,
    searchParams,
}: {
    params: Promise<{ gestanteId: string }>;
    searchParams: Promise<Params>;
}) {
    await exigirRol("PROFESIONAL");
    const { gestanteId } = await params;
    const consulta = await searchParams;

    const numero = Number(gestanteId);
    if (!Number.isInteger(numero) || numero <= 0) notFound();

    // El backend responde 404 también cuando la gestante no está asignada a
    // este profesional, para no revelar que existe (RNF-03).
    const datos = await paciente(numero);
    if (!datos) notFound();

    const perfil = datos.perfil as PerfilGestante | null;
    const embarazo = datos.embarazos[0] ?? null;
    const ruta = `/pro/pacientes/${numero}`;
    const seccion = pestanaActiva(
        consulta,
        SECCIONES.map((s) => s.valor),
    );
    const pagina = Number(consulta.page) || 1;

    const [catalogoMedicion, catalogoExamen, catalogoControl] = await Promise.all([
        tiposMedicion(),
        tiposExamen(),
        tiposControl(),
    ]);

    const nombre = `${datos.nombre} ${datos.apellido}`;
    const activo = embarazo?.estado === "ACTIVO";

    return (
        <>
            <Boton comoHijo variante="fantasma" tamano="sm" className="mt-7">
                <Link href="/pro/pacientes">
                    <ArrowLeft aria-hidden />
                    Volver a mis pacientes
                </Link>
            </Boton>

            <div className="mb-5 mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <h1 className="font-display text-3xl font-semibold text-balance sm:text-4xl">
                        {nombre}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {activo && embarazo?.edad_gestacional
                            ? `Semana ${embarazo.edad_gestacional} · ${nombreTrimestre(embarazo.trimestre)}`
                            : "Sin embarazo activo"}
                    </p>
                </div>

                {activo && embarazo && (
                    <div className="flex flex-wrap gap-2">
                        <DialogoControl
                            embarazoId={embarazo.embarazo_id}
                            gestante={nombre}
                            tipos={catalogoMedicion}
                        />
                        <DialogoExamen
                            embarazoId={embarazo.embarazo_id}
                            gestante={nombre}
                            tipos={catalogoExamen}
                        />
                        <DialogoNuevaCita
                            tipos={catalogoControl}
                            embarazoId={embarazo.embarazo_id}
                            gestante={nombre}
                            textoBoton="Citar"
                        />
                    </div>
                )}
            </div>

            <div className="space-y-5">
                {/* --- Resumen, siempre visible ----------------------------- */}
                <Tarjeta>
                    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                        {activo && embarazo ? (
                            <AnilloGestacion
                                semana={embarazo.semana_actual}
                                edadGestacional={embarazo.edad_gestacional}
                            />
                        ) : (
                            <span className="grid size-44 shrink-0 place-items-center rounded-full bg-surface-soft text-muted-foreground">
                                <Baby className="size-10" aria-hidden />
                            </span>
                        )}

                        <div className="grid w-full flex-1 gap-3 sm:grid-cols-2">
                            {activo && embarazo && (
                                <>
                                    <DatoPaciente
                                        etiqueta="Fecha probable de parto"
                                        valor={fechaCompleta(embarazo.fecha_estimada_parto)}
                                    />
                                    <DatoPaciente
                                        etiqueta="Ganancia de peso"
                                        valor={
                                            embarazo.peso?.ganancia_actual_kg != null ? (
                                                <>
                                                    {variacion(embarazo.peso.ganancia_actual_kg)}
                                                    <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                                                        de {embarazo.peso.ganancia_recomendada_kg.min}–
                                                        {embarazo.peso.ganancia_recomendada_kg.max} kg
                                                    </span>
                                                </>
                                            ) : (
                                                "Sin peso registrado"
                                            )
                                        }
                                    />
                                </>
                            )}

                            <DatoPaciente
                                etiqueta="Documento"
                                valor={
                                    perfil
                                        ? `${perfil.tipo_documento} ${perfil.numero_documento}`
                                        : "—"
                                }
                            />
                            <DatoPaciente
                                etiqueta="EPS y grupo sanguíneo"
                                valor={
                                    [perfil?.eps, perfil?.grupo_sanguineo]
                                        .filter(Boolean)
                                        .join(" · ") || "Sin registrar"
                                }
                            />

                            <Panel className="sm:col-span-2">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                    Contacto
                                </p>
                                <ul className="mt-2 space-y-1.5 text-sm">
                                    <li className="flex items-center gap-2">
                                        <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                        <a
                                            href={`mailto:${datos.correo}`}
                                            className="underline-offset-4 hover:underline"
                                        >
                                            {datos.correo}
                                        </a>
                                    </li>
                                    {perfil?.telefono && (
                                        <li className="flex items-center gap-2">
                                            <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                            <a
                                                href={`tel:${perfil.telefono.replace(/\s/g, "")}`}
                                                className="underline-offset-4 hover:underline"
                                            >
                                                {perfil.telefono}
                                            </a>
                                        </li>
                                    )}
                                    {perfil?.contacto_emergencia_telefono && (
                                        <li className="flex items-center gap-2">
                                            <PhoneCall className="size-4 shrink-0 text-critica" aria-hidden />
                                            <span>
                                                <a
                                                    href={`tel:${perfil.contacto_emergencia_telefono.replace(/\s/g, "")}`}
                                                    className="underline-offset-4 hover:underline"
                                                >
                                                    {perfil.contacto_emergencia_telefono}
                                                </a>
                                                <span className="ml-1.5 text-muted-foreground">
                                                    emergencia
                                                    {perfil.contacto_emergencia_nombre
                                                        ? ` · ${perfil.contacto_emergencia_nombre}`
                                                        : ""}
                                                </span>
                                            </span>
                                        </li>
                                    )}
                                </ul>
                            </Panel>
                        </div>
                    </div>

                    {datos.embarazos.length > 1 && (
                        <p className="mt-4 text-xs text-muted-foreground">
                            Tiene {datos.embarazos.length} embarazos registrados; abajo se
                            muestra el más reciente.
                        </p>
                    )}
                </Tarjeta>

                {/* --- Secciones -------------------------------------------- */}
                {embarazo ? (
                    <Tarjeta>
                        <Pestanas
                            ruta={ruta}
                            params={consulta}
                            pestanas={SECCIONES.map((s) => ({
                                valor: s.valor,
                                texto: s.texto,
                                icono: s.icono,
                            }))}
                            etiqueta="Secciones de la ficha"
                        />

                        {/* Solo la sección espera por el servidor: las pestañas
                            siguen montadas y se pueden volver a pulsar. */}
                        <Suspense
                            key={`${seccion}-${pagina}`}
                            fallback={<EsqueletoLista filas={3} />}
                        >
                            <Seccion
                                seccion={seccion}
                                embarazoId={embarazo.embarazo_id}
                                pagina={pagina}
                                ruta={ruta}
                                params={consulta}
                            />
                        </Suspense>
                    </Tarjeta>
                ) : (
                    <Tarjeta>
                        <EncabezadoTarjeta seccion="Seguimiento" />
                        <Vacio
                            icono={Baby}
                            titulo="Todavía no ha registrado su embarazo"
                            descripcion="La gestante lo registra desde su app con la fecha de su última menstruación. Hasta entonces no hay seguimiento que mostrar."
                        />
                    </Tarjeta>
                )}

                {!activo && embarazo && (
                    <p className="text-center text-xs text-muted-foreground">
                        Este embarazo está{" "}
                        <Insignia>{embarazo.estado.toLowerCase()}</Insignia>. Los datos se
                        conservan como histórico.
                    </p>
                )}
            </div>
        </>
    );
}
