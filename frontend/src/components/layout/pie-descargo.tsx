import Link from "next/link";
import { DESCARGO } from "@/lib/marca";
import { cn } from "@/lib/utils";

/**
 * Descargo de responsabilidad. Aparece en el pie de todas las pantallas:
 * el sistema organiza información, no diagnostica.
 */
export function PieDescargo({ className }: { className?: string }) {
    return (
        <footer
            className={cn(
                "mx-auto mt-8 max-w-2xl px-4 pb-6 text-center text-xs leading-relaxed text-muted-foreground",
                className,
            )}
        >
            <p>{DESCARGO}</p>
            <p className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
                <Link
                    href="/politica-de-privacidad"
                    className="underline-offset-4 hover:text-foreground hover:underline"
                >
                    Política de datos
                </Link>
                <Link
                    href="/terminos"
                    className="underline-offset-4 hover:text-foreground hover:underline"
                >
                    Términos de uso
                </Link>
            </p>
        </footer>
    );
}
