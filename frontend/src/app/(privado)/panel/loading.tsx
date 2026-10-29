import { Esqueleto } from "@/components/ui/esqueleto";

/**
 * Esqueleto del panel con su misma silueta: saludo, tarjeta de gestación
 * (anillo y casillas), alertas y la fila inferior.
 */
export default function Cargando() {
    return (
        <div aria-busy="true" aria-live="polite">
            <span className="sr-only">Cargando…</span>

            <div className="mb-5 mt-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div className="space-y-2">
                    <Esqueleto className="h-3 w-40" />
                    <Esqueleto className="h-10 w-64 max-w-full" />
                    <Esqueleto className="h-4 w-72 max-w-full" />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-2">
                    <Esqueleto className="h-[4.5rem] rounded-2xl sm:h-11 sm:w-28 sm:rounded-full" />
                    <Esqueleto className="h-[4.5rem] rounded-2xl sm:h-11 sm:w-32 sm:rounded-full" />
                </div>
            </div>

            <div className="space-y-5">
                <div className="grid items-start gap-5 lg:grid-cols-3">
                    <div className="glass rounded-3xl p-5 sm:p-6 lg:col-span-2">
                        <Esqueleto className="h-4 w-32" />
                        <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row">
                            <Esqueleto className="size-44 shrink-0 rounded-full" />
                            <div className="grid w-full flex-1 gap-3 sm:grid-cols-2">
                                <Esqueleto className="h-20" />
                                <Esqueleto className="h-20" />
                                <Esqueleto className="h-24 sm:col-span-2" />
                                <Esqueleto className="h-24 sm:col-span-2" />
                            </div>
                        </div>
                    </div>

                    <div className="glass space-y-3 rounded-3xl p-5 sm:p-6">
                        <Esqueleto className="h-4 w-40" />
                        <Esqueleto className="h-24" />
                        <Esqueleto className="h-24" />
                    </div>
                </div>

                <div className="grid items-start gap-5 lg:grid-cols-3">
                    <div className="glass rounded-3xl p-5 sm:p-6 lg:col-span-2">
                        <Esqueleto className="h-6 w-56" />
                        <Esqueleto className="mt-6 h-40 w-full" />
                    </div>
                    <div className="glass space-y-3 rounded-3xl p-5 sm:p-6">
                        <Esqueleto className="h-6 w-40" />
                        <Esqueleto className="h-16" />
                        <Esqueleto className="h-16" />
                    </div>
                </div>
            </div>
        </div>
    );
}
