const { Pool, types } = require('pg');
const env = require('./env');

// BIGINT y NUMERIC llegan como texto por defecto; los ids y mediciones caben en Number.
types.setTypeParser(20, (v) => parseInt(v, 10));
types.setTypeParser(1700, (v) => parseFloat(v));
// DATE se devuelve tal cual (YYYY-MM-DD) para evitar corrimientos por zona horaria.
types.setTypeParser(1082, (v) => v);

const pool = new Pool({
    ...env.db,
    max: 10,
    options: '-c search_path=seguimiento_embarazo,public'
});

pool.on('error', (error) => {
    console.error('Error inesperado en el pool de PostgreSQL:', error.message);
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
