import { Hammer } from "lucide-react";
import { Saludo } from "@/components/layout/saludo";
import { Tarjeta } from "@/components/ui/tarjeta";

/**
 * Marcador temporal de las pantallas que faltan por construir.
 * Se reemplaza por la pantalla real a medida que avanza el maquetado.
 */
export function EnConstruccion({
    titulo,
    descripcion,
    contendra,
}: {
    titulo: string;
    descripcion: string;
    contendra: string[];
}) {
    return (
        <>
            <Saludo titulo={titulo} subtitulo={descripcion} />
            <Tarjeta>
                <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-soft text-brand-deep">
                        <Hammer className="size-5" aria-hidden />
                    </span>
                    <div>
                        <p className="font-medium">Pantalla en construcción</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Esta sección aún no está lista. Va a incluir:
                        </p>
                        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                            {contendra.map((punto) => (
                                <li key={punto} className="flex gap-2">
                                    <span aria-hidden className="text-brand-deep">
                                        ·
                                    </span>
                                    {punto}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </Tarjeta>
        </>
    );
}
