import type { Metadata } from "next";
import { EnConstruccion } from "@/components/ui/en-construccion";
import { exigirRol } from "@/lib/sesion-servidor";

export const metadata: Metadata = { title: "Auditoría" };

export default async function Pagina() {
    await exigirRol("ADMINISTRADOR");
    return (
        <EnConstruccion
            titulo="Auditoría"
            descripcion="Registro de las acciones del sistema."
            contendra={[
                "Bitácora con usuario, acción, entidad y fecha",
                "Filtros por usuario, acción y rango de fechas"
]}
        />
    );
}
