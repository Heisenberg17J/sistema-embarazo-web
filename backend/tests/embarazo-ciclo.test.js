const { api, auth, SEED, login, nuevaGestante, nuevoEmbarazo, asignar, fechaHace, pool } = require('./helpers');

afterAll(() => pool.end());

const dias = (n) => fechaHace(-n);

describe('Ciclo de vida del embarazo', () => {
    let admin;
    let prof;

    beforeAll(async () => {
        admin = await login(SEED.admin);
        prof = await login(SEED.profesional);
    });

    describe('corregir la fecha de última menstruación', () => {
        test('la fecha probable de parto y las semanas ya guardadas siguen a la nueva fecha', async () => {
            const g = await nuevaGestante();
            const emb = await nuevoEmbarazo(g.token, 140); // semana 20
            await asignar(admin.token, prof.usuario.id, g.usuario.id);
            const base = `/api/v1/embarazos/${emb.embarazo_id}`;

            const m = await api().post(`${base}/mediciones`).set(auth(g.token)).send({ mediciones: [{ tipo: 'PESO', valor: 62 }] }).expect(201);
            await api().post(`${base}/controles`).set(auth(prof.token)).send({ mediciones: [{ tipo: 'PESO', valor: 63 }] }).expect(201);
            expect(m.body.mediciones[0].semana_gestacion).toBe(20);

            // Se había escrito mal: la FUM era 14 días antes.
            const res = await api().patch(base).set(auth(g.token)).send({ fecha_inicio: fechaHace(154) });
            expect(res.status).toBe(200);
            expect(res.body.fecha_inicio).toBe(fechaHace(154));
            expect(res.body.fecha_estimada_parto).toBe(fechaHace(154 - 280));
            expect(res.body.semana_actual).toBe(22);

            // Lo que ya estaba guardado se recalculó: si no, las gráficas quedarían desfasadas.
            const { rows: med } = await pool.query('SELECT semana_gestacion FROM seguimiento_embarazo.medicion WHERE embarazo_id = $1', [emb.embarazo_id]);
            const { rows: con } = await pool.query('SELECT semana_gestacion FROM seguimiento_embarazo.control WHERE embarazo_id = $1', [emb.embarazo_id]);
            expect(med.map((r) => r.semana_gestacion)).toEqual(expect.arrayContaining([22]));
            expect(con.map((r) => r.semana_gestacion)).toEqual([22]);

            // Queda constancia de qué cambió.
            const { rows } = await pool.query(
                `SELECT detalle FROM seguimiento_embarazo.auditoria WHERE entidad = 'embarazo' AND entidad_id = $1 AND accion = 'MODIFICAR' ORDER BY id DESC LIMIT 1`, [emb.embarazo_id]
            );
            expect(rows[0].detalle.fecha_inicio.antes).toBe(fechaHace(140));
            expect(rows[0].detalle.semanas_recalculadas.mediciones).toBeGreaterThan(0);
        });

        test('si se indica una fecha probable de parto propia, se respeta', async () => {
            const g = await nuevaGestante();
            const emb = await nuevoEmbarazo(g.token, 100);
            const fpp = dias(190);
            const res = await api().patch(`/api/v1/embarazos/${emb.embarazo_id}`).set(auth(g.token))
                .send({ fecha_inicio: fechaHace(110), fecha_estimada_parto: fpp });
            expect(res.status).toBe(200);
            expect(res.body.fecha_estimada_parto).toBe(fpp);
        });

        test('cambiar solo los datos de talla y peso no toca las fechas ni las semanas', async () => {
            const g = await nuevaGestante();
            const emb = await nuevoEmbarazo(g.token, 100);
            const res = await api().patch(`/api/v1/embarazos/${emb.embarazo_id}`).set(auth(g.token)).send({ talla_cm: 162, peso_pregestacional_kg: 58 });
            expect(res.status).toBe(200);
            expect(res.body.fecha_inicio).toBe(emb.fecha_inicio);
            expect(res.body.fecha_estimada_parto).toBe(emb.fecha_estimada_parto);
            expect(res.body.peso.imc_pregestacional).toBe(22.1);
        });

        test('una fecha posterior a lo ya registrado se rechaza: dejaría datos antes de que empezara el embarazo', async () => {
            const g = await nuevaGestante();
            const emb = await nuevoEmbarazo(g.token, 100);
            const base = `/api/v1/embarazos/${emb.embarazo_id}`;
            await api().post(`${base}/sintomas`).set(auth(g.token)).send({ tipo: 'NAUSEAS', fecha: fechaHace(60) }).expect(201);

            // FUM hace 30 días, pero ya hay un síntoma de hace 60: sería "anterior al embarazo".
            const res = await api().patch(base).set(auth(g.token)).send({ fecha_inicio: fechaHace(30) });
            expect(res.status).toBe(422);
            expect(res.body.error).toMatch(/posterior al primer registro/);
            expect(res.body.error).toContain(fechaHace(60));

            // Nada cambió: ni la FUM ni la fecha probable de parto.
            const { rows } = await pool.query('SELECT fecha_inicio::text, fecha_estimada_parto::text FROM seguimiento_embarazo.embarazo WHERE id = $1', [emb.embarazo_id]);
            expect(rows[0].fecha_inicio).toBe(fechaHace(100));
            expect(rows[0].fecha_estimada_parto).toBe(emb.fecha_estimada_parto);

            // Una FUM anterior al primer registro sí vale.
            expect((await api().patch(base).set(auth(g.token)).send({ fecha_inicio: fechaHace(75) })).status).toBe(200);
        });

        test('no se acepta una fecha futura ni una anterior a la semana máxima (45)', async () => {
            const g = await nuevaGestante();
            const emb = await nuevoEmbarazo(g.token, 100);
            const base = `/api/v1/embarazos/${emb.embarazo_id}`;
            expect((await api().patch(base).set(auth(g.token)).send({ fecha_inicio: dias(3) })).status).toBe(400);
            const vieja = await api().patch(base).set(auth(g.token)).send({ fecha_inicio: fechaHace(400) });
            expect(vieja.status).toBe(422);
            expect(vieja.body.error).toMatch(/45 semanas/);
        });

        test('una gestante no edita el embarazo de otra', async () => {
            const a = await nuevaGestante();
            const b = await nuevaGestante();
            const eb = await nuevoEmbarazo(b.token, 100);
            expect((await api().patch(`/api/v1/embarazos/${eb.embarazo_id}`).set(auth(a.token)).send({ talla_cm: 150 })).status).toBe(404);
        });
    });

    describe('cerrar el embarazo y empezar otro', () => {
        test('finalizar cancela las citas pendientes, bloquea nuevos registros y deja registrar el siguiente embarazo', async () => {
            const g = await nuevaGestante();
            const emb = await nuevoEmbarazo(g.token, 270);
            await asignar(admin.token, prof.usuario.id, g.usuario.id);
            const base = `/api/v1/embarazos/${emb.embarazo_id}`;

            const hora = `${String(8 + (Date.now() % 10)).padStart(2, '0')}:${String(Date.now() % 60).padStart(2, '0')}`;
            const cita = await api().post(`${base}/citas`).set(auth(prof.token))
                .send({ tipo_control: 'CONTROL_PRENATAL', fecha: dias(20), hora });
            expect(cita.status).toBe(201);

            const fin = await api().patch(`${base}/finalizar`).set(auth(g.token)).send({ estado: 'FINALIZADO' });
            expect(fin.status).toBe(200);
            expect(fin.body.estado).toBe('FINALIZADO');
            expect(fin.body.fecha_finalizacion).toBeTruthy();
            // De un embarazo cerrado ya no se calcula la semana en curso.
            expect(fin.body.semana_actual).toBeNull();

            const citas = (await api().get(`${base}/citas`).set(auth(g.token))).body;
            expect(citas.find((c) => c.id === cita.body.id).estado).toBe('CANCELADA');
            expect((await api().post(`${base}/mediciones`).set(auth(g.token)).send({ mediciones: [{ tipo: 'PESO', valor: 70 }] })).status).toBe(409);
            // No se puede cerrar dos veces.
            expect((await api().patch(`${base}/finalizar`).set(auth(g.token)).send({ estado: 'FINALIZADO' })).status).toBe(409);

            // Ya puede registrar el siguiente.
            const nuevo = await nuevoEmbarazo(g.token, 30);
            expect(nuevo.embarazo_id).not.toBe(emb.embarazo_id);
            expect((await api().get('/api/v1/embarazos/actual').set(auth(g.token))).body.embarazo_id).toBe(nuevo.embarazo_id);

            // Y conserva el anterior en su historial, con su estado.
            const todos = (await api().get('/api/v1/embarazos').set(auth(g.token))).body;
            expect(todos.map((e) => e.estado).sort()).toEqual(['ACTIVO', 'FINALIZADO']);
        });

        test('un embarazo puede cerrarse como terminado de otra forma (CANCELADO)', async () => {
            const g = await nuevaGestante();
            const emb = await nuevoEmbarazo(g.token, 60);
            const res = await api().patch(`/api/v1/embarazos/${emb.embarazo_id}/finalizar`).set(auth(g.token)).send({ estado: 'CANCELADO' });
            expect(res.status).toBe(200);
            expect(res.body.estado).toBe('CANCELADO');
        });

        test('no se puede tener un segundo embarazo activo', async () => {
            const g = await nuevaGestante();
            await nuevoEmbarazo(g.token, 60);
            const res = await api().post('/api/v1/embarazos').set(auth(g.token)).send({ fecha_inicio: fechaHace(10) });
            expect(res.status).toBe(409);
            expect(res.body.error).toMatch(/embarazo activo/);
        });
    });

    describe('el profesional registra el embarazo de una paciente', () => {
        test('de una paciente asignada sí; de una que no lo es, no', async () => {
            const g = await nuevaGestante();
            const otra = await nuevaGestante();
            await asignar(admin.token, prof.usuario.id, g.usuario.id);

            const res = await api().post('/api/v1/embarazos').set(auth(prof.token))
                .send({ gestante_id: g.usuario.id, fecha_inicio: fechaHace(70), talla_cm: 158 });
            expect(res.status).toBe(201);
            expect(res.body.gestante_usuario_id).toBe(g.usuario.id);
            expect(res.body.semana_actual).toBe(10);

            // La gestante lo ve como suyo.
            expect((await api().get('/api/v1/embarazos/actual').set(auth(g.token))).body.embarazo_id).toBe(res.body.embarazo_id);

            const ajena = await api().post('/api/v1/embarazos').set(auth(prof.token)).send({ gestante_id: otra.usuario.id, fecha_inicio: fechaHace(70) });
            expect(ajena.status).toBe(404);
            // Sin indicar paciente tampoco.
            expect((await api().post('/api/v1/embarazos').set(auth(prof.token)).send({ fecha_inicio: fechaHace(70) })).status).toBe(400);
        });
    });
});
