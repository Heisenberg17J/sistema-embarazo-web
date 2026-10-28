const { api, auth, SEED, login, nuevaGestante, pool } = require('./helpers');
const registro = require('../src/services/registro');
const db = require('../src/config/db');

afterAll(() => pool.end());

describe('Registro de eventos y errores del servidor', () => {
    test('cada respuesta lleva un identificador de petición', async () => {
        const a = await api().get('/api/v1/salud');
        const b = await api().get('/api/v1/auth/me');
        expect(a.headers['x-request-id']).toMatch(/^[a-f0-9]{10}$/);
        expect(b.headers['x-request-id']).toMatch(/^[a-f0-9]{10}$/);
        expect(a.headers['x-request-id']).not.toBe(b.headers['x-request-id']);
    });

    test('un error inesperado devuelve el identificador y nada del error interno', async () => {
        const espiaError = jest.spyOn(registro, 'error').mockImplementation(() => {});
        const espiaBd = jest.spyOn(db.pool, 'query').mockRejectedValueOnce(new Error('FALLO INTERNO: clave de la base en 10.0.0.5'));
        try {
            const res = await api().post('/api/v1/auth/login').send({ correo: 'cualquiera@prueba.co', contrasena: 'Clave1234' });
            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Error interno del servidor');
            // Quien lo sufre recibe el identificador para reportarlo, no el detalle.
            expect(res.body.id).toBe(res.headers['x-request-id']);
            expect(JSON.stringify(res.body)).not.toMatch(/FALLO INTERNO|10\.0\.0\.5|stack|at /);

            // El detalle sí queda en el registro del servidor, con el mismo identificador.
            const llamada = espiaError.mock.calls.find(([msg]) => msg === 'error no controlado');
            expect(llamada).toBeTruthy();
            expect(llamada[1].id).toBe(res.body.id);
            expect(llamada[1].error).toMatch(/FALLO INTERNO/);
        } finally {
            espiaBd.mockRestore();
            espiaError.mockRestore();
        }
    });

    test('el registro de peticiones nunca incluye datos de la persona ni de la petición', async () => {
        const espia = jest.spyOn(registro, 'info').mockImplementation(() => {});
        try {
            const g = await nuevaGestante();
            await api().post('/api/v1/auth/login').send({ correo: g.datos.correo, contrasena: g.datos.contrasena }).expect(200);
            await api().get('/api/v1/usuarios?q=Maria%20Gomez&rol=GESTANTE').set(auth((await login(SEED.admin)).token)).expect(200);

            const registrado = JSON.stringify(espia.mock.calls);
            // Qué pasó, sí.
            expect(registrado).toMatch(/"metodo":"POST"/);
            expect(registrado).toMatch(/"ruta":"\/api\/v1\/auth\/login"/);
            expect(registrado).toMatch(/"estado":200/);
            // Qué dijo la persona, no: ni correo, ni contraseña, ni tokens, ni la búsqueda.
            expect(registrado).not.toContain(g.datos.correo);
            expect(registrado).not.toContain(g.datos.contrasena);
            expect(registrado).not.toContain('Maria');
            expect(registrado).not.toMatch(/eyJ[\w-]+\./); // un JWT
            expect(registrado).not.toContain('?'); // la cadena de consulta se descarta
        } finally {
            espia.mockRestore();
        }
    });

    test('el chequeo de disponibilidad no llena el registro', async () => {
        const espia = jest.spyOn(registro, 'info').mockImplementation(() => {});
        try {
            await api().get('/api/v1/salud').expect(200);
            expect(espia).not.toHaveBeenCalled();
        } finally {
            espia.mockRestore();
        }
    });

    test('una petición del servidor con error 5xx se registra como error', async () => {
        const espiaError = jest.spyOn(registro, 'error').mockImplementation(() => {});
        const espiaBd = jest.spyOn(db.pool, 'query').mockRejectedValueOnce(new Error('x'));
        try {
            await api().post('/api/v1/auth/login').send({ correo: 'a@b.co', contrasena: 'Clave1234' });
            expect(espiaError.mock.calls.map(([m]) => m)).toContain('petición con error del servidor');
        } finally {
            espiaBd.mockRestore();
            espiaError.mockRestore();
        }
    });
});
