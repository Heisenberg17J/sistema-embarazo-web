const { pool, transaccion } = require('../../config/db');
const { noEncontrado, paginacion, paginado } = require('../../utils/http');
const { ROLES } = require('../../middlewares/roles');
const { exigirActivo } = require('../../middlewares/acceso');
const { registrarAuditoria, ipDe } = require('../../services/auditoria');
const { notificarAlertasCriticas } = require('../../services/notificaciones');
const { registrarMediciones } = require('../../services/mediciones');
const { evaluarMedicion, presentarAlerta } = require('../../services/alertas');
const { esEditable, exigirCorreccion, exigirMotivo, anularAlertas } = require('../../services/correcciones');

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
    void notificarAlertasCriticas(req.embarazo, resultado.alertas);
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
                    m.origen, m.control_id, m.observaciones, m.registrado_por, m.creado_en
               FROM medicion m JOIN tipo_medicion t ON t.id = m.tipo_medicion_id
              WHERE ${where}
              ORDER BY m.fecha_registro DESC, m.id DESC
              LIMIT ${pag.limit} OFFSET ${pag.offset}`, valores),
        pool.query(`SELECT count(*)::int AS total FROM medicion m JOIN tipo_medicion t ON t.id = m.tipo_medicion_id WHERE ${where}`, valores)
    ]);
    // `editable` le dice a la pantalla si puede ofrecer "Corregir": lo decide el servidor, no el cliente.
    const filas = rows.map(({ registrado_por: propietarioId, creado_en: creadoEn, ...m }) => ({
        ...m,
        editable: esEditable(req.usuario, { propietarioId, creadoEn })
    }));
    res.status(200).json(paginado(filas, conteo.rows[0].total, pag));
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

// Carga la medición bloqueada para modificarla y comprueba que se pueda corregir.
const cargarCorregible = async (db, req) => {
    const { rows } = await db.query(
        `SELECT m.*, t.codigo AS tipo, t.nombre AS tipo_nombre, t.decimales
           FROM medicion m JOIN tipo_medicion t ON t.id = m.tipo_medicion_id
          WHERE m.id = $1 AND m.embarazo_id = $2 FOR UPDATE OF m`,
        [req.params.id, req.embarazo.id]
    );
    const fila = rows[0];
    if (!fila) throw noEncontrado('Medición');
    exigirCorreccion(req.usuario, { propietarioId: fila.registrado_por, creadoEn: fila.creado_en });
    return fila;
};

// Corrige el valor de una medición. Las alertas que generó el valor anterior se anulan
// (no se borran) y se evalúa el nuevo: puede nacer una alerta nueva, o ninguna.
const corregir = async (req, res) => {
    exigirActivo(req.embarazo);
    exigirMotivo(req.usuario, req.body.motivo);
    const { valor, observaciones, motivo } = req.body;

    const resultado = await transaccion(async (db) => {
        const antes = await cargarCorregible(db, req);
        const cambiaValor = valor !== undefined && Number(valor) !== Number(antes.valor);

        const { rows } = await db.query(
            `UPDATE medicion
                SET valor = COALESCE(round($2::numeric, $3), valor),
                    observaciones = CASE WHEN $4::boolean THEN $5 ELSE observaciones END
              WHERE id = $1 RETURNING *`,
            [antes.id, valor ?? null, antes.decimales, observaciones !== undefined, observaciones ?? null]
        );
        const nueva = { ...rows[0], tipo: antes.tipo };

        let alertas = [];
        let anuladas = [];
        if (cambiaValor) {
            anuladas = await anularAlertas(db, {
                medicionIds: [antes.id], usuarioId: req.usuario.id,
                motivo: `El valor se corrigió de ${antes.valor} a ${nueva.valor}${motivo ? `: ${motivo}` : ''}`
            });
            const alerta = await evaluarMedicion(db, nueva);
            alertas = alerta ? [presentarAlerta(alerta)] : [];
        }

        await registrarAuditoria(db, {
            usuarioId: req.usuario.id, accion: 'MODIFICAR', entidad: 'medicion', entidadId: antes.id,
            detalle: {
                embarazo_id: req.embarazo.id, tipo: antes.tipo, motivo: motivo ?? null,
                antes: { valor: antes.valor, observaciones: antes.observaciones },
                despues: { valor: nueva.valor, observaciones: nueva.observaciones },
                alertas_anuladas: anuladas.length, alertas_nuevas: alertas.length
            },
            ip: ipDe(req)
        });
        return { medicion: { ...nueva, tipo_nombre: antes.tipo_nombre }, alertas, alertas_anuladas: anuladas.length };
    });
    void notificarAlertasCriticas(req.embarazo, resultado.alertas);
    res.status(200).json(resultado);
};

const eliminar = async (req, res) => {
    exigirActivo(req.embarazo);
    exigirMotivo(req.usuario, req.body?.motivo);
    const motivo = req.body?.motivo;

    await transaccion(async (db) => {
        const fila = await cargarCorregible(db, req);
        // Primero las alertas: al desaparecer el dato su vínculo se pondría en NULL de todos modos,
        // pero así quedan marcadas como anuladas y no como alertas huérfanas pendientes.
        const anuladas = await anularAlertas(db, {
            medicionIds: [fila.id], usuarioId: req.usuario.id,
            motivo: `El dato se eliminó${motivo ? `: ${motivo}` : ''}`
        });
        await db.query('DELETE FROM medicion WHERE id = $1', [fila.id]);
        await registrarAuditoria(db, {
            usuarioId: req.usuario.id, accion: 'DESACTIVAR', entidad: 'medicion', entidadId: fila.id,
            detalle: {
                eliminada: true, embarazo_id: req.embarazo.id, tipo: fila.tipo, valor: fila.valor,
                fecha_registro: fila.fecha_registro, motivo: motivo ?? null, alertas_anuladas: anuladas.length
            },
            ip: ipDe(req)
        });
    });
    res.status(200).json({ mensaje: 'Medición eliminada' });
};

module.exports = { crear, listar, serie, corregir, eliminar };
