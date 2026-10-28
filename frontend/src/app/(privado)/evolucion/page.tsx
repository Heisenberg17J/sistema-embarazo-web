import type { Metadata } from "next";
import { HeartPulse, Scale, TrendingUp } from "lucide-react";
import { DialogoMedicion } from "@/components/formularios/dialogo-medicion";
import { Saludo } from "@/components/layout/saludo";
import { GraficaEvolucion } from "@/components/paneles/grafica-evolucion";
import { SinEmbarazo } from "@/components/paneles/sin-embarazo";
import { Filtros, unParam } from "@/components/ui/filtros";
import { Insignia } from "@/components/ui/insignia";
import { EncabezadoTarjeta, Panel, Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import {
    embarazoActivo,
    serieMediciones,
    tiposMedicion,
    usuarioActual,
} from "@/lib/datos";
import { marcaTiempo, variacion } from "@/lib/formato";
import { ESTILO_SEVERIDAD } from "@/lib/severidad";
import { exigirRol } from "@/lib/sesion-servidor";
import type { PerfilGestante, SerieMediciones } from "@/lib/tipos";
import { severidadDeValor, ultimoValor } from "@/lib/umbrales";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Mi evolución" };

const PESO = "PESO";
const PRESION = ["PA_SISTOLICA", "PA_DIASTOLICA"];

export default async function PaginaEvolucion({
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
                    titulo="Mi evolución"
                    conFecha={false}
                    subtitulo="Aquí verás cómo cambian tus mediciones semana a semana."
                />
                <SinEmbarazo />
            </>
        );
    }

    const catalogo = await tiposMedicion();
    const [serie, usuario] = await Promise.all([
        serieMediciones(
            embarazo.embarazo_id,
            catalogo.map((t) => t.codigo),
        ),
        usuarioActual(),
    ]);

    const conDatos = (tipo: string) =>
        (serie.series.find((s) => s.tipo === tipo)?.puntos.length ?? 0) > 0;

    const buscar = (tipos: string[]) =>
        serie.series.filter((s) => tipos.includes(s.tipo));

    // Peso y presión salen siempre; el resto, solo los que tengan mediciones.
    const otros = catalogo.filter(
        (t) => t.codigo !== PESO && !PRESION.includes(t.codigo) && conDatos(t.codigo),
    );
    const elegido = unParam(params, "tipo");
    const otroActivo = otros.find((t) => t.codigo === elegido) ?? otros[0];

    const hayAlgo = conDatos(PESO) || PRESION.some(conDatos) || otros.length > 0;
    const perfil = usuario.perfil as PerfilGestante | null;

    return (
        <>
            <Saludo
                titulo="Mi evolución"
                conFecha={false}
                subtitulo="Las líneas punteadas marcan los valores de referencia. Cruzarlas no es un diagnóstico: es un aviso para que lo consultes."
                acciones={
                    <DialogoMedicion
                        tipos={catalogo.filter((t) => t.registrable_por_gestante)}
                        contactoNombre={perfil?.contacto_emergencia_nombre}
                        contactoTelefono={perfil?.contacto_emergencia_telefono}
                    />
                }
            />

            {!hayAlgo ? (
                <Tarjeta>
                    <Vacio
                        icono={TrendingUp}
                        titulo="Todavía no hay mediciones"
                        descripcion="Registra tu peso o tu presión arterial y aquí verás cómo evolucionan a lo largo del embarazo."
                    />
                </Tarjeta>
            ) : (
                <div className="space-y-5">
                    {embarazo.peso && (
                        <Tarjeta>
                            <EncabezadoTarjeta
                                seccion="Peso"
                                titulo="Tu ganancia de peso"
                                accion={
                                    <Insignia tono="marca">
                                        {embarazo.peso.categoria_imc}
                                    </Insignia>
                                }
                            />
                            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                <Panel className="text-center">
                                    <p className="text-[11px] text-muted-foreground">
                                        IMC antes del embarazo
                                    </p>
                                    <p className="mt-1 font-display text-xl font-semibold">
                                        {embarazo.peso.imc_pregestacional}
                                    </p>
                                </Panel>
                                <Panel className="text-center">
                                    <p className="text-[11px] text-muted-foreground">
                                        Has ganado
                                    </p>
                                    <p className="mt-1 font-display text-xl font-semibold">
                                        {embarazo.peso.ganancia_actual_kg != null
                                            ? variacion(embarazo.peso.ganancia_actual_kg)
                                            : "—"}
                                    </p>
                                </Panel>
                                <Panel className="text-center">
                                    <p className="text-[11px] text-muted-foreground">
                                        Recomendado en todo el embarazo
                                    </p>
                                    <p className="mt-1 font-display text-xl font-semibold">
                                        {embarazo.peso.ganancia_recomendada_kg.min}–
                                        {embarazo.peso.ganancia_recomendada_kg.max} kg
                                    </p>
                                </Panel>
                            </div>
                            <p className="mt-3 text-[11px] text-muted-foreground">
                                {embarazo.peso.nota}
                            </p>
                        </Tarjeta>
                    )}

                    {conDatos(PESO) && (
                        <TarjetaGrafica
                            seccion="Peso corporal"
                            titulo="Peso por semana"
                            icono={<Scale className="size-4" aria-hidden />}
                            series={buscar([PESO])}
                            serie={serie}
                            tipos={[PESO]}
                            unidad="kg"
                        />
                    )}

                    {PRESION.some(conDatos) && (
                        <TarjetaGrafica
                            seccion="Presión arterial"
                            titulo="Sistólica y diastólica"
                            icono={<HeartPulse className="size-4" aria-hidden />}
                            series={buscar(PRESION)}
                            serie={serie}
                            tipos={PRESION}
                            unidad="mmHg"
                        />
                    )}

                    {otroActivo && (
                        <Tarjeta>
                            <EncabezadoTarjeta
                                seccion="Otras mediciones"
                                titulo={otroActivo.nombre}
                            />
                            {otros.length > 1 && (
                                <Filtros
                                    ruta="/evolucion"
                                    params={params}
                                    nombre="tipo"
                                    etiqueta="Tipo de medición"
                                    opciones={otros.map((t) => ({
                                        valor: t.codigo,
                                        texto: t.nombre,
                                    }))}
                                    porDefecto={otros[0].codigo}
                                    className="mt-4"
                                />
                            )}
                            <GraficaEvolucion
                                series={buscar([otroActivo.codigo])}
                                unidad={otroActivo.unidad}
                            />
                            <UltimaLectura serie={serie} tipo={otroActivo.codigo} />
                        </Tarjeta>
                    )}
                </div>
            )}
        </>
    );
}

