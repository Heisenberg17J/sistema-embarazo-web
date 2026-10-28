const app = require('./app');
const env = require('./config/env');
const { pool } = require('./config/db');

const servidor = app.listen(env.puerto, () => {
    console.log(`API de seguimiento del embarazo en http://localhost:${env.puerto}/api/v1`);
});

const cerrar = () => {
    servidor.close(() => pool.end().then(() => process.exit(0)));
};
process.on('SIGTERM', cerrar);
process.on('SIGINT', cerrar);
