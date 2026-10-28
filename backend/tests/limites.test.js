// Los límites se desactivan en las pruebas; en este archivo se activan a propósito.
process.env.LIMITES_EN_PRUEBAS = 'true';

const { api, auth, SEED, login, nuevaGestante, unico, pool } = require('./helpers');

afterAll(() => pool.end());

describe('Límite de peticiones', () => {
    test('los intentos de entrar se cuentan por cuenta: bloquear una no bloquea a las demás', async () => {
        const correo = `victima-${unico()}@prueba.co`;
        for (let i = 0; i < 10; i++) {
            const r = await api().post('/api/v1/auth/login').send({ correo, contrasena: 'incorrecta' });
            expect(r.status).toBe(401);
        }
        const bloqueado = await api().post('/api/v1/auth/login').send({ correo, contrasena: 'incorrecta' });
        expect(bloqueado.status).toBe(429);
        expect(bloqueado.body.error).toMatch(/Demasiados intentos/);

        // Otra persona, misma IP: entra sin problema.
        const otra = await api().post('/api/v1/auth/login').send(SEED.gestante);
        expect(otra.status).toBe(200);
    });

    test('el correo se compara sin importar mayúsculas ni espacios', async () => {
        const correo = `Mayus-${unico()}@Prueba.co`;
        for (let i = 0; i < 10; i++) await api().post('/api/v1/auth/login').send({ correo, contrasena: 'x' });
        const r = await api().post('/api/v1/auth/login').send({ correo: `  ${correo.toLowerCase()} `, contrasena: 'x' });
        expect(r.status).toBe(429);
    });

    test('pedir recuperar la contraseña tiene su propio tope, por correo', async () => {
        const correo = `recupera-${unico()}@prueba.co`;
        for (let i = 0; i < 5; i++) {
            expect((await api().post('/api/v1/auth/recuperar').send({ correo })).status).toBe(200);
        }
        expect((await api().post('/api/v1/auth/recuperar').send({ correo })).status).toBe(429);
        // Otro correo no se ve afectado.
        expect((await api().post('/api/v1/auth/recuperar').send({ correo: `otro-${unico()}@prueba.co` })).status).toBe(200);
    });

    test('el uso normal de la API no se acerca al límite general, y es por sesión', async () => {
        const a = await nuevaGestante();
        const b = await login(SEED.profesional);
        for (let i = 0; i < 20; i++) {
            expect((await api().get('/api/v1/auth/me').set(auth(a.token))).status).toBe(200);
        }
        expect((await api().get('/api/v1/auth/me').set(auth(b.token))).status).toBe(200);
    });
});
