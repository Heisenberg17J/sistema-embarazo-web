const { pool, transaccion } = require('../../config/db');
const { HttpError, noEncontrado } = require('../../utils/http');
const { ROLES } = require('../../middlewares/roles');
const { puedeVerGestante } = require('../../middlewares/acceso');
const { registrarAuditoria, ipDe } = require('../../services/auditoria');
const { actualizarParcial } = require('../../services/usuarios');
const { resumenEmbarazo } = require('../../services/embarazo');

const DIAS_GESTACION = 280;   // Regla de Naegele: FPP = FUM + 280 días
const DIAS_MAX_FUM = 44 * 7;  // Una FUM más antigua no corresponde a un embarazo en curso

const sumarDias = (fechaIso, dias) => {
    const d = new Date(`${fechaIso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
};

const diasDesde = (fechaIso) => Math.floor((Date.now() - new Date(`${fechaIso}T00:00:00`).getTime()) / 86400000);

// Determina sobre qué gestante se actúa: la gestante sobre sí misma; el profesional sobre una asignada.
const gestanteObjetivo = async (req, gestanteId) => {
    if (req.usuario.rol === ROLES.GESTANTE) return req.usuario.id;
    if (!gestanteId) throw new HttpError(400, 'Debe indicar gestante_id');
    if (!(await puedeVerGestante(pool, req.usuario, gestanteId))) throw noEncontrado('Gestante');
    return gestanteId;
};

// RF-04: registro del embarazo; la FPP se calcula si no se envía.
const crear = async (req, res) => {
    const { gestante_id: gestanteIdBody, fecha_inicio: fum, fecha_estimada_parto: fpp, ...resto } = req.body;
    const gestanteId = await gestanteObjetivo(req, gestanteIdBody);
    if (diasDesde(fum) > DIAS_MAX_FUM) {
        throw new HttpError(422, 'La fecha de última menstruación indica más de 44 semanas; verifique la fecha');
    }

    const resumen = await transaccion(async (db) => {
        const { rows } = await db.query(
            `INSERT INTO embarazo (gestante_usuario_id, fecha_inicio, fecha_estimada_parto, talla_cm, peso_pregestacional_kg, observaciones)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [gestanteId, fum, fpp || sumarDias(fum, DIAS_GESTACION), resto.talla_cm ?? null,
                resto.peso_pregestacional_kg ?? null, resto.observaciones ?? null]
        );
        await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'CREAR', entidad: 'embarazo', entidadId: rows[0].id, ip: ipDe(req) });
        return resumenEmbarazo(db, rows[0].id);
    });
    res.status(201).json(resumen);
};

// Embarazo activo de la gestante autenticada.
const actual = async (req, res) => {
    const { rows } = await pool.query(
        `SELECT id FROM embarazo WHERE gestante_usuario_id = $1 AND estado = 'ACTIVO'`, [req.usuario.id]
    );
    if (!rows[0]) throw noEncontrado('Embarazo activo');
    res.status(200).json(await resumenEmbarazo(pool, rows[0].id));
};

// Historial de embarazos (actual y anteriores) de una gestante.
const listar = async (req, res) => {
    const gestanteId = await gestanteObjetivo(req, req.query.gestante_id);
    const { rows } = await pool.query(
        `SELECT id FROM embarazo WHERE gestante_usuario_id = $1 ORDER BY fecha_inicio DESC`, [gestanteId]
    );
    res.status(200).json(await Promise.all(rows.map((r) => resumenEmbarazo(pool, r.id))));
};

const obtener = async (req, res) => {
    res.status(200).json(await resumenEmbarazo(pool, req.embarazo.id));
};

const actualizar = async (req, res) => {
    const resumen = await transaccion(async (db) => {
        await actualizarParcial(db, 'embarazo', 'id', req.embarazo.id, req.body,
            ['fecha_inicio', 'fecha_estimada_parto', 'talla_cm', 'peso_pregestacional_kg', 'observaciones']);
        await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'MODIFICAR', entidad: 'embarazo', entidadId: req.embarazo.id, detalle: { campos: Object.keys(req.body) }, ip: ipDe(req) });
        return resumenEmbarazo(db, req.embarazo.id);
    });
    res.status(200).json(resumen);
};

// Cierra el embarazo y cancela las citas pendientes asociadas.
const finalizar = async (req, res) => {
    if (req.embarazo.estado !== 'ACTIVO') throw new HttpError(409, 'El embarazo ya está cerrado');
    const { estado, fecha_finalizacion: fechaFin, observaciones } = req.body;
    const resumen = await transaccion(async (db) => {
        await db.query(
            `UPDATE embarazo SET estado = $2, fecha_finalizacion = COALESCE($3, CURRENT_DATE),
                    observaciones = COALESCE($4, observaciones)
              WHERE id = $1`,
            [req.embarazo.id, estado, fechaFin ?? null, observaciones ?? null]
        );
        await db.query(
            `UPDATE cita SET estado = 'CANCELADA', motivo_cancelacion = 'Embarazo cerrado'
              WHERE embarazo_id = $1 AND estado IN ('PROGRAMADA', 'REPROGRAMADA')`,
            [req.embarazo.id]
        );
        await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'MODIFICAR', entidad: 'embarazo', entidadId: req.embarazo.id, detalle: { estado }, ip: ipDe(req) });
        return resumenEmbarazo(db, req.embarazo.id);
    });
    res.status(200).json(resumen);
};

module.exports = { crear, actual, listar, obtener, actualizar, finalizar };
