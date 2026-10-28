const { api, auth, SEED, login, nuevaGestante, nuevoEmbarazo, asignar, fechaHace, pool } = require('./helpers');

afterAll(() => pool.end());

const manana = () => fechaHace(-1);

describe('Seguimiento del embarazo (RF-04 a RF-10, RF-16, RF-17)', () => {
    let admin;
    let prof;
    let g;
    let emb;
    let base;

    beforeAll(async () => {
        admin = await login(SEED.admin);
        prof = await login(SEED.profesional);
        g = await nuevaGestante();
        const res = await api().post('/api/v1/embarazos').set(auth(g.token))
            .send({ fecha_inicio: fechaHace(150), talla_cm: 160, peso_pregestacional_kg: 60 });
        expect(res.status).toBe(201);
        emb = res.body;
        await asignar(admin.token, prof.usuario.id, g.usuario.id);
        base = `/api/v1/embarazos/${emb.embarazo_id}`;
    });

    test('calcula FPP (Naegele), edad gestacional e IMC', () => {
        expect(emb.fecha_estimada_parto).toBe(fechaHace(150 - 280));
        expect(emb.semana_actual).toBe(21);
        expect(emb.edad_gestacional).toBe('21+3');
        expect(emb.trimestre).toBe(2);
        expect(emb.peso.imc_pregestacional).toBe(23.4);
        expect(emb.peso.categoria_imc).toBe('Peso adecuado');
    });

    test('solo un embarazo activo por gestante; FUM futura o muy antigua se rechaza', async () => {
        expect((await api().post('/api/v1/embarazos').set(auth(g.token)).send({ fecha_inicio: fechaHace(10) })).status).toBe(409);
        const otra = await nuevaGestante();
        expect((await api().post('/api/v1/embarazos').set(auth(otra.token)).send({ fecha_inicio: manana() })).status).toBe(400);
        expect((await api().post('/api/v1/embarazos').set(auth(otra.token)).send({ fecha_inicio: fechaHace(400) })).status).toBe(422);
        expect((await api().post('/api/v1/embarazos').set(auth(otra.token)).send({ fecha_inicio: '2026-02-30' })).status).toBe(400);
    });

    test('GET /embarazos/actual devuelve el embarazo de la gestante autenticada', async () => {
        const res = await api().get('/api/v1/embarazos/actual').set(auth(g.token));
        expect(res.status).toBe(200);
        expect(res.body.embarazo_id).toBe(emb.embarazo_id);
    });

    test('citas: programar, evitar choques de agenda y fechas pasadas', async () => {
        const cita = await api().post(`${base}/citas`).set(auth(prof.token)).send({ tipo_control: 'CONTROL_PRENATAL', fecha: manana(), hora: '07:15' });
        expect(cita.status).toBe(201);
        expect(cita.body.hora).toBe('07:15');

        const choque = await api().post(`${base}/citas`).set(auth(prof.token)).send({ tipo_control: 'ECOGRAFIA', fecha: manana(), hora: '07:15' });
        expect(choque.status).toBe(409);
        const pasada = await api().post(`${base}/citas`).set(auth(prof.token)).send({ tipo_control: 'ECOGRAFIA', fecha: fechaHace(2), hora: '08:00' });
        expect(pasada.status).toBe(422);

        const proximas = await api().get(`${base}/citas?ambito=proximas`).set(auth(g.token));
        expect(proximas.body.map((c) => c.id)).toContain(cita.body.id);

        const rep = await api().patch(`/api/v1/citas/${cita.body.id}`).set(auth(prof.token)).send({ hora: '07:45' });
        expect(rep.body.estado).toBe('REPROGRAMADA');

        // El control asociado deja la cita como CUMPLIDA
        const control = await api().post(`${base}/controles`).set(auth(prof.token)).send({
            cita_id: cita.body.id, mediciones: [{ tipo: 'PESO', valor: 65 }, { tipo: 'ALTURA_UTERINA', valor: 21 }]
        });
        expect(control.status).toBe(201);
        expect(control.body.semana_gestacion).toBe(21);
        const anteriores = await api().get(`${base}/citas?ambito=anteriores`).set(auth(g.token));
        expect(anteriores.body.find((c) => c.id === cita.body.id).estado).toBe('CUMPLIDA');
    });

    test('la gestante solo puede cancelar su cita y debe indicar motivo', async () => {
        const cita = await api().post(`${base}/citas`).set(auth(prof.token)).send({ tipo_control: 'ECOGRAFIA', fecha: manana(), hora: '09:30' });
        expect((await api().patch(`/api/v1/citas/${cita.body.id}/estado`).set(auth(g.token)).send({ estado: 'CUMPLIDA' })).status).toBe(403);
        expect((await api().patch(`/api/v1/citas/${cita.body.id}/estado`).set(auth(g.token)).send({ estado: 'CANCELADA' })).status).toBe(400);
        const ok = await api().patch(`/api/v1/citas/${cita.body.id}/estado`).set(auth(g.token)).send({ estado: 'CANCELADA', motivo_cancelacion: 'Viaje familiar' });
        expect(ok.body.estado).toBe('CANCELADA');
    });

    test('exámenes: el profesional registra y la gestante consulta', async () => {
        const ex = await api().post(`${base}/examenes`).set(auth(prof.token)).send({ tipo: 'GLICEMIA', fecha: fechaHace(1), resultado: '82 mg/dL' });
        expect(ex.status).toBe(201);
        const lista = await api().get(`${base}/examenes`).set(auth(g.token));
        expect(lista.body.datos[0].tipo).toBe('GLICEMIA');
    });

    test('historial cronológico y series para gráficas', async () => {
        await api().post(`${base}/sintomas`).set(auth(g.token)).send({ tipo: 'MAREO', intensidad: 1 });
        const hist = await api().get(`${base}/historial`).set(auth(prof.token));
        expect(hist.status).toBe(200);
        const tipos = new Set(hist.body.datos.map((h) => h.tipo));
        for (const t of ['CONTROL', 'SINTOMA', 'EXAMEN', 'CITA']) expect(tipos).toContain(t);

        const soloExamenes = await api().get(`${base}/historial?tipo=EXAMEN`).set(auth(g.token));
        expect(soloExamenes.body.datos.every((h) => h.tipo === 'EXAMEN')).toBe(true);

        const serie = await api().get(`${base}/mediciones/serie?tipos=PESO,PA_SISTOLICA`).set(auth(g.token));
        const peso = serie.body.series.find((s) => s.tipo === 'PESO');
        expect(peso.unidad).toBe('kg');
        expect(peso.puntos.length).toBeGreaterThan(0);
        const pas = serie.body.series.find((s) => s.tipo === 'PA_SISTOLICA');
        expect(pas.referencias.map((r) => r.codigo)).toEqual(expect.arrayContaining(['PAS_ELEVADA', 'PAS_SEVERA']));
    });

    test('paneles distintos según el rol (RF-17)', async () => {
        const pg = await api().get('/api/v1/dashboard').set(auth(g.token));
        expect(pg.body.rol).toBe('GESTANTE');
        expect(pg.body.embarazo.embarazo_id).toBe(emb.embarazo_id);
        expect(pg.body.ultimas_mediciones.map((m) => m.tipo)).toContain('PESO');

        const pp = await api().get('/api/v1/dashboard').set(auth(prof.token));
        expect(pp.body.resumen.pacientes).toBeGreaterThan(0);

        const pa = await api().get('/api/v1/dashboard').set(auth(admin.token));
        expect(pa.body.usuarios_por_rol).toHaveLength(3);
    });

    test('contenido educativo según la semana (RF-16)', async () => {
        const c = await api().post('/api/v1/contenido').set(auth(admin.token)).send({
            titulo: 'Signos de alarma', cuerpo: 'Acuda a urgencias si...', categoria: 'Alarma', semana_desde: 0, semana_hasta: 42, publicado: true
        });
        expect(c.status).toBe(201);
        const borrador = await api().post('/api/v1/contenido').set(auth(admin.token)).send({
            titulo: 'Borrador', cuerpo: 'x', semana_desde: 0, semana_hasta: 42
        });
        const mi = await api().get('/api/v1/contenido/mi-semana').set(auth(g.token));
        expect(mi.body.semana).toBe(21);
        const ids = mi.body.contenidos.map((x) => x.id);
        expect(ids).toContain(c.body.id);
        expect(ids).not.toContain(borrador.body.id);

        await api().post(`/api/v1/contenido/${c.body.id}/leido`).set(auth(g.token)).expect(200);
        const otra = await api().get('/api/v1/contenido/mi-semana').set(auth(g.token));
        expect(otra.body.contenidos.find((x) => x.id === c.body.id).leido).toBe(true);
        expect((await api().get(`/api/v1/contenido/${borrador.body.id}`).set(auth(g.token))).status).toBe(404);
    });

    test('finalizar el embarazo cancela las citas pendientes y bloquea nuevos registros', async () => {
        const g2 = await nuevaGestante();
        const e2 = await nuevoEmbarazo(g2.token, 200);
        await asignar(admin.token, prof.usuario.id, g2.usuario.id);
        const b2 = `/api/v1/embarazos/${e2.embarazo_id}`;
        const cita = await api().post(`${b2}/citas`).set(auth(prof.token)).send({ tipo_control: 'CONTROL_PRENATAL', fecha: manana(), hora: '11:00' });

        const fin = await api().patch(`${b2}/finalizar`).set(auth(prof.token)).send({ estado: 'FINALIZADO', observaciones: 'Parto vaginal sin complicaciones' });
        expect(fin.status).toBe(200);
        expect(fin.body.estado).toBe('FINALIZADO');
        const citas = await api().get(`${b2}/citas`).set(auth(g2.token));
        expect(citas.body.find((c) => c.id === cita.body.id).estado).toBe('CANCELADA');
        expect((await api().post(`${b2}/mediciones`).set(auth(g2.token)).send({ mediciones: [{ tipo: 'PESO', valor: 60 }] })).status).toBe(409);
    });

    test('auditoría: registra acciones y es de solo inserción (RNF-14)', async () => {
        const res = await api().get('/api/v1/admin/auditoria?accion=CREAR&entidad=control').set(auth(admin.token));
        expect(res.status).toBe(200);
        expect(res.body.datos.length).toBeGreaterThan(0);
        await expect(pool.query('UPDATE seguimiento_embarazo.auditoria SET entidad = $1', ['x'])).rejects.toThrow(/solo inserción/);
        await expect(pool.query('DELETE FROM seguimiento_embarazo.auditoria')).rejects.toThrow(/solo inserción/);
    });
});
