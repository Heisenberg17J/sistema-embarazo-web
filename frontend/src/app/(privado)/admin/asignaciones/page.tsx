import type { Metadata } from "next";
import { EnConstruccion } from "@/components/ui/en-construccion";
import { exigirRol } from "@/lib/sesion-servidor";

export const metadata: Metadata = { title: "Asignaciones" };

export default async function Pagina() {
    await exigirRol("ADMINISTRADOR");
    return (
        <EnConstruccion
            titulo="Asignaciones"
            descripcion="Qué profesional atiende a cada gestante."
            contendra={[
                "Asignar una gestante a un profesional",
                "Finalizar una asignación conservando el histórico"
]}
        />
    );
}
