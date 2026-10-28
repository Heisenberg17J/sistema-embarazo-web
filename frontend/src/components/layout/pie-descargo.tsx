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
            {DESCARGO}
        </footer>
    );
}
