import type { Metadata } from "next";
import { EnConstruccion } from "@/components/ui/en-construccion";
import { exigirRol } from "@/lib/sesion-servidor";

export const metadata: Metadata = { title: "Catálogos" };

export default async function Pagina() {
    await exigirRol("ADMINISTRADOR");
    return (
        <EnConstruccion
            titulo="Catálogos"
            descripcion="Tipos de control, examen, síntoma y medición."
            contendra={[
                "Ampliar los catálogos sin tocar el código",
                "Marcar qué síntomas son signos de alarma",
                "Definir los rangos técnicos de cada medición"
]}
        />
    );
}
