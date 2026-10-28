const { HttpError } = require('../utils/http');
const { evaluarMedicion, presentarAlerta } = require('./alertas');

// Registra un lote de mediciones (p. ej. sistólica + diastólica) y corre el motor de alertas
// sobre cada una. Debe llamarse dentro de una transacción.
const registrarMediciones = async (db, { embarazo, mediciones, origen, registradoPor, controlId = null, fechaRegistro = null, observaciones = null }) => {
    const codigos = mediciones.map((m) => m.tipo);
    if (new Set(codigos).size !== codigos.length) throw new HttpError(400, 'Hay tipos de medición repetidos en la misma toma');

    const { rows: tipos } = await db.query(
        'SELECT id, codigo, decimales FROM tipo_medicion WHERE codigo = ANY($1) AND activo', [codigos]
    );
    const porCodigo = new Map(tipos.map((t) => [t.codigo, t]));
    const desconocidos = codigos.filter((c) => !porCodigo.has(c));
    if (desconocidos.length) throw new HttpError(400, `Tipo de medición no válido: ${desconocidos.join(', ')}`);

    const registradas = [];
    const alertas = [];
    for (const { tipo, valor } of mediciones) {
        const t = porCodigo.get(tipo);
        const { rows } = await db.query(
            `INSERT INTO medicion (embarazo_id, tipo_medicion_id, control_id, registrado_por, origen, valor,
                                   fecha_registro, semana_gestacion, observaciones)
             VALUES ($1, $2, $3, $4, $5, round($6::numeric, $7), COALESCE($8, now()),
                     fn_semana_gestacion($9, COALESCE($8, now())::date), $10)
             RETURNING *`,
            [embarazo.id, t.id, controlId, registradoPor, origen, valor, t.decimales, fechaRegistro,
                embarazo.fecha_inicio, observaciones]
        );
        const medicion = { ...rows[0], tipo };
        registradas.push(medicion);
        const alerta = await evaluarMedicion(db, medicion);
        if (alerta) alertas.push(presentarAlerta(alerta));
    }
    return { mediciones: registradas, alertas };
};

module.exports = { registrarMediciones };
