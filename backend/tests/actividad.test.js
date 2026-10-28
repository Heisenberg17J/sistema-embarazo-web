const { api, auth, SEED, login, nuevaGestante, nuevoEmbarazo, asignar, pool } = require('./helpers');

afterAll(() => pool.end());

describe('Actividad general del profesional', () => {
    let admin;
    let prof;
    let otro;

    beforeAll(async () => {
        admin = await login(SEED.admin);
        prof = await login(SEED.profesional);
        otro = await login(SEED.profesional2);
    });

    const conSintoma = async (profesional) => {
        const g = await nuevaGestante();
        const emb = await nuevoEmbarazo(g.token, 100);
        await asignar(admin.token, profesional.usuario.id, g.usuario.id);
        const s = await api().post(`/api/v1/embarazos/${emb.embarazo_id}/sintomas`).set(auth(g.token)).send({ tipo: 'NAUSEAS', intensidad: 2 });
        expect(s.status).toBe(201);
        return g;
    };

    test('reúne lo registrado en sus pacientes, con el nombre de cada una, y nada de las ajenas', async () => {
        const mia = await conSintoma(prof);
        const ajena = await conSintoma(otro);

        const res = await api().get('/api/v1/pacientes/actividad?limit=100').set(auth(prof.token));
        expect(res.status).toBe(200);
        const gestantes = new Set(res.body.datos.map((e) => e.gestante_id));
        expect(gestantes.has(mia.usuario.id)).toBe(true);
        expect(gestantes.has(ajena.usuario.id)).toBe(false);

        const evento = res.body.datos.find((e) => e.gestante_id === mia.usuario.id && e.tipo === 'SINTOMA');
        expect(evento.gestante).toContain('Gestante');
        // Lo más reciente primero.
        const fechas = res.body.datos.map((e) => new Date(e.fecha).getTime());
        expect(fechas).toEqual([...fechas].sort((a, b) => b - a));
    });

    test('filtra por tipo y rechaza uno inventado', async () => {
        await conSintoma(prof);
        const soloSintomas = await api().get('/api/v1/pacientes/actividad?tipo=sintoma&limit=100').set(auth(prof.token));
        expect(soloSintomas.status).toBe(200);
        expect(soloSintomas.body.datos.length).toBeGreaterThan(0);
        expect(soloSintomas.body.datos.every((e) => e.tipo === 'SINTOMA')).toBe(true);

        expect((await api().get('/api/v1/pacientes/actividad?tipo=NADA').set(auth(prof.token))).status).toBe(400);
    });

    test('no incluye citas que todavía no ocurrieron', async () => {
        const res = await api().get('/api/v1/pacientes/actividad?tipo=CITA&limit=100').set(auth(prof.token));
        expect(res.status).toBe(200);
        expect(res.body.datos.every((e) => new Date(e.fecha) <= new Date())).toBe(true);
    });

    test('una paciente que dejó de estar asignada desaparece', async () => {
        const g = await conSintoma(prof);
        await pool.query('UPDATE seguimiento_embarazo.asignacion SET activa = FALSE WHERE gestante_usuario_id = $1', [g.usuario.id]);
        const res = await api().get('/api/v1/pacientes/actividad?limit=100').set(auth(prof.token));
        expect(res.body.datos.some((e) => e.gestante_id === g.usuario.id)).toBe(false);
    });

    test('solo lo ve un profesional y queda en la auditoría', async () => {
        const g = await nuevaGestante();
        expect((await api().get('/api/v1/pacientes/actividad').set(auth(g.token))).status).toBe(403);
        expect((await api().get('/api/v1/pacientes/actividad').set(auth(admin.token))).status).toBe(403);

        await api().get('/api/v1/pacientes/actividad').set(auth(prof.token));
        const { rows } = await pool.query(
            `SELECT 1 FROM seguimiento_embarazo.auditoria WHERE usuario_id = $1 AND accion = 'CONSULTAR_SENSIBLE' AND detalle->>'recurso' = 'actividad'`,
            [prof.usuario.id]);
        expect(rows.length).toBeGreaterThan(0);
    });
});

describe('Mi equipo en el panel de la gestante', () => {
    test('la gestante ve quién la acompaña, sin su correo, y sin profesional la lista va vacía', async () => {
        const admin = await login(SEED.admin);
        const prof = await login(SEED.profesional);
        const g = await nuevaGestante();

        const antes = await api().get('/api/v1/dashboard').set(auth(g.token));
        expect(antes.body.profesionales).toEqual([]);

        await asignar(admin.token, prof.usuario.id, g.usuario.id);
        const despues = await api().get('/api/v1/dashboard').set(auth(g.token));
        expect(despues.body.profesionales).toHaveLength(1);
        const p = despues.body.profesionales[0];
        expect(p.nombre).toContain('Mejía');
        expect(p.especialidad).toBeTruthy();
        expect(JSON.stringify(p)).not.toContain('@');

        // También con embarazo activo.
        await nuevoEmbarazo(g.token, 100);
        const conEmbarazo = await api().get('/api/v1/dashboard').set(auth(g.token));
        expect(conEmbarazo.body.profesionales).toHaveLength(1);

        // Si la asignación termina, deja de aparecer.
        await pool.query('UPDATE seguimiento_embarazo.asignacion SET activa = FALSE, fecha_fin = CURRENT_DATE WHERE gestante_usuario_id = $1', [g.usuario.id]);
        expect((await api().get('/api/v1/dashboard').set(auth(g.token))).body.profesionales).toEqual([]);
    });
});
