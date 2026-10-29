import Link from "next/link";
import { Baby, CalendarPlus } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/vacio";

/**
 * Estado de las pantallas de seguimiento cuando la gestante todavía no ha
 * registrado un embarazo: sin él no hay nada que mostrar en ninguna.
 */
export function SinEmbarazo({
    descripcion = "Cuéntanos cuándo empezó y te acompañamos semana a semana. Con la fecha de tu última menstruación calculamos tu semana de gestación y la fecha probable de parto.",
}: {
    descripcion?: string;
}) {
    return (
        <Tarjeta indice={0}>
            <Vacio
                icono={Baby}
                ilustracion="color"
                titulo="Aún no has registrado tu embarazo"
                descripcion={descripcion}
                accion={
                    <Boton comoHijo tamano="lg">
                        <Link href="/embarazo/nuevo">
                            <CalendarPlus aria-hidden />
                            Registrar mi embarazo
                        </Link>
                    </Boton>
                }
            />
        </Tarjeta>
    );
}
