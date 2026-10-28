const { api, auth, SEED, login, nuevaGestante, pool } = require('./helpers');
const { bandeja } = require('../src/services/correo');

afterAll(() => pool.end());

const recuperar = (correo) => api().post('/api/v1/auth/recuperar').send({ correo });
const restablecer = (token, contrasena_nueva) => api().post('/api/v1/auth/restablecer').send({ token, contrasena_nueva });

// El token viaja solo por correo: se lee del enlace del último mensaje enviado a esa dirección.
const tokenDe = (correo) => {
    const mensajes = bandeja.filter((m) => m.para === correo && /restablecer\//.test(m.texto));
    const ultimo = mensajes.at(-1);
    return ultimo ? ultimo.texto.match(/restablecer\/([a-f0-9]{64})/)[1] : null;
};

// La espera mínima entre solicitudes impide usarlo para llenar un buzón ajeno; en la
// prueba se adelanta el reloj de la solicitud anterior.
const envejecer = (usuarioId) => pool.query(
    `UPDATE seguimiento_embarazo.recuperacion_contrasena
        SET solicitada_en = solicitada_en - interval '5 minutes', expira_en = expira_en - interval '5 minutes'
      WHERE usuario_id = $1`, [usuarioId]
);

describe('Recuperación de contraseña', () => {
    test('con un correo registrado envía un enlace y responde lo mismo que con uno que no existe', async () => {
        const g = await nuevaGestante();
        const antes = bandeja.length;

        const existe = await recuperar(g.datos.correo);
        const noExiste = await recuperar('nadie-existe@prueba.co');

        expect(existe.status).toBe(200);
        expect(noExiste.status).toBe(200);
        // Idénticas: el formulario no sirve para averiguar quién tiene cuenta.
        expect(existe.body).toEqual(noExiste.body);

        // Solo el correo registrado recibe algo.
        expect(bandeja.length).toBe(antes + 1);
        const msg = bandeja.at(-1);
        expect(msg.para).toBe(g.datos.correo);
        expect(msg.asunto).toMatch(/Restablece/);
        expect(msg.texto).toMatch(/restablecer\/[a-f0-9]{64}/);
        expect(msg.texto).toMatch(/60 minutos/);
    });

    test('en la base solo queda el hash del token, nunca el token', async () => {
        const g = await nuevaGestante();
        await recuperar(g.datos.correo);
        const token = tokenDe(g.datos.correo);

        const { rows } = await pool.query('SELECT token_hash FROM seguimiento_embarazo.recuperacion_contrasena WHERE usuario_id = $1', [g.usuario.id]);
        expect(rows).toHaveLength(1);
        expect(rows[0].token_hash).toHaveLength(64);
        expect(rows[0].token_hash).not.toBe(token);
    });

    test('restablecer cambia la contraseña y cierra las sesiones abiertas', async () => {
        const g = await nuevaGestante();
        await recuperar(g.datos.correo);
        const token = tokenDe(g.datos.correo);

        const res = await restablecer(token, 'NuevaClave456');
        expect(res.status).toBe(200);

        expect((await api().post('/api/v1/auth/login').send({ correo: g.datos.correo, contrasena: g.datos.contrasena })).status).toBe(401);
        expect((await api().post('/api/v1/auth/login').send({ correo: g.datos.correo, contrasena: 'NuevaClave456' })).status).toBe(200);
        // La sesión que ya existía (por ejemplo, de quien conocía la clave anterior) no se puede renovar.
        expect((await api().post('/api/v1/auth/refresh').send({ refresh_token: g.refresh })).status).toBe(401);

        // Y se avisa por correo del cambio.
        expect(bandeja.at(-1).asunto).toMatch(/cambió/);
    });

    test('el enlace sirve una sola vez', async () => {
        const g = await nuevaGestante();
        await recuperar(g.datos.correo);
        const token = tokenDe(g.datos.correo);

        expect((await restablecer(token, 'PrimeraClave123')).status).toBe(200);
        const otra = await restablecer(token, 'SegundaClave123');
        expect(otra.status).toBe(400);
        expect(otra.body.error).toMatch(/no es válido o ya venció/);
        expect((await api().post('/api/v1/auth/login').send({ correo: g.datos.correo, contrasena: 'PrimeraClave123' })).status).toBe(200);
    });

    test('un enlace vencido o inventado se rechaza con el mismo mensaje', async () => {
        const g = await nuevaGestante();
        await recuperar(g.datos.correo);
        const token = tokenDe(g.datos.correo);
        await pool.query(
            `UPDATE seguimiento_embarazo.recuperacion_contrasena
                SET solicitada_en = now() - interval '3 hours', expira_en = now() - interval '2 hours' WHERE usuario_id = $1`, [g.usuario.id]
        );

        const vencido = await restablecer(token, 'NuevaClave456');
        const inventado = await restablecer('a'.repeat(64), 'NuevaClave456');
        expect(vencido.status).toBe(400);
        expect(inventado.status).toBe(400);
        expect(vencido.body.error).toBe(inventado.body.error);

        // Formato que no es de un token.
        expect((await restablecer('corto', 'NuevaClave456')).status).toBe(400);
    });

    test('una contraseña débil no gasta el enlace', async () => {
        const g = await nuevaGestante();
        await recuperar(g.datos.correo);
        const token = tokenDe(g.datos.correo);

        const debil = await restablecer(token, 'corta');
        expect(debil.status).toBe(400);
        expect(debil.body.detalles.map((d) => d.campo)).toContain('contrasena_nueva');
        // El enlace sigue vivo para poder intentarlo de nuevo.
        expect((await restablecer(token, 'ClaveValida789')).status).toBe(200);
    });

    test('pedir un enlace nuevo deja sin efecto el anterior', async () => {
        const g = await nuevaGestante();
        await recuperar(g.datos.correo);
        const viejo = tokenDe(g.datos.correo);
        await envejecer(g.usuario.id);

        await recuperar(g.datos.correo);
        const nuevo = tokenDe(g.datos.correo);
        expect(nuevo).not.toBe(viejo);

        expect((await restablecer(viejo, 'ClaveValida789')).status).toBe(400);
        expect((await restablecer(nuevo, 'ClaveValida789')).status).toBe(200);
    });

    test('no se puede usar para llenar de correos el buzón de otra persona', async () => {
        const g = await nuevaGestante();
        await recuperar(g.datos.correo);
        const antes = bandeja.length;

        // Segunda solicitud inmediata: misma respuesta, pero no se envía nada más.
        const otra = await recuperar(g.datos.correo);
        expect(otra.status).toBe(200);
        expect(bandeja.length).toBe(antes);
    });

    test('una cuenta desactivada no recibe enlaces', async () => {
        const admin = await login(SEED.admin);
        const g = await nuevaGestante();
        await api().patch(`/api/v1/usuarios/${g.usuario.id}/estado`).set(auth(admin.token)).send({ activo: false }).expect(200);
        const antes = bandeja.length;

        expect((await recuperar(g.datos.correo)).status).toBe(200);
        expect(bandeja.length).toBe(antes);
    });

    test('queda en la auditoría', async () => {
        const g = await nuevaGestante();
        await recuperar(g.datos.correo);
        const token = tokenDe(g.datos.correo);
        await restablecer(token, 'ClaveValida789');

        const { rows } = await pool.query(
            `SELECT detalle->>'tipo' AS tipo FROM seguimiento_embarazo.auditoria
              WHERE usuario_id = $1 AND detalle->>'campo' = 'contrasena' ORDER BY id`, [g.usuario.id]
        );
        expect(rows.map((r) => r.tipo)).toEqual(['recuperacion_solicitada', 'recuperacion']);
    });
});
