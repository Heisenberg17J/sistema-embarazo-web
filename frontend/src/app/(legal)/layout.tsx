import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { PieDescargo } from "@/components/layout/pie-descargo";
import { Boton } from "@/components/ui/boton";

/**
 * Páginas legales. Se pueden leer con o sin sesión: quien va a registrarse debe
 * poder leer la política antes de aceptarla.
 */
export default function LayoutLegal({ children }: { children: React.ReactNode }) {
    return (
        <div className="mx-auto min-h-dvh max-w-3xl px-4 py-6 sm:px-6">
            <header className="mb-6 flex items-center justify-between gap-3">
                <Logo conLema={false} />
                <Boton comoHijo variante="vidrio" tamano="sm">
                    <Link href="/">
                        <ArrowLeft aria-hidden />
                        Volver
                    </Link>
                </Boton>
            </header>
            <main>{children}</main>
            <PieDescargo />
        </div>
    );
}
