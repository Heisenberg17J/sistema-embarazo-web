import type { Metadata } from "next";
import { EnConstruccion } from "@/components/ui/en-construccion";
import { exigirRol } from "@/lib/sesion-servidor";

export const metadata: Metadata = { title: "Usuarios" };

export default async function Pagina() {
    await exigirRol("ADMINISTRADOR");
    return (
        <EnConstruccion
            titulo="Usuarios"
            descripcion="Gestión de las cuentas del sistema."
            contendra={[
                "Listado con filtros por rol, estado y búsqueda",
                "Crear gestantes, profesionales y administradores",
                "Desactivar una cuenta o restablecer su contraseña"
]}
        />
    );
}
