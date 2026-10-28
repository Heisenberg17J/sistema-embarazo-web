const crypto = require('crypto');
const { hashContrasena, obtenerUsuarioCompleto } = require('./usuarios');
const { hoy } = require('../utils/fechas');

// ---------------------------------------------------------------------------
// Derecho de consulta (Ley 1581): todo lo que el sistema guarda de una persona.
// ---------------------------------------------------------------------------

const porEmbarazo = async (db, tabla, ids, columnas = 't.*', joins = '', orden = 't.id') => {
    if (!ids.length) return [];
    const { rows } = await db.query(
        `SELECT ${columnas} FROM ${tabla} t ${joins} WHERE t.embarazo_id = ANY($1) ORDER BY ${orden}`, [ids]
    );
    return rows;
};

const exportarDatos = async (db, usuarioId) => {
    const usuario = await obtenerUsuarioCompleto(db, usuarioId);

    const salida = {
        generado_en: new Date().toISOString(),
        fecha: hoy(),
        aviso: 'Copia de los datos personales que este sistema conserva sobre usted.',
        usuario
    };

    if (usuario.rol === 'GESTANTE') {
        const { rows: embarazos } = await db.query(
            'SELECT * FROM embarazo WHERE gestante_usuario_id = $1 ORDER BY fecha_inicio', [usuarioId]
        );
        const ids = embarazos.map((e) => e.id);

        salida.embarazos = embarazos;
        salida.controles = await porEmbarazo(db, 'control', ids);
        salida.mediciones = await porEmbarazo(
            db, 'medicion', ids, 't.*, tm.codigo AS tipo, tm.unidad', 'JOIN tipo_medicion tm ON tm.id = t.tipo_medicion_id', 't.fecha_registro'
        );
        salida.sintomas = await porEmbarazo(
            db, 'sintoma', ids, 't.*, ts.codigo AS tipo', 'LEFT JOIN tipo_sintoma ts ON ts.id = t.tipo_sintoma_id', 't.fecha'
        );
        salida.examenes = await porEmbarazo(
            db, 'examen', ids, 't.*, te.codigo AS tipo', 'JOIN tipo_examen te ON te.id = t.tipo_examen_id', 't.fecha'
        );
        salida.citas = await porEmbarazo(db, 'cita', ids, 't.*', '', 't.fecha, t.hora');
        salida.alertas = await porEmbarazo(db, 'alerta', ids, 't.*', '', 't.generada_en');

        const { rows: asignaciones } = await db.query(
            'SELECT profesional_usuario_id, fecha_inicio, fecha_fin, activa FROM asignacion WHERE gestante_usuario_id = $1', [usuarioId]
        );
        salida.profesionales_asignados = asignaciones;
    }

    // Nunca token_hash: es una credencial, no un dato de la persona.
    salida.sesiones = (await db.query(
        'SELECT emitida_en, expira_en, revocada_en, ip, user_agent FROM sesion WHERE usuario_id = $1 ORDER BY emitida_en DESC', [usuarioId]
    )).rows;
    salida.actividad = (await db.query(
        'SELECT accion, entidad, entidad_id, detalle, ip, ocurrido_en FROM auditoria WHERE usuario_id = $1 ORDER BY ocurrido_en', [usuarioId]
    )).rows;
    salida.contenido_leido = (await db.query(
        'SELECT contenido_id, leido_en FROM contenido_lectura WHERE usuario_id = $1 ORDER BY leido_en', [usuarioId]
    )).rows;
    salida.solicitudes_supresion = (await db.query(
        'SELECT estado, motivo, solicitada_en, atendida_en, respuesta FROM solicitud_supresion WHERE usuario_id = $1 ORDER BY solicitada_en', [usuarioId]
    )).rows;

    return salida;
};

// ---------------------------------------------------------------------------
// Derecho de supresión.
//
// La historia clínica no se puede borrar sin más: hay obligación legal de
// conservarla. Lo que se destruye es lo que IDENTIFICA a la persona; los
// registros clínicos quedan, sin nombre. Los textos libres que la persona o su
// profesional escribieron en observaciones no se pueden depurar de forma
// automática: es una limitación que la política debe declarar.
// ---------------------------------------------------------------------------

const anonimizarGestante = async (db, usuarioId) => {
    const { rows } = await db.query(
        `SELECT u.id, u.anonimizado_en, r.codigo AS rol FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE u.id = $1 FOR UPDATE OF u`,
        [usuarioId]
    );
    const usuario = rows[0];
    if (!usuario) return { ok: false, motivo: 'La cuenta no existe' };
    if (usuario.rol !== 'GESTANTE') return { ok: false, motivo: 'Solo se anonimizan cuentas de gestantes' };
    if (usuario.anonimizado_en) return { ok: false, motivo: 'La cuenta ya fue anonimizada' };

    // La contraseña pasa a un valor aleatorio que nadie conoce: la cuenta no vuelve a abrirse.
    const hashInutil = await hashContrasena(crypto.randomBytes(32).toString('hex'));

    await db.query(
        `UPDATE usuario
            SET nombre = 'Persona', apellido = 'Anonimizada',
                correo = $2, hash_contrasena = $3,
                activo = FALSE, debe_cambiar_contrasena = FALSE, anonimizado_en = now()
          WHERE id = $1`,
        [usuarioId, `anonimo-${usuarioId}@anonimo.invalid`, hashInutil]
    );

    // De la fecha de nacimiento solo queda el año. grupo_sanguineo es un dato
    // clínico y se conserva.
    await db.query(
        `UPDATE perfil_gestante
            SET numero_documento = $2, telefono = NULL, direccion = NULL, eps = NULL,
                contacto_emergencia_nombre = NULL, contacto_emergencia_telefono = NULL,
                fecha_nacimiento = GREATEST(date_trunc('year', fecha_nacimiento)::date, DATE '1940-01-02')
          WHERE usuario_id = $1`,
        [usuarioId, `ANON-${usuarioId}`]
    );

    // Sesiones (con IP y navegador) y enlaces de recuperación pendientes.
    await db.query('DELETE FROM sesion WHERE usuario_id = $1', [usuarioId]);
    await db.query('DELETE FROM recuperacion_contrasena WHERE usuario_id = $1', [usuarioId]);
    await db.query(
        'UPDATE asignacion SET activa = FALSE, fecha_fin = CURRENT_DATE WHERE gestante_usuario_id = $1 AND activa', [usuarioId]
    );
    return { ok: true };
};

module.exports = { exportarDatos, anonimizarGestante };
