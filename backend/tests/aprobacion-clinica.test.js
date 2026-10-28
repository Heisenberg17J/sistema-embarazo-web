const { api, auth, SEED, login, nuevaGestante, pool } = require('./helpers');

afterAll(() => pool.end());

describe('Aprobación clínica de reglas y signos de alarma', () => {
    let admin;
    let prof;
    let regla;
    let signo;

    const revision = async (token) => (await api().get('/api/v1/catalogos/revision-clinica').set(auth(token))).body;

    beforeAll(async () => {
        admin = await login(SEED.admin);
        prof = await login(SEED.profesional);
        const r = await revision(prof.token);
        regla = r.reglas.find((x) => x.codigo === 'PAS_SEVERA');
        signo = r.signos.find((x) => x.codigo === 'SANGRADO');
    });

    test('al inicio nada está aprobado: lo escribió un desarrollador, no un clínico', async () => {
        const r = await revision(prof.token);
        expect(r.pendientes).toBeGreaterThan(10);
        expect(regla.aprobada_en).toBeNull();
        expect(signo.aprobada_en).toBeNull();
    });

    test('solo un profesional aprueba: ni el administrador ni la gestante', async () => {
        const g = await nuevaGestante();
        const ruta = `/api/v1/catalogos/reglas-alerta/${regla.id}/aprobar`;
        expect((await api().post(ruta).set(auth(admin.token))).status).toBe(403);
        expect((await api().post(ruta).set(auth(g.token))).status).toBe(403);
        expect((await api().get('/api/v1/catalogos/revision-clinica').set(auth(g.token))).status).toBe(403);
    });

    test('al aprobar queda quién y cuándo, y baja el número de pendientes', async () => {
        const antes = (await revision(prof.token)).pendientes;

        const res = await api().post(`/api/v1/catalogos/reglas-alerta/${regla.id}/aprobar`).set(auth(prof.token));
        expect(res.status).toBe(200);
        expect(res.body.aprobada_por_nombre).toBe('Carlos Mejía');

        await api().post(`/api/v1/catalogos/tipos-sintoma/${signo.id}/aprobar`).set(auth(prof.token)).expect(200);

        const despues = await revision(prof.token);
        expect(despues.pendientes).toBe(antes - 2);
        expect(despues.reglas.find((x) => x.id === regla.id).aprobada_por).toBe('Carlos Mejía');
    });

    test('un síntoma que no es signo de alarma no se aprueba', async () => {
        const { rows } = await pool.query("SELECT id FROM seguimiento_embarazo.tipo_sintoma WHERE es_signo_alarma = FALSE LIMIT 1");
        const res = await api().post(`/api/v1/catalogos/tipos-sintoma/${rows[0].id}/aprobar`).set(auth(prof.token));
        expect(res.status).toBe(404);
    });

    test('si el administrador cambia lo aprobado, la aprobación se retira', async () => {
        // La regla ya está aprobada por la prueba anterior.
        expect((await revision(prof.token)).reglas.find((x) => x.id === regla.id).aprobada_en).not.toBeNull();

        const res = await api().patch(`/api/v1/catalogos/reglas-alerta/${regla.id}`).set(auth(admin.token)).send({ valor_referencia: 165 });
        expect(res.status).toBe(200);

        const r = (await revision(prof.token)).reglas.find((x) => x.id === regla.id);
        expect(r.valor_referencia).toBe(165);
        expect(r.aprobada_en).toBeNull();
        expect(r.aprobada_por).toBeNull();

        // Restablecer el valor original para no contaminar otras pruebas.
        await api().patch(`/api/v1/catalogos/reglas-alerta/${regla.id}`).set(auth(admin.token)).send({ valor_referencia: 160 }).expect(200);
    });

    test('cambiar solo el nombre, que no es contenido clínico, no retira la aprobación', async () => {
        await api().post(`/api/v1/catalogos/tipos-sintoma/${signo.id}/aprobar`).set(auth(prof.token)).expect(200);
        const leer = async () => (await pool.query('SELECT aprobada_en, nombre FROM seguimiento_embarazo.tipo_sintoma WHERE id = $1', [signo.id])).rows[0];
        expect((await leer()).aprobada_en).not.toBeNull();

        try {
            await api().patch(`/api/v1/catalogos/tipos-sintoma/${signo.id}`).set(auth(admin.token)).send({ nombre: 'Sangrado vaginal' }).expect(200);
            const despues = await leer();
            expect(despues.nombre).toBe('Sangrado vaginal');
            expect(despues.aprobada_en).not.toBeNull();
        } finally {
            // Otras pruebas leen este nombre: se devuelve como estaba.
            await api().patch(`/api/v1/catalogos/tipos-sintoma/${signo.id}`).set(auth(admin.token)).send({ nombre: 'Sangrado' });
        }
    });

    test('la aprobación queda en la auditoría', async () => {
        const { rows } = await pool.query(
            `SELECT 1 FROM seguimiento_embarazo.auditoria WHERE usuario_id = $1 AND entidad = 'regla_alerta' AND detalle->>'aprobacion_clinica' = 'true'`,
            [prof.usuario.id]
        );
        expect(rows.length).toBeGreaterThan(0);
    });
});
