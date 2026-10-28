// Ganancia de peso recomendada según el IMC pregestacional (IOM 2009). Es una referencia
// orientativa para la gestante; la meta individual la define su profesional de salud.
const RANGOS_GANANCIA = [
    { hasta: 18.5, categoria: 'Bajo peso', min: 12.5, max: 18 },
    { hasta: 25, categoria: 'Peso adecuado', min: 11.5, max: 16 },
    { hasta: 30, categoria: 'Sobrepeso', min: 7, max: 11.5 },
    { hasta: Infinity, categoria: 'Obesidad', min: 5, max: 9 }
];

const redondear = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

// Estado del embarazo con edad gestacional, trimestre, IMC y ganancia de peso.
const resumenEmbarazo = async (db, embarazoId) => {
    const { rows } = await db.query(
        `SELECT v.*, e.talla_cm, e.peso_pregestacional_kg, e.fecha_finalizacion, e.observaciones,
                (SELECT m.valor FROM medicion m JOIN tipo_medicion t ON t.id = m.tipo_medicion_id
                  WHERE m.embarazo_id = e.id AND t.codigo = 'PESO'
                  ORDER BY m.fecha_registro DESC LIMIT 1) AS ultimo_peso_kg
           FROM v_embarazo_actual v JOIN embarazo e ON e.id = v.embarazo_id
          WHERE v.embarazo_id = $1`,
        [embarazoId]
    );
    const e = rows[0];
    if (!e) return null;

    if (e.estado !== 'ACTIVO') {
        e.semana_actual = null;
        e.edad_gestacional = null;
        e.trimestre = null;
        e.dias_para_parto = null;
    }

    e.peso = null;
    if (e.talla_cm && e.peso_pregestacional_kg) {
        const imc = e.peso_pregestacional_kg / (e.talla_cm / 100) ** 2;
        const rango = RANGOS_GANANCIA.find((r) => imc < r.hasta);
        e.peso = {
            imc_pregestacional: redondear(imc),
            categoria_imc: rango.categoria,
            ganancia_recomendada_kg: { min: rango.min, max: rango.max },
            ganancia_actual_kg: e.ultimo_peso_kg != null ? redondear(e.ultimo_peso_kg - e.peso_pregestacional_kg) : null,
            nota: 'Referencia orientativa; tu profesional de salud define la meta individual.'
        };
    }
    return e;
};

module.exports = { resumenEmbarazo };
