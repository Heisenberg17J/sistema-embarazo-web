const { pool, transaccion } = require('../../config/db');
const { HttpError, noEncontrado, paginacion, paginado } = require('../../utils/http');
const { exigirActivo } = require('../../middlewares/acceso');
const { registrarAuditoria, ipDe } = require('../../services/auditoria');
const { notificarAlertasCriticas } = require('../../services/notificaciones');
const { evaluarSintoma, presentarAlerta } = require('../../services/alertas');
const { esEditable, exigirCorreccion, anularAlertas } = require('../../services/correcciones');

// RF-06. Si es un signo de alarma, la respuesta incluye la alerta para que el frontend
// muestre de inmediato la indicación de acudir a urgencias.
const crear = async (req, res) => {
    exigirActivo(req.embarazo);
    const { tipo, descripcion, intensidad, fecha, observaciones } = req.body;

    const resultado = await transaccion(async (db) => {
        let tipoSintoma = null;
        if (tipo) {
            const { rows } = await db.query('SELECT * FROM tipo_sintoma WHERE codigo = $1 AND activo', [tipo]);
            tipoSintoma = rows[0];
            if (!tipoSintoma) throw new HttpError(400, `Tipo de síntoma no válido: ${tipo}`);
        }
        const { rows } = await db.query(
            `INSERT INTO sintoma (embarazo_id, tipo_sintoma_id, descripcion, intensidad, fecha, observaciones)
             VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE), $6)
             RETURNING *, fn_semana_gestacion($7, fecha) AS semana_gestacion`,
            [req.embarazo.id, tipoSintoma?.id ?? null, descripcion || tipoSintoma.nombre, intensidad ?? null,
                fecha ?? null, observaciones ?? null, req.embarazo.fecha_inicio]
        );
        const sintoma = rows[0];
        const alerta = await evaluarSintoma(db, sintoma, tipoSintoma, sintoma.semana_gestacion);
        await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'CREAR', entidad: 'sintoma', entidadId: sintoma.id, detalle: { embarazo_id: req.embarazo.id, tipo, alerta: !!alerta }, ip: ipDe(req) });
        return { ...sintoma, tipo: tipoSintoma?.codigo ?? null, alerta: presentarAlerta(alerta) };
    });
    void notificarAlertasCriticas(req.embarazo, [resultado.alerta]);
    res.status(201).json(resultado);
};

const listar = async (req, res) => {
    const pag = paginacion(req.query);
    const [{ rows }, conteo] = await Promise.all([
        pool.query(
            `SELECT s.id, ts.codigo AS tipo, ts.nombre AS tipo_nombre, ts.es_signo_alarma, s.descripcion, s.intensidad,
                    s.fecha, fn_semana_gestacion($2, s.fecha) AS semana_gestacion, s.observaciones, s.registrado_en,
                    a.id AS alerta_id, a.severidad AS alerta_severidad, a.estado AS alerta_estado
               FROM sintoma s
               LEFT JOIN tipo_sintoma ts ON ts.id = s.tipo_sintoma_id
               LEFT JOIN alerta a ON a.sintoma_id = s.id
              WHERE s.embarazo_id = $1
              ORDER BY s.fecha DESC, s.id DESC
              LIMIT ${pag.limit} OFFSET ${pag.offset}`, [req.embarazo.id, req.embarazo.fecha_inicio]),
        pool.query('SELECT count(*)::int AS total FROM sintoma WHERE embarazo_id = $1', [req.embarazo.id])
    ]);
    // Un síntoma es de la gestante: solo ella lo corrige, y dentro de su ventana.
    const filas = rows.map((f) => ({
        ...f,
        editable: esEditable(req.usuario, { propietarioId: req.embarazo.gestante_usuario_id, creadoEn: f.registrado_en })
    }));
    res.status(200).json(paginado(filas, conteo.rows[0].total, pag));
};

const cargarCorregible = async (db, req) => {
    const { rows } = await db.query(
        `SELECT s.*, ts.codigo AS tipo FROM sintoma s LEFT JOIN tipo_sintoma ts ON ts.id = s.tipo_sintoma_id
          WHERE s.id = $1 AND s.embarazo_id = $2 FOR UPDATE OF s`,
        [req.params.id, req.embarazo.id]
    );
    const fila = rows[0];
    if (!fila) throw noEncontrado('Síntoma');
    exigirCorreccion(req.usuario, { propietarioId: req.embarazo.gestante_usuario_id, creadoEn: fila.registrado_en });
    return fila;
};

