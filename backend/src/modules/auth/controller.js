const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const { pool, transaccion } = require('../../config/db');
const { HttpError } = require('../../utils/http');
const { registrarAuditoria, ipDe } = require('../../services/auditoria');
const {
    hashContrasena, verificarContrasena, obtenerUsuarioCompleto, crearUsuario, actualizarParcial
} = require('../../services/usuarios');
const { exportarDatos } = require('../../services/datos-personales');
const { solicitarRecuperacion, consumirToken, avisarCambio } = require('../../services/recuperacion');

const sha256 = (valor) => crypto.createHash('sha256').update(valor).digest('hex');

// Emite un JWT de acceso corto y un refresh token opaco cuyo hash se guarda en sesion.
const emitirSesion = async (db, usuario, req) => {
    const accessToken = jwt.sign({ sub: usuario.id, rol: usuario.rol }, env.jwt.secreto, { expiresIn: env.jwt.expiraAcceso });
    const refreshToken = crypto.randomBytes(48).toString('hex');
    await db.query(
        `INSERT INTO sesion (usuario_id, token_hash, ip, user_agent, expira_en)
         VALUES ($1, $2, $3, $4, now() + make_interval(days => $5))`,
        [usuario.id, sha256(refreshToken), ipDe(req), (req.get('user-agent') || '').slice(0, 255), env.jwt.diasRefresh]
    );
    return { access_token: accessToken, refresh_token: refreshToken, tipo: 'Bearer', expira_en: env.jwt.expiraAcceso };
};

// RF-01: el registro público solo crea gestantes; profesionales y administradores los crea el administrador.
const registro = async (req, res) => {
    const { nombre, apellido, correo, contrasena, acepto_politica: _acepto, version_politica: versionPolitica, ...perfil } = req.body;
    const resultado = await transaccion(async (db) => {
        const id = await crearUsuario(db, { rol: 'GESTANTE', nombre, apellido, correo, contrasena, perfil, versionPolitica });
        await registrarAuditoria(db, { usuarioId: id, accion: 'CREAR', entidad: 'usuario', entidadId: id, detalle: { origen: 'registro', version_politica: versionPolitica }, ip: ipDe(req) });
        const usuario = await obtenerUsuarioCompleto(db, id);
        return { usuario, ...(await emitirSesion(db, usuario, req)) };
    });
    res.status(201).json(resultado);
};

// RF-02. El mismo mensaje para correo inexistente o contraseña errada evita enumerar cuentas.
const login = async (req, res) => {
    const { correo, contrasena } = req.body;
    const { rows } = await pool.query(
        `SELECT u.id, r.codigo AS rol, u.hash_contrasena, u.activo
           FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE lower(u.correo) = $1`,
        [correo]
    );
    const candidato = rows[0];
    const valida = candidato ? await verificarContrasena(contrasena, candidato.hash_contrasena) : false;

    if (!valida || !candidato.activo) {
        await registrarAuditoria(null, {
            usuarioId: candidato?.id, accion: 'LOGIN_FALLIDO', entidad: 'usuario', entidadId: candidato?.id,
            detalle: { correo, motivo: !valida ? 'credenciales' : 'inactivo' }, ip: ipDe(req)
        });
        throw new HttpError(401, valida ? 'La cuenta está desactivada. Contacta al administrador.' : 'Correo o contraseña incorrectos');
    }

    const resultado = await transaccion(async (db) => {
        await db.query('UPDATE usuario SET ultimo_acceso = now() WHERE id = $1', [candidato.id]);
        await registrarAuditoria(db, { usuarioId: candidato.id, accion: 'LOGIN', entidad: 'usuario', entidadId: candidato.id, ip: ipDe(req) });
        const usuario = await obtenerUsuarioCompleto(db, candidato.id);
        return { usuario, ...(await emitirSesion(db, usuario, req)) };
    });
    res.status(200).json(resultado);
};

