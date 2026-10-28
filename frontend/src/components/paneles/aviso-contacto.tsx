import Link from "next/link";
import { PhoneCall } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";

/**
 * Invita a registrar el contacto de emergencia mientras falte.
 *
 * Es el número al que la app ofrece llamar en un aviso de atención inmediata:
 * sin él, ese botón nunca aparece justo cuando más falta hace.
 */
export function AvisoContacto() {
    return (
        <Tarjeta className="border-l-4 border-l-advertencia-borde">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-advertencia-suave text-advertencia">
                    <PhoneCall className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="font-medium text-balance">
                        Falta tu contacto de emergencia
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Si algún día registras un signo de alarma, te ofrecemos llamarlo
                        con un solo toque. Toma menos de un minuto.
                    </p>
                </div>
                <Boton comoHijo variante="vidrio" className="shrink-0">
                    <Link href="/perfil#contacto">Agregarlo</Link>
                </Boton>
            </div>
        </Tarjeta>
    );
}
