import type { Metadata } from "next";
import { EnConstruccion } from "@/components/ui/en-construccion";
import { exigirRol } from "@/lib/sesion-servidor";

export const metadata: Metadata = { title: "Agenda" };

export default async function Pagina() {
    await exigirRol("PROFESIONAL");
    return (
        <EnConstruccion
            titulo="Mi agenda"
            descripcion="Tus citas programadas."
            contendra={[
                "Agenda por fecha",
                "Programar, reprogramar y cerrar citas",
                "Registrar el control de una cita cumplida"
]}
        />
    );
}
