import type { Metadata } from "next";
import { EnConstruccion } from "@/components/ui/en-construccion";
import { exigirRol } from "@/lib/sesion-servidor";

export const metadata: Metadata = { title: "Configuración" };

export default async function Pagina() {
    await exigirRol("ADMINISTRADOR");
    return (
        <EnConstruccion
            titulo="Configuración"
            descripcion="Parámetros generales del sistema."
            contendra={[
                "Parámetros editables y su descripción"
]}
        />
    );
}
