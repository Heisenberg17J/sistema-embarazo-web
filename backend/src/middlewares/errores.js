const { HttpError } = require('../utils/http');

// Mensajes legibles para las restricciones que el usuario puede provocar.
const MENSAJES_RESTRICCION = {
    uq_usuario_correo: 'El correo electrónico ya está registrado',
    uq_usuario_correo_lower: 'El correo electrónico ya está registrado',
    uq_gestante_doc: 'Ya existe una gestante con ese documento',
    uq_prof_registro: 'Ya existe un profesional con ese registro',
    uq_embarazo_activo: 'La gestante ya tiene un embarazo activo',
    uq_cita_agenda: 'El profesional ya tiene una cita programada en esa fecha y hora',
    uq_asignacion_activa: 'La gestante ya está asignada a ese profesional',
    uq_control_cita: 'Esa cita ya tiene un control registrado',
    uq_tipo_control_codigo: 'Ya existe un tipo de control con ese código',
    uq_tipo_examen_codigo: 'Ya existe un tipo de examen con ese código',
    uq_tipo_sintoma_codigo: 'Ya existe un tipo de síntoma con ese código',
    uq_tipo_medicion_codigo: 'Ya existe un tipo de medición con ese código',
    uq_regla_codigo: 'Ya existe una regla con ese código',
    ck_embarazo_inicio: 'La fecha de inicio (FUM) no puede ser futura',
    ck_embarazo_fpp: 'La fecha probable de parto debe ser posterior a la FUM y no superar 320 días',
    ck_embarazo_fin: 'La fecha de finalización no es coherente con el estado del embarazo',
    ck_control_fecha: 'La fecha del control no puede ser futura',
    ck_sintoma_fecha: 'La fecha del síntoma no puede ser futura',
    ck_examen_fecha: 'La fecha del examen no puede ser futura',
    ck_gestante_nac: 'La fecha de nacimiento no es válida',
    ck_usuario_correo: 'El correo electrónico no es válido',
    ck_cita_cancel: 'Para cancelar una cita hay que indicar el motivo',
    ck_regla_valores: 'Los valores de la regla no son coherentes con el operador'
};

// eslint-disable-next-line no-unused-vars
const manejadorErrores = (error, req, res, next) => {
    if (error instanceof HttpError) {
        const cuerpo = { error: error.message };
        if (error.detalles) cuerpo.detalles = error.detalles;
        return res.status(error.status).json(cuerpo);
    }

    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido' });
    }

    // Errores de PostgreSQL: nunca se devuelve el mensaje interno salvo los que lanzan nuestros triggers.
    const amigable = MENSAJES_RESTRICCION[error.constraint];
    switch (error.code) {
        case '23505':
            return res.status(409).json({ error: amigable || 'El registro ya existe' });
        case '23503':
            return res.status(409).json({ error: 'El registro referencia datos inexistentes o tiene datos dependientes' });
        case '23514':
            // Sin constraint => la lanzó un trigger con un mensaje pensado para el usuario.
            return res.status(422).json({ error: amigable || (error.constraint ? 'Los datos no cumplen las reglas del sistema' : error.message) });
        case '23502':
            return res.status(400).json({ error: `Falta el campo obligatorio ${error.column}` });
        case '22P02':
        case '22007':
        case '22008':
        case '22003':
            return res.status(400).json({ error: 'Formato o valor de dato inválido' });
        case '42501':
            return res.status(403).json({ error: 'Operación no permitida' });
        default:
            console.error(error);
            return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

const rutaNoEncontrada = (req, res) => res.status(404).json({ error: 'Ruta no encontrada' });

module.exports = { manejadorErrores, rutaNoEncontrada };
