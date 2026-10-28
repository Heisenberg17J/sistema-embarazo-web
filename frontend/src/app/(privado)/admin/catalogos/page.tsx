import type { Metadata } from "next";
import { ClipboardList, FlaskConical, ListTree, Ruler, Stethoscope } from "lucide-react";
import { cambiarEstadoCatalogo, type RutaCatalogo } from "@/acciones/admin";
import { DialogoCatalogo, SINGULAR, type RegistroCatalogo } from "@/components/admin/dialogo-catalogo";
import { BotonAccion } from "@/components/admin/boton-accion";
import { DialogoConfirmar } from "@/components/admin/dialogo-confirmar";
import { Saludo } from "@/components/layout/saludo";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Pestanas, pestanaActiva, type Pestana } from "@/components/ui/pestanas";
import { EncabezadoTarjeta, Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { catalogoCompleto } from "@/lib/datos";
import { SEVERIDAD_TEXTO } from "@/lib/formato";
import { ESTILO_SEVERIDAD } from "@/lib/severidad";
import { exigirRol } from "@/lib/sesion-servidor";
import type { TipoControl, TipoExamen, TipoMedicion, TipoSintoma } from "@/lib/tipos";

export const metadata: Metadata = { title: "Catálogos" };

const SECCIONES: (Pestana & { valor: RutaCatalogo; descripcion: string })[] = [
    {
        valor: "tipos-control",
        texto: "Controles",
        icono: Stethoscope,
        descripcion: "Tipos de cita y control prenatal que puede programar el profesional.",
    },
    {
        valor: "tipos-examen",
        texto: "Exámenes",
        icono: FlaskConical,
        descripcion: "Exámenes cuyos resultados registra el profesional.",
    },
    {
        valor: "tipos-sintoma",
        texto: "Síntomas",
        icono: ClipboardList,
        descripcion: "Síntomas que la gestante elige al registrar. Los signos de alarma generan una alerta inmediata.",
    },
    {
        valor: "tipos-medicion",
        texto: "Mediciones",
        icono: Ruler,
        descripcion: "Variables que se registran y grafican, con su rango técnico válido.",
    },
];

type Params = Record<string, string | string[] | undefined>;

export default async function PaginaCatalogos({
    searchParams,
}: {
    searchParams: Promise<Params>;
}) {
    await exigirRol("ADMINISTRADOR");
    const params = await searchParams;
    const catalogo = pestanaActiva(
        params,
        SECCIONES.map((s) => s.valor),
    ) as RutaCatalogo;
    const seccion = SECCIONES.find((s) => s.valor === catalogo)!;

    const registros = await catalogoCompleto<RegistroCatalogo>(catalogo);
    // Activos primero; dentro de cada grupo, el orden alfabético de la API.
    const ordenados = [...registros].sort((a, b) => Number(b.activo) - Number(a.activo));

    return (
        <>
            <Saludo
                titulo="Catálogos"
                conFecha={false}
                subtitulo="Amplía las opciones del sistema sin tocar el código. Lo que tiene historial no se borra: se desactiva."
            />

            <Tarjeta>
                <Pestanas
                    ruta="/admin/catalogos"
                    params={params}
                    pestanas={SECCIONES}
                    etiqueta="Catálogos"
                />

                <EncabezadoTarjeta
                    className="mt-4"
                    titulo={seccion.texto}
                    descripcion={seccion.descripcion}
                    accion={<DialogoCatalogo catalogo={catalogo} />}
                />

                {ordenados.length === 0 ? (
                    <Vacio icono={ListTree} titulo="Este catálogo está vacío" />
                ) : (
                    <ul className="mt-4 space-y-2">
                        {ordenados.map((r) => (
                            <li
                                key={r.id}
                                className="glass-soft flex flex-col gap-2 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="min-w-0">
                                    <p className="flex flex-wrap items-center gap-2 font-medium">
                                        {r.nombre}
                                        {!r.activo && <Insignia>Inactivo</Insignia>}
                                    </p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        <span className="font-mono">{r.codigo}</span>
                                        {detalle(catalogo, r) && ` · ${detalle(catalogo, r)}`}
                                    </p>
                                    {catalogo === "tipos-sintoma" &&
                                        (r as TipoSintoma).es_signo_alarma && (
                                            <SignoAlarma sintoma={r as TipoSintoma} />
                                        )}
                                </div>

                                <div className="flex shrink-0 flex-wrap items-start justify-end gap-1">
                                    <DialogoCatalogo catalogo={catalogo} registro={r} />
                                    {r.activo ? (
                                        <DialogoConfirmar
                                            titulo={`Desactivar ${SINGULAR[catalogo]}`}
                                            descripcion={r.nombre}
                                            accion={cambiarEstadoCatalogo}
                                            campos={{ catalogo, registro_id: r.id, activo: "false" }}
                                            textoConfirmar="Desactivar"
                                            peligro
                                            disparador={
                                                <Boton variante="fantasma" tamano="sm">
                                                    Desactivar
                                                </Boton>
                                            }
                                        >
                                            Dejará de ofrecerse en los formularios. Los registros
                                            que ya lo usan se conservan y siguen mostrándolo.
                                        </DialogoConfirmar>
                                    ) : (
                                        <BotonAccion
                                            accion={cambiarEstadoCatalogo}
                                            campos={{ catalogo, registro_id: r.id, activo: "true" }}
                                        >
                                            Reactivar
                                        </BotonAccion>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Tarjeta>
        </>
    );
}

/** Dato secundario de cada registro, según el catálogo. */
function detalle(catalogo: RutaCatalogo, r: RegistroCatalogo) {
    switch (catalogo) {
        case "tipos-control":
            return `${(r as TipoControl).duracion_min} min`;
        case "tipos-examen":
            return (r as TipoExamen).descripcion;
        case "tipos-medicion": {
            const m = r as TipoMedicion;
            return [
                `${m.valor_min}–${m.valor_max} ${m.unidad}`,
                m.registrable_por_gestante ? "la registra la gestante" : "solo el profesional",
            ].join(" · ");
        }
        default:
            return null;
    }
}

function SignoAlarma({ sintoma }: { sintoma: TipoSintoma }) {
    const estilo = sintoma.severidad ? ESTILO_SEVERIDAD[sintoma.severidad] : null;
    return (
        <div className="mt-2 space-y-1">
            <div className="flex flex-wrap gap-1.5">
                <Insignia tono={estilo?.tono ?? "advertencia"}>
                    {estilo && <estilo.icono aria-hidden />}
                    Signo de alarma
                    {sintoma.severidad && ` · ${SEVERIDAD_TEXTO[sintoma.severidad]}`}
                </Insignia>
                {sintoma.alarma_hasta_semana && (
                    <Insignia>Antes de la semana {sintoma.alarma_hasta_semana}</Insignia>
                )}
            </div>
            {sintoma.mensaje_alarma && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                    {sintoma.mensaje_alarma}
                </p>
            )}
        </div>
    );
}
