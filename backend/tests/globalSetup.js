require('./env');
const { Client } = require('pg');

// Crea la BD de pruebas si no existe y la deja con migraciones + datos de prueba.
module.exports = async () => {
    const admin = new Client({
        host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
        user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: 'postgres'
    });
    await admin.connect();
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [process.env.DB_NAME]);
    if (!rowCount) await admin.query(`CREATE DATABASE "${process.env.DB_NAME}"`);
    await admin.end();

    const { ejecutar } = require('../scripts/migrate');
    await ejecutar({ reset: true, seed: true, silencioso: true });
};
