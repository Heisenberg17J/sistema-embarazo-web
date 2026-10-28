const { pool } = require('../config/db');

// Tablas que solo crecen: una sesión vencida o un enlace de recuperación usado no sirven para nada
// pasado un tiempo. La auditoría NO se toca: es inmutable (trigger tg_auditoria_inmutable) y su
// plazo de conservación es una decisión legal, no técnica.
const DIAS_DE_GRACIA = 30;

// Borra sesiones vencidas o revocadas hace más de DIAS_DE_GRACIA, y los enlaces de recuperación
// vencidos o usados en el mismo plazo. Devuelve cuántas filas quitó de cada tabla.
const limpiar = async (db = pool, { dias = DIAS_DE_GRACIA } = {}) => {
    const sesiones = await db.query(
        `DELETE FROM sesion
          WHERE expira_en < now() - make_interval(days => $1)
             OR revocada_en < now() - make_interval(days => $1)`, [dias]);
    const recuperaciones = await db.query(
        `DELETE FROM recuperacion_contrasena
          WHERE expira_en < now() - make_interval(days => $1)
             OR usada_en < now() - make_interval(days => $1)`, [dias]);
    return { sesiones: sesiones.rowCount, recuperaciones: recuperaciones.rowCount };
};

module.exports = { limpiar, DIAS_DE_GRACIA };
