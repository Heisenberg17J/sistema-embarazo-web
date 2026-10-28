const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { ROL_ID } = require('../middlewares/roles');

const hashContrasena = (contrasena) => bcrypt.hash(contrasena, env.bcryptCosto);
const verificarContrasena = (contrasena, hash) => bcrypt.compare(contrasena, hash);

const COLUMNAS_USUARIO = `u.id, r.codigo AS rol, u.nombre, u.apellido, u.correo, u.activo,
    u.debe_cambiar_contrasena, u.ultimo_acceso, u.creado_en, u.actualizado_en,
    u.acepto_politica_en, u.version_politica`;

const CAMPOS_PERFIL_GESTANTE = ['tipo_documento', 'numero_documento', 'fecha_nacimiento', 'telefono', 'direccion',
    'eps', 'grupo_sanguineo', 'contacto_emergencia_nombre', 'contacto_emergencia_telefono'];
const CAMPOS_PERFIL_PROFESIONAL = ['registro_profesional', 'especialidad', 'institucion', 'telefono'];

// Usuario + perfil según su rol. Nunca incluye el hash de la contraseña (RNF-01).
const obtenerUsuarioCompleto = async (db, id) => {
    const { rows } = await db.query(
        `SELECT ${COLUMNAS_USUARIO} FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE u.id = $1`, [id]
    );
    const usuario = rows[0];
    if (!usuario) return null;
    const tabla = { GESTANTE: 'perfil_gestante', PROFESIONAL: 'perfil_profesional' }[usuario.rol];
    if (tabla) {
        const perfil = await db.query(`SELECT * FROM ${tabla} WHERE usuario_id = $1`, [id]);
        if (perfil.rows[0]) {
            const { usuario_id: _u, rol_id: _r, ...datos } = perfil.rows[0];
            usuario.perfil = datos;
        } else {
            usuario.perfil = null;
        }
    }
    return usuario;
};

// Crea usuario y, si aplica, su perfil. Debe llamarse dentro de una transacción.
// `versionPolitica`: versión de la política que la persona aceptó al registrarse (solo gestantes).
const crearUsuario = async (db, { rol, nombre, apellido, correo, contrasena, debeCambiar = false, perfil, versionPolitica = null }) => {
    const hash = await hashContrasena(contrasena);
    const { rows } = await db.query(
        `INSERT INTO usuario (rol_id, nombre, apellido, correo, hash_contrasena, debe_cambiar_contrasena,
                              acepto_politica_en, version_politica)
         VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $7::text IS NULL THEN NULL ELSE now() END, $7)
         RETURNING id`,
        [ROL_ID[rol], nombre, apellido, correo, hash, debeCambiar, versionPolitica]
    );
    const id = rows[0].id;
    if (rol === 'GESTANTE') await insertarPerfil(db, 'perfil_gestante', id, perfil, CAMPOS_PERFIL_GESTANTE);
    if (rol === 'PROFESIONAL') await insertarPerfil(db, 'perfil_profesional', id, perfil, CAMPOS_PERFIL_PROFESIONAL);
    return id;
};

const insertarPerfil = async (db, tabla, usuarioId, perfil, permitidos) => {
    const campos = permitidos.filter((c) => perfil[c] !== undefined);
    const valores = campos.map((c) => perfil[c]);
    const marcadores = campos.map((_, i) => `$${i + 2}`);
    await db.query(
        `INSERT INTO ${tabla} (usuario_id${campos.map((c) => `, ${c}`).join('')})
         VALUES ($1${marcadores.map((m) => `, ${m}`).join('')})`,
        [usuarioId, ...valores]
    );
};

// UPDATE parcial: solo toca las columnas presentes en datos (PATCH).
const actualizarParcial = async (db, tabla, columnaId, id, datos, permitidos) => {
    const campos = permitidos.filter((c) => datos[c] !== undefined);
    if (!campos.length) return 0;
    const sets = campos.map((c, i) => `${c} = $${i + 2}`).join(', ');
    const { rowCount } = await db.query(
        `UPDATE ${tabla} SET ${sets} WHERE ${columnaId} = $1`, [id, ...campos.map((c) => datos[c])]
    );
    return rowCount;
};

module.exports = {
    hashContrasena, verificarContrasena, obtenerUsuarioCompleto, crearUsuario, actualizarParcial,
    CAMPOS_PERFIL_GESTANTE, CAMPOS_PERFIL_PROFESIONAL
};
