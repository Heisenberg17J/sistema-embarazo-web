// Aplica las migraciones de db/migrations en orden y, opcionalmente, los datos de prueba.
//   node scripts/migrate.js            -> aplica migraciones pendientes
//   node scripts/migrate.js --seed     -> además carga db/seeds.sql
//   node scripts/migrate.js --solo-seed
//   node scripts/migrate.js --reset    -> BORRA el esquema completo y lo recrea (solo desarrollo/pruebas)
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const env = require('../src/config/env');

const DIR_DB = path.join(__dirname, '../../db');
const DIR_MIGRACIONES = path.join(DIR_DB, 'migrations');

const ejecutar = async ({ reset = false, seed = false, soloSeed = false, silencioso = false } = {}) => {
    const log = silencioso ? () => {} : console.log;
    const client = new Client({ ...env.db, options: `-c timezone=${env.zonaHoraria}` });
    await client.connect();
    try {
        if (reset) {
            if (env.entorno === 'production') throw new Error('--reset no está permitido en producción');
            await client.query('DROP SCHEMA IF EXISTS seguimiento_embarazo CASCADE; DROP TABLE IF EXISTS public.schema_migraciones;');
            log('Esquema eliminado.');
        }

        if (!soloSeed) {
            await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migraciones (
                nombre      VARCHAR(255) PRIMARY KEY,
                aplicada_en TIMESTAMPTZ  NOT NULL DEFAULT now())`);
            const { rows } = await client.query('SELECT nombre FROM public.schema_migraciones');
            const aplicadas = new Set(rows.map((r) => r.nombre));
            const archivos = fs.readdirSync(DIR_MIGRACIONES).filter((f) => f.endsWith('.sql')).sort();

            for (const archivo of archivos) {
                if (aplicadas.has(archivo)) continue;
                const sql = fs.readFileSync(path.join(DIR_MIGRACIONES, archivo), 'utf8');
                await client.query('BEGIN');
                try {
                    await client.query(sql);
                    await client.query('INSERT INTO public.schema_migraciones (nombre) VALUES ($1)', [archivo]);
                    await client.query('COMMIT');
                    log(`Migración aplicada: ${archivo}`);
                } catch (error) {
                    await client.query('ROLLBACK');
                    throw new Error(`Falló la migración ${archivo}: ${error.message}`);
                }
            }
        }

        if (seed || soloSeed) {
            await client.query(fs.readFileSync(path.join(DIR_DB, 'seeds.sql'), 'utf8'));
            log('Datos de prueba cargados.');
        }
    } finally {
        await client.end();
    }
};

if (require.main === module) {
    const args = process.argv.slice(2);
    ejecutar({ reset: args.includes('--reset'), seed: args.includes('--seed'), soloSeed: args.includes('--solo-seed') })
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error.message);
            process.exit(1);
        });
}

module.exports = { ejecutar };
