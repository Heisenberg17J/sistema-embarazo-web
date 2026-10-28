"use client";

import { useEffect } from "react";
import { RotateCcw, WifiOff } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";

/**
 * Pantalla de error de las secciones con sesión.
 *
 * Next muestra su propia pantalla genérica en inglés; esta explica qué pasó en
 * español y ofrece reintentar sin perder la sesión.
 */
export default function ErrorPrivado({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="mx-auto mt-10 max-w-lg">
            <Tarjeta>
                <div className="flex flex-col items-center gap-4 py-6 text-center">
                    <span className="grid size-12 place-items-center rounded-2xl bg-advertencia-suave text-advertencia">
                        <WifiOff className="size-5" aria-hidden />
                    </span>
                    <div>
                        <h1 className="font-display text-xl font-semibold">
                            No pudimos cargar esta sección
                        </h1>
                        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                            Puede ser un problema de conexión o del servidor. Tus datos
                            están a salvo: vuelve a intentarlo en un momento.
                        </p>
                    </div>
                    <Boton onClick={reset} tamano="lg">
                        <RotateCcw aria-hidden />
                        Reintentar
                    </Boton>
                    {error.digest && (
                        <p className="text-[11px] text-muted-foreground">
                            Código del error: {error.digest}
                        </p>
                    )}
                </div>
            </Tarjeta>
        </div>
    );
}
