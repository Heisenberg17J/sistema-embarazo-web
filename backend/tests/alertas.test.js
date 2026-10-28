const { api, auth, SEED, login, nuevaGestante, nuevoEmbarazo, asignar, pool } = require('./helpers');

afterAll(() => pool.end());

describe('Motor de alertas y signos de alarma (RF-11, RF-12)', () => {
    let admin;
    let prof;
    let g;
    let emb;
    let base;

    beforeAll(async () => {
        admin = await login(SEED.admin);
        prof = await login(SEED.profesional);
        g = await nuevaGestante();
        emb = await nuevoEmbarazo(g.token, 150); // semana 21
        await asignar(admin.token, prof.usuario.id, g.usuario.id);
        base = `/api/v1/embarazos/${emb.embarazo_id}`;
    });

    const medir = (mediciones, token = g.token) => api().post(`${base}/mediciones`).set(auth(token)).send({ mediciones });
    const sintoma = (datos) => api().post(`${base}/sintomas`).set(auth(g.token)).send(datos);

    test('presión 165/112 genera solo la alerta más severa por cada valor (CRITICA)', async () => {
        const res = await medir([{ tipo: 'PA_SISTOLICA', valor: 165 }, { tipo: 'PA_DIASTOLICA', valor: 112 }]);
        expect(res.status).toBe(201);
        expect(res.body.alertas).toHaveLength(2);
        for (const a of res.body.alertas) {
            expect(a.severidad).toBe('CRITICA');
            expect(a.accion_inmediata).toBe(true);
            expect(a.mensaje).toMatch(/urgencias/);
            expect(a.aviso).toMatch(/no reemplaza/);
        }
    });

    test('presión 145/85 genera advertencia solo por la sistólica', async () => {
        const res = await medir([{ tipo: 'PA_SISTOLICA', valor: 145 }, { tipo: 'PA_DIASTOLICA', valor: 85 }]);
        expect(res.body.alertas).toHaveLength(1);
        expect(res.body.alertas[0].severidad).toBe('ADVERTENCIA');
    });

    test('valores normales no generan alertas', async () => {
        const res = await medir([{ tipo: 'PA_SISTOLICA', valor: 115 }, { tipo: 'PA_DIASTOLICA', valor: 75 }, { tipo: 'PESO', valor: 64.25 }]);
        expect(res.status).toBe(201);
        expect(res.body.alertas).toHaveLength(0);
        expect(res.body.mediciones.find((m) => m.tipo === 'PESO').valor).toBe(64.3); // redondeo a 1 decimal
    });

    test('valores fuera del rango técnico se rechazan con mensaje claro', async () => {
        const res = await medir([{ tipo: 'PA_SISTOLICA', valor: 400 }]);
        expect(res.status).toBe(422);
        expect(res.body.error).toMatch(/fuera del rango técnico/);
    });

    test('la gestante no puede registrar mediciones reservadas al profesional', async () => {
        const res = await medir([{ tipo: 'FCF', valor: 140 }]);
        expect(res.status).toBe(422);
        expect(res.body.error).toMatch(/no está autorizada/);
    });

    test('un tipo de medición inexistente responde 400', async () => {
        expect((await medir([{ tipo: 'INVENTADO', valor: 1 }])).status).toBe(400);
    });

    test('sangrado es signo de alarma: alerta CRITICA inmediata', async () => {
        const res = await sintoma({ tipo: 'SANGRADO', intensidad: 2 });
        expect(res.status).toBe(201);
        expect(res.body.alerta.severidad).toBe('CRITICA');
        expect(res.body.alerta.accion_inmediata).toBe(true);
        expect(res.body.descripcion).toBe('Sangrado');
    });

    test('contracciones antes de la semana 37 son alarma', async () => {
        const res = await sintoma({ tipo: 'CONTRACCIONES' });
        expect(res.body.alerta.severidad).toBe('CRITICA');
    });

    test('síntoma común leve no alerta; con intensidad alta sí (ADVERTENCIA)', async () => {
        const leve = await sintoma({ tipo: 'NAUSEAS', intensidad: 2 });
        expect(leve.body.alerta).toBeNull();
        const fuerte = await sintoma({ tipo: 'NAUSEAS', intensidad: 5 });
        expect(fuerte.body.alerta.severidad).toBe('ADVERTENCIA');
    });

    test('el profesional ve las alertas de su paciente, críticas primero, y las revisa', async () => {
        const lista = await api().get('/api/v1/alertas?estado=PENDIENTE').set(auth(prof.token));
        expect(lista.status).toBe(200);
        const propias = lista.body.datos.filter((a) => a.embarazo_id === emb.embarazo_id);
        expect(propias.length).toBeGreaterThanOrEqual(5);
        expect(lista.body.datos[0].severidad).toBe('CRITICA');

        const id = propias[0].id;
        const rev = await api().patch(`/api/v1/alertas/${id}/revisar`).set(auth(prof.token)).send({ estado: 'REVISADA', observacion: 'Se contactó a la paciente' });
        expect(rev.status).toBe(200);
        expect(rev.body.estado).toBe('REVISADA');
        expect(rev.body.revisor).toBeTruthy();

        const otraVez = await api().patch(`/api/v1/alertas/${id}/revisar`).set(auth(prof.token)).send({ estado: 'REVISADA' });
        expect(otraVez.status).toBe(409);
    });

    test('un profesional no asignado no puede revisar la alerta', async () => {
        const prof2 = await login(SEED.profesional2);
        const { rows } = await pool.query('SELECT id FROM seguimiento_embarazo.alerta WHERE embarazo_id = $1 AND estado = $2 LIMIT 1', [emb.embarazo_id, 'PENDIENTE']);
        const res = await api().patch(`/api/v1/alertas/${rows[0].id}/revisar`).set(auth(prof2.token)).send({ estado: 'REVISADA' });
        expect(res.status).toBe(404);
    });

    test('la gestante ve sus propias alertas', async () => {
        const res = await api().get('/api/v1/alertas').set(auth(g.token));
        expect(res.body.datos.length).toBeGreaterThan(0);
        expect(res.body.datos.every((a) => a.gestante_usuario_id === g.usuario.id)).toBe(true);
    });

    test('las mediciones de un control también pasan por el motor de alertas', async () => {
        const res = await api().post(`${base}/controles`).set(auth(prof.token)).send({
            observaciones: 'Control de rutina', mediciones: [{ tipo: 'FCF', valor: 95 }, { tipo: 'PESO', valor: 66 }]
        });
        expect(res.status).toBe(201);
        expect(res.body.mediciones).toHaveLength(2);
        expect(res.body.alertas).toHaveLength(1);
        expect(res.body.alertas[0].severidad).toBe('CRITICA');
    });
});