// Corrige un síntoma. Si cambia el tipo o la intensidad, la alerta que generó se anula y se
// evalúa de nuevo: "sangrado" mal elegido en lugar de "náuseas" no puede quedarse como urgencia.
const corregir = async (req, res) => {
    exigirActivo(req.embarazo);
    const { tipo, descripcion, intensidad, observaciones, motivo } = req.body;

    const resultado = await transaccion(async (db) => {
        const antes = await cargarCorregible(db, req);

        let tipoNuevo = null;
        if (tipo !== undefined) {
            const { rows } = await db.query('SELECT * FROM tipo_sintoma WHERE codigo = $1 AND activo', [tipo]);
            tipoNuevo = rows[0];
            if (!tipoNuevo) throw new HttpError(400, `Tipo de síntoma no válido: ${tipo}`);
        }
        const cambiaTipo = tipoNuevo && tipoNuevo.id !== antes.tipo_sintoma_id;
        const cambiaIntensidad = intensidad !== undefined && intensidad !== antes.intensidad;

        const { rows } = await db.query(
            `UPDATE sintoma
                SET tipo_sintoma_id = CASE WHEN $2::boolean THEN $3 ELSE tipo_sintoma_id END,
                    descripcion     = COALESCE($4, descripcion),
                    intensidad      = CASE WHEN $5::boolean THEN $6 ELSE intensidad END,
                    observaciones   = CASE WHEN $7::boolean THEN $8 ELSE observaciones END
              WHERE id = $1
          RETURNING *, fn_semana_gestacion($9, fecha) AS semana_gestacion`,
            [antes.id, tipoNuevo !== null, tipoNuevo?.id ?? null,
                // Si cambia el tipo y no se reescribió la descripción, la descripción sigue al tipo.
                descripcion ?? (cambiaTipo ? tipoNuevo.nombre : null),
                intensidad !== undefined, intensidad ?? null,
                observaciones !== undefined, observaciones ?? null, req.embarazo.fecha_inicio]
        );
        const nuevo = rows[0];

        let alerta = null;
        let anuladas = [];
        if (cambiaTipo || cambiaIntensidad) {
            anuladas = await anularAlertas(db, {
                sintomaIds: [antes.id], usuarioId: req.usuario.id,
                motivo: `El síntoma se corrigió${motivo ? `: ${motivo}` : ''}`
            });
            const { rows: t } = await db.query('SELECT * FROM tipo_sintoma WHERE id = $1', [nuevo.tipo_sintoma_id]);
            alerta = await evaluarSintoma(db, nuevo, t[0] ?? null, nuevo.semana_gestacion);
        }

        await registrarAuditoria(db, {
            usuarioId: req.usuario.id, accion: 'MODIFICAR', entidad: 'sintoma', entidadId: antes.id,
            detalle: {
                embarazo_id: req.embarazo.id, motivo: motivo ?? null,
                antes: { tipo: antes.tipo, descripcion: antes.descripcion, intensidad: antes.intensidad },
                despues: { tipo_sintoma_id: nuevo.tipo_sintoma_id, descripcion: nuevo.descripcion, intensidad: nuevo.intensidad },
                alertas_anuladas: anuladas.length, alerta_nueva: !!alerta
            },
            ip: ipDe(req)
        });
        return { ...nuevo, alerta: presentarAlerta(alerta), alertas_anuladas: anuladas.length };
    });
    void notificarAlertasCriticas(req.embarazo, [resultado.alerta]);
    res.status(200).json(resultado);
};

const eliminar = async (req, res) => {
    exigirActivo(req.embarazo);
    const motivo = req.body?.motivo;

    await transaccion(async (db) => {
        const fila = await cargarCorregible(db, req);
        const anuladas = await anularAlertas(db, {
            sintomaIds: [fila.id], usuarioId: req.usuario.id, motivo: `El síntoma se eliminó${motivo ? `: ${motivo}` : ''}`
        });
        await db.query('DELETE FROM sintoma WHERE id = $1', [fila.id]);
        await registrarAuditoria(db, {
            usuarioId: req.usuario.id, accion: 'DESACTIVAR', entidad: 'sintoma', entidadId: fila.id,
            detalle: {
                eliminado: true, embarazo_id: req.embarazo.id, tipo: fila.tipo, descripcion: fila.descripcion,
                intensidad: fila.intensidad, fecha: fila.fecha, motivo: motivo ?? null, alertas_anuladas: anuladas.length
            },
            ip: ipDe(req)
        });
    });
    res.status(200).json({ mensaje: 'Síntoma eliminado' });
};

module.exports = { crear, listar, corregir, eliminar };
