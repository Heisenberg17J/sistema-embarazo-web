import type { Metadata } from "next";
import { ShieldAlert, SlidersHorizontal } from "lucide-react";
import { cambiarEstadoRegla } from "@/acciones/admin";
import { BotonAccion } from "@/components/admin/boton-accion";
import { DialogoConfirmar } from "@/components/admin/dialogo-confirmar";
import { DialogoRegla } from "@/components/admin/dialogo-regla";
import { Saludo } from "@/components/layout/saludo";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { EncabezadoTarjeta, Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";
import { catalogoCompleto, reglasAlerta } from "@/lib/datos";
import { condicionRegla, semanasRegla } from "@/lib/reglas";
import { ESTILO_SEVERIDAD, PESO_SEVERIDAD } from "@/lib/severidad";
import { exigirRol } from "@/lib/sesion-servidor";
import type { ReglaAlerta, TipoMedicion } from "@/lib/tipos";

export const metadata: Metadata = { title: "Reglas de alerta" };

export default async function PaginaReglas() {
    await exigirRol("ADMINISTRADOR");
    const [reglas, tipos] = await Promise.all([
        reglasAlerta(),
        catalogoCompleto<TipoMedicion>("tipos-medicion"),
    ]);

    // Agrupadas por medición, en el orden del catálogo; lo más severo primero.
    const grupos = tipos
        .map((t) => ({
            tipo: t,
            reglas: reglas
                .filter((r) => r.tipo_medicion === t.codigo)
                .sort(
                    (a, b) =>
                        Number(b.activa) - Number(a.activa) ||
                        PESO_SEVERIDAD[a.severidad] - PESO_SEVERIDAD[b.severidad],
                ),
        }))
        .filter((g) => g.reglas.length > 0);
    const activos = tipos.filter((t) => t.activo);

    return (
        <>
            <Saludo
                titulo="Reglas de alerta"
                conFecha={false}
                subtitulo="Umbrales que generan alertas al registrar una medición. Los cambios rigen para lo que se registre desde ahora."
                acciones={<DialogoRegla tipos={activos} />}
            />

            <div className="space-y-5">
                <p className="glass-soft flex items-start gap-3 rounded-2xl p-4 text-sm leading-relaxed">
                    <ShieldAlert className="mt-0.5 size-5 shrink-0 text-advertencia" aria-hidden />
                    <span>
                        Las alertas orientan a la gestante y a su profesional, no son un
                        diagnóstico. Ajusta estos umbrales solo con criterio clínico: un
                        cambio afecta a todas las gestantes. Los signos de alarma de los
                        síntomas se configuran en Catálogos.
                    </span>
                </p>

                {grupos.length === 0 ? (
                    <Tarjeta>
                        <Vacio
                            icono={SlidersHorizontal}
                            titulo="No hay reglas"
                            descripcion="Sin reglas, ninguna medición generará alertas."
                        />
                    </Tarjeta>
                ) : (
                    grupos.map(({ tipo, reglas: suyas }) => (
                        <Tarjeta key={tipo.codigo}>
                            <EncabezadoTarjeta
                                seccion={tipo.unidad}
                                titulo={tipo.nombre}
                                accion={!tipo.activo ? <Insignia>Medición inactiva</Insignia> : undefined}
                            />
                            <ul className="mt-4 space-y-2">
                                {suyas.map((r) => (
                                    <ItemRegla key={r.id} regla={r} tipos={activos} />
                                ))}
                            </ul>
                        </Tarjeta>
                    ))
                )}
            </div>
        </>
    );
}

function ItemRegla({ regla: r, tipos }: { regla: ReglaAlerta; tipos: TipoMedicion[] }) {
    const estilo = ESTILO_SEVERIDAD[r.severidad];
    return (
        <li
            className={`glass-soft rounded-2xl border-l-4 p-4 ${r.activa ? estilo.borde : "border-l-transparent opacity-70"}`}
        >
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="font-display text-lg font-medium">{condicionRegla(r)}</p>
                    <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{r.codigo}</span> ·{" "}
                        {semanasRegla(r.semana_desde, r.semana_hasta)}
                    </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    <Insignia tono={estilo.tono}>
                        <estilo.icono aria-hidden />
                        {estilo.etiqueta}
                    </Insignia>
                    {!r.activa && <Insignia>Inactiva</Insignia>}
                    {r.activa && !r.aprobada_en && (
                        <Insignia tono="advertencia">Sin aprobación clínica</Insignia>
                    )}
                </div>
            </div>

            <p className="mt-2 text-sm leading-relaxed">{r.mensaje}</p>

            <div className="mt-2 flex flex-wrap items-start justify-end gap-1">
                <DialogoRegla regla={r} tipos={tipos} />
                {r.activa ? (
                    <DialogoConfirmar
                        titulo="Desactivar la regla"
                        descripcion={`${r.codigo} · ${condicionRegla(r)}`}
                        accion={cambiarEstadoRegla}
                        campos={{ regla_id: r.id, activa: "false" }}
                        textoConfirmar="Desactivar"
                        peligro
                        disparador={
                            <Boton variante="fantasma" tamano="sm">
                                Desactivar
                            </Boton>
                        }
                    >
                        Las mediciones que se registren desde ahora ya no generarán esta
                        alerta. Las alertas que ya existen no cambian.
                    </DialogoConfirmar>
                ) : (
                    <BotonAccion accion={cambiarEstadoRegla} campos={{ regla_id: r.id, activa: "true" }}>
                        Reactivar
                    </BotonAccion>
                )}
            </div>
        </li>
    );
}