// Rota el refresh token: el usado queda revocado y se entrega uno nuevo.
const refrescar = async (req, res) => {
    const resultado = await transaccion(async (db) => {
        const { rows } = await db.query(
            `UPDATE sesion s SET revocada_en = now()
               FROM usuario u
              WHERE s.token_hash = $1 AND s.revocada_en IS NULL AND s.expira_en > now()
                AND u.id = s.usuario_id AND u.activo
          RETURNING s.usuario_id`,
            [sha256(req.body.refresh_token)]
        );
        if (!rows[0]) throw new HttpError(401, 'Sesión inválida o expirada');
        const usuario = await obtenerUsuarioCompleto(db, rows[0].usuario_id);
        return emitirSesion(db, usuario, req);
    });
    res.status(200).json(resultado);
};

const logout = async (req, res) => {
    await pool.query(
        'UPDATE sesion SET revocada_en = now() WHERE token_hash = $1 AND usuario_id = $2 AND revocada_en IS NULL',
        [sha256(req.body.refresh_token), req.usuario.id]
    );
    await registrarAuditoria(null, { usuarioId: req.usuario.id, accion: 'LOGOUT', entidad: 'usuario', entidadId: req.usuario.id, ip: ipDe(req) });
    res.status(200).json({ mensaje: 'Sesión cerrada' });
};

const yo = async (req, res) => {
    res.status(200).json(await obtenerUsuarioCompleto(pool, req.usuario.id));
};

// Cambio de contraseña propio; revoca las demás sesiones abiertas.
const cambiarContrasena = async (req, res) => {
    const { contrasena_actual: actual, contrasena_nueva: nueva } = req.body;
    const { rows } = await pool.query('SELECT hash_contrasena FROM usuario WHERE id = $1', [req.usuario.id]);
    if (!(await verificarContrasena(actual, rows[0].hash_contrasena))) {
        throw new HttpError(400, 'La contraseña actual no es correcta');
    }
    if (actual === nueva) throw new HttpError(400, 'La nueva contraseña debe ser distinta de la actual');

    await transaccion(async (db) => {
        await db.query(
            'UPDATE usuario SET hash_contrasena = $2, debe_cambiar_contrasena = FALSE WHERE id = $1',
            [req.usuario.id, await hashContrasena(nueva)]
        );
        await db.query('UPDATE sesion SET revocada_en = now() WHERE usuario_id = $1 AND revocada_en IS NULL', [req.usuario.id]);
        await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'MODIFICAR', entidad: 'usuario', entidadId: req.usuario.id, detalle: { campo: 'contrasena' }, ip: ipDe(req) });
    });
    res.status(200).json({ mensaje: 'Contraseña actualizada. Inicie sesión nuevamente.' });
};

// La gestante actualiza sus datos de contacto; el documento y la fecha de nacimiento solo los corrige el administrador.
const actualizarPerfil = async (req, res) => {
    const { nombre, apellido, ...perfil } = req.body;
    const usuario = await transaccion(async (db) => {
        await actualizarParcial(db, 'usuario', 'id', req.usuario.id, { nombre, apellido }, ['nombre', 'apellido']);
        const tabla = { GESTANTE: 'perfil_gestante', PROFESIONAL: 'perfil_profesional' }[req.usuario.rol];
        if (tabla) {
            await actualizarParcial(db, tabla, 'usuario_id', req.usuario.id, perfil,
                ['telefono', 'direccion', 'eps', 'grupo_sanguineo', 'contacto_emergencia_nombre', 'contacto_emergencia_telefono', 'institucion']);
        }
        await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'MODIFICAR', entidad: 'usuario', entidadId: req.usuario.id, detalle: { campos: Object.keys(req.body) }, ip: ipDe(req) });
        return obtenerUsuarioCompleto(db, req.usuario.id);
    });
    res.status(200).json(usuario);
};

