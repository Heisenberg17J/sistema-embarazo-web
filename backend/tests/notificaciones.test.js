const { api, auth, SEED, login, nuevaGestante, nuevoEmbarazo, asignar, pool } = require('./helpers');
const correo = require('../src/services/correo');

afterAll(() => pool.end());

// Los envíos se disparan sin esperar (no bloquean a quien registra el dato), así que se espera
// a que llegue a la bandeja de pruebas en lugar de asumir cuándo.
const esperarCorreos = async (desde, esperados = 1) => {
    for (let i = 0; i < 50 && correo.bandeja.length - desde < esperados; i += 1) {
        await new Promise((r) => setTimeout(r, 20));
    }
    return correo.bandeja.slice(desde);
};

describe('Aviso por correo de una alerta de atención inmediata', () => {
    let admin;
    let prof;

    beforeAll(async () => {
        admin = await login(SEED.admin);
        prof = await login(SEED.profesional);
    });

    const nuevaPaciente = async ({ conProfesional = true } = {}) => {
        const g = await nuevaGestante();
        const emb = await nuevoEmbarazo(g.token, 150);
        if (conProfesional) await asignar(admin.token, prof.usuario.id, g.usuario.id);
        return { g, base: `/api/v1/embarazos/${emb.embarazo_id}` };
    };

    test('una presión crítica avisa al profesional asignado, sin datos clínicos', async () => {
        const { g, base } = await nuevaPaciente();
        const antes = correo.bandeja.length;

        await api().post(`${base}/mediciones`).set(auth(g.token))
            .send({ mediciones: [{ tipo: 'PA_SISTOLICA', valor: 168 }, { tipo: 'PA_DIASTOLICA', valor: 114 }] }).expect(201);

        const [msg] = await esperarCorreos(antes);
        expect(msg.para).toBe(SEED.profesional.correo);
        expect(msg.asunto).toContain(`${g.datos.nombre} ${g.datos.apellido}`);
        expect(msg.texto).toContain(`/pro/pacientes/${g.usuario.id}?seccion=alertas`);
        // Dos alertas críticas en la misma petición, un solo correo.
        expect(msg.texto).toMatch(/2 alertas/);
        expect(correo.bandeja.length - antes).toBe(1);

        // El correo no es un canal seguro: ni valores ni mensajes clínicos.
        expect(msg.texto + msg.html + msg.asunto).not.toMatch(/168|114|mmHg|urgencias|sist[oó]lica|diast[oó]lica/i);
    });

    test('un síntoma de alarma también avisa', async () => {
        const { g, base } = await nuevaPaciente();
        const antes = correo.bandeja.length;
        await api().post(`${base}/sintomas`).set(auth(g.token)).send({ tipo: 'SANGRADO' }).expect(201);
        const [msg] = await esperarCorreos(antes);
        expect(msg.para).toBe(SEED.profesional.correo);
        expect(msg.texto + msg.html).not.toMatch(/sangrado/i);
    });

    test('un control con frecuencia cardiaca fetal baja avisa al profesional que lo registró', async () => {
        const { base } = await nuevaPaciente();
        const antes = correo.bandeja.length;
        await api().post(`${base}/controles`).set(auth(prof.token)).send({ mediciones: [{ tipo: 'FCF', valor: 90 }] }).expect(201);
        const [msg] = await esperarCorreos(antes);
        expect(msg.para).toBe(SEED.profesional.correo);
    });

    test('una advertencia no genera correo: solo lo que pide atención inmediata', async () => {
        const { g, base } = await nuevaPaciente();
        const antes = correo.bandeja.length;
        const r = await api().post(`${base}/mediciones`).set(auth(g.token)).send({ mediciones: [{ tipo: 'PA_SISTOLICA', valor: 145 }] }).expect(201);
        expect(r.body.alertas[0].severidad).toBe('ADVERTENCIA');
        await new Promise((res) => setTimeout(res, 150));
        expect(correo.bandeja.length).toBe(antes);
    });

    test('un valor normal tampoco', async () => {
        const { g, base } = await nuevaPaciente();
        const antes = correo.bandeja.length;
        await api().post(`${base}/mediciones`).set(auth(g.token)).send({ mediciones: [{ tipo: 'PESO', valor: 62 }] }).expect(201);
        await new Promise((res) => setTimeout(res, 150));
        expect(correo.bandeja.length).toBe(antes);
    });

    test('corregir un valor y que siga siendo crítico vuelve a avisar; que deje de serlo, no', async () => {
        const { g, base } = await nuevaPaciente();
        const r = await api().post(`${base}/mediciones`).set(auth(g.token)).send({ mediciones: [{ tipo: 'PA_SISTOLICA', valor: 150 }] }).expect(201);
        const id = r.body.mediciones[0].id;

        const antes = correo.bandeja.length;
        await api().patch(`${base}/mediciones/${id}`).set(auth(g.token)).send({ valor: 180 }).expect(200);
        await esperarCorreos(antes);
        expect(correo.bandeja.length - antes).toBe(1);

        await api().patch(`${base}/mediciones/${id}`).set(auth(g.token)).send({ valor: 120 }).expect(200);
        await new Promise((res) => setTimeout(res, 150));
        expect(correo.bandeja.length - antes).toBe(1);
    });

    test('si hay dos profesionales asignados, los dos reciben el aviso', async () => {
        const { g, base } = await nuevaPaciente();
        const prof2 = await login(SEED.profesional2);
        await asignar(admin.token, prof2.usuario.id, g.usuario.id);
        const antes = correo.bandeja.length;

        await api().post(`${base}/sintomas`).set(auth(g.token)).send({ tipo: 'CONVULSION' }).expect(201);
        const msgs = await esperarCorreos(antes, 2);
        expect(msgs.map((m) => m.para).sort()).toEqual([SEED.profesional.correo, SEED.profesional2.correo].sort());
    });

    test('sin profesional asignado se avisa a los administradores para que le asignen uno', async () => {
        const { g, base } = await nuevaPaciente({ conProfesional: false });
        const antes = correo.bandeja.length;

        await api().post(`${base}/sintomas`).set(auth(g.token)).send({ tipo: 'SANGRADO' }).expect(201);
        const [msg] = await esperarCorreos(antes);
        expect(msg.para).toBe(SEED.admin.correo);
        expect(msg.asunto).toMatch(/sin profesional/i);
        expect(msg.texto).toMatch(/\/admin\/asignaciones/);
    });

    test('un profesional cuya asignación terminó ya no recibe avisos', async () => {
        const { g, base } = await nuevaPaciente();
        const { rows } = await pool.query(
            'SELECT id FROM seguimiento_embarazo.asignacion WHERE gestante_usuario_id = $1 AND activa', [g.usuario.id]
        );
        await api().patch(`/api/v1/asignaciones/${rows[0].id}/finalizar`).set(auth(admin.token)).expect(200);
        const antes = correo.bandeja.length;

        await api().post(`${base}/sintomas`).set(auth(g.token)).send({ tipo: 'SANGRADO' }).expect(201);
        const [msg] = await esperarCorreos(antes);
        // Ya no es "su" paciente: el aviso va a los administradores, no a él.
        expect(msg.para).toBe(SEED.admin.correo);
    });

    test('que el correo falle no impide registrar el dato', async () => {
        const { g, base } = await nuevaPaciente();
        const espia = jest.spyOn(correo, 'enviarCorreo').mockRejectedValue(new Error('el proveedor no responde'));
        const error = jest.spyOn(console, 'error').mockImplementation(() => {});
        try {
            const r = await api().post(`${base}/sintomas`).set(auth(g.token)).send({ tipo: 'SANGRADO' });
            // El registro y la alerta existen aunque el aviso no salió.
            expect(r.status).toBe(201);
            expect(r.body.alerta.severidad).toBe('CRITICA');
            await new Promise((res) => setTimeout(res, 100));
            expect(espia).toHaveBeenCalled();
        } finally {
            espia.mockRestore();
            error.mockRestore();
        }
    });
});
