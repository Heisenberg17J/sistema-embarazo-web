const { pool, transaccion } = require('../../config/db');
const { HttpError, noEncontrado, paginacion, paginado } = require('../../utils/http');
const { ROL_ID } = require('../../middlewares/roles');
const { registrarAuditoria, ipDe } = require('../../services/auditoria');
const {
    hashContrasena, obtenerUsuarioCompleto, crearUsuario, actualizarParcial,
    CAMPOS_PERFIL_GESTANTE, CAMPOS_PERFIL_PROFESIONAL
} = require('../../services/usuarios');

// RF-14: listado con filtros por rol, estado y texto.
const listar = async (req, res) => {
    const { rol, activo, q } = req.query;
    const pag = paginacion(req.query);
    const filtros = [];
    const valores = [];
    if (rol) { valores.push(ROL_ID[rol]); filtros.push(`u.rol_id = $${valores.length}`); }
    if (activo !== undefined) { valores.push(activo); filtros.push(`u.activo = $${valores.length}`); }
    if (q) {
        valores.push(`%${q}%`);
        filtros.push(`(u.nombre ILIKE $${valores.length} OR u.apellido ILIKE $${valores.length} OR u.correo ILIKE $${valores.length})`);
    }
    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    const { rows } = await pool.query(
        `SELECT u.id, r.codigo AS rol, u.nombre, u.apellido, u.correo, u.activo, u.ultimo_acceso, u.creado_en,
                count(*) OVER () AS total
           FROM usuario u JOIN rol r ON r.id = u.rol_id
           ${where}
          ORDER BY u.apellido, u.nombre
          LIMIT ${pag.limit} OFFSET ${pag.offset}`,
        valores
    );
    const total = rows[0]?.total ?? 0;
    res.status(200).json(paginado(rows.map(({ total: _t, ...u }) => u), total, pag));
};

const obtener = async (req, res) => {
    const usuario = await obtenerUsuarioCompleto(pool, req.params.id);
    if (!usuario) throw noEncontrado('Usuario');
    res.status(200).json(usuario);
};

// El administrador crea cualquier rol con una contraseña temporal que el usuario debe cambiar al entrar.
const crear = async (req, res) => {
    const { rol, nombre, apellido, correo, contrasena_temporal: contrasena, perfil = {} } = req.body;
    const usuario = await transaccion(async (db) => {
        const id = await crearUsuario(db, { rol, nombre, apellido, correo, contrasena, debeCambiar: true, perfil });
        await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'CREAR', entidad: 'usuario', entidadId: id, detalle: { rol }, ip: ipDe(req) });
        return obtenerUsuarioCompleto(db, id);
    });
    res.status(201).json(usuario);
};

const actualizar = async (req, res) => {
    const { id } = req.params;
    const { perfil, ...datos } = req.body;
    const usuario = await transaccion(async (db) => {
        const actual = await obtenerUsuarioCompleto(db, id);
        if (!actual) throw noEncontrado('Usuario');
        await actualizarParcial(db, 'usuario', 'id', id, datos, ['nombre', 'apellido', 'correo']);
        if (perfil && actual.rol === 'GESTANTE') {
            await actualizarParcial(db, 'perfil_gestante', 'usuario_id', id, perfil, CAMPOS_PERFIL_GESTANTE);
        }
        if (perfil && actual.rol === 'PROFESIONAL') {
            await actualizarParcial(db, 'perfil_profesional', 'usuario_id', id, perfil, CAMPOS_PERFIL_PROFESIONAL);
        }
        await registrarAuditoria(db, {
            usuarioId: req.usuario.id, accion: 'MODIFICAR', entidad: 'usuario', entidadId: id,
            detalle: { campos: [...Object.keys(datos), ...Object.keys(perfil || {}).map((c) => `perfil.${c}`)] }, ip: ipDe(req)
        });
        return obtenerUsuarioCompleto(db, id);
    });
    res.status(200).json(usuario);
};

// Desactivar en lugar de borrar: conserva el historial clínico y la trazabilidad.
const cambiarEstado = async (req, res) => {
    const { id } = req.params;
    const { activo } = req.body;
    if (id === req.usuario.id && !activo) throw new HttpError(400, 'No puede desactivar su propia cuenta');
    const usuario = await transaccion(async (db) => {
        const { rowCount } = await db.query('UPDATE usuario SET activo = $2 WHERE id = $1', [id, activo]);
        if (!rowCount) throw noEncontrado('Usuario');
        if (!activo) await db.query('UPDATE sesion SET revocada_en = now() WHERE usuario_id = $1 AND revocada_en IS NULL', [id]);
        await registrarAuditoria(db, {
            usuarioId: req.usuario.id, accion: activo ? 'MODIFICAR' : 'DESACTIVAR', entidad: 'usuario', entidadId: id,
            detalle: { activo }, ip: ipDe(req)
        });
        return obtenerUsuarioCompleto(db, id);
    });
    res.status(200).json(usuario);
};

const restablecerContrasena = async (req, res) => {
    const { id } = req.params;
    await transaccion(async (db) => {
        const { rowCount } = await db.query(
            'UPDATE usuario SET hash_contrasena = $2, debe_cambiar_contrasena = TRUE WHERE id = $1',
            [id, await hashContrasena(req.body.contrasena_temporal)]
        );
        if (!rowCount) throw noEncontrado('Usuario');
        await db.query('UPDATE sesion SET revocada_en = now() WHERE usuario_id = $1 AND revocada_en IS NULL', [id]);
        await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'MODIFICAR', entidad: 'usuario', entidadId: id, detalle: { campo: 'contrasena', tipo: 'restablecimiento' }, ip: ipDe(req) });
    });
    res.status(200).json({ mensaje: 'Contraseña restablecida. El usuario deberá cambiarla al iniciar sesión.' });
};

module.exports = { listar, obtener, crear, actualizar, cambiarEstado, restablecerContrasena };