// Derecho de consulta: todo lo que el sistema guarda de la persona, como archivo descargable.
const misDatos = async (req, res) => {
    const datos = await exportarDatos(pool, req.usuario.id);
    await registrarAuditoria(null, {
        usuarioId: req.usuario.id, accion: 'CONSULTAR_SENSIBLE', entidad: 'usuario', entidadId: req.usuario.id,
        detalle: { recurso: 'mis-datos' }, ip: ipDe(req)
    });
    res.set('Content-Disposition', 'attachment; filename="mis-datos.json"');
    res.status(200).json(datos);
};

// Derecho de supresión: la gestante la solicita y el administrador la atiende.
const estadoSupresion = async (req, res) => {
    const { rows } = await pool.query(
        `SELECT id, estado, motivo, solicitada_en, atendida_en, respuesta
           FROM solicitud_supresion WHERE usuario_id = $1 ORDER BY solicitada_en DESC LIMIT 1`, [req.usuario.id]
    );
    res.status(200).json(rows[0] || null);
};

const solicitarSupresion = async (req, res) => {
    const solicitud = await transaccion(async (db) => {
        const { rows } = await db.query(
            'INSERT INTO solicitud_supresion (usuario_id, motivo) VALUES ($1, $2) RETURNING id, estado, motivo, solicitada_en',
            [req.usuario.id, req.body.motivo ?? null]
        );
        await registrarAuditoria(db, {
            usuarioId: req.usuario.id, accion: 'CREAR', entidad: 'solicitud_supresion', entidadId: rows[0].id, ip: ipDe(req)
        });
        return rows[0];
    });
    res.status(201).json(solicitud);
};

// Recuperación de contraseña. La respuesta de /recuperar es siempre la misma, exista o no
// el correo, para que el formulario no sirva para averiguar quién tiene cuenta.
const MENSAJE_RECUPERACION =
    'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña. Revisa también la carpeta de spam.';

const recuperar = async (req, res) => {
    const resultado = await transaccion((db) => solicitarRecuperacion(db, { correo: req.body.correo, ip: ipDe(req) }));
    if (resultado.creado) {
        await registrarAuditoria(null, {
            usuarioId: resultado.usuarioId, accion: 'MODIFICAR', entidad: 'usuario', entidadId: resultado.usuarioId,
            detalle: { campo: 'contrasena', tipo: 'recuperacion_solicitada' }, ip: ipDe(req)
        });
    }
    res.status(200).json({ mensaje: MENSAJE_RECUPERACION });
};

const restablecer = async (req, res) => {
    const usuario = await transaccion(async (db) => {
        const u = await consumirToken(db, req.body.token);
        if (!u) throw new HttpError(400, 'El enlace no es válido o ya venció. Solicita uno nuevo.');

        await db.query(
            'UPDATE usuario SET hash_contrasena = $2, debe_cambiar_contrasena = FALSE WHERE id = $1',
            [u.id, await hashContrasena(req.body.contrasena_nueva)]
        );
        // Quien tuviera una sesión abierta (por ejemplo, un tercero que ya sabía la
        // contraseña anterior) pierde el acceso; los demás enlaces pendientes también.
        await db.query('UPDATE sesion SET revocada_en = now() WHERE usuario_id = $1 AND revocada_en IS NULL', [u.id]);
        await db.query('UPDATE recuperacion_contrasena SET usada_en = now() WHERE usuario_id = $1 AND usada_en IS NULL', [u.id]);
        await registrarAuditoria(db, {
            usuarioId: u.id, accion: 'MODIFICAR', entidad: 'usuario', entidadId: u.id,
            detalle: { campo: 'contrasena', tipo: 'recuperacion' }, ip: ipDe(req)
        });
        return u;
    });
    void avisarCambio(usuario);
    res.status(200).json({ mensaje: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
};

module.exports = {
    registro, login, refrescar, logout, yo, cambiarContrasena, actualizarPerfil,
    misDatos, estadoSupresion, solicitarSupresion, recuperar, restablecer
};
