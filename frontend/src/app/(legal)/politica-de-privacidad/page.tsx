import type { Metadata } from "next";
import Link from "next/link";
import { DocumentoLegal, Seccion } from "@/components/ui/documento-legal";
import { MARCA } from "@/lib/marca";
import { POLITICA } from "@/lib/politica";

export const metadata: Metadata = { title: "Política de tratamiento de datos" };

export default function PaginaPolitica() {
    const r = POLITICA.responsable;

    return (
        <DocumentoLegal titulo="Política de tratamiento de datos personales">
            <Seccion titulo="1. Quién es el responsable">
                <p>
                    {MARCA.nombre} es operado por <strong>{r.nombre}</strong>
                    {" "}({r.identificacion}), con domicilio en {r.direccion}. Para
                    cualquier asunto sobre tus datos personales puedes escribir a{" "}
                    <strong>{r.correo}</strong> o llamar al {r.telefono}.
                </p>
            </Seccion>

            <Seccion titulo="2. Qué datos tratamos">
                <p>Para que el seguimiento de tu embarazo funcione necesitamos:</p>
                <ul className="list-disc space-y-1.5 pl-5">
                    <li>
                        <strong>Identificación y contacto:</strong> nombre, documento,
                        fecha de nacimiento, correo, teléfono, dirección, EPS y un
                        contacto de emergencia.
                    </li>
                    <li>
                        <strong>Datos de salud, que son datos sensibles:</strong> fecha
                        de tu última menstruación, talla y peso, grupo sanguíneo, tus
                        mediciones (peso, presión arterial y otras), los síntomas que
                        registras, y los controles, exámenes y citas que registra tu
                        profesional.
                    </li>
                    <li>
                        <strong>Datos técnicos:</strong> la fecha y la dirección IP de
                        tus accesos y el navegador que usas, para proteger tu cuenta.
                    </li>
                </ul>
            </Seccion>

            <Seccion titulo="3. Para qué los usamos">
                <ul className="list-disc space-y-1.5 pl-5">
                    <li>Organizar y mostrarte el seguimiento de tu embarazo.</li>
                    <li>
                        Generar alertas informativas cuando un valor o un síntoma que
                        registras pide atención, y avisar a tu profesional.
                    </li>
                    <li>
                        Que tu profesional de salud consulte tu información para
                        atenderte.
                    </li>
                    <li>
                        Enviarte correos necesarios del servicio, como el de
                        recuperación de contraseña.
                    </li>
                    <li>
                        Mantener un registro de quién accede a la información y
                        proteger la seguridad del sistema.
                    </li>
                </ul>
                <p>
                    No vendemos tus datos ni los usamos para publicidad. Las
                    estadísticas que se calculan para la administración del sistema
                    son agregadas: no identifican a ninguna persona.
                </p>
            </Seccion>

            <Seccion titulo="4. Datos sensibles: tu autorización">
                <p>
                    Los datos de salud son sensibles. Por eso no estás obligada a
                    autorizar su tratamiento y puedes negarte a responder cualquier
                    pregunta sobre ellos. Sin esos datos, sin embargo, el servicio no
                    puede cumplir su propósito, que es el seguimiento de tu embarazo.
                    Al marcar la casilla de aceptación al crear tu cuenta autorizas de
                    forma previa, expresa e informada el tratamiento descrito aquí.
                    Guardamos la fecha y la versión de este documento que aceptaste.
                </p>
                <p className="rounded-xl bg-surface-soft px-4 py-3 text-sm">
                    [Pendiente de la asesoría jurídica: tratamiento de datos de
                    menores de edad. El registro admite tarjeta de identidad; para
                    adolescentes la autorización debe darla su representante legal.]
                </p>
            </Seccion>

            <Seccion titulo="5. Quién puede ver tu información">
                <ul className="list-disc space-y-1.5 pl-5">
                    <li>
                        <strong>Tu profesional de salud asignado</strong> puede ver tu
                        seguimiento completo. Un profesional al que no te hayan asignado
                        no puede verlo.
                    </li>
                    <li>
                        <strong>El administrador del sistema</strong> gestiona las
                        cuentas y puede ver tus datos de identificación y contacto. No
                        tiene acceso a tu información clínica.
                    </li>
                    <li>
                        <strong>Proveedores tecnológicos</strong> que alojan el sistema
                        y envían correos, bajo nuestras instrucciones y con deber de
                        confidencialidad: [indicar proveedores y país en que se alojan
                        los datos].
                    </li>
                </ul>
                <p>
                    Solo entregaremos tus datos a una autoridad si una norma o una
                    orden judicial lo exige.
                </p>
            </Seccion>

            <Seccion titulo="6. Cuánto tiempo los conservamos">
                <p>
                    Tu información clínica se conserva el tiempo que exige la
                    normativa de historias clínicas: [confirmar con asesoría jurídica
                    el plazo aplicable a este servicio]. Los datos técnicos de acceso
                    se conservan para la seguridad del sistema.
                </p>
            </Seccion>

            <Seccion titulo="7. Tus derechos">
                <p>Como titular de tus datos puedes:</p>
                <ul className="list-disc space-y-1.5 pl-5">
                    <li>Conocer qué datos tenemos de ti y descargar una copia.</li>
                    <li>Actualizar y rectificar tus datos.</li>
                    <li>Pedir que se supriman tus datos.</li>
                    <li>Revocar tu autorización.</li>
                    <li>
                        Presentar una queja ante la Superintendencia de Industria y
                        Comercio.
                    </li>
                </ul>
                <p>
                    Puedes descargar tus datos y pedir la supresión desde{" "}
                    <strong>Mi perfil → Tus datos y privacidad</strong>, o escribiendo
                    al correo del responsable. Respondemos en los plazos de ley.
                </p>
                <p>
                    <strong>Sobre la supresión:</strong> no podemos borrar sin más tu
                    historia clínica, porque hay una obligación legal de conservarla.
                    Lo que hacemos es <strong>anonimizar tu cuenta</strong>: eliminamos
                    tu nombre, documento, contacto y dirección, y dejamos de poder
                    identificarte. Los registros clínicos quedan sin tu nombre. Los
                    textos libres que tú o tu profesional hayan escrito en las
                    observaciones no se pueden depurar de forma automática.
                </p>
            </Seccion>

            <Seccion titulo="8. Cómo protegemos tus datos">
                <p>
                    Las contraseñas se guardan cifradas, la conexión va protegida y
                    cada profesional solo accede a las pacientes que tiene asignadas.
                    Cada acceso a información clínica queda registrado. Ningún sistema
                    es infalible: si ocurriera un incidente que afecte tus datos, te lo
                    informaremos.
                </p>
            </Seccion>

            <Seccion titulo="9. Cambios en esta política">
                <p>
                    Si el texto cambia de fondo, publicaremos una nueva versión y te
                    pediremos aceptarla. Los{" "}
                    <Link
                        href="/terminos"
                        className="font-semibold text-brand-deep underline-offset-4 hover:underline"
                    >
                        términos de uso
                    </Link>{" "}
                    complementan este documento.
                </p>
            </Seccion>
        </DocumentoLegal>
    );
}
