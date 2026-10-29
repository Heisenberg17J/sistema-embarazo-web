import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

export function AvisoExito({ children }: { children: ReactNode }) {
    if (!children) return null;
    return (
        <p
            role="status"
            className="animate-[aparecer_var(--dur-entrada)_var(--ease-out)_both] flex items-start gap-2 rounded-2xl bg-exito-suave px-4 py-3 text-base sm:text-sm font-medium text-exito"
        >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            {children}
        </p>
    );
}
