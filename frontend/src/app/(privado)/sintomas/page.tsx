import type { Metadata } from "next";
import { Activity, TriangleAlert } from "lucide-react";
import { Saludo } from "@/components/layout/saludo";
import { eliminarSintoma } from "@/acciones/correcciones";
import { DialogoCorregirSintoma } from "@/components/formularios/dialogo-corregir-sintoma";
import { DialogoEliminar } from "@/components/formularios/dialogo-eliminar";
import { DialogoSintoma } from "@/components/formularios/dialogo-sintoma";
import { SinEmbarazo } from "@/components/paneles/sin-embarazo";
import { Insignia } from "@/components/ui/insignia";
import { ANCLA_LISTA, Paginacion } from "@/components/ui/paginacion";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { embarazoActivo, sintomas, tiposSintoma, usuarioActual } from "@/lib/datos";
import { capitalizar, fechaLarga } from "@/lib/formato";
import { ESTILO_SEVERIDAD } from "@/lib/severidad";
import { exigirRol } from "@/lib/sesion-servidor";
import type { PerfilGestante } from "@/lib/tipos";

export const metadata: Metadata = { title: "Mis síntomas" };

const INTENSIDAD_TEXTO = ["", "Muy leve", "Leve", "Moderado", "Fuerte", "Muy fuerte"];

export default async function PaginaSintomas({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    await exigirRol("GESTANTE");
    const params = await searchParams;
    const embarazo = await embarazoActivo();

    if (!embarazo) {
        return (
            <>
                <Saludo
                    titulo="Mis síntomas"
                    conFecha={false}
                    subtitulo="Aquí anotarás cómo te sientes durante el embarazo."
                />
                <SinEmbarazo />
            </>
        );
    }

    const pagina = Number(params.page) || 1;
    const [lista, catalogo, usuario] = await Promise.all([
        sintomas(embarazo.embarazo_id, { page: pagina, limit: 15 }),
        tiposSintoma(),
        usuarioActual(),
    ]);

    const perfil = usuario.perfil as PerfilGestante | null;

    return (
        <>
            <Saludo
                titulo="Mis síntomas"
                conFecha={false}
                subtitulo="Lo que anotes aquí lo puede consultar tu profesional en el control."
                acciones={
                    <DialogoSintoma
                        tipos={catalogo}
                        contactoNombre={perfil?.contacto_emergencia_nombre}
                        contactoTelefono={perfil?.contacto_emergencia_telefono}
                    />
                }
            />

            <Tarjeta indice={0} id={ANCLA_LISTA} className="scroll-mt-4">
                {lista.datos.length === 0 ? (
                    <Vacio
                        icono={Activity}
                        ilustracion
                        titulo="Todavía no has registrado síntomas"
                        descripcion="Anotar cómo te sientes ayuda a tu profesional a entender cómo va tu embarazo. Si algo te preocupa, no esperes al control."
                    />
                ) : (
                    <ul className="space-y-3">
                        {lista.datos.map((sintoma) => {
                            const severidad = sintoma.alerta_severidad;
                            const estilo = severidad
                                ? ESTILO_SEVERIDAD[severidad]
                                : null;

                            return (
                                <li
                                    key={sintoma.id}
                                    className="glass-soft rounded-2xl p-4"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                                        <div className="min-w-0">
                                            <p className="font-medium text-balance">
                                                {sintoma.descripcion}
                                            </p>
                                            <p className="mt-0.5 text-sm text-muted-foreground">
                                                {capitalizar(fechaLarga(sintoma.fecha))}
                                                {sintoma.semana_gestacion != null &&
                                                    ` · semana ${sintoma.semana_gestacion}`}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            {sintoma.intensidad && (
                                                <Insignia>
                                                    {INTENSIDAD_TEXTO[sintoma.intensidad]}
                                                </Insignia>
                                            )}
                                            {estilo && (
                                                <Insignia tono={estilo.tono}>
                                                    <TriangleAlert aria-hidden />
                                                    {estilo.etiqueta}
                                                </Insignia>
                                            )}
                                        </div>
                                    </div>

                                    {sintoma.observaciones && (
                                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                            {sintoma.observaciones}
                                        </p>
                                    )}

                                    {sintoma.alerta_estado === "REVISADA" && (
                                        <p className="mt-2 text-xs font-medium text-exito">
                                            Tu profesional ya revisó esta alerta.
                                        </p>
                                    )}

                                    {/* Solo si la ventana de corrección sigue abierta: lo decide el servidor. */}
                                    {sintoma.editable && (
                                        <div className="mt-3 flex flex-wrap items-center justify-end gap-1 border-t border-border-firme pt-2">
                                            <span className="mr-auto text-[11px] text-muted-foreground">
                                                ¿Te equivocaste? Puedes corregirlo durante las 24 horas siguientes a haberlo guardado.
                                            </span>
                                            <DialogoCorregirSintoma
                                                embarazoId={embarazo.embarazo_id}
                                                sintoma={sintoma}
                                                tipos={catalogo}
                                                contactoNombre={perfil?.contacto_emergencia_nombre}
                                                contactoTelefono={perfil?.contacto_emergencia_telefono}
                                            />
                                            <DialogoEliminar
                                                titulo="Eliminar este síntoma"
                                                descripcion={sintoma.descripcion}
                                                accion={eliminarSintoma}
                                                embarazoId={embarazo.embarazo_id}
                                                elementoId={sintoma.id}
                                            >
                                                <p>Dejará de aparecer en tu historial.</p>
                                            </DialogoEliminar>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}

                <Paginacion
                    ruta="/sintomas"
                    params={params}
                    paginacion={lista.paginacion}
                    etiqueta="síntomas"
                />
            </Tarjeta>
        </>
    );
}
