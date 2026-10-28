const { api, auth, SEED, login, nuevaGestante, nuevoEmbarazo, asignar, pool } = require('./helpers');

afterAll(() => pool.end());

describe('Control de acceso por rol y privacidad (RF-03, RNF-02, RNF-03)', () => {
    let admin;
    let prof;
    let prof2;

    beforeAll(async () => {
        admin = await login(SEED.admin);
        prof = await login(SEED.profesional);
        prof2 = await login(SEED.profesional2);
    });

    test('una gestante no accede a funciones de administración', async () => {
        const g = await nuevaGestante();
        expect((await api().get('/api/v1/usuarios').set(auth(g.token))).status).toBe(403);
        expect((await api().post('/api/v1/asignaciones').set(auth(g.token)).send({ profesional_id: 2, gestante_id: g.usuario.id })).status).toBe(403);
        expect((await api().get('/api/v1/admin/auditoria').set(auth(g.token))).status).toBe(403);
    });

    test('una gestante no ve el embarazo de otra (404, sin revelar que existe)', async () => {
        const a = await nuevaGestante();
        const b = await nuevaGestante();
        const embB = await nuevoEmbarazo(b.token);
        const res = await api().get(`/api/v1/embarazos/${embB.embarazo_id}`).set(auth(a.token));
        expect(res.status).toBe(404);
        expect((await api().get(`/api/v1/embarazos/${embB.embarazo_id}/historial`).set(auth(a.token))).status).toBe(404);
        expect((await api().post(`/api/v1/embarazos/${embB.embarazo_id}/mediciones`).set(auth(a.token))
            .send({ mediciones: [{ tipo: 'PESO', valor: 60 }] })).status).toBe(404);
    });

    test('el profesional solo accede mientras la asignación está activa', async () => {
        const g = await nuevaGestante();
        const emb = await nuevoEmbarazo(g.token);
        const ruta = `/api/v1/embarazos/${emb.embarazo_id}`;

        expect((await api().get(ruta).set(auth(prof.token))).status).toBe(404);

        const asignacion = await asignar(admin.token, prof.usuario.id, g.usuario.id);
        expect((await api().get(ruta).set(auth(prof.token))).status).toBe(200);
        expect((await api().get(ruta).set(auth(prof2.token))).status).toBe(404);

        const pacientes = await api().get('/api/v1/pacientes').set(auth(prof.token));
        expect(pacientes.body.map((p) => p.gestante_usuario_id)).toContain(g.usuario.id);

        await api().patch(`/api/v1/asignaciones/${asignacion.id}/finalizar`).set(auth(admin.token)).expect(200);
        expect((await api().get(ruta).set(auth(prof.token))).status).toBe(404);
    });

    test('el administrador no ve datos clínicos individuales', async () => {
        const g = await nuevaGestante();
        const emb = await nuevoEmbarazo(g.token);
        expect((await api().get(`/api/v1/embarazos/${emb.embarazo_id}`).set(auth(admin.token))).status).toBe(403);
    });

    test('la gestante no puede registrar controles ni exámenes', async () => {
        const g = await nuevaGestante();
        const emb = await nuevoEmbarazo(g.token);
        expect((await api().post(`/api/v1/embarazos/${emb.embarazo_id}/controles`).set(auth(g.token)).send({})).status).toBe(403);
        expect((await api().post(`/api/v1/embarazos/${emb.embarazo_id}/examenes`).set(auth(g.token))
            .send({ tipo: 'HEMOGRAMA', fecha: '2026-01-01', resultado: 'x' })).status).toBe(403);
    });

    test('no se duplica una asignación activa', async () => {
        const g = await nuevaGestante();
        await asignar(admin.token, prof2.usuario.id, g.usuario.id);
        const res = await api().post('/api/v1/asignaciones').set(auth(admin.token)).send({ profesional_id: prof2.usuario.id, gestante_id: g.usuario.id });
        expect(res.status).toBe(409);
    });

    test('no se puede asignar a un usuario con el rol equivocado', async () => {
        const g = await nuevaGestante();
        const res = await api().post('/api/v1/asignaciones').set(auth(admin.token)).send({ profesional_id: g.usuario.id, gestante_id: g.usuario.id });
        expect(res.status).toBe(400);
    });
});
