const { pool, transaccion } = require('../../config/db');
const { paginacion, paginado } = require('../../utils/http');
const { ROLES } = require('../../middlewares/roles');
const { exigirActivo } = require('../../middlewares/acceso');
const { registrarAuditoria, ipDe } = require('../../services/auditoria');
const { registrarMediciones } = require('../../services/mediciones');

// La gestante registra peso, presión, etc. desde casa; el profesional fuera de un control.
const crear = async (req, res) => {
    exigirActivo(req.embarazo);
    const { mediciones, fecha_registro: fechaRegistro, observaciones } = req.body;
    const resultado = await transaccion(async (db) => {
        const r = await registrarMediciones(db, {
            embarazo: req.embarazo, mediciones, fechaRegistro, observaciones,
            origen: req.usuario.rol === ROLES.GESTANTE ? 'GESTANTE' : 'PROFESIONAL',
            registradoPor: req.usuario.id
        });
        await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'CREAR', entidad: 'medicion', entidadId: r.mediciones[0].id, detalle: { embarazo_id: req.embarazo.id, tipos: mediciones.map((m) => m.tipo), alertas: r.alertas.length }, ip: ipDe(req) });
        return r;
    });
    res.status(201).json(resultado);
};

const listar = async (req, res) => {
    const { tipo, desde, hasta } = req.query;
    const pag = paginacion(req.query);
    const valores = [req.embarazo.id];
    const filtros = ['m.embarazo_id = $1'];
    if (tipo) { valores.push(tipo); filtros.push(`t.codigo = $${valores.length}`); }
    if (desde) { valores.push(desde); filtros.push(`m.fecha_registro >= $${valores.length}::date`); }
    if (hasta) { valores.push(hasta); filtros.push(`m.fecha_registro < $${valores.length}::date + 1`); }
    const where = filtros.join(' AND ');
    const [{ rows }, conteo] = await Promise.all([
        pool.query(
            `SELECT m.id, t.codigo AS tipo, t.nombre, t.unidad, m.valor, m.fecha_registro, m.semana_gestacion,
                    m.origen, m.control_id, m.observaciones
               FROM medicion m JOIN tipo_medicion t ON t.id = m.tipo_medicion_id
              WHERE ${where}
              ORDER BY m.fecha_registro DESC, m.id DESC
              LIMIT ${pag.limit} OFFSET ${pag.offset}`, valores),
        pool.query(`SELECT count(*)::int AS total FROM medicion m JOIN tipo_medicion t ON t.id = m.tipo_medicion_id WHERE ${where}`, valores)
    ]);
    res.status(200).json(paginado(rows, conteo.rows[0].total, pag));
};

// RF-10: series para las gráficas, con los umbrales activos como líneas de referencia.
const serie = async (req, res) => {
    const tipos = req.query.tipos;
    const [{ rows: puntos }, { rows: info }, { rows: reglas }] = await Promise.all([
        pool.query(
            `SELECT t.codigo AS tipo, m.fecha_registro AS fecha, m.semana_gestacion AS semana, m.valor, m.origen
               FROM medicion m JOIN tipo_medicion t ON t.id = m.tipo_medicion_id
              WHERE m.embarazo_id = $1 AND t.codigo = ANY($2)
              ORDER BY m.fecha_registro, m.id`, [req.embarazo.id, tipos]),
        pool.query('SELECT codigo, nombre, unidad FROM tipo_medicion WHERE codigo = ANY($1)', [tipos]),
        pool.query(
            `SELECT t.codigo AS tipo, r.codigo, r.operador, r.valor_referencia, r.valor_min, r.valor_max, r.severidad
               FROM regla_alerta r JOIN tipo_medicion t ON t.id = r.tipo_medicion_id
              WHERE r.activa AND t.codigo = ANY($1)`, [tipos])
    ]);
    const series = info.map((t) => ({
        tipo: t.codigo,
        nombre: t.nombre,
        unidad: t.unidad,
        puntos: puntos.filter((p) => p.tipo === t.codigo).map(({ tipo: _t, ...p }) => p),
        referencias: reglas.filter((r) => r.tipo === t.codigo).map(({ tipo: _t, ...r }) => r)
    }));
    res.status(200).json({ embarazo_id: req.embarazo.id, fecha_inicio: req.embarazo.fecha_inicio, series });
};

module.exports = { crear, listar, serie };
