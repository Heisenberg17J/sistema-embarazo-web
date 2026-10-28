// RF-11: motor de alertas. Corre dentro de la transacción que registra la medición o el síntoma,
// así una alerta nunca queda sin su dato de origen ni un dato peligroso queda sin alerta.

const AVISO = 'Esta alerta es informativa y no reemplaza la valoración de un profesional de salud.';
const PESO_SEVERIDAD = { CRITICA: 3, ADVERTENCIA: 2, INFORMATIVA: 1 };
const INTENSIDAD_ALTA = 4;

const cumpleRegla = (regla, valor) => {
    switch (regla.operador) {
        case 'MENOR': return valor < regla.valor_referencia;
        case 'MENOR_IGUAL': return valor <= regla.valor_referencia;
        case 'MAYOR': return valor > regla.valor_referencia;
        case 'MAYOR_IGUAL': return valor >= regla.valor_referencia;
        case 'FUERA_DE_RANGO': return valor < regla.valor_min || valor > regla.valor_max;
        default: return false;
    }
};

const masSevera = (a, b) => PESO_SEVERIDAD[b.severidad] - PESO_SEVERIDAD[a.severidad];

// Si varias reglas aplican (p. ej. PAS 165 cumple ≥140 y ≥160) se emite solo la más severa.
const evaluarMedicion = async (db, medicion) => {
    const { rows: reglas } = await db.query(
        `SELECT * FROM regla_alerta
          WHERE activa AND tipo_medicion_id = $1 AND $2 BETWEEN semana_desde AND semana_hasta`,
        [medicion.tipo_medicion_id, medicion.semana_gestacion ?? 0]
    );
    const regla = reglas.filter((r) => cumpleRegla(r, medicion.valor)).sort(masSevera)[0];
    if (!regla) return null;

    const { rows } = await db.query(
        `INSERT INTO alerta (embarazo_id, regla_alerta_id, medicion_id, control_id, severidad, mensaje, valor_detectado)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (medicion_id, regla_alerta_id) DO NOTHING
         RETURNING *`,
        [medicion.embarazo_id, regla.id, medicion.id, medicion.control_id, regla.severidad, regla.mensaje, medicion.valor]
    );
    return rows[0] || null;
};

// Un signo de alarma siempre genera alerta (salvo que su ventana de semanas ya pasó);
// cualquier otro síntoma la genera si la gestante reporta intensidad alta.
const evaluarSintoma = async (db, sintoma, tipo, semana) => {
    let severidad;
    let mensaje;
    const alarmaVigente = tipo?.es_signo_alarma
        && (tipo.alarma_hasta_semana == null || semana < tipo.alarma_hasta_semana);

    if (alarmaVigente) {
        severidad = tipo.severidad;
        mensaje = tipo.mensaje_alarma;
    } else if (sintoma.intensidad >= INTENSIDAD_ALTA) {
        severidad = 'ADVERTENCIA';
        mensaje = 'Se registró un síntoma de intensidad alta: consulta con tu profesional de salud.';
    } else {
        return null;
    }

    const { rows } = await db.query(
        `INSERT INTO alerta (embarazo_id, sintoma_id, severidad, mensaje)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [sintoma.embarazo_id, sintoma.id, severidad, mensaje]
    );
    return rows[0];
};

// Forma pública de una alerta recién generada, con la indicación de acción inmediata.
const presentarAlerta = (alerta) => alerta && {
    ...alerta,
    accion_inmediata: alerta.severidad === 'CRITICA',
    aviso: AVISO
};

module.exports = { evaluarMedicion, evaluarSintoma, presentarAlerta, cumpleRegla, AVISO };
