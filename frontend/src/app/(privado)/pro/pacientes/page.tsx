import type { Metadata } from "next";
import { EnConstruccion } from "@/components/ui/en-construccion";
import { exigirRol } from "@/lib/sesion-servidor";

export const metadata: Metadata = { title: "Pacientes" };

export default async function Pagina() {
    await exigirRol("PROFESIONAL");
    return (
        <EnConstruccion
            titulo="Mis pacientes"
            descripcion="Las gestantes que tienes asignadas."
            contendra={[
                "Tarjetas de pacientes con su semana de gestación",
                "Las que tienen alertas críticas aparecen primero",
                "Próxima cita de cada una"
]}
        />
    );
}
