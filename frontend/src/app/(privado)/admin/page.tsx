import type { Metadata } from "next";
import { EnConstruccion } from "@/components/ui/en-construccion";
import { exigirRol } from "@/lib/sesion-servidor";

export const metadata: Metadata = { title: "Estadísticas" };

export default async function Pagina() {
    await exigirRol("ADMINISTRADOR");
    return (
        <EnConstruccion
            titulo="Estadísticas"
            descripcion="Resumen general del sistema."
            contendra={[
                "Usuarios por rol y gestantes sin profesional asignado",
                "Embarazos, citas y alertas por estado",
                "Uso del contenido educativo"
]}
        />
    );
}
