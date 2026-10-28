const express = require('express');
const { pool, transaccion } = require('../../config/db');
const { autenticar } = require('../../middlewares/auth');
const { permitir, ROLES } = require('../../middlewares/roles');
const { validar } = require('../../middlewares/validar');
const { registrarAuditoria, ipDe } = require('../../services/auditoria');
const { actualizarParcial } = require('../../services/usuarios');
const { manejar, noEncontrado, HttpError } = require('../../utils/http');
const { z, idParam, texto, textoOpcional, booleano } = require('../../utils/esquemas');

// RNF-12: los catálogos se amplían desde la administración, sin tocar código.
// No se borran (tienen histórico asociado); se desactivan con activo=false.
const codigo = z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,30}$/, 'Código: mayúsculas, números y guion bajo');
const severidad = z.enum(['INFORMATIVA', 'ADVERTENCIA', 'CRITICA']);
const semana = z.number().int().min(0).max(45);

const CATALOGOS = {
    'tipos-control': {
        tabla: 'tipo_control',
        esquema: z.object({ codigo, nombre: texto(80), duracion_min: z.number().int().min(5).max(240).optional(), activo: z.boolean().optional() })
    },
    'tipos-examen': {
        tabla: 'tipo_examen',
        esquema: z.object({ codigo, nombre: texto(100), descripcion: textoOpcional(2000), activo: z.boolean().optional() })
    },
    'tipos-sintoma': {
        tabla: 'tipo_sintoma',
        esquema: z.object({
            codigo, nombre: texto(80), es_signo_alarma: z.boolean().optional(), severidad: severidad.optional().nullable(),
            mensaje_alarma: textoOpcional(255), alarma_hasta_semana: semana.optional().nullable(), activo: z.boolean().optional()
        })
    },
    'tipos-medicion': {
        tabla: 'tipo_medicion',
        esquema: z.object({
            codigo, nombre: texto(80), unidad: texto(15), valor_min: z.number(), valor_max: z.number(),
            decimales: z.number().int().min(0).max(3).optional(), registrable_por_gestante: z.boolean().optional(), activo: z.boolean().optional()
        })
    }
};

const router = express.Router();
router.use(autenticar);
const soloAdmin = permitir(ROLES.ADMINISTRADOR);
const todosQuery = z.object({ todos: booleano.optional() });

