const { api, auth, SEED, login, nuevaGestante, nuevoEmbarazo, pool } = require('./helpers');

afterAll(() => pool.end());

describe('Autorización de datos y derechos del titular (Ley 1581)', () => {
    describe('aceptación de la política al registrarse', () => {
        const base = {
            nombre: 'Ana', apellido: 'Suárez', contrasena: 'Clave1234', tipo_documento: 'CC',
            fecha_nacimiento: '1995-03-10'
        };
        let n = 0;
        const datos = (extra) => {
            n += 1;
            return { ...base, correo: `politica${Date.now()}${n}@prueba.co`, numero_documento: `P${Date.now()}${n}`.slice(0, 20), ...extra };
        };

        test('sin aceptar no se puede registrar', async () => {
            const res = await api().post('/api/v1/auth/registro').send(datos({}));
            expect(res.status).toBe(400);
            expect(res.body.detalles.map((d) => d.campo)).toEqual(expect.arrayContaining(['acepto_politica']));

            const falso = await api().post('/api/v1/auth/registro').send(datos({ acepto_politica: false, version_politica: '1.0' }));
            expect(falso.status).toBe(400);
        });

        test('una aceptación sobre una versión que ya no es la vigente se rechaza', async () => {
            const res = await api().post('/api/v1/auth/registro').send(datos({ acepto_politica: true, version_politica: '0.1' }));
            expect(res.status).toBe(400);
            expect(JSON.stringify(res.body.detalles)).toMatch(/pol[ií]tica cambi/i);
        });

        test('al aceptar queda constancia de cuándo y de qué versión', async () => {
            const res = await api().post('/api/v1/auth/registro').send(datos({ acepto_politica: true, version_politica: '1.0' }));
            expect(res.status).toBe(201);
            expect(res.body.usuario.version_politica).toBe('1.0');
            expect(new Date(res.body.usuario.acepto_politica_en).getTime()).toBeGreaterThan(Date.now() - 60000);

            const { rows } = await pool.query(
                `SELECT detalle FROM seguimiento_embarazo.auditoria WHERE accion = 'CREAR' AND entidad = 'usuario' AND entidad_id = $1`,
                [res.body.usuario.id]
            );
            expect(rows[0].detalle.version_politica).toBe('1.0');
        });

        test('el administrador crea cuentas sin pasar por la aceptación del registro', async () => {
            const admin = await login(SEED.admin);
            const u = Date.now().toString(36);
            const res = await api().post('/api/v1/usuarios').set(auth(admin.token)).send({
                rol: 'PROFESIONAL', nombre: 'Rosa', apellido: 'Gil', correo: `rg${u}@prueba.co`, contrasena_temporal: 'Temporal123',
                perfil: { registro_profesional: `RG-${u}`, especialidad: 'Enfermería' }
            });
            expect(res.status).toBe(201);
            expect(res.body.acepto_politica_en).toBeNull();
        });
    });

    describe('derecho de consulta: descargar mis datos', () => {
        test('devuelve lo que la persona registró, y nada de otra', async () => {
            const a = await nuevaGestante();
            const b = await nuevaGestante();
            const ea = await nuevoEmbarazo(a.token);
            await nuevoEmbarazo(b.token);
            await api().post(`/api/v1/embarazos/${ea.embarazo_id}/mediciones`).set(auth(a.token))
                .send({ mediciones: [{ tipo: 'PESO', valor: 61.5 }] }).expect(201);
            await api().post(`/api/v1/embarazos/${ea.embarazo_id}/sintomas`).set(auth(a.token))
                .send({ tipo: 'NAUSEAS', intensidad: 2 }).expect(201);

            const res = await api().get('/api/v1/auth/mis-datos').set(auth(a.token));
            expect(res.status).toBe(200);
            expect(res.headers['content-disposition']).toMatch(/attachment/);
            expect(res.body.usuario.correo).toBe(a.datos.correo);
            expect(res.body.embarazos).toHaveLength(1);
            expect(res.body.mediciones.map((m) => m.tipo)).toContain('PESO');
            expect(res.body.sintomas).toHaveLength(1);

            // Nada de la otra gestante.
            expect(JSON.stringify(res.body)).not.toContain(b.datos.correo);
            expect(res.body.embarazos.every((e) => e.gestante_usuario_id === a.usuario.id)).toBe(true);
        });

        test('no incluye credenciales: ni hash de contraseña ni tokens de sesión', async () => {
            const g = await nuevaGestante();
            const res = await api().get('/api/v1/auth/mis-datos').set(auth(g.token));
            const texto = JSON.stringify(res.body);
            expect(texto).not.toMatch(/hash_contrasena|token_hash|\$2[aby]\$/);
            expect(res.body.sesiones.length).toBeGreaterThan(0);
        });

        test('exige sesión y queda auditado', async () => {
            expect((await api().get('/api/v1/auth/mis-datos')).status).toBe(401);
            const g = await nuevaGestante();
            await api().get('/api/v1/auth/mis-datos').set(auth(g.token)).expect(200);
            const { rows } = await pool.query(
                `SELECT 1 FROM seguimiento_embarazo.auditoria WHERE usuario_id = $1 AND accion = 'CONSULTAR_SENSIBLE' AND detalle->>'recurso' = 'mis-datos'`,
                [g.usuario.id]
            );
            expect(rows).toHaveLength(1);
        });
    });

    describe('derecho de supresión: solicitud y anonimización', () => {
        let admin;
        let prof;
        beforeAll(async () => {
            admin = await login(SEED.admin);
            prof = await login(SEED.profesional);
        });

        test('solo una solicitud pendiente por persona, y solo las gestantes la hacen', async () => {
            const g = await nuevaGestante();
            const r1 = await api().post('/api/v1/auth/solicitud-supresion').set(auth(g.token)).send({ motivo: 'Ya no quiero usar el servicio' });
            expect(r1.status).toBe(201);
            expect(r1.body.estado).toBe('PENDIENTE');

            const r2 = await api().post('/api/v1/auth/solicitud-supresion').set(auth(g.token)).send({});
            expect(r2.status).toBe(409);
            expect(r2.body.error).toMatch(/pendiente/);

            expect((await api().post('/api/v1/auth/solicitud-supresion').set(auth(prof.token)).send({})).status).toBe(403);
            const estado = await api().get('/api/v1/auth/solicitud-supresion').set(auth(g.token));
            expect(estado.body.estado).toBe('PENDIENTE');
        });

        test('solo el administrador atiende las solicitudes', async () => {
            const g = await nuevaGestante();
            const s = await api().post('/api/v1/auth/solicitud-supresion').set(auth(g.token)).send({});
            expect((await api().get('/api/v1/admin/solicitudes-supresion').set(auth(g.token))).status).toBe(403);
            expect((await api().post(`/api/v1/admin/solicitudes-supresion/${s.body.id}/atender`).set(auth(prof.token))
                .send({ accion: 'ANONIMIZAR' })).status).toBe(403);
        });

        test('rechazar exige explicar por qué', async () => {
            const g = await nuevaGestante();
            const s = await api().post('/api/v1/auth/solicitud-supresion').set(auth(g.token)).send({});
            const sin = await api().post(`/api/v1/admin/solicitudes-supresion/${s.body.id}/atender`).set(auth(admin.token)).send({ accion: 'RECHAZAR' });
            expect(sin.status).toBe(400);
            const con = await api().post(`/api/v1/admin/solicitudes-supresion/${s.body.id}/atender`).set(auth(admin.token))
                .send({ accion: 'RECHAZAR', respuesta: 'Hay una obligación legal de conservar la historia clínica.' });
            expect(con.status).toBe(200);
            expect(con.body.estado).toBe('RECHAZADA');

            // La cuenta sigue intacta y puede volver a solicitar.
            expect((await api().get('/api/v1/auth/me').set(auth(g.token))).status).toBe(200);
        });

        test('anonimizar destruye lo que identifica y conserva el registro clínico', async () => {
            const g = await nuevaGestante({ telefono: '3001112233', eps: 'EPS Sura', contacto_emergencia_nombre: 'Pedro', contacto_emergencia_telefono: '3009998877' });
            const e = await nuevoEmbarazo(g.token);
            await api().post(`/api/v1/embarazos/${e.embarazo_id}/mediciones`).set(auth(g.token))
                .send({ mediciones: [{ tipo: 'PESO', valor: 70 }] }).expect(201);

            const s = await api().post('/api/v1/auth/solicitud-supresion').set(auth(g.token)).send({});
            const res = await api().post(`/api/v1/admin/solicitudes-supresion/${s.body.id}/atender`).set(auth(admin.token)).send({ accion: 'ANONIMIZAR' });
            expect(res.status).toBe(200);
            expect(res.body.estado).toBe('ATENDIDA');

            const { rows: [u] } = await pool.query(
                `SELECT u.nombre, u.apellido, u.correo, u.activo, u.anonimizado_en, p.numero_documento, p.telefono, p.eps,
                        p.contacto_emergencia_nombre, p.contacto_emergencia_telefono, p.fecha_nacimiento::text AS nac
                   FROM seguimiento_embarazo.usuario u JOIN seguimiento_embarazo.perfil_gestante p ON p.usuario_id = u.id WHERE u.id = $1`,
                [g.usuario.id]
            );
            expect(u).toMatchObject({ nombre: 'Persona', apellido: 'Anonimizada', activo: false, telefono: null, eps: null, contacto_emergencia_nombre: null, contacto_emergencia_telefono: null });
            expect(u.correo).toMatch(/@anonimo\.invalid$/);
            expect(u.numero_documento).toBe(`ANON-${g.usuario.id}`);
            expect(u.anonimizado_en).not.toBeNull();
            expect(u.nac).toBe('1995-01-01'); // de la fecha de nacimiento solo queda el año

            // La historia clínica se conserva.
            const { rows: med } = await pool.query('SELECT count(*)::int AS n FROM seguimiento_embarazo.medicion WHERE embarazo_id = $1', [e.embarazo_id]);
            expect(med[0].n).toBe(1);

            // La cuenta ya no se puede abrir, ni con el correo anterior ni con la sesión que tenía.
            expect((await api().post('/api/v1/auth/login').send({ correo: g.datos.correo, contrasena: g.datos.contrasena })).status).toBe(401);
            expect((await api().get('/api/v1/auth/me').set(auth(g.token))).status).toBe(401);
            expect((await api().post('/api/v1/auth/refresh').send({ refresh_token: g.refresh })).status).toBe(401);

            // Y no se puede anonimizar dos veces la misma solicitud.
            expect((await api().post(`/api/v1/admin/solicitudes-supresion/${s.body.id}/atender`).set(auth(admin.token)).send({ accion: 'ANONIMIZAR' })).status).toBe(404);
        });
    });
});
