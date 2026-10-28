const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });

// Falla al arrancar si falta una variable crítica, en vez de fallar en la primera petición.
const requerida = (nombre) => {
    const valor = process.env[nombre];
    if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`);
    return valor;
};

const jwtSecret = requerida('JWT_SECRET');
if (jwtSecret.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres');

module.exports = {
    entorno: process.env.NODE_ENV || 'development',
    puerto: Number(process.env.PORT) || 4000,
    corsOrigen: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((o) => o.trim()),
    trustProxy: process.env.TRUST_PROXY === 'true',
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        user: requerida('DB_USER'),
        password: requerida('DB_PASSWORD'),
        database: requerida('DB_NAME'),
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    },
    jwt: {
        secreto: jwtSecret,
        expiraAcceso: process.env.JWT_EXPIRA || '15m',
        diasRefresh: Number(process.env.REFRESH_DIAS) || 7
    },
    bcryptCosto: Number(process.env.BCRYPT_COSTO) || 12
};
