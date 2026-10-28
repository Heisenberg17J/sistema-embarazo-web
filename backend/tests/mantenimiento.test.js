const { pool } = require('./helpers');
const { limpiar } = require('../src/services/mantenimiento');
const { nuevaGestante, login, SEED } = require('./helpers');

afterAll(() => pool.end());

describe('Limpieza de sesiones y enlaces de recuperación', () => {
    const insertarSesion = (usuarioId, { expira, revocada = null }) => pool.query(
        `INSERT INTO seguimiento_embarazo.sesion (usuario_id, token_hash, emitida_en, expira_en, revocada_en)
         VALUES ($1, $2, now() - interval '90 days', $3, $4) RETURNING id`,
        [usuarioId, `h${Math.random().toString(36).slice(2)}${Date.now()}`, expira, revocada]
    ).then((r) => r.rows[0].id);

    const existe = async (id) => (await pool.query('SELECT 1 FROM seguimiento_embarazo.sesion WHERE id = $1', [id])).rowCount === 1;

    test('quita las vencidas hace más de 30 días y conserva las recientes y las vigentes', async () => {
        const g = await nuevaGestante();
        const vieja = await insertarSesion(g.usuario.id, { expira: new Date(Date.now() - 40 * 864e5) });
        const revocadaVieja = await insertarSesion(g.usuario.id, {
            expira: new Date(Date.now() + 864e5), revocada: new Date(Date.now() - 40 * 864e5)
        });
        const reciente = await insertarSesion(g.usuario.id, { expira: new Date(Date.now() - 5 * 864e5) });
        const vigente = await insertarSesion(g.usuario.id, { expira: new Date(Date.now() + 5 * 864e5) });

        const r = await limpiar();
        expect(r.sesiones).toBeGreaterThanOrEqual(2);

        expect(await existe(vieja)).toBe(false);
        expect(await existe(revocadaVieja)).toBe(false);
        expect(await existe(reciente)).toBe(true);
        expect(await existe(vigente)).toBe(true);
    });

    test('la sesión de una persona que acaba de entrar sigue funcionando', async () => {
        const sesion = await login(SEED.gestante);
        await limpiar();
        const refresco = await require('./helpers').api().post('/api/v1/auth/refresh').send({ refresh_token: sesion.refresh });
        expect(refresco.status).toBe(200);
    });

    test('quita los enlaces de recuperación vencidos o usados hace tiempo', async () => {
        const g = await nuevaGestante();
        const insertar = (expira, usada) => pool.query(
            `INSERT INTO seguimiento_embarazo.recuperacion_contrasena (usuario_id, token_hash, solicitada_en, expira_en, usada_en)
             VALUES ($1, $2, now() - interval '90 days', $3, $4) RETURNING id`,
            [g.usuario.id, `r${Math.random().toString(36).slice(2)}${Date.now()}`, expira, usada]
        ).then((x) => x.rows[0].id);
        const vencido = await insertar(new Date(Date.now() - 60 * 864e5), null);
        const usadoViejo = await insertar(new Date(Date.now() - 60 * 864e5), new Date(Date.now() - 50 * 864e5));
        const vigente = await insertar(new Date(Date.now() + 3600e3), null);

        await limpiar();
        const queda = async (id) => (await pool.query('SELECT 1 FROM seguimiento_embarazo.recuperacion_contrasena WHERE id = $1', [id])).rowCount === 1;
        expect(await queda(vencido)).toBe(false);
        expect(await queda(usadoViejo)).toBe(false);
        expect(await queda(vigente)).toBe(true);
    });

    test('no toca la auditoría', async () => {
        const antes = (await pool.query('SELECT count(*)::int AS n FROM seguimiento_embarazo.auditoria')).rows[0].n;
        await limpiar();
        const despues = (await pool.query('SELECT count(*)::int AS n FROM seguimiento_embarazo.auditoria')).rows[0].n;
        expect(despues).toBeGreaterThanOrEqual(antes);
    });
});