for (const [ruta, { tabla, esquema }] of Object.entries(CATALOGOS)) {
    const campos = Object.keys(esquema.shape);

    router.get(`/${ruta}`, validar({ query: todosQuery }), manejar(async (req, res) => {
        const todos = req.query.todos && req.usuario.rol === ROLES.ADMINISTRADOR;
        const { rows } = await pool.query(`SELECT * FROM ${tabla} ${todos ? '' : 'WHERE activo'} ORDER BY nombre`);
        res.status(200).json(rows);
    }));

    router.post(`/${ruta}`, soloAdmin, validar({ body: esquema }), manejar(async (req, res) => {
        const presentes = campos.filter((c) => req.body[c] !== undefined);
        const fila = await transaccion(async (db) => {
            const { rows } = await db.query(
                `INSERT INTO ${tabla} (${presentes.join(', ')}) VALUES (${presentes.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
                presentes.map((c) => req.body[c])
            );
            await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'CREAR', entidad: tabla, entidadId: rows[0].id, ip: ipDe(req) });
            return rows[0];
        });
        res.status(201).json(fila);
    }));

    router.patch(`/${ruta}/:id`, soloAdmin, validar({ params: idParam(), body: esquema.partial() }), manejar(async (req, res) => {
        const fila = await transaccion(async (db) => {
            const cambios = await actualizarParcial(db, tabla, 'id', req.params.id, req.body, campos);
            const { rows } = await db.query(`SELECT * FROM ${tabla} WHERE id = $1`, [req.params.id]);
            if (!rows[0]) throw noEncontrado('Registro');
            if (cambios) await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'MODIFICAR', entidad: tabla, entidadId: req.params.id, detalle: req.body, ip: ipDe(req) });
            return rows[0];
        });
        res.status(200).json(fila);
    }));
}

// --- Reglas de alerta (RF-11) ----------------------------------------------------------

const esquemaRegla = z.object({
    tipo_medicion: codigo,
    codigo: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,40}$/, 'Código: mayúsculas, números y guion bajo'),
    operador: z.enum(['MENOR', 'MENOR_IGUAL', 'MAYOR', 'MAYOR_IGUAL', 'FUERA_DE_RANGO']),
    valor_referencia: z.number().optional().nullable(),
    valor_min: z.number().optional().nullable(),
    valor_max: z.number().optional().nullable(),
    semana_desde: semana.optional(),
    semana_hasta: semana.optional(),
    severidad: severidad.optional(),
    mensaje: texto(255),
    activa: z.boolean().optional()
});
const CAMPOS_REGLA = Object.keys(esquemaRegla.shape).filter((c) => c !== 'tipo_medicion');

const SELECT_REGLA = `SELECT r.*, t.codigo AS tipo_medicion, t.unidad FROM regla_alerta r
                      JOIN tipo_medicion t ON t.id = r.tipo_medicion_id`;

const idTipoMedicion = async (db, cod) => {
    const { rows } = await db.query('SELECT id FROM tipo_medicion WHERE codigo = $1', [cod]);
    if (!rows[0]) throw new HttpError(400, `Tipo de medición no válido: ${cod}`);
    return rows[0].id;
};

router.get('/reglas-alerta', permitir(ROLES.ADMINISTRADOR, ROLES.PROFESIONAL), manejar(async (req, res) => {
    const { rows } = await pool.query(`${SELECT_REGLA} ORDER BY t.codigo, r.severidad DESC`);
    res.status(200).json(rows);
}));

router.post('/reglas-alerta', soloAdmin, validar({ body: esquemaRegla }), manejar(async (req, res) => {
    const regla = await transaccion(async (db) => {
        const tipoId = await idTipoMedicion(db, req.body.tipo_medicion);
        const presentes = CAMPOS_REGLA.filter((c) => req.body[c] !== undefined);
        const { rows } = await db.query(
            `INSERT INTO regla_alerta (tipo_medicion_id, creada_por, ${presentes.join(', ')})
             VALUES ($1, $2, ${presentes.map((_, i) => `$${i + 3}`).join(', ')}) RETURNING id`,
            [tipoId, req.usuario.id, ...presentes.map((c) => req.body[c])]
        );
        await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'CREAR', entidad: 'regla_alerta', entidadId: rows[0].id, detalle: req.body, ip: ipDe(req) });
        return (await db.query(`${SELECT_REGLA} WHERE r.id = $1`, [rows[0].id])).rows[0];
    });
    res.status(201).json(regla);
}));

router.patch('/reglas-alerta/:id', soloAdmin, validar({ params: idParam(), body: esquemaRegla.partial() }), manejar(async (req, res) => {
    const regla = await transaccion(async (db) => {
        const datos = { ...req.body };
        if (datos.tipo_medicion) datos.tipo_medicion_id = await idTipoMedicion(db, datos.tipo_medicion);
        await actualizarParcial(db, 'regla_alerta', 'id', req.params.id, datos, [...CAMPOS_REGLA, 'tipo_medicion_id']);
        const { rows } = await db.query(`${SELECT_REGLA} WHERE r.id = $1`, [req.params.id]);
        if (!rows[0]) throw noEncontrado('Regla');
        await registrarAuditoria(db, { usuarioId: req.usuario.id, accion: 'MODIFICAR', entidad: 'regla_alerta', entidadId: req.params.id, detalle: req.body, ip: ipDe(req) });
        return rows[0];
    });
    res.status(200).json(regla);
}));

module.exports = router;
