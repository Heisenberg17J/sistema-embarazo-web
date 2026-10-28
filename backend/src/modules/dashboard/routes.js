const express = require('express');
const { pool } = require('../../config/db');
const { autenticar } = require('../../middlewares/auth');
const { ROLES } = require('../../middlewares/roles');
const { resumenEmbarazo } = require('../../services/embarazo');
const { AVISO } = require('../../services/alertas');
const { manejar } = require('../../utils/http');
const configuracion = require('../../services/configuracion');

const router = express.Router();

// Quién la acompaña y cómo contactarle. Solo datos de trabajo del perfil profesional: el correo
// de acceso de la persona no se comparte.
const profesionalesDe = async (usuarioId) => {
    const { rows } = await pool.query(
        `SELECT u.id, u.nombre || ' ' || u.apellido AS nombre, p.especialidad, p.institucion, p.telefono
           FROM asignacion a
           JOIN usuario u ON u.id = a.profesional_usuario_id AND u.activo
           JOIN perfil_profesional p ON p.usuario_id = u.id
          WHERE a.gestante_usuario_id = $1 AND a.activa
          ORDER BY a.creada_en, u.id`, [usuarioId]);
    return rows;
};

const panelGestante = async (usuarioId) => {
    const profesionales = await profesionalesDe(usuarioId);
    const { rows: emb } = await pool.query(
        `SELECT id FROM embarazo WHERE gestante_usuario_id = $1 AND estado = 'ACTIVO'`, [usuarioId]
    );
    if (!emb[0]) return { embarazo: null, profesionales, mensaje: 'Aún no ha registrado un embarazo activo.' };
    const embarazoId = emb[0].id;
    const embarazo = await resumenEmbarazo(pool, embarazoId);

    const [cita, alertas, mediciones, contenido] = await Promise.all([
        pool.query(
            `SELECT ci.id, ci.fecha, to_char(ci.hora, 'HH24:MI') AS hora, ci.estado, tc.nombre AS tipo_control,
                    (ci.fecha - CURRENT_DATE) AS dias_para, u.nombre || ' ' || u.apellido AS profesional
               FROM cita ci JOIN tipo_control tc ON tc.id = ci.tipo_control_id JOIN usuario u ON u.id = ci.profesional_usuario_id
              WHERE ci.embarazo_id = $1 AND ci.estado IN ('PROGRAMADA', 'REPROGRAMADA') AND ci.fecha + ci.hora >= now()
              ORDER BY ci.fecha, ci.hora LIMIT 1`, [embarazoId]),
        pool.query(
            `SELECT id, severidad, mensaje, generada_en, (severidad = 'CRITICA') AS accion_inmediata
               FROM alerta WHERE embarazo_id = $1 AND estado = 'PENDIENTE'
              ORDER BY CASE severidad WHEN 'CRITICA' THEN 1 WHEN 'ADVERTENCIA' THEN 2 ELSE 3 END, generada_en DESC
              LIMIT 5`, [embarazoId]),
        pool.query(
            `SELECT DISTINCT ON (t.codigo) t.codigo AS tipo, t.nombre, t.unidad, m.valor, m.fecha_registro
               FROM medicion m JOIN tipo_medicion t ON t.id = m.tipo_medicion_id
              WHERE m.embarazo_id = $1
              ORDER BY t.codigo, m.fecha_registro DESC`, [embarazoId]),
        pool.query(
            `SELECT c.id, c.titulo, c.categoria, (l.usuario_id IS NOT NULL) AS leido
               FROM contenido_educativo c
               LEFT JOIN contenido_lectura l ON l.contenido_id = c.id AND l.usuario_id = $2
              WHERE c.publicado AND $1 BETWEEN c.semana_desde AND c.semana_hasta
              ORDER BY leido, c.id LIMIT 3`, [embarazo.semana_actual, usuarioId])
    ]);

    // `dias_recordatorio_cita` (configuración del administrador): con tantos días o menos de
    // anticipación, la pantalla destaca la cita.
    const diasRecordatorio = await configuracion.entero('dias_recordatorio_cita');
    const proximaCita = cita.rows[0]
        ? { ...cita.rows[0], recordatorio: cita.rows[0].dias_para <= diasRecordatorio }
        : null;

    return {
        embarazo,
        profesionales,
        proxima_cita: proximaCita,
        alertas_pendientes: alertas.rows,
        ultimas_mediciones: mediciones.rows,
        contenido_semana: contenido.rows,
        aviso: AVISO
    };
};