function TarjetaGrafica({
    seccion,
    titulo,
    icono,
    series,
    serie,
    tipos,
    unidad,
}: {
    seccion: string;
    titulo: string;
    icono: React.ReactNode;
    series: SerieMediciones["series"];
    serie: SerieMediciones;
    tipos: string[];
    unidad: string;
}) {
    return (
        <Tarjeta>
            <EncabezadoTarjeta
                seccion={seccion}
                titulo={
                    <span className="flex items-center gap-2 text-brand-deep">
                        {icono}
                        <span className="text-foreground">{titulo}</span>
                    </span>
                }
            />
            <GraficaEvolucion series={series} unidad={unidad} />
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {tipos.map((tipo) => (
                    <UltimaLectura key={tipo} serie={serie} tipo={tipo} />
                ))}
            </div>
        </Tarjeta>
    );
}

/** Último valor registrado, resaltado si cruza algún umbral. */
function UltimaLectura({
    serie,
    tipo,
}: {
    serie: SerieMediciones;
    tipo: string;
}) {
    const ultimo = ultimoValor(serie, tipo);
    if (!ultimo) return null;

    const info = serie.series.find((s) => s.tipo === tipo);
    const severidad = severidadDeValor(ultimo.valor, ultimo.referencias);
    const estilo = severidad ? ESTILO_SEVERIDAD[severidad] : null;

    return (
        <Panel className="mt-2 flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted-foreground">
                {info?.nombre}
                <span className="ml-1.5 text-[11px]">
                    · {marcaTiempo(ultimo.fecha)}
                </span>
            </span>
            <span
                className={cn(
                    "font-display text-lg font-semibold",
                    estilo && estilo.texto,
                )}
            >
                {ultimo.valor} {ultimo.unidad}
            </span>
        </Panel>
    );
}
