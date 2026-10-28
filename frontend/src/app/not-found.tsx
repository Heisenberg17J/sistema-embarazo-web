import Link from "next/link";
import { Compass } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Boton } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";

export default function NoEncontrado() {
    return (
        <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-8">
            <div className="mb-6">
                <Logo />
            </div>
            <main className="w-full max-w-md">
                <Tarjeta>
                    <div className="flex flex-col items-center gap-4 py-4 text-center">
                        <span className="grid size-12 place-items-center rounded-2xl bg-surface-soft text-brand-deep">
                            <Compass className="size-5" aria-hidden />
                        </span>
                        <div>
                            <h1 className="font-display text-xl font-semibold">
                                Esta página no existe
                            </h1>
                            <p className="mt-2 text-sm text-muted-foreground">
                                Puede que el enlace esté mal escrito o que el contenido
                                ya no esté disponible.
                            </p>
                        </div>
                        <Boton comoHijo tamano="lg">
                            <Link href="/">Ir al inicio</Link>
                        </Boton>
                    </div>
                </Tarjeta>
            </main>
        </div>
    );
}
