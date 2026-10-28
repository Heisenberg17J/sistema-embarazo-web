// Limpieza periódica (sesiones y enlaces de recuperación vencidos). Pensado para un cron semanal:
//   npm run limpiar
const { pool } = require('../src/config/db');
const { limpiar } = require('../src/services/mantenimiento');
const registro = require('../src/services/registro');

limpiar()
    .then((r) => { registro.info('limpieza terminada', r); return pool.end(); })
    .catch((e) => { registro.error('la limpieza falló', { error: e.message }); process.exitCode = 1; return pool.end(); });
