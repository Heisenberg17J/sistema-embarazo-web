const app = require('./app');
const env = require('./config/env');
const { pool } = require('./config/db');
const registro = require('./services/registro');

const servidor = app.listen(env.puerto, () => {
    console.log(`API de seguimiento del embarazo en http://localhost:${env.puerto}/api/v1`);
});

// Un error que nadie atrapó no debe desaparecer: queda registrado antes de que el proceso termine.
process.on('unhandledRejection', (motivo) => {
    registro.error('promesa rechazada sin atender', { error: motivo?.message ?? String(motivo), pila: motivo?.stack });
});
process.on('uncaughtException', (error) => {
    registro.error('excepción sin atrapar', { error: error.message, pila: error.stack });
    process.exit(1);
});

const cerrar = () => {
    servidor.close(() => pool.end().then(() => process.exit(0)));
};
process.on('SIGTERM', cerrar);
process.on('SIGINT', cerrar);
