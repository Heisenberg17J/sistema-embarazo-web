const { Pool, types } = require('pg');
const env = require('./env');
const registro = require('../services/registro');

// BIGINT y NUMERIC llegan como texto por defecto; los ids y mediciones caben en Number.
types.setTypeParser(20, (v) => parseInt(v, 10));
types.setTypeParser(1700, (v) => parseFloat(v));
// DATE se devuelve tal cual (YYYY-MM-DD) para evitar corrimientos por zona horaria.
types.setTypeParser(1082, (v) => v);

const pool = new Pool({
    ...env.db,
    max: 10,
    // CURRENT_DATE y fn_semana_gestacion dependen de la zona de la sesión: se
    // fija igual que en Node, porque la de un PostgreSQL gestionado suele ser UTC.
    options: `-c search_path=seguimiento_embarazo,public -c timezone=${env.zonaHoraria}`
});

pool.on('error', (error) => {
    registro.error('error inesperado en el pool de PostgreSQL', { error: error.message });
});

// Ejecuta fn dentro de una transacción; hace ROLLBACK si algo falla.
const transaccion = async (fn) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const resultado = await fn(client);
        await client.query('COMMIT');
        return resultado;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = { pool, transaccion };
