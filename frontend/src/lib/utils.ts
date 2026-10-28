import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Une clases de Tailwind resolviendo las que entran en conflicto. */
export function cn(...clases: ClassValue[]) {
    return twMerge(clsx(clases));
}
