const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const api = () => request(app);
const auth = (token) => ({ Authorization: `Bearer ${token}` });

// Credenciales de db/seeds.sql
const SEED = {
    admin: { correo: 'admin@seguimiento.co', contrasena: 'Admin*2026' },
    profesional: { correo: 'cmejia@seguimiento.co', contrasena: 'Prof*2026' },
    profesional2: { correo: 'aduarte@seguimiento.co', contrasena: 'Prof*2026' },
    gestante: { correo: 'maria.gomez@correo.co', contrasena: 'Gest*2026' }
};

const login = async ({ correo, contrasena }) => {
    const res = await api().post('/api/v1/auth/login').send({ correo, contrasena });
    if (res.status !== 200) throw new Error(`Login falló para ${correo}: ${res.status} ${JSON.stringify(res.body)}`);
    return { token: res.body.access_token, refresh: res.body.refresh_token, usuario: res.body.usuario };
};

let contador = 0;
const unico = () => `${Date.now().toString(36)}${(contador++).toString(36)}`;

const fechaHace = (dias) => {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

// Registra una gestante nueva por el endpoint público y devuelve su sesión.
const nuevaGestante = async (extra = {}) => {
    const u = unico();
    const datos = {
        nombre: 'Prueba', apellido: `Gestante ${u}`, correo: `g${u}@prueba.co`, contrasena: 'Clave1234',
        numero_documento: `D${u}`.slice(0, 20), fecha_nacimiento: '1995-03-10', ...extra
    };
    const res = await api().post('/api/v1/auth/registro').send(datos);
    if (res.status !== 201) throw new Error(`Registro falló: ${JSON.stringify(res.body)}`);
    return { token: res.body.access_token, refresh: res.body.refresh_token, usuario: res.body.usuario, datos };
};

const nuevoEmbarazo = async (token, diasDesdeFum = 140) => {
    const res = await api().post('/api/v1/embarazos').set(auth(token)).send({ fecha_inicio: fechaHace(diasDesdeFum) });
    if (res.status !== 201) throw new Error(`Embarazo falló: ${JSON.stringify(res.body)}`);
    return res.body;
};

const asignar = async (tokenAdmin, profesionalId, gestanteId) => {
    const res = await api().post('/api/v1/asignaciones').set(auth(tokenAdmin)).send({ profesional_id: profesionalId, gestante_id: gestanteId });
    if (res.status !== 201) throw new Error(`Asignación falló: ${JSON.stringify(res.body)}`);
    return res.body;
};

module.exports = { api, auth, SEED, login, unico, fechaHace, nuevaGestante, nuevoEmbarazo, asignar, pool };
