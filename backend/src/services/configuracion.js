const { pool } = require('../config/db');
const { HttpError } = require('../utils/http');

// Parámetros de `configuracion_sistema` que la aplicación de verdad lee. Cada uno declara su
// rango: un valor fuera de él haría fallar otra cosa (semanas_max_gestacion no puede pasar de
// 45 porque la base de datos limita las semanas de controles y mediciones a 45).
const PARAMETROS = {
    semanas_max_gestacion: { defecto: 45, min: 38, max: 45, etiqueta: 'La semana máxima de gestación' },
    dias_recordatorio_cita: { defecto: 3, min: 0, max: 30, etiqueta: 'Los días de anticipación del recordatorio' }
};

// Caché corta: estos valores se leen en cada registro de embarazo y en cada panel, y casi nunca cambian.
const TTL_MS = 60 * 1000;
const cache = new Map();

const invalidar = () => cache.clear();

const entero = async (clave) => {
    const definicion = PARAMETROS[clave];
    const hit = cache.get(clave);
    if (hit && hit.hasta > Date.now()) return hit.valor;

    const { rows } = await pool.query('SELECT valor FROM configuracion_sistema WHERE clave = $1', [clave]);
    const leido = Number.parseInt(rows[0]?.valor, 10);
    // Si el valor guardado no sirve (alguien lo editó a mano en la base), se usa el defecto.
    const valor = Number.isInteger(leido) && leido >= definicion.min && leido <= definicion.max ? leido : definicion.defecto;
    cache.set(clave, { valor, hasta: Date.now() + TTL_MS });
    return valor;
};

// Valida lo que el administrador intenta guardar. Los parámetros que no están en PARAMETROS
// (informativos) se aceptan tal cual.
const validar = (clave, valor) => {
    const d = PARAMETROS[clave];
    if (!d) return;
    const n = Number(valor);
    if (!/^\d+$/.test(String(valor).trim()) || n < d.min || n > d.max) {
        throw new HttpError(400, 'Datos inválidos', [{
            campo: 'valor', mensaje: `${d.etiqueta} debe ser un número entero entre ${d.min} y ${d.max}`
        }]);
    }
};

module.exports = { entero, validar, invalidar, PARAMETROS };
