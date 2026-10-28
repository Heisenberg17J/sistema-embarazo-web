import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Baby } from "lucide-react";
import { Tarjeta } from "@/components/ui/tarjeta";
import { embarazoActivo } from "@/lib/datos";
import { exigirRol } from "@/lib/sesion-servidor";
import { FormularioEmbarazo } from "./formulario-embarazo";

export const metadata: Metadata = { title: "Registrar mi embarazo" };

export default async function PaginaNuevoEmbarazo() {
    await exigirRol("GESTANTE");

    // Solo se permite un embarazo activo a la vez (RF-04).
    if (await embarazoActivo()) redirect("/panel");

    return (
        <div className="mx-auto mt-7 max-w-xl">
            <Tarjeta>
                <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-soft text-brand-deep">
                        <Baby className="size-5" aria-hidden />
                    </span>
                    <div>
                        <h1 className="font-display text-2xl font-semibold">
                            Registrar mi embarazo
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Con la fecha de tu última menstruación calculamos tu semana de
                            gestación y la fecha probable de parto.
                        </p>
                    </div>
                </div>

                <FormularioEmbarazo />
            </Tarjeta>
        </div>
    );
}
