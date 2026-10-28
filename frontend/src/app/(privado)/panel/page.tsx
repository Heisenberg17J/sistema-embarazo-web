import type { Metadata } from "next";
import Link from "next/link";
import {
    Activity,
    BellRing,
    CalendarClock,
    CalendarDays,
    ChevronRight,
    ClipboardList,
    Phone,
    BookOpen,
    Target,
} from "lucide-react";
import { DialogoMedicion } from "@/components/formularios/dialogo-medicion";
import { DialogoSintoma } from "@/components/formularios/dialogo-sintoma";
import { Saludo } from "@/components/layout/saludo";
import { AlertaItem } from "@/components/paneles/alerta-item";
import { AnilloGestacion } from "@/components/paneles/anillo-gestacion";
import { MiniEvolucion } from "@/components/paneles/mini-evolucion";
import { AvisoContacto } from "@/components/paneles/aviso-contacto";
import { SinEmbarazo } from "@/components/paneles/sin-embarazo";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import {
    CasillaDato,
    EncabezadoTarjeta,
    Panel,
    Tarjeta,
} from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import {
    controles,
    panelDeGestante,
    serieMediciones,
    sintomas,
    tiposMedicion,
    tiposSintoma,
    usuarioActual,
} from "@/lib/datos";
import {
    edadGestacionalLegible,
    fechaCompleta,
    fechaConHora,
    nombreTrimestre,
    progresoGestacion,
} from "@/lib/formato";
import { exigirRol } from "@/lib/sesion-servidor";
import type { PerfilGestante } from "@/lib/tipos";

export const metadata: Metadata = { title: "Panel" };

const TIPOS_GRAFICA = ["PESO", "PA_SISTOLICA", "PA_DIASTOLICA"];

const textoAnticipacion = (dias: number) =>
    dias <= 0 ? "Es hoy" : dias === 1 ? "Es mañana" : `Faltan ${dias} días`;

