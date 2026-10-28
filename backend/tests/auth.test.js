const { api, auth, SEED, login, unico, nuevaGestante, pool } = require('./helpers');

afterAll(() => pool.end());

describe('Registro e inicio de sesión (RF-01, RF-02, RNF-01)', () => {
    test('registra una gestante, guarda solo el hash y no lo expone', async () => {
        const { usuario, datos, token } = await nuevaGestante({ grupo_sanguineo: 'O+' });
        expect(usuario.rol).toBe('GESTANTE');
        expect(usuario.perfil.grupo_sanguineo).toBe('O+');
        expect(JSON.stringify(usuario)).not.toMatch(/hash_contrasena|"contrasena"/);
        expect(token).toBeTruthy();

        const { rows } = await pool.query('SELECT hash_contrasena FROM seguimiento_embarazo.usuario WHERE id = $1', [usuario.id]);
        expect(rows[0].hash_contrasena).toMatch(/^\$2[aby]\$/);
        expect(rows[0].hash_contrasena).not.toContain(datos.contrasena);
    });

    test('el correo es único sin importar mayúsculas', async () => {
        const { datos } = await nuevaGestante();
        const res = await api().post('/api/v1/auth/registro').send({ ...datos, correo: datos.correo.toUpperCase(), numero_documento: `X${unico()}` });
        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/correo/i);
    });

    test('rechaza contraseñas débiles y datos inválidos con detalle por campo', async () => {
        const res = await api().post('/api/v1/auth/registro').send({
            nombre: 'A', apellido: 'B', correo: 'no-es-correo', contrasena: 'corta', numero_documento: '1', fecha_nacimiento: '2999-01-01'
        });
        expect(res.status).toBe(400);
        const campos = res.body.detalles.map((d) => d.campo);
        expect(campos).toEqual(expect.arrayContaining(['correo', 'contrasena', 'numero_documento', 'fecha_nacimiento']));
    });

    test('el registro público no permite elegir rol', async () => {
        const { usuario } = await nuevaGestante({ rol: 'ADMINISTRADOR' });
        expect(usuario.rol).toBe('GESTANTE');
    });

    test('login incorrecto responde 401 genérico y queda auditado', async () => {
        const res = await api().post('/api/v1/auth/login').send({ correo: SEED.gestante.correo, contrasena: 'Equivocada1' });
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Correo o contraseña incorrectos');
        const noExiste = await api().post('/api/v1/auth/login').send({ correo: 'nadie@x.co', contrasena: 'Equivocada1' });
        expect(noExiste.body.error).toBe(res.body.error);

        const { rows } = await pool.query(
            `SELECT 1 FROM seguimiento_embarazo.auditoria WHERE accion = 'LOGIN_FALLIDO' AND detalle->>'correo' = $1`, [SEED.gestante.correo]
        );
        expect(rows.length).toBeGreaterThan(0);
    });

    test('rutas protegidas exigen token válido', async () => {
        expect((await api().get('/api/v1/auth/me')).status).toBe(401);
        expect((await api().get('/api/v1/auth/me').set(auth('token.falso.x'))).status).toBe(401);
    });

    test('el refresh token rota: el anterior deja de servir', async () => {
        const { refresh } = await login(SEED.gestante);
        const r1 = await api().post('/api/v1/auth/refresh').send({ refresh_token: refresh });
        expect(r1.status).toBe(200);
        const r2 = await api().post('/api/v1/auth/refresh').send({ refresh_token: refresh });
        expect(r2.status).toBe(401);
        const r3 = await api().post('/api/v1/auth/refresh').send({ refresh_token: r1.body.refresh_token });
        expect(r3.status).toBe(200);
    });

    test('usuario creado por el administrador debe cambiar la contraseña temporal', async () => {
        const admin = await login(SEED.admin);
        const u = unico();
        const creado = await api().post('/api/v1/usuarios').set(auth(admin.token)).send({
            rol: 'PROFESIONAL', nombre: 'Laura', apellido: 'Ríos', correo: `p${u}@prueba.co`, contrasena_temporal: 'Temporal123',
            perfil: { registro_profesional: `RP-${u}`, especialidad: 'Enfermería' }
        });
        expect(creado.status).toBe(201);
        expect(creado.body.debe_cambiar_contrasena).toBe(true);
        expect(creado.body.perfil.especialidad).toBe('Enfermería');

        const sesion = await login({ correo: `p${u}@prueba.co`, contrasena: 'Temporal123' });
        const bloqueado = await api().get('/api/v1/pacientes').set(auth(sesion.token));
        expect(bloqueado.status).toBe(403);
        expect(bloqueado.body.detalles.codigo).toBe('CAMBIO_CONTRASENA_REQUERIDO');

        const cambio = await api().patch('/api/v1/auth/contrasena').set(auth(sesion.token))
            .send({ contrasena_actual: 'Temporal123', contrasena_nueva: 'Definitiva123' });
        expect(cambio.status).toBe(200);
        const nueva = await login({ correo: `p${u}@prueba.co`, contrasena: 'Definitiva123' });
        expect((await api().get('/api/v1/pacientes').set(auth(nueva.token))).status).toBe(200);
    });

    test('un usuario desactivado pierde el acceso de inmediato', async () => {
        const admin = await login(SEED.admin);
        const g = await nuevaGestante();
        const off = await api().patch(`/api/v1/usuarios/${g.usuario.id}/estado`).set(auth(admin.token)).send({ activo: false });
        expect(off.status).toBe(200);
        expect((await api().get('/api/v1/auth/me').set(auth(g.token))).status).toBe(401);
        const relogin = await api().post('/api/v1/auth/login').send({ correo: g.datos.correo, contrasena: g.datos.contrasena });
        expect(relogin.status).toBe(401);
        expect((await api().post('/api/v1/auth/refresh').send({ refresh_token: g.refresh })).status).toBe(401);
    });
});
