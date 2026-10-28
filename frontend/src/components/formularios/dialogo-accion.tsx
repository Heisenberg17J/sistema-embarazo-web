"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import { Dialogo } from "@/components/ui/dialogo";

/**
 * Contenedor de los diálogos que escriben en la API.
 *
 * Reúne el ciclo que comparten todos: abrir, enviar, mostrar el resultado y
 * recién entonces pedir datos frescos al servidor. El refresco va al cerrar y
 * no dentro de la acción, porque refrescar antes remonta el formulario y borra
 * lo que acababa de responder la API.
 */
export function DialogoAccion({
    titulo,
    descripcion,
    disparador,
    cerrarAlExito = false,
    children,
}: {
    titulo: string;
    descripcion?: string;
    /** El botón que lo abre. */
    disparador: ReactNode;
    /** true cuando no hay nada que leer en el resultado (p. ej. cerrar una cita). */
    cerrarAlExito?: boolean;
    children: (api: { onExito: () => void; cerrar: () => void }) => ReactNode;
}) {
    const router = useRouter();
    const [abierto, setAbierto] = useState(false);
    // Remontar el formulario al cerrarlo lo deja limpio para la próxima vez.
    const [generacion, setGeneracion] = useState(0);
    const [pendienteRefrescar, setPendienteRefrescar] = useState(false);

    const refrescar = useCallback(() => {
        setGeneracion((g) => g + 1);
        setPendienteRefrescar(false);
        router.refresh();
    }, [router]);

    const cambiar = (siguiente: boolean) => {
        setAbierto(siguiente);
        if (!siguiente && pendienteRefrescar) refrescar();
    };

    const onExito = useCallback(() => {
        if (cerrarAlExito) {
            setAbierto(false);
            refrescar();
        } else {
            setPendienteRefrescar(true);
        }
    }, [cerrarAlExito, refrescar]);

    const cerrar = useCallback(() => setAbierto(false), []);

    return (
        <Dialogo
            abierto={abierto}
            onCambio={cambiar}
            titulo={titulo}
            descripcion={descripcion}
            disparador={disparador}
        >
            <div key={generacion}>{children({ onExito, cerrar })}</div>
        </Dialogo>
    );
}