export default async function PaginaPanel() {
    const sesion = await exigirRol("GESTANTE");
    const datos = await panelDeGestante();

    // Sin embarazo activo la gestante no tiene nada que seguir todavía.
    if (!datos.embarazo) {
        return (
            <>
                <Saludo
                    nombre={sesion.nombre}
                    subtitulo="Para empezar, registra los datos de tu embarazo."
                />
                <SinEmbarazo />
            </>
        );
    }

    const embarazo = datos.embarazo;
    const id = embarazo.embarazo_id;

    const [serie, ultimosSintomas, ultimoControl, usuario, catalogoMedicion, catalogoSintoma] =
        await Promise.all([
            serieMediciones(id, TIPOS_GRAFICA),
            sintomas(id, { limit: 4 }),
            controles(id, { limit: 1 }),
            usuarioActual(),
            tiposMedicion(),
            tiposSintoma(),
        ]);

    const perfil = usuario.perfil as PerfilGestante | null;
    const contacto = {
        contactoNombre: perfil?.contacto_emergencia_nombre ?? null,
        contactoTelefono: perfil?.contacto_emergencia_telefono ?? null,
    };

    const control = ultimoControl.datos[0];
    const progreso = progresoGestacion(embarazo.semana_actual);

    return (
        <>
            <Saludo
                nombre={sesion.nombre}
                subtitulo={
                    embarazo.semana_actual != null
                        ? `Aquí tienes el resumen de tu semana ${embarazo.semana_actual}.`
                        : "Aquí tienes el resumen de tu seguimiento."
                }
                acciones={
                    <>
                        <DialogoSintoma
                            tipos={catalogoSintoma}
                            {...contacto}
                        />
                        <DialogoMedicion
                            tipos={catalogoMedicion.filter((t) => t.registrable_por_gestante)}
                            {...contacto}
                        />
                    </>
                }
            />

            <div className="space-y-5">
                {/* Sin este dato, el aviso de atención inmediata no puede
                    ofrecer a quién llamar. */}
                {!contacto.contactoTelefono && <AvisoContacto />}

                {/* --- Gestación y alertas ------------------------------------ */}
                <div className="grid items-start gap-5 lg:grid-cols-3">
                    <Tarjeta className="lg:col-span-2">
                        <EncabezadoTarjeta
                            seccion="Tu gestación"
                            accion={
                                <Insignia tono="marca">
                                    {nombreTrimestre(embarazo.trimestre)}
                                </Insignia>
                            }
                        />

                        <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row">
                            <AnilloGestacion
                                semana={embarazo.semana_actual}
                                edadGestacional={embarazo.edad_gestacional}
                            />

                            <div className="grid w-full flex-1 gap-3 sm:grid-cols-2">
                                <CasillaDato
                                    etiqueta="Fecha estimada de parto"
                                    icono={<CalendarDays className="size-4" aria-hidden />}
                                    valor={fechaCompleta(embarazo.fecha_estimada_parto)}
                                />
                                <CasillaDato
                                    etiqueta="Progreso"
                                    icono={<Target className="size-4" aria-hidden />}
                                    valor={
                                        <>
                                            {progreso}%
                                            {embarazo.dias_para_parto != null && (
                                                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                                                    · faltan {embarazo.dias_para_parto} días
                                                </span>
                                            )}
                                        </>
                                    }
                                />

                                <Panel className="sm:col-span-2">
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                        Próxima cita
                                    </p>
                                    {datos.proxima_cita ? (
                                        <div className="mt-2 flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate font-medium">
                                                    {datos.proxima_cita.profesional} ·{" "}
                                                    {datos.proxima_cita.tipo_control}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {fechaConHora(
                                                        datos.proxima_cita.fecha,
                                                        datos.proxima_cita.hora,
                                                    )}
                                                </p>
                                                {datos.proxima_cita.recordatorio && (
                                                    <Insignia tono="advertencia" className="mt-2">
                                                        <CalendarClock aria-hidden />
                                                        {textoAnticipacion(datos.proxima_cita.dias_para)}
                                                    </Insignia>
                                                )}
                                            </div>
                                            <Boton
                                                comoHijo
                                                variante="fantasma"
                                                tamano="iconoSm"
                                                aria-label="Ver mis citas"
                                            >
                                                <Link href="/citas">
                                                    <ChevronRight aria-hidden />
                                                </Link>
                                            </Boton>
                                        </div>
                                    ) : (
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            No tienes citas programadas. Tu profesional de salud
                                            las agenda.
                                        </p>
                                    )}
                                </Panel>

                                <Panel className="sm:col-span-2">
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                        {datos.profesionales.length > 1 ? "Tu equipo de salud" : "Tu profesional de salud"}
                                    </p>
                                    {datos.profesionales.length === 0 ? (
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            Todavía no tienes un profesional asignado. Cuando se te
                                            asigne uno, aquí verás cómo contactarle.
                                        </p>
                                    ) : (
                                        <ul className="mt-2 space-y-3">
                                            {datos.profesionales.map((p) => (
                                                <li
                                                    key={p.id}
                                                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2"
                                                >
                                                    <div className="min-w-0">
                                                        {/* Sin truncate: un texto que no se parte fija el ancho mínimo de la
                                                            columna y ensancha toda la página en móvil. */}
                                                        <p className="break-words font-medium">{p.nombre}</p>
                                                        <p className="break-words text-sm text-muted-foreground">
                                                            {[p.especialidad, p.institucion]
                                                                .filter(Boolean)
                                                                .join(" · ")}
                                                        </p>
                                                    </div>
                                                    {p.telefono && (
                                                        <Boton comoHijo variante="contorno" tamano="sm">
                                                            <a
                                                                href={`tel:${p.telefono.replace(/[^\d+]/g, "")}`}
                                                                aria-label={`Llamar a ${p.nombre}`}
                                                            >
                                                                <Phone aria-hidden />
                                                                {p.telefono}
                                                            </a>
                                                        </Boton>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </Panel>
                            </div>
                        </div>

                        <p className="mt-4 text-center text-xs text-muted-foreground">
                            ¿Algún dato no está bien?{" "}
                            <Link
                                href="/embarazo"
                                className="font-semibold text-brand-deep underline-offset-4 hover:underline"
                            >
                                Revisa y corrige tu embarazo
                            </Link>
                        </p>

                        {embarazo.peso && (
                            <Panel className="mt-3">
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                        Peso · {embarazo.peso.categoria_imc} (IMC{" "}
                                        {embarazo.peso.imc_pregestacional})
                                    </p>
                                    <p className="text-sm font-medium">
                                        {embarazo.peso.ganancia_actual_kg != null
                                            ? `Has ganado ${embarazo.peso.ganancia_actual_kg} kg`
                                            : "Sin peso registrado aún"}
                                        <span className="font-normal text-muted-foreground">
                                            {" "}
                                            · recomendado{" "}
                                            {embarazo.peso.ganancia_recomendada_kg.min}–
                                            {embarazo.peso.ganancia_recomendada_kg.max} kg
                                        </span>
                                    </p>
                                </div>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                    {embarazo.peso.nota}
                                </p>
                            </Panel>
                        )}
                    </Tarjeta>

                    <Tarjeta>
                        <EncabezadoTarjeta
                            seccion="Alertas informativas"
                            accion={
                                datos.alertas_pendientes.length > 0 ? (
                                    <Insignia tono="critica">
                                        {datos.alertas_pendientes.length} sin revisar
                                    </Insignia>
                                ) : undefined
                            }
                        />

                        {datos.alertas_pendientes.length === 0 ? (
                            <Vacio
                                icono={BellRing}
                                titulo="Sin alertas pendientes"
                                descripcion="Te avisamos aquí si algún valor que registres sale del rango esperado."
                            />
                        ) : (
                            <div className="mt-4 space-y-3">
                                {datos.alertas_pendientes.map((alerta) => (
                                    <AlertaItem
                                        key={alerta.id}
                                        severidad={alerta.severidad}
                                        mensaje={alerta.mensaje}
                                        generadaEn={alerta.generada_en}
                                    />
                                ))}
                            </div>
                        )}

                        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                            {datos.aviso}
                        </p>

                        {datos.alertas_pendientes.length > 0 && (
                            <Boton
                                comoHijo
                                variante="vidrio"
                                tamano="sm"
                                ancho="completo"
                                className="mt-3"
                            >
                                <Link href="/alertas">Ver todas mis alertas</Link>
                            </Boton>
                        )}
                    </Tarjeta>
                </div>

                {/* --- Evolución y contenido de la semana --------------------- */}
                <div className="grid items-start gap-5 lg:grid-cols-3">
                    <MiniEvolucion serie={serie} />

                    <Tarjeta>
                        <EncabezadoTarjeta
                            seccion={
                                embarazo.semana_actual != null
                                    ? `Semana ${embarazo.semana_actual}`
                                    : "Para ti"
                            }
                            titulo="Para esta semana"
                        />

                        {datos.contenido_semana.length === 0 ? (
                            <Vacio
                                icono={BookOpen}
                                titulo="Sin contenido para esta semana"
                                descripcion="Pronto encontrarás aquí información útil para tu etapa."
                            />
                        ) : (
                            <div className="mt-4 space-y-3">
                                {datos.contenido_semana.map((contenido) => (
                                    <Link
                                        key={contenido.id}
                                        href={`/aprendizaje/${contenido.id}`}
                                        className="glass-soft flex w-full items-center justify-between gap-3 rounded-2xl p-4 text-left transition-colors hover:bg-surface-strong"
                                    >
                                        <span className="min-w-0">
                                            <span className="block text-sm font-semibold text-balance">
                                                {contenido.titulo}
                                            </span>
                                            {contenido.categoria && (
                                                <span className="mt-1 block text-xs text-muted-foreground">
                                                    {contenido.categoria}
                                                </span>
                                            )}
                                        </span>
                                        {contenido.leido ? (
                                            <Insignia tono="exito">Leído</Insignia>
                                        ) : (
                                            <ChevronRight
                                                className="size-4 shrink-0 text-muted-foreground"
                                                aria-hidden
                                            />
                                        )}
                                    </Link>
                                ))}
                            </div>
                        )}

                        <Boton
                            comoHijo
                            variante="vidrio"
                            tamano="sm"
                            ancho="completo"
                            className="mt-4"
                        >
                            <Link href="/aprendizaje">Ver todos los contenidos</Link>
                        </Boton>
                    </Tarjeta>
                </div>

                {/* --- Síntomas y último control ------------------------------ */}
                <div className="grid items-start gap-5 lg:grid-cols-3">
                    <Tarjeta className="lg:col-span-2">
                        <EncabezadoTarjeta
                            seccion="Síntomas recientes"
                            accion={
                                <Boton comoHijo variante="fantasma" tamano="sm">
                                    <Link href="/sintomas">
                                        Ver todos
                                        <ChevronRight aria-hidden />
                                    </Link>
                                </Boton>
                            }
                        />

                        {ultimosSintomas.datos.length === 0 ? (
                            <Vacio
                                icono={Activity}
                                titulo="No has registrado síntomas"
                                descripcion="Anotarlos ayuda a tu profesional a entender cómo va tu embarazo."
                            />
                        ) : (
                            <ul className="mt-4 flex flex-wrap gap-2">
                                {ultimosSintomas.datos.map((sintoma) => (
                                    <li key={sintoma.id}>
                                        <Insignia
                                            tono={
                                                sintoma.alerta_severidad === "CRITICA"
                                                    ? "critica"
                                                    : sintoma.alerta_severidad === "ADVERTENCIA"
                                                      ? "advertencia"
                                                      : "neutro"
                                            }
                                            className="px-3.5 py-2 text-sm"
                                        >
                                            {sintoma.descripcion}
                                            {sintoma.intensidad && (
                                                <span className="text-muted-foreground">
                                                    · {sintoma.intensidad}/5
                                                </span>
                                            )}
                                        </Insignia>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Tarjeta>

                    <Tarjeta>
                        <EncabezadoTarjeta seccion="Último control" />
                        {control ? (
                            <div className="mt-3">
                                <p className="font-display text-lg font-medium">
                                    Control prenatal{" · "}
                                    <span className="text-muted-foreground">
                                        Semana {control.semana_gestacion}
                                    </span>
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {control.observaciones ?? "Sin observaciones pendientes"}
                                </p>
                                <p className="mt-2 text-xs text-muted-foreground">
                                    {control.profesional} · {fechaCompleta(control.fecha)}
                                </p>
                                {control.mediciones.length > 0 && (
                                    <ul className="mt-3 flex flex-wrap gap-1.5">
                                        {control.mediciones.map((m) => (
                                            <li key={m.tipo}>
                                                <Insignia>
                                                    {m.nombre}: {m.valor} {m.unidad}
                                                </Insignia>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ) : (
                            <Vacio
                                icono={ClipboardList}
                                titulo="Sin controles registrados"
                                descripcion="Tu profesional registrará aquí cada control prenatal."
                            />
                        )}

                        {embarazo.edad_gestacional && (
                            <p className="mt-4 text-xs text-muted-foreground">
                                {edadGestacionalLegible(embarazo.edad_gestacional)}
                            </p>
                        )}
                    </Tarjeta>
                </div>
            </div>
        </>
    );
}
