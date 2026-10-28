import { Esqueleto } from "@/components/ui/esqueleto";

export default function Cargando() {
    return (
        <div aria-busy="true" aria-live="polite">
            <span className="sr-only">Cargando tu panel…</span>

            <div className="mb-5 mt-7 space-y-2">
                <Esqueleto className="h-4 w-40" />
                <Esqueleto className="h-10 w-64" />
                <Esqueleto className="h-4 w-72 max-w-full" />
            </div>

            <div className="grid items-start gap-5 lg:grid-cols-3">
                <div className="glass rounded-3xl p-5 sm:p-6 lg:col-span-2">
                    <div className="flex flex-col items-center gap-6 sm:flex-row">
                        <Esqueleto className="size-44 shrink-0 rounded-full" />
                        <div className="grid w-full flex-1 gap-3 sm:grid-cols-2">
                            <Esqueleto className="h-20" />
                            <Esqueleto className="h-20" />
                            <Esqueleto className="h-20 sm:col-span-2" />
                        </div>
                    </div>
                </div>
                <div className="glass space-y-3 rounded-3xl p-5 sm:p-6">
                    <Esqueleto className="h-20" />
                    <Esqueleto className="h-20" />
                </div>
            </div>
        </div>
    );
}
