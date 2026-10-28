import type { Metadata } from "next";
import Link from "next/link";
import { DocumentoLegal, Seccion } from "@/components/ui/documento-legal";
import { MARCA } from "@/lib/marca";

export const metadata: Metadata = { title: "Términos de uso" };

export default function PaginaTerminos() {
    return (
        <DocumentoLegal titulo="Términos de uso">
            <Seccion titulo="1. Qué es este servicio">
                <p>
                    {MARCA.nombre} es una herramienta para registrar, organizar y
                    visualizar el seguimiento de un embarazo. Está pensada para
                    acompañar tu atención con un profesional de salud, no para
                    reemplazarla.
                </p>
            </Seccion>

            <Seccion titulo="2. No es un servicio de emergencias">
                <p
                    role="note"
                    className="rounded-2xl bg-critica-suave px-4 py-3 font-medium text-critica"
                >
                    Si tienes un signo de alarma o sientes que algo no está bien, no
                    esperes a que la aplicación te avise: llama a la línea de
                    emergencias 123 o acude a urgencias de inmediato.
                </p>
                <p>
                    Las alertas que genera el sistema son <strong>informativas</strong>.
                    Se basan en valores de referencia generales y en lo que tú
                    registras. Que no aparezca una alerta no significa que todo esté
                    bien, y que aparezca una no es un diagnóstico.
                </p>
            </Seccion>

            <Seccion titulo="3. No hace diagnósticos">
                <p>
                    El sistema no diagnostica ni prescribe, y no reemplaza la
                    valoración de un profesional de salud. Las decisiones sobre tu
                    salud las tomas tú con tu profesional.
                </p>
            </Seccion>

            <Seccion titulo="4. Tu cuenta">
                <ul className="list-disc space-y-1.5 pl-5">
                    <li>La cuenta es personal: no compartas tu contraseña.</li>
                    <li>
                        Los datos que registres deben ser veraces. Un valor mal
                        escrito puede generar una alerta que no corresponde; si te
                        equivocas, avisa a tu profesional.
                    </li>
                    <li>
                        Si sospechas que alguien más accedió a tu cuenta, cambia tu
                        contraseña y avisa a tu profesional de salud.
                    </li>
                </ul>
            </Seccion>

            <Seccion titulo="5. Disponibilidad">
                <p>
                    Hacemos lo posible para que el servicio esté disponible, pero
                    puede haber interrupciones por mantenimiento o por fallas de
                    terceros. Por eso no debes depender de él para una situación
                    urgente.
                </p>
            </Seccion>

            <Seccion titulo="6. Tus datos personales">
                <p>
                    El tratamiento de tus datos se rige por la{" "}
                    <Link
                        href="/politica-de-privacidad"
                        className="font-semibold text-brand-deep underline-offset-4 hover:underline"
                    >
                        política de tratamiento de datos personales
                    </Link>
                    .
                </p>
            </Seccion>
        </DocumentoLegal>
    );
}
