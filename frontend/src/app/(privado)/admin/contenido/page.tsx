import type { Metadata } from "next";
import { EnConstruccion } from "@/components/ui/en-construccion";
import { exigirRol } from "@/lib/sesion-servidor";

export const metadata: Metadata = { title: "Contenido" };

export default async function Pagina() {
    await exigirRol("ADMINISTRADOR");
    return (
        <EnConstruccion
            titulo="Contenido educativo"
            descripcion="Material que ven las gestantes."
            contendra={[
                "Crear y editar contenidos por rango de semanas",
                "Publicar o dejar en borrador"
]}
        />
    );
}
