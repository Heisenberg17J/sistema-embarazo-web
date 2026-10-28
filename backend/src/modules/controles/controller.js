const { pool, transaccion } = require('../../config/db');
const { HttpError, noEncontrado, paginacion, paginado } = require('../../utils/http');
const { exigirActivo } = require('../../middlewares/acceso');
const { registrarAuditoria, ipDe } = require('../../services/auditoria');
const { notificarAlertasCriticas } = require('../../services/notificaciones');
const { registrarMediciones } = require('../../services/mediciones');
const { evaluarMedicion, presentarAlerta } = require('../../services/alertas');
const { esEditable, exigirCorreccion, exigirMotivo, anularAlertas } = require('../../services/correcciones');

const SELECT_CONTROL = `
    SELECT c.id, c.embarazo_id, c.cita_id, c.fecha, c.semana_gestacion, c.observaciones, c.creado_en,
           c.profesional_usuario_id, u.nombre || ' ' || u.apellido AS profesional,
           COALESCE((SELECT json_agg(json_build_object('tipo', t.codigo, 'nombre', t.nombre, 'valor', m.valor, 'unidad', t.unidad)
                                      ORDER BY t.id)
                       FROM medicion m JOIN tipo_medicion t ON t.id = m.tipo_medicion_id
                      WHERE m.control_id = c.id), '[]') AS mediciones
      FROM control c JOIN usuario u ON u.id = c.profesional_usuario_id`;

// `editable` lo decide el servidor: la pantalla solo ofrece "Corregir" si de verdad se puede.
const conEditable = (usuario, c) => ({
    ...c,
    editable: esEditable(usuario, { propietarioId: c.profesional_usuario_id, creadoEn: c.creado_en })
});

const listar = async (req, res) => {
    const pag = paginacion(req.query);
    const [{ rows }, conteo] = await Promise.all([
        pool.query(`${SELECT_CONTROL} WHERE c.embarazo_id = $1 ORDER BY c.fecha DESC, c.id DESC LIMIT ${pag.limit} OFFSET ${pag.offset}`, [req.embarazo.id]),
        pool.query('SELECT count(*)::int AS total FROM control WHERE embarazo_id = $1', [req.embarazo.id])
    ]);
    res.status(200).json(paginado(rows.map((c) => conEditable(req.usuario, c)), conteo.rows[0].total, pag));
};

const obtener = async (req, res) => {
    const { rows } = await pool.query(`${SELECT_CONTROL} WHERE c.id = $1 AND c.embarazo_id = $2`, [req.params.id, req.embarazo.id]);
    if (!rows[0]) throw noEncontrado('Control');
    res.status(200).json(conEditable(req.usuario, rows[0]));
};

// RF-05: el control y sus mediciones se guardan juntos; si la cita existe, queda CUMPLIDA.
const crear = async (req, res) => {
    exigirActivo(req.embarazo);
    const { fecha, cita_id: citaId, observaciones, mediciones = [] } = req.body;

    const resultado = await transaccion(async (db) => {
        if (citaId) {
            const { rows } = await db.query(
                `UPDATE cita SET estado = 'CUMPLIDA'
                  WHERE id = $1 AND embarazo_id = $2 AND estado IN ('PROGRAMADA', 'REPROGRAMADA', 'CUMPLIDA')
                  RETURNING id`,
                [citaId, req.embarazo.id]
            );
            if (!rows[0]) throw new HttpError(400, 'La cita no pertenece a este embarazo o está cancelada');
        }
        const { rows } = await db.query(
            `INSERT INTO control (embarazo_id, profesional_usuario_id, cita_id, fecha, semana_gestacion, observaciones)
             VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE),
                     fn_semana_gestacion($5, COALESCE($4::date, CURRENT_DATE)), $6)
             RETURNING id, fecha`,
            [req.embarazo.id, req.usuario.id, citaId ?? null, fecha ?? null, req.embarazo.fecha_inicio, observaciones ?? null]
        );
        const control = rows[0];
        const { alertas } = await registrarMediciones(db, {
            embarazo: req.embarazo, mediciones, origen: 'PROFESIONAL', registradoPor: req.usuario.id,
            controlId: control.id, fechaRegistro: `${control.fecha}T12:00:00`
        });
        await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'CREAR', entidad: 'control', entidadId: control.id, detalle: { embarazo_id: req.embarazo.id, mediciones: mediciones.length }, ip: ipDe(req) });
        const completo = (await db.query(`${SELECT_CONTROL} WHERE c.id = $1`, [control.id])).rows[0];
        return { ...completo, alertas };
    });
    void notificarAlertasCriticas(req.embarazo, resultado.alertas);
    res.status(201).json(resultado);
};

const cargarCorregible = async (db, req) => {
    const { rows } = await db.query(
        'SELECT * FROM control WHERE id = $1 AND embarazo_id = $2 FOR UPDATE', [req.params.id, req.embarazo.id]
    );
    const control = rows[0];
    if (!control) throw noEncontrado('Control');
    exigirCorreccion(req.usuario, { propietarioId: control.profesional_usuario_id, creadoEn: control.creado_en });
    return control;
};

