const { api, auth, SEED, login, nuevaGestante, nuevoEmbarazo, asignar, pool } = require('./helpers');

afterAll(() => pool.end());

// Corregir un dato que generó una alerta NO borra la alerta: la anula. Si se borrara,
// el profesional perdería sin aviso una alerta que quizá estaba atendiendo, y bastaría
// eliminar un valor peligroso para "esconderlo".
describe('Corrección de datos clínicos', () => {
    let admin;
    let prof;
    let g;
    let emb;
    let base;

    beforeAll(async () => {
        admin = await login(SEED.admin);
        prof = await login(SEED.profesional);
        g = await nuevaGestante();
        emb = await nuevoEmbarazo(g.token, 150);
        await asignar(admin.token, prof.usuario.id, g.usuario.id);
        base = `/api/v1/embarazos/${emb.embarazo_id}`;
    });

    const medir = (tipo, valor, token = g.token) =>
        api().post(`${base}/mediciones`).set(auth(token)).send({ mediciones: [{ tipo, valor }] });
    const alertasDe = async (token = g.token, estado) =>
        (await api().get(`/api/v1/embarazos/${emb.embarazo_id}/alertas${estado ? `?estado=${estado}` : ''}`).set(auth(token))).body.datos;
    const envejecer = (tabla, columna, id, horas) => pool.query(
        `UPDATE seguimiento_embarazo.${tabla} SET ${columna} = now() - make_interval(hours => $2) WHERE id = $1`, [id, horas]
    );
    const auditoria = async (entidad, entidadId, accion) => (await pool.query(
        'SELECT detalle FROM seguimiento_embarazo.auditoria WHERE entidad = $1 AND entidad_id = $2 AND accion = $3 ORDER BY id DESC LIMIT 1',
        [entidad, entidadId, accion]
    )).rows[0]?.detalle;

    describe('mediciones', () => {
        test('corregir un valor que disparó una alerta crítica la anula, no la borra', async () => {
            const r = await medir('PA_SISTOLICA', 165);
            expect(r.body.alertas[0].severidad).toBe('CRITICA');
            const id = r.body.mediciones[0].id;
            const alertaId = r.body.alertas[0].id;

            const res = await api().patch(`${base}/mediciones/${id}`).set(auth(g.token)).send({ valor: 125 });
            expect(res.status).toBe(200);
            expect(res.body.medicion.valor).toBe(125);
            expect(res.body.alertas).toHaveLength(0);
            expect(res.body.alertas_anuladas).toBe(1);

            // La alerta sigue ahí, anulada, con el motivo a la vista.
            const anulada = (await alertasDe(g.token, 'ANULADA')).find((a) => a.id === alertaId);
            expect(anulada).toBeTruthy();
            expect(anulada.estado).toBe('ANULADA');
            expect(anulada.motivo_anulacion).toMatch(/corrigió de 165 a 125/);
            expect(anulada.valor_detectado).toBe(165); // lo que se detectó queda como constancia
            expect(anulada.accion_inmediata).toBe(true);

            // Ya no está entre las pendientes: no se le pide nada al profesional.
            expect((await alertasDe(prof.token, 'PENDIENTE')).some((a) => a.id === alertaId)).toBe(false);
        });

        test('corregir a otro valor alto anula la alerta anterior y genera la nueva', async () => {
            const r = await medir('PA_SISTOLICA', 170);
            const id = r.body.mediciones[0].id;

            const res = await api().patch(`${base}/mediciones/${id}`).set(auth(g.token)).send({ valor: 145 });
            expect(res.status).toBe(200);
            expect(res.body.alertas_anuladas).toBe(1);
            expect(res.body.alertas).toHaveLength(1);
            expect(res.body.alertas[0].severidad).toBe('ADVERTENCIA');
            expect(res.body.alertas[0].valor_detectado).toBe(145);

            // Solo una alerta viva para esa medición: no se duplica.
            const { rows } = await pool.query(
                `SELECT count(*)::int AS n FROM seguimiento_embarazo.alerta WHERE medicion_id = $1 AND estado <> 'ANULADA'`, [id]
            );
            expect(rows[0].n).toBe(1);
        });

        test('un valor corregido que sigue siendo crítico avisa de nuevo con la indicación de urgencias', async () => {
            const r = await medir('PA_SISTOLICA', 150);
            const res = await api().patch(`${base}/mediciones/${r.body.mediciones[0].id}`).set(auth(g.token)).send({ valor: 180 });
            expect(res.body.alertas[0].severidad).toBe('CRITICA');
            expect(res.body.alertas[0].accion_inmediata).toBe(true);
        });

        test('el valor corregido también se valida contra el rango técnico', async () => {
            const r = await medir('PESO', 60);
            const res = await api().patch(`${base}/mediciones/${r.body.mediciones[0].id}`).set(auth(g.token)).send({ valor: 900 });
            expect(res.status).toBe(422);
            expect(res.body.error).toMatch(/fuera del rango técnico/);
        });

        test('eliminar un dato conserva su alerta como anulada', async () => {
            const r = await medir('PA_DIASTOLICA', 115);
            const alertaId = r.body.alertas[0].id;
            const id = r.body.mediciones[0].id;

            expect((await api().delete(`${base}/mediciones/${id}`).set(auth(g.token)).send({})).status).toBe(200);

            const { rows } = await pool.query('SELECT 1 FROM seguimiento_embarazo.medicion WHERE id = $1', [id]);
            expect(rows).toHaveLength(0);
            const anulada = (await alertasDe(g.token, 'ANULADA')).find((a) => a.id === alertaId);
            expect(anulada).toBeTruthy();
            expect(anulada.motivo_anulacion).toMatch(/eliminó/);
            expect(anulada.valor_detectado).toBe(115);

            // La traza queda en la auditoría con el valor que había.
            const detalle = await auditoria('medicion', id, 'DESACTIVAR');
            expect(detalle).toMatchObject({ eliminada: true, tipo: 'PA_DIASTOLICA', valor: 115 });
        });

        test('la auditoría guarda el valor de antes y el de después', async () => {
            const r = await medir('PESO', 61.2);
            const id = r.body.mediciones[0].id;
            await api().patch(`${base}/mediciones/${id}`).set(auth(g.token)).send({ valor: 62.1 }).expect(200);
            const detalle = await auditoria('medicion', id, 'MODIFICAR');
            expect(detalle.antes.valor).toBe(61.2);
            expect(detalle.despues.valor).toBe(62.1);
        });

        test('la gestante solo corrige dentro de las 24 horas siguientes a guardarlo', async () => {
            const r = await medir('PESO', 63);
            const id = r.body.mediciones[0].id;
            await envejecer('medicion', 'creado_en', id, 25);

            const res = await api().patch(`${base}/mediciones/${id}`).set(auth(g.token)).send({ valor: 64 });
            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/24 horas/);
            expect(res.body.error).toMatch(/profesional/);
            expect((await api().delete(`${base}/mediciones/${id}`).set(auth(g.token)).send({})).status).toBe(403);
        });

        test('la ventana cuenta desde que se guardó, no desde la fecha que declara el dato', async () => {
            // Una medición tomada ayer pero escrita ahora se puede corregir ahora.
            const ayer = new Date(Date.now() - 24 * 3600000).toISOString();
            const r = await api().post(`${base}/mediciones`).set(auth(g.token))
                .send({ mediciones: [{ tipo: 'PESO', valor: 66 }], fecha_registro: ayer });
            expect(r.status).toBe(201);
            const res = await api().patch(`${base}/mediciones/${r.body.mediciones[0].id}`).set(auth(g.token)).send({ valor: 65 });
            expect(res.status).toBe(200);
        });

        test('nadie corrige lo que registró otra persona', async () => {
            const r = await medir('PESO', 67);
            const id = r.body.mediciones[0].id;

            // El profesional no corrige lo que registró la gestante.
            expect((await api().patch(`${base}/mediciones/${id}`).set(auth(prof.token)).send({ valor: 68, motivo: 'x' })).status).toBe(403);
            // Otra gestante ni siquiera ve el embarazo.
            const otra = await nuevaGestante();
            expect((await api().patch(`${base}/mediciones/${id}`).set(auth(otra.token)).send({ valor: 68 })).status).toBe(404);
            expect((await api().delete(`${base}/mediciones/${id}`).set(auth(otra.token)).send({})).status).toBe(404);
            // El valor sigue siendo el original.
            const { rows } = await pool.query('SELECT valor FROM seguimiento_embarazo.medicion WHERE id = $1', [id]);
            expect(rows[0].valor).toBe(67);
        });

        test('el listado dice cuáles se pueden corregir', async () => {
            const nueva = await medir('PESO', 70);
            const vieja = await medir('PESO', 71);
            await envejecer('medicion', 'creado_en', vieja.body.mediciones[0].id, 30);

            const lista = (await api().get(`${base}/mediciones?tipo=PESO&limit=50`).set(auth(g.token))).body.datos;
            expect(lista.find((m) => m.id === nueva.body.mediciones[0].id).editable).toBe(true);
            expect(lista.find((m) => m.id === vieja.body.mediciones[0].id).editable).toBe(false);
            // El profesional ve lo mismo, y ninguna es suya.
            const comoProf = (await api().get(`${base}/mediciones?tipo=PESO&limit=50`).set(auth(prof.token))).body.datos;
            expect(comoProf.every((m) => m.editable === false)).toBe(true);
            // Datos internos que la pantalla no necesita.
            expect(lista[0]).not.toHaveProperty('registrado_por');
        });

        test('pedir un cambio sin indicar cuál se rechaza', async () => {
            const r = await medir('PESO', 72);
            expect((await api().patch(`${base}/mediciones/${r.body.mediciones[0].id}`).set(auth(g.token)).send({})).status).toBe(400);
        });
    });

    describe('síntomas', () => {
        const sintoma = (datos) => api().post(`${base}/sintomas`).set(auth(g.token)).send(datos);

        test('un síntoma de alarma mal elegido se corrige y su alerta se anula', async () => {
            const r = await sintoma({ tipo: 'SANGRADO' });
            const id = r.body.id;
            const alertaId = r.body.alerta.id;
            expect(r.body.alerta.severidad).toBe('CRITICA');

            const res = await api().patch(`${base}/sintomas/${id}`).set(auth(g.token)).send({ tipo: 'NAUSEAS' });
            expect(res.status).toBe(200);
            expect(res.body.descripcion).toBe('Náuseas'); // la descripción sigue al tipo
            expect(res.body.alerta).toBeNull();
            expect(res.body.alertas_anuladas).toBe(1);

            const anulada = (await alertasDe(g.token, 'ANULADA')).find((a) => a.id === alertaId);
            expect(anulada.motivo_anulacion).toMatch(/síntoma se corrigió/);
        });

        test('corregir a un signo de alarma genera la alerta', async () => {
            const r = await sintoma({ tipo: 'NAUSEAS', intensidad: 2 });
            expect(r.body.alerta).toBeNull();
            const res = await api().patch(`${base}/sintomas/${r.body.id}`).set(auth(g.token)).send({ tipo: 'VISION_BORROSA' });
            expect(res.body.alerta.severidad).toBe('CRITICA');
            expect(res.body.alerta.accion_inmediata).toBe(true);
        });

        test('bajar la intensidad retira la alerta por intensidad alta', async () => {
            const r = await sintoma({ tipo: 'MAREO', intensidad: 5 });
            expect(r.body.alerta.severidad).toBe('ADVERTENCIA');
            const res = await api().patch(`${base}/sintomas/${r.body.id}`).set(auth(g.token)).send({ intensidad: 2 });
            expect(res.body.alerta).toBeNull();
            expect(res.body.alertas_anuladas).toBe(1);
        });

        test('eliminar un síntoma conserva su alerta anulada', async () => {
            const r = await sintoma({ tipo: 'SANGRADO' });
            expect((await api().delete(`${base}/sintomas/${r.body.id}`).set(auth(g.token)).send({})).status).toBe(200);
            expect((await alertasDe(g.token, 'ANULADA')).some((a) => a.id === r.body.alerta.id)).toBe(true);
            const { rows } = await pool.query('SELECT 1 FROM seguimiento_embarazo.sintoma WHERE id = $1', [r.body.id]);
            expect(rows).toHaveLength(0);
        });

        test('solo la gestante dueña, y dentro de su ventana', async () => {
            const r = await sintoma({ tipo: 'NAUSEAS' });
            expect((await api().patch(`${base}/sintomas/${r.body.id}`).set(auth(prof.token)).send({ intensidad: 3 })).status).toBe(403);
            await envejecer('sintoma', 'registrado_en', r.body.id, 25);
            const res = await api().patch(`${base}/sintomas/${r.body.id}`).set(auth(g.token)).send({ intensidad: 3 });
            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/24 horas/);
        });

        test('el listado marca cuáles son corregibles', async () => {
            const r = await sintoma({ tipo: 'EDEMA' });
            const lista = (await api().get(`${base}/sintomas?limit=50`).set(auth(g.token))).body.datos;
            expect(lista.find((s) => s.id === r.body.id).editable).toBe(true);
        });
    });

    describe('controles y exámenes (profesional)', () => {
        const control = (mediciones, extra = {}) =>
            api().post(`${base}/controles`).set(auth(prof.token)).send({ observaciones: 'Control', mediciones, ...extra });

        test('corregir la frecuencia cardiaca fetal de un control anula su alerta crítica', async () => {
            const c = await control([{ tipo: 'FCF', valor: 95 }]);
            expect(c.body.alertas[0].severidad).toBe('CRITICA');

            const res = await api().patch(`${base}/controles/${c.body.id}`).set(auth(prof.token))
                .send({ mediciones: [{ tipo: 'FCF', valor: 140 }], motivo: 'Error al transcribir el monitoreo' });
            expect(res.status).toBe(200);
            expect(res.body.alertas).toHaveLength(0);
            expect(res.body.alertas_anuladas).toBe(1);
            expect(res.body.mediciones.find((m) => m.tipo === 'FCF').valor).toBe(140);

            const detalle = await auditoria('control', c.body.id, 'MODIFICAR');
            expect(detalle.motivo).toBe('Error al transcribir el monitoreo');
            expect(detalle.cambios[0]).toMatchObject({ campo: 'FCF', antes: 95, despues: 140 });
        });

        test('el profesional debe indicar por qué corrige un registro clínico', async () => {
            const c = await control([{ tipo: 'PESO', valor: 66 }]);
            const sin = await api().patch(`${base}/controles/${c.body.id}`).set(auth(prof.token)).send({ observaciones: 'Otra' });
            expect(sin.status).toBe(400);
            expect(sin.body.error).toMatch(/motivo/);
            expect((await api().delete(`${base}/controles/${c.body.id}`).set(auth(prof.token)).send({})).status).toBe(400);
        });

        test('se puede quitar una medición del control, y añadir la que se olvidó', async () => {
            const c = await control([{ tipo: 'PESO', valor: 66 }, { tipo: 'ALTURA_UTERINA', valor: 22 }]);
            const res = await api().patch(`${base}/controles/${c.body.id}`).set(auth(prof.token)).send({
                mediciones: [{ tipo: 'ALTURA_UTERINA', valor: null }, { tipo: 'FCF', valor: 145 }], motivo: 'Se tomó mal la altura'
            });
            expect(res.status).toBe(200);
            const tipos = res.body.mediciones.map((m) => m.tipo).sort();
            expect(tipos).toEqual(['FCF', 'PESO']);
        });

        test('eliminar un control borra sus mediciones y deja sus alertas anuladas', async () => {
            const c = await control([{ tipo: 'FCF', valor: 90 }, { tipo: 'PESO', valor: 66 }]);
            const alertaId = c.body.alertas[0].id;

            const res = await api().delete(`${base}/controles/${c.body.id}`).set(auth(prof.token)).send({ motivo: 'Registrado en la paciente equivocada' });
            expect(res.status).toBe(200);

            const { rows } = await pool.query('SELECT count(*)::int AS n FROM seguimiento_embarazo.medicion WHERE control_id = $1', [c.body.id]);
            expect(rows[0].n).toBe(0);
            expect((await alertasDe(prof.token, 'ANULADA')).some((a) => a.id === alertaId)).toBe(true);
            const detalle = await auditoria('control', c.body.id, 'DESACTIVAR');
            expect(detalle.mediciones).toEqual(expect.arrayContaining([{ tipo: 'FCF', valor: 90 }]));
            expect(detalle.motivo).toMatch(/equivocada/);
        });

        test('solo el profesional que lo registró, y durante 7 días', async () => {
            const c = await control([{ tipo: 'PESO', valor: 66 }]);
            const prof2 = await login(SEED.profesional2);
            await asignar(admin.token, prof2.usuario.id, g.usuario.id);

            // Otro profesional, aunque tenga asignada a la paciente.
            expect((await api().patch(`${base}/controles/${c.body.id}`).set(auth(prof2.token)).send({ observaciones: 'x', motivo: 'x' })).status).toBe(403);
            // La gestante no corrige controles.
            expect((await api().patch(`${base}/controles/${c.body.id}`).set(auth(g.token)).send({ observaciones: 'x' })).status).toBe(403);

            await envejecer('control', 'creado_en', c.body.id, 24 * 8);
            const res = await api().patch(`${base}/controles/${c.body.id}`).set(auth(prof.token)).send({ observaciones: 'x', motivo: 'x' });
            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/7 días/);
        });

        test('un examen se corrige y se elimina, y la gestante no puede', async () => {
            const e = await api().post(`${base}/examenes`).set(auth(prof.token))
                .send({ tipo: 'GLICEMIA', fecha: new Date().toISOString().slice(0, 10), resultado: '120 mg/dL' });
            expect(e.status).toBe(201);

            expect((await api().patch(`${base}/examenes/${e.body.id}`).set(auth(g.token)).send({ resultado: 'x' })).status).toBe(403);

            const res = await api().patch(`${base}/examenes/${e.body.id}`).set(auth(prof.token))
                .send({ resultado: '82 mg/dL', motivo: 'Se leyó el resultado de otra paciente' });
            expect(res.status).toBe(200);
            expect(res.body.resultado).toBe('82 mg/dL');
            const detalle = await auditoria('examen', e.body.id, 'MODIFICAR');
            expect(detalle.antes.resultado).toBe('120 mg/dL');

            expect((await api().delete(`${base}/examenes/${e.body.id}`).set(auth(prof.token)).send({ motivo: 'Duplicado' })).status).toBe(200);
            const lista = (await api().get(`${base}/examenes`).set(auth(prof.token))).body.datos;
            expect(lista.some((x) => x.id === e.body.id)).toBe(false);
        });
    });

    describe('efecto en lo que ve el profesional', () => {
        test('las alertas anuladas no cuentan como pendientes en la lista de pacientes', async () => {
            const g2 = await nuevaGestante();
            const e2 = await nuevoEmbarazo(g2.token, 150);
            await asignar(admin.token, prof.usuario.id, g2.usuario.id);
            const b2 = `/api/v1/embarazos/${e2.embarazo_id}`;

            const r = await api().post(`${b2}/mediciones`).set(auth(g2.token)).send({ mediciones: [{ tipo: 'PA_SISTOLICA', valor: 170 }] });
            const pendientes = async () => (await api().get('/api/v1/pacientes').set(auth(prof.token))).body
                .find((p) => p.gestante_usuario_id === g2.usuario.id);
            expect((await pendientes()).alertas_criticas).toBe(1);

            await api().patch(`${b2}/mediciones/${r.body.mediciones[0].id}`).set(auth(g2.token)).send({ valor: 120 }).expect(200);
            const despues = await pendientes();
            expect(despues.alertas_pendientes).toBe(0);
            expect(despues.alertas_criticas).toBe(0);
        });

        test('una alerta anulada ya no se puede revisar', async () => {
            const r = await medir('PA_SISTOLICA', 175);
            await api().patch(`${base}/mediciones/${r.body.mediciones[0].id}`).set(auth(g.token)).send({ valor: 118 }).expect(200);
            const res = await api().patch(`/api/v1/alertas/${r.body.alertas[0].id}/revisar`).set(auth(prof.token)).send({ estado: 'REVISADA' });
            expect(res.status).toBe(409);
            expect(res.body.error).toMatch(/anulada/);
        });
    });
});
