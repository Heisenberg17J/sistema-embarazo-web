import type { Metadata } from "next";
import { EnConstruccion } from "@/components/ui/en-construccion";
import { exigirRol } from "@/lib/sesion-servidor";

export const metadata: Metadata = { title: "Reglas de alerta" };

export default async function Pagina() {
    await exigirRol("ADMINISTRADOR");
    return (
        <EnConstruccion
            titulo="Reglas de alerta"
            descripcion="Umbrales que disparan las alertas."
            contendra={[
                "Reglas clínicas base y las que agregues",
                "Ajustar umbrales, severidad y mensaje",
                "Activar o desactivar una regla"
]}
        />
    );
}