// Corrige un control: sus observaciones y/o sus mediciones. Un valor `null` elimina esa medición.
// Cada medición que cambia anula las alertas del valor anterior y se evalúa de nuevo.
const corregir = async (req, res) => {
    exigirActivo(req.embarazo);
    exigirMotivo(req.usuario, req.body.motivo);
    const { observaciones, mediciones = [], motivo } = req.body;

    const resultado = await transaccion(async (db) => {
        const control = await cargarCorregible(db, req);
        const cambios = [];
        const alertas = [];
        let anuladas = 0;

        if (observaciones !== undefined) {
            await db.query('UPDATE control SET observaciones = $2 WHERE id = $1', [control.id, observaciones]);
            cambios.push({ campo: 'observaciones', antes: control.observaciones, despues: observaciones });
        }

        if (mediciones.length) {
            const { rows: existentes } = await db.query(
                `SELECT m.id, m.valor, t.codigo AS tipo, t.decimales
                   FROM medicion m JOIN tipo_medicion t ON t.id = m.tipo_medicion_id
                  WHERE m.control_id = $1 FOR UPDATE OF m`, [control.id]
            );
            for (const { tipo, valor } of mediciones) {
                const actual = existentes.find((m) => m.tipo === tipo);

                if (valor === null) {
                    if (!actual) continue;
                    anuladas += (await anularAlertas(db, {
                        medicionIds: [actual.id], usuarioId: req.usuario.id, motivo: `La medición se eliminó del control: ${motivo}`
                    })).length;
                    await db.query('DELETE FROM medicion WHERE id = $1', [actual.id]);
                    cambios.push({ campo: tipo, antes: actual.valor, despues: null });
                } else if (actual) {
                    if (Number(valor) === Number(actual.valor)) continue;
                    const { rows } = await db.query(
                        'UPDATE medicion SET valor = round($2::numeric, $3) WHERE id = $1 RETURNING *', [actual.id, valor, actual.decimales]
                    );
                    anuladas += (await anularAlertas(db, {
                        medicionIds: [actual.id], usuarioId: req.usuario.id,
                        motivo: `El valor se corrigió de ${actual.valor} a ${rows[0].valor}: ${motivo}`
                    })).length;
                    const alerta = await evaluarMedicion(db, { ...rows[0], tipo });
                    if (alerta) alertas.push(presentarAlerta(alerta));
                    cambios.push({ campo: tipo, antes: actual.valor, despues: rows[0].valor });
                } else {
                    // Una medición que se olvidó al registrar el control.
                    const r = await registrarMediciones(db, {
                        embarazo: req.embarazo, mediciones: [{ tipo, valor }], origen: 'PROFESIONAL',
                        registradoPor: req.usuario.id, controlId: control.id, fechaRegistro: `${control.fecha}T12:00:00`
                    });
                    alertas.push(...r.alertas);
                    cambios.push({ campo: tipo, antes: null, despues: r.mediciones[0].valor });
                }
            }
        }

        await registrarAuditoria(db, {
            usuarioId: req.usuario.id, accion: 'MODIFICAR', entidad: 'control', entidadId: control.id,
            detalle: { embarazo_id: req.embarazo.id, motivo: motivo ?? null, cambios, alertas_anuladas: anuladas, alertas_nuevas: alertas.length },
            ip: ipDe(req)
        });
        const completo = (await db.query(`${SELECT_CONTROL} WHERE c.id = $1`, [control.id])).rows[0];
        return { ...conEditable(req.usuario, completo), alertas, alertas_anuladas: anuladas };
    });
    void notificarAlertasCriticas(req.embarazo, resultado.alertas);
    res.status(200).json(resultado);
};

// Elimina un control y sus mediciones. Sus alertas no desaparecen: quedan anuladas.
const eliminar = async (req, res) => {
    exigirActivo(req.embarazo);
    exigirMotivo(req.usuario, req.body?.motivo);
    const motivo = req.body?.motivo;

    await transaccion(async (db) => {
        const control = await cargarCorregible(db, req);
        const { rows: mediciones } = await db.query(
            `SELECT t.codigo AS tipo, m.id, m.valor FROM medicion m JOIN tipo_medicion t ON t.id = m.tipo_medicion_id
              WHERE m.control_id = $1`, [control.id]
        );
        const anuladas = await anularAlertas(db, {
            medicionIds: mediciones.map((m) => m.id), controlId: control.id, usuarioId: req.usuario.id,
            motivo: `El control se eliminó: ${motivo}`
        });
        // Las mediciones del control se eliminan en cascada.
        await db.query('DELETE FROM control WHERE id = $1', [control.id]);
        await registrarAuditoria(db, {
            usuarioId: req.usuario.id, accion: 'DESACTIVAR', entidad: 'control', entidadId: control.id,
            detalle: {
                eliminado: true, embarazo_id: req.embarazo.id, fecha: control.fecha, semana: control.semana_gestacion,
                observaciones: control.observaciones, mediciones: mediciones.map((m) => ({ tipo: m.tipo, valor: m.valor })),
                motivo, alertas_anuladas: anuladas.length
            },
            ip: ipDe(req)
        });
    });
    res.status(200).json({ mensaje: 'Control eliminado' });
};

module.exports = { listar, obtener, crear, corregir, eliminar };
