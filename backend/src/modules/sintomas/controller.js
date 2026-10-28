const { pool, transaccion } = require('../../config/db');
const { HttpError, paginacion, paginado } = require('../../utils/http');
const { exigirActivo } = require('../../middlewares/acceso');
const { registrarAuditoria, ipDe } = require('../../services/auditoria');
const { evaluarSintoma, presentarAlerta } = require('../../services/alertas');

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
    res.status(200).json(paginado(rows, conteo.rows[0].total, pag));
};

module.exports = { crear, listar };
