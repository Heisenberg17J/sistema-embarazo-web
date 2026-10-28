const crypto = require('crypto');
const env = require('../config/env');
const { enviarCorreo } = require('./correo');

const sha256 = (valor) => crypto.createHash('sha256').update(valor).digest('hex');

const VIGENCIA_MINUTOS = 60;
// Evita que alguien use el formulario para llenar de correos el buzón de otra persona.
const ESPERA_ENTRE_SOLICITUDES_SEG = 60;

// Crea un enlace de restablecimiento y lo envía. Devuelve sin decir si el correo
// existía: la respuesta de la API es idéntica para que no sirva para averiguar
// quién tiene cuenta.
const solicitarRecuperacion = async (db, { correo, ip }) => {
    const { rows } = await db.query(
        `SELECT id, nombre FROM usuario WHERE lower(correo) = $1 AND activo AND anonimizado_en IS NULL`, [correo]
    );
    const usuario = rows[0];
    if (!usuario) return { creado: false };

    const reciente = await db.query(
        `SELECT 1 FROM recuperacion_contrasena
          WHERE usuario_id = $1 AND solicitada_en > now() - make_interval(secs => $2)`,
        [usuario.id, ESPERA_ENTRE_SOLICITUDES_SEG]
    );
    if (reciente.rowCount) return { creado: false };

    // Un enlace nuevo deja sin efecto los anteriores.
    await db.query('UPDATE recuperacion_contrasena SET usada_en = now() WHERE usuario_id = $1 AND usada_en IS NULL', [usuario.id]);

    const token = crypto.randomBytes(32).toString('hex');
    await db.query(
        `INSERT INTO recuperacion_contrasena (usuario_id, token_hash, expira_en, ip)
         VALUES ($1, $2, now() + make_interval(mins => $3), $4)`,
        [usuario.id, sha256(token), VIGENCIA_MINUTOS, ip]
    );

    const enlace = `${env.appUrl}/restablecer/${token}`;
    // Sin await: el tiempo de respuesta no debe delatar si la cuenta existe.
    void enviarCorreo({
        para: correo,
        asunto: 'Restablece tu contraseña',
        texto:
            `Hola ${usuario.nombre},\n\n` +
            `Recibimos una solicitud para restablecer tu contraseña. Abre este enlace para elegir una nueva ` +
            `(vale ${VIGENCIA_MINUTOS} minutos y solo se puede usar una vez):\n\n${enlace}\n\n` +
            `Si no fuiste tú, ignora este mensaje: tu contraseña no cambia.`,
        html:
            `<p>Hola ${usuario.nombre},</p>` +
            `<p>Recibimos una solicitud para restablecer tu contraseña. Usa este enlace para elegir una nueva ` +
            `(vale ${VIGENCIA_MINUTOS} minutos y solo se puede usar una vez):</p>` +
            `<p><a href="${enlace}">Restablecer mi contraseña</a></p>` +
            `<p>Si no fuiste tú, ignora este mensaje: tu contraseña no cambia.</p>`
    });
    return { creado: true, usuarioId: usuario.id };
};

// Consume el enlace. Devuelve el usuario si era válido (no usado, no vencido).
// El UPDATE ... RETURNING es atómico: dos peticiones con el mismo token no pueden
// ganar las dos.
const consumirToken = async (db, token) => {
    const { rows } = await db.query(
        `UPDATE recuperacion_contrasena r SET usada_en = now()
           FROM usuario u
          WHERE r.token_hash = $1 AND r.usada_en IS NULL AND r.expira_en > now()
            AND u.id = r.usuario_id AND u.activo AND u.anonimizado_en IS NULL
      RETURNING u.id, u.nombre, u.correo`,
        [sha256(token)]
    );
    return rows[0] || null;
};

const avisarCambio = (usuario) =>
    enviarCorreo({
        para: usuario.correo,
        asunto: 'Tu contraseña cambió',
        texto:
            `Hola ${usuario.nombre},\n\nTu contraseña acaba de cambiar y se cerraron tus sesiones abiertas.\n\n` +
            `Si no fuiste tú, restablécela de nuevo desde ${env.appUrl}/recuperar y avisa a tu profesional de salud.`
    });

module.exports = { solicitarRecuperacion, consumirToken, avisarCambio, VIGENCIA_MINUTOS };
