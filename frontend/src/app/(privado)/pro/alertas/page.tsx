import type { Metadata } from "next";
import { EnConstruccion } from "@/components/ui/en-construccion";
import { exigirRol } from "@/lib/sesion-servidor";

export const metadata: Metadata = { title: "Alertas" };

export default async function Pagina() {
    await exigirRol("PROFESIONAL");
    return (
        <EnConstruccion
            titulo="Bandeja de alertas"
            descripcion="Alertas de tus pacientes asignadas."
            contendra={[
                "Alertas pendientes ordenadas por severidad",
                "Marcar como revisada o descartada con una observación",
                "Acceso directo a la ficha de la paciente"
]}
        />
    );
}
