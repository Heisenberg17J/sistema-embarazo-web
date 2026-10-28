const { execFileSync } = require('child_process');
const path = require('path');
const { pool } = require('./helpers');
const { hoy, diasEntre } = require('../src/utils/fechas');

afterAll(() => pool.end());

// Un servicio gestionado casi siempre corre en UTC. Entre las 7 p. m. y la
// medianoche de Colombia, "hoy" en UTC ya es "mañana": la semana de gestación,
// las citas de hoy y la fecha por defecto de un síntoma se correrían un día.
describe('Zona horaria (la app trabaja en hora de Colombia)', () => {
    test('el proceso queda en America/Bogota aunque el servidor traiga UTC', () => {
        const script = `
            process.env.JWT_SECRET = 'x'.repeat(40);
            process.env.DB_USER = 'u'; process.env.DB_PASSWORD = 'p'; process.env.DB_NAME = 'd';
            require(${JSON.stringify(path.join(__dirname, '../src/config/env'))});
            process.stdout.write(String(new Date().getTimezoneOffset()));`;
        const salida = execFileSync(process.execPath, ['-e', script], {
            env: { ...process.env, TZ: 'UTC', APP_TZ: '' },
            encoding: 'utf8'
        });
        // UTC-5 -> 300 minutos de diferencia, y sin horario de verano.
        expect(salida).toBe('300');
    });

    test('la sesión de PostgreSQL usa la misma zona', async () => {
        const { rows } = await pool.query('SHOW timezone');
        expect(rows[0].TimeZone).toBe('America/Bogota');
    });

    test('CURRENT_DATE en la base coincide con la fecha de hoy de la aplicación', async () => {
        const { rows } = await pool.query("SELECT to_char(CURRENT_DATE, 'YYYY-MM-DD') AS hoy");
        expect(rows[0].hoy).toBe(hoy());
    });

    test('a las 23:00 en Bogotá, UTC ya está en el día siguiente pero la app no', () => {
        const instante = new Date('2026-10-29T04:00:00Z'); // 23:00 del 28 en Colombia
        const enUtc = instante.toISOString().slice(0, 10);
        const enBogota = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(instante);
        expect(enUtc).toBe('2026-10-29');
        expect(enBogota).toBe('2026-10-28');
    });

    test('diasEntre cuenta días de calendario, también entre meses y años', () => {
        expect(diasEntre('2026-10-28', '2026-10-29')).toBe(1);
        expect(diasEntre('2026-10-31', '2026-11-01')).toBe(1);
        expect(diasEntre('2026-12-31', '2027-01-01')).toBe(1);
        expect(diasEntre('2026-02-01', '2026-03-01')).toBe(28);
    });
});
