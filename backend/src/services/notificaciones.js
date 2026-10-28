const env = require('../config/env');
const { pool } = require('../config/db');
const correo = require('./correo');
const registro = require('./registro');

// Una alerta de atención inmediata que nadie ve a tiempo no sirve de nada. Hoy solo existe
// si el profesional abre la aplicación; aquí se le avisa por correo cuando se genera una.
//
// El correo NO lleva datos clínicos: no es un canal seguro (se guarda en servidores ajenos,
// se reenvía, se ve en la pantalla de bloqueo). Dice que hay una alerta crítica y de quién,
// y enlaza a la ficha, donde sí hay que iniciar sesión para ver el detalle.

const VISTA = (embarazo, alertas) => alertas.length === 1 ? 'una alerta' : `${alertas.length} alertas`;

const enlace = (gestanteId) => `${env.appUrl}/pro/pacientes/${gestanteId}?seccion=alertas`;

// Avisa a quien corresponda. Se llama DESPUÉS de confirmar la transacción: un aviso de una
// alerta que luego se revierte sería una falsa alarma. Nunca lanza ni bloquea a quien lo
// llama: que el correo falle no puede impedir que una gestante registre un dato.
const notificarAlertasCriticas = async (embarazo, alertas) => {
    try {
        const criticas = (alertas ?? []).filter((a) => a && a.severidad === 'CRITICA');
        if (!criticas.length) return { enviados: 0 };

        const { rows: [gestante] } = await pool.query(
            'SELECT nombre || \' \' || apellido AS nombre FROM usuario WHERE id = $1', [embarazo.gestante_usuario_id]
        );
        const nombre = gestante?.nombre ?? 'Una paciente';

        const { rows: profesionales } = await pool.query(
            `SELECT u.nombre, u.correo FROM asignacion a JOIN usuario u ON u.id = a.profesional_usuario_id
              WHERE a.gestante_usuario_id = $1 AND a.activa AND u.activo`, [embarazo.gestante_usuario_id]
        );

        if (profesionales.length) {
            await Promise.all(profesionales.map((p) => correo.enviarCorreo({
                para: p.correo,
                asunto: `Alerta de atención inmediata: ${nombre}`,
                texto:
                    `Hola ${p.nombre},\n\n${nombre} tiene ${VISTA(embarazo, criticas)} de atención inmediata sin revisar.\n\n` +
                    `Entra a verla: ${enlace(embarazo.gestante_usuario_id)}\n\n` +
                    `Por seguridad este correo no incluye datos clínicos.`,
                html:
                    `<p>Hola ${p.nombre},</p><p><strong>${nombre}</strong> tiene ${VISTA(embarazo, criticas)} de atención inmediata sin revisar.</p>` +
                    `<p><a href="${enlace(embarazo.gestante_usuario_id)}">Ver en el sistema</a></p>` +
                    `<p style="color:#666">Por seguridad este correo no incluye datos clínicos.</p>`
            })));
            return { enviados: profesionales.length };
        }

        // Sin profesional asignado nadie revisaría la alerta: se avisa a los administradores
        // para que le asignen uno. Ellos no ven datos clínicos, así que el aviso es el mismo.
        const { rows: admins } = await pool.query(
            `SELECT u.nombre, u.correo FROM usuario u JOIN rol r ON r.id = u.rol_id
              WHERE r.codigo = 'ADMINISTRADOR' AND u.activo`
        );
        await Promise.all(admins.map((a) => correo.enviarCorreo({
            para: a.correo,
            asunto: `Gestante sin profesional con una alerta crítica: ${nombre}`,
            texto:
                `Hola ${a.nombre},\n\n${nombre} generó ${VISTA(embarazo, criticas)} de atención inmediata y no tiene ` +
                `ningún profesional asignado, así que nadie la revisará.\n\nAsígnale un profesional: ${env.appUrl}/admin/asignaciones`
        })));
        return { enviados: admins.length, sinProfesional: true };
    } catch (error) {
        registro.error('no se pudo avisar de una alerta crítica', { error: error.message });
        return { enviados: 0, error: true };
    }
};

module.exports = { notificarAlertasCriticas };
