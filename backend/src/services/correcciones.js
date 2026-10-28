const { HttpError } = require('../utils/http');
const { ROLES } = require('../middlewares/roles');
const { VENTANA_GESTANTE_HORAS, VENTANA_PROFESIONAL_HORAS } = require('../config/correcciones');

const horasDesde = (instante) => (Date.now() - new Date(instante).getTime()) / 3600000;

// ¿Puede este usuario corregir o eliminar este dato?
//   - La gestante, sus propios registros, dentro de 24 horas desde que los guardó.
//   - El profesional, los que él registró, dentro de 7 días.
// `propietarioId` es quien lo registró (para un síntoma, la gestante dueña del embarazo).
const evaluarCorreccion = (usuario, { propietarioId, creadoEn }) => {
    const ventana = usuario.rol === ROLES.GESTANTE ? VENTANA_GESTANTE_HORAS
        : usuario.rol === ROLES.PROFESIONAL ? VENTANA_PROFESIONAL_HORAS
            : 0;
    if (!ventana || propietarioId !== usuario.id) return { permitido: false, motivo: 'ajeno', ventana };
    if (horasDesde(creadoEn) > ventana) return { permitido: false, motivo: 'vencido', ventana };
    return { permitido: true, ventana };
};

const esEditable = (usuario, datos) => evaluarCorreccion(usuario, datos).permitido;

// Lanza el error adecuado si no se puede. Con mensajes que dicen qué hacer, no solo "prohibido".
const exigirCorreccion = (usuario, datos) => {
    const r = evaluarCorreccion(usuario, datos);
    if (r.permitido) return;
    if (r.motivo === 'vencido') {
        const tiempo = r.ventana >= 48 ? `${Math.round(r.ventana / 24)} días` : `${r.ventana} horas`;
        throw new HttpError(403, usuario.rol === ROLES.GESTANTE
            ? `Solo puedes corregir un registro durante las ${tiempo} siguientes a haberlo guardado. Cuéntaselo a tu profesional de salud.`
            : `Solo puedes corregir un registro durante los ${tiempo} siguientes a haberlo guardado.`);
    }
    throw new HttpError(403, 'Solo quien registró un dato puede corregirlo.');
};

// El profesional deja constancia de por qué corrige un registro clínico; la gestante, no está obligada.
const exigirMotivo = (usuario, motivo) => {
    if (usuario.rol === ROLES.PROFESIONAL && !motivo) {
        throw new HttpError(400, 'Indica el motivo de la corrección: queda en el historial de la paciente.');
    }
};

// Pasa a ANULADA las alertas de los datos indicados y las desvincula de ellos. Sin
// desvincular, la alerta nueva que genera el valor corregido chocaría con los
// índices únicos (medición + regla, síntoma) y el motor la descartaría en silencio.
const anularAlertas = async (db, { medicionIds = [], sintomaIds = [], controlId = null, usuarioId, motivo }) => {
    const { rows } = await db.query(
        `UPDATE alerta
            SET estado = 'ANULADA', anulada_en = now(), anulada_por = $4, motivo_anulacion = $5,
                medicion_id = NULL, sintoma_id = NULL, control_id = NULL
          WHERE estado <> 'ANULADA'
            AND (medicion_id = ANY($1::bigint[]) OR sintoma_id = ANY($2::bigint[]) OR control_id = $3)
      RETURNING id`,
        [medicionIds, sintomaIds, controlId, usuarioId, String(motivo).slice(0, 255)]
    );
    return rows.map((r) => r.id);
};

module.exports = { esEditable, exigirCorreccion, exigirMotivo, anularAlertas, evaluarCorreccion };