const panelProfesional = async (usuarioId) => {
    const [resumen, criticas, hoy] = await Promise.all([
        pool.query(
            `SELECT count(*)::int AS pacientes,
                    COALESCE(sum(alertas_pendientes), 0)::int AS alertas_pendientes,
                    COALESCE(sum(alertas_criticas), 0)::int AS alertas_criticas,
                    count(*) FILTER (WHERE embarazo_id IS NOT NULL AND proxima_cita IS NULL)::int AS sin_cita_programada
               FROM v_pacientes_profesional WHERE profesional_usuario_id = $1`, [usuarioId]),
        pool.query(
            `SELECT a.id, a.embarazo_id, e.gestante_usuario_id, u.nombre || ' ' || u.apellido AS gestante,
                    a.severidad, a.mensaje, a.valor_detectado, a.generada_en
               FROM alerta a JOIN embarazo e ON e.id = a.embarazo_id JOIN usuario u ON u.id = e.gestante_usuario_id
              WHERE a.estado = 'PENDIENTE'
                AND EXISTS (SELECT 1 FROM asignacion asg WHERE asg.gestante_usuario_id = e.gestante_usuario_id
                             AND asg.profesional_usuario_id = $1 AND asg.activa)
              ORDER BY CASE a.severidad WHEN 'CRITICA' THEN 1 WHEN 'ADVERTENCIA' THEN 2 ELSE 3 END, a.generada_en DESC
              LIMIT 10`, [usuarioId]),
        pool.query(
            `SELECT ci.id, ci.embarazo_id, to_char(ci.hora, 'HH24:MI') AS hora, ci.estado, tc.nombre AS tipo_control,
                    u.nombre || ' ' || u.apellido AS gestante
               FROM cita ci JOIN tipo_control tc ON tc.id = ci.tipo_control_id
               JOIN embarazo e ON e.id = ci.embarazo_id JOIN usuario u ON u.id = e.gestante_usuario_id
              WHERE ci.profesional_usuario_id = $1 AND ci.fecha = CURRENT_DATE
              ORDER BY ci.hora`, [usuarioId])
    ]);
    return { resumen: resumen.rows[0], alertas_prioritarias: criticas.rows, citas_hoy: hoy.rows };
};

// Estadísticas generales (RF del administrador). Solo agregados: nada de datos clínicos individuales.
const panelAdministrador = async () => {
    const [usuarios, embarazos, alertas, citas, contenido] = await Promise.all([
        pool.query(`SELECT r.codigo AS rol, count(*) FILTER (WHERE u.activo)::int AS activos,
                           count(*) FILTER (WHERE NOT u.activo)::int AS inactivos
                      FROM rol r LEFT JOIN usuario u ON u.rol_id = r.id GROUP BY r.codigo ORDER BY r.codigo`),
        pool.query(`SELECT estado, count(*)::int AS total FROM embarazo GROUP BY estado`),
        pool.query(`SELECT severidad, estado, count(*)::int AS total FROM alerta GROUP BY severidad, estado ORDER BY severidad, estado`),
        pool.query(`SELECT estado, count(*)::int AS total FROM cita GROUP BY estado`),
        pool.query(`SELECT count(*)::int AS publicados,
                           (SELECT count(*)::int FROM contenido_lectura) AS lecturas
                      FROM contenido_educativo WHERE publicado`)
    ]);
    const { rows: sinAsignar } = await pool.query(
        `SELECT count(*)::int AS total FROM perfil_gestante g JOIN usuario u ON u.id = g.usuario_id
          WHERE u.activo AND NOT EXISTS (SELECT 1 FROM asignacion a WHERE a.gestante_usuario_id = g.usuario_id AND a.activa)`
    );
    return {
        usuarios_por_rol: usuarios.rows,
        gestantes_sin_profesional: sinAsignar[0].total,
        embarazos_por_estado: embarazos.rows,
        alertas: alertas.rows,
        citas_por_estado: citas.rows,
        contenido: contenido.rows[0]
    };
};

// RF-17: un panel distinto según el rol.
router.get('/', autenticar, manejar(async (req, res) => {
    const paneles = {
        [ROLES.GESTANTE]: panelGestante,
        [ROLES.PROFESIONAL]: panelProfesional,
        [ROLES.ADMINISTRADOR]: panelAdministrador
    };
    res.status(200).json({ rol: req.usuario.rol, ...(await paneles[req.usuario.rol](req.usuario.id)) });
}));

module.exports = router;
