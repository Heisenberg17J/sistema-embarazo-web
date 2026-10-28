const { api, auth, SEED, login, nuevaGestante, nuevoEmbarazo, asignar, fechaHace, pool } = require('./helpers');

afterAll(() => pool.end());

const dias = (n) => fechaHace(-n);

// Estos parámetros los lee el backend de verdad: cambiarlos tiene que cambiar el comportamiento.
describe('Configuración del sistema', () => {
    let admin;
    let prof;

    const fijar = (clave, valor) => api().patch(`/api/v1/admin/configuracion/${clave}`).set(auth(admin.token)).send({ valor });

    beforeAll(async () => {
        admin = await login(SEED.admin);
        prof = await login(SEED.profesional);
    });

    // La caché se vacía al guardar, así que restaurar el valor original no deja rastro en otras pruebas.
    afterEach(async () => {
        await fijar('semanas_max_gestacion', '45');
        await fijar('dias_recordatorio_cita', '3');
    });

    test('los parámetros que pertenecen al entorno ya no están en la configuración', async () => {
        const res = await api().get('/api/v1/admin/configuracion').set(auth(admin.token));
        expect(res.status).toBe(200);
        const claves = res.body.map((p) => p.clave);
        expect(claves).toEqual(expect.arrayContaining(['semanas_max_gestacion', 'dias_recordatorio_cita']));
        expect(claves).not.toContain('sesion_horas_vigencia');
        expect(claves).not.toContain('backup_frecuencia_horas');
    });

    describe('validación', () => {
        test.each([
            ['semanas_max_gestacion', '37'],
            ['semanas_max_gestacion', '46'],
            ['semanas_max_gestacion', 'cuarenta'],
            ['semanas_max_gestacion', '40.5'],
            ['dias_recordatorio_cita', '-1'],
            ['dias_recordatorio_cita', '31'],
            ['dias_recordatorio_cita', '']
        ])('%s no acepta "%s"', async (clave, valor) => {
            const res = await fijar(clave, valor);
            expect(res.status).toBe(400);
        });

        test('el mensaje indica el rango permitido', async () => {
            const res = await fijar('semanas_max_gestacion', '50');
            expect(res.body.detalles[0].mensaje).toMatch(/entre 38 y 45/);
        });

        test('los valores dentro del rango se guardan', async () => {
            expect((await fijar('semanas_max_gestacion', '38')).status).toBe(200);
            expect((await fijar('dias_recordatorio_cita', '0')).status).toBe(200);
        });
    });

    describe('semanas_max_gestacion', () => {
        test('cambia la FUM más antigua que se acepta, al instante', async () => {
            const g = await nuevaGestante();
            // 42 semanas y media: pasa con el límite de 45, no con el de 40.
            const fum = fechaHace(42 * 7 + 3);

            expect((await fijar('semanas_max_gestacion', '40')).status).toBe(200);
            const rechazada = await api().post('/api/v1/embarazos').set(auth(g.token)).send({ fecha_inicio: fum });
            expect(rechazada.status).toBe(422);
            expect(rechazada.body.error).toMatch(/más de 40 semanas/);

            expect((await fijar('semanas_max_gestacion', '45')).status).toBe(200);
            const aceptada = await api().post('/api/v1/embarazos').set(auth(g.token)).send({ fecha_inicio: fum });
            expect(aceptada.status).toBe(201);
        });

        test('también rige al corregir la FUM de un embarazo', async () => {
            const g = await nuevaGestante();
            const emb = await nuevoEmbarazo(g.token, 100);
            expect((await fijar('semanas_max_gestacion', '38')).status).toBe(200);
            const res = await api().patch(`/api/v1/embarazos/${emb.embarazo_id}`).set(auth(g.token)).send({ fecha_inicio: fechaHace(40 * 7) });
            expect(res.status).toBe(422);
            expect(res.body.error).toMatch(/más de 38 semanas/);
        });
    });

    describe('dias_recordatorio_cita', () => {
        const programar = async (diasAdelante) => {
            const g = await nuevaGestante();
            const emb = await nuevoEmbarazo(g.token, 100);
            await asignar(admin.token, prof.usuario.id, g.usuario.id);
            const hora = `${String(8 + (Date.now() % 10)).padStart(2, '0')}:${String(Date.now() % 60).padStart(2, '0')}`;
            const cita = await api().post(`/api/v1/embarazos/${emb.embarazo_id}/citas`).set(auth(prof.token))
                .send({ tipo_control: 'CONTROL_PRENATAL', fecha: dias(diasAdelante), hora });
            expect(cita.status).toBe(201);
            return g;
        };
        const panel = async (g) => (await api().get('/api/v1/dashboard').set(auth(g.token))).body.proxima_cita;

        test('la próxima cita trae los días que faltan y si toca destacarla', async () => {
            const g = await programar(2);
            const cita = await panel(g);
            expect(cita.dias_para).toBe(2);
            expect(cita.recordatorio).toBe(true); // 2 <= 3 (valor por defecto)
        });

        test('una cita más lejana que el aviso no se destaca', async () => {
            const g = await programar(10);
            const cita = await panel(g);
            expect(cita.dias_para).toBe(10);
            expect(cita.recordatorio).toBe(false);
        });

        test('cambiar el parámetro cambia el resultado sin esperar la caché', async () => {
            const g = await programar(10);
            expect((await panel(g)).recordatorio).toBe(false);
            expect((await fijar('dias_recordatorio_cita', '14')).status).toBe(200);
            expect((await panel(g)).recordatorio).toBe(true);
            expect((await fijar('dias_recordatorio_cita', '0')).status).toBe(200);
            expect((await panel(g)).recordatorio).toBe(false);
        });
    });
});
