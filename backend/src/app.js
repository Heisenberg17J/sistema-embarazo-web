const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/env');
const { pool } = require('./config/db');
const { manejadorErrores, rutaNoEncontrada } = require('./middlewares/errores');

const app = express();

if (env.trustProxy) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.corsOrigen }));
app.use(express.json({ limit: '100kb' }));

// Comprobación de salud para despliegue/monitoreo (RNF-05).
app.get('/api/v1/salud', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.status(200).json({ estado: 'ok', base_datos: 'ok' });
    } catch {
        res.status(503).json({ estado: 'degradado', base_datos: 'sin conexión' });
    }
});

const api = express.Router();
api.use('/auth', require('./modules/auth/routes'));
api.use('/usuarios', require('./modules/usuarios/routes'));
api.use('/asignaciones', require('./modules/asignaciones/routes'));
api.use('/embarazos', require('./modules/embarazos/routes'));
api.use('/citas', require('./modules/citas/routes').router);
api.use('/alertas', require('./modules/alertas/routes').router);
api.use('/pacientes', require('./modules/pacientes/routes'));
api.use('/catalogos', require('./modules/catalogos/routes'));
api.use('/contenido', require('./modules/contenido/routes'));
api.use('/dashboard', require('./modules/dashboard/routes'));
api.use('/admin', require('./modules/administracion/routes'));
app.use('/api/v1', api);

app.use(rutaNoEncontrada);
app.use(manejadorErrores);

module.exports = app;
