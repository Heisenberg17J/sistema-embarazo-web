// Crea el primer administrador de una base nueva (en producción no se cargan los datos de prueba,
// que traen contraseñas conocidas). Sin administrador no hay quien cree profesionales.
//
//   ADMIN_CORREO=ana@tu-dominio.com ADMIN_NOMBRE=Ana ADMIN_APELLIDO=Pérez node scripts/crear-admin.js
//
// Con ADMIN_CONTRASENA se usa esa; sin ella se genera una al azar y se muestra UNA vez. En ambos
// casos la cuenta queda obligada a cambiarla en el primer ingreso.
const crypto = require('crypto');
const { pool, transaccion } = require('../src/config/db');
const { crearUsuario } = require('../src/services/usuarios');
const { z, correo, contrasena } = require('../src/utils/esquemas');

const generar = () => {
    // Letras y números sin caracteres que se confundan (0/O, 1/l), siempre con al menos uno de cada tipo.
    const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const elegir = (n) => Array.from(crypto.randomBytes(n), (b) => alfabeto[b % alfabeto.length]).join('');
    return `${elegir(7)}-${elegir(7)}-${crypto.randomInt(10, 99)}`;
};

const principal = async () => {
    const faltan = ['ADMIN_CORREO', 'ADMIN_NOMBRE', 'ADMIN_APELLIDO'].filter((v) => !process.env[v]?.trim());
    if (faltan.length) throw new Error(`Falta definir ${faltan.join(', ')}`);
    const generada = !process.env.ADMIN_CONTRASENA;
    const datos = z.object({
        correo, nombre: z.string().trim().min(1, 'Falta ADMIN_NOMBRE'),
        apellido: z.string().trim().min(1, 'Falta ADMIN_APELLIDO'), contrasena
    }).safeParse({
        correo: process.env.ADMIN_CORREO, nombre: process.env.ADMIN_NOMBRE,
        apellido: process.env.ADMIN_APELLIDO, contrasena: process.env.ADMIN_CONTRASENA || generar()
    });
    if (!datos.success) {
        throw new Error(datos.error.issues.map((i) => `${i.path.join('.') || 'datos'}: ${i.message}`).join('; '));
    }
    const d = datos.data;

    await transaccion(async (db) => {
        const existe = await db.query('SELECT 1 FROM usuario WHERE lower(correo) = lower($1)', [d.correo]);
        if (existe.rowCount) throw new Error(`Ya existe una cuenta con el correo ${d.correo}`);
        await crearUsuario(db, { rol: 'ADMINISTRADOR', ...d, debeCambiar: true });
    });

    console.log(`Administrador creado: ${d.correo}`);
    if (generada) console.log(`Contraseña temporal (se muestra solo ahora): ${d.contrasena}`);
    console.log('Deberá cambiarla al entrar por primera vez.');
};

principal()
    .then(() => pool.end())
    .catch((e) => { console.error(`No se creó el administrador: ${e.message}`); process.exitCode = 1; return pool.end(); });
