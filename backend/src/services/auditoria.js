const { pool } = require('../config/db');

// RNF-14: registra quién hizo qué y cuándo. Recibe el cliente de la transacción si existe,
// para que la auditoría se confirme o se revierta junto con la operación.
const registrarAuditoria = async (db, { usuarioId, accion, entidad, entidadId = null, detalle = null, ip = null }) => {
    await (db || pool).query(
        `INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle, ip)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [usuarioId ?? null, accion, entidad, entidadId, detalle, ip]
    );
};

// Normaliza la IP de Express (quita el prefijo IPv4-mapped de IPv6).
const ipDe = (req) => (req.ip || '').replace(/^::ffff:/, '') || null;

module.exports = { registrarAuditoria, ipDe };
