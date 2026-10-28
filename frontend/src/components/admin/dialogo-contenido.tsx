"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { BookPlus, Pencil, Save } from "lucide-react";
import { guardarContenido, type ResultadoAdmin } from "@/acciones/admin";
import { DialogoAccion } from "@/components/formularios/dialogo-accion";
import { Boton } from "@/components/ui/boton";
import { AvisoExito } from "@/components/ui/aviso-exito";
import { AvisoError, Campo } from "@/components/ui/campo";
import type { Contenido } from "@/lib/tipos";

const INICIAL: ResultadoAdmin = {};

/** RF-16. Crea un contenido educativo o edita uno existente. */
export function DialogoContenido({
    contenido,
    categorias,
}: {
    /** Si viene, se edita; si no, se crea uno nuevo. */
    contenido?: Contenido;
    /** Categorías ya usadas, como sugerencias. */
    categorias: string[];
}) {
    return (
        <DialogoAccion
            titulo={contenido ? "Editar contenido" : "Nuevo contenido"}
            descripcion="Las gestantes lo ven en “Aprendizaje” cuando su semana de gestación cae dentro del rango."
            disparador={
                contenido ? (
                    <Boton variante="fantasma" tamano="sm">
                        <Pencil aria-hidden />
                        Editar
                    </Boton>
                ) : (
                    <Boton>
                        <BookPlus aria-hidden />
                        Nuevo contenido
                    </Boton>
                )
            }
        >
            {({ onExito }) => (
                <Formulario contenido={contenido} categorias={categorias} onExito={onExito} />
            )}
        </DialogoAccion>
    );
}

function Formulario({
    contenido,
    categorias,
    onExito,
}: {
    contenido?: Contenido;
    categorias: string[];
    onExito: () => void;
}) {
    const [estado, enviar, enviando] = useActionState(guardarContenido, INICIAL);
    const e = estado.porCampo ?? {};
    const v = estado.valores ?? {};
    const idLista = useId();
    // Controlada: tras un error React restablece el formulario y la casilla
    // volvería a su estado inicial.
    const [publicado, setPublicado] = useState(contenido?.publicado ?? false);

    useEffect(() => {
        if (estado.ok) onExito();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estado]);

    if (estado.ok) return <AvisoExito>{estado.resumen}</AvisoExito>;

    const inicial = (campo: keyof Contenido) =>
        v[campo] ?? (contenido?.[campo] != null ? String(contenido[campo]) : "");

    return (
        <form action={enviar} className="space-y-4" noValidate>
            {contenido && <input type="hidden" name="contenido_id" value={contenido.id} />}
            <AvisoError>{estado.error}</AvisoError>

            <Campo etiqueta="Título" obligatorio error={e.titulo}>
                {(p) => (
                    <input
                        {...p}
                        name="titulo"
                        maxLength={160}
                        defaultValue={inicial("titulo")}
                        required
                    />
                )}
            </Campo>

            <Campo
                etiqueta="Categoría"
                error={e.categoria}
                ayuda="Agrupa los contenidos. Puedes elegir una existente o escribir una nueva."
            >
                {(p) => (
                    <>
                        <input
                            {...p}
                            name="categoria"
                            maxLength={60}
                            list={idLista}
                            defaultValue={inicial("categoria")}
                        />
                        <datalist id={idLista}>
                            {categorias.map((c) => (
                                <option key={c} value={c} />
                            ))}
                        </datalist>
                    </>
                )}
            </Campo>

            <div className="grid grid-cols-2 gap-4">
                <Campo etiqueta="Desde la semana" obligatorio error={e.semana_desde}>
                    {(p) => (
                        <input
                            {...p}
                            name="semana_desde"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={45}
                            defaultValue={inicial("semana_desde")}
                            required
                        />
                    )}
                </Campo>
                <Campo etiqueta="Hasta la semana" obligatorio error={e.semana_hasta}>
                    {(p) => (
                        <input
                            {...p}
                            name="semana_hasta"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={45}
                            defaultValue={inicial("semana_hasta")}
                            required
                        />
                    )}
                </Campo>
            </div>

            <Campo
                etiqueta="Contenido"
                obligatorio
                error={e.cuerpo}
                ayuda="Texto plano. Los saltos de línea se respetan; no se interpreta HTML."
            >
                {(p) => (
                    <textarea
                        {...p}
                        name="cuerpo"
                        rows={10}
                        maxLength={20000}
                        defaultValue={inicial("cuerpo")}
                        className={`${p.className} h-auto py-3 leading-relaxed`}
                        required
                    />
                )}
            </Campo>

            <label className="glass-soft flex cursor-pointer items-start gap-3 rounded-2xl p-4">
                <input
                    type="checkbox"
                    name="publicado"
                    checked={publicado}
                    onChange={(ev) => setPublicado(ev.target.checked)}
                    className="mt-0.5 size-5 accent-primary"
                />
                <span>
                    <span className="block text-sm font-medium">Publicar</span>
                    <span className="block text-xs text-muted-foreground">
                        Sin marcar, queda como borrador y solo lo ve la administración.
                    </span>
                </span>
            </label>

            <Boton type="submit" ancho="completo" tamano="lg" disabled={enviando}>
                <Save aria-hidden />
                {enviando ? "Guardando…" : "Guardar"}
            </Boton>
        </form>
    );
}
