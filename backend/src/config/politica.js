// Versión vigente de la política de tratamiento de datos.
//
// Se guarda con cada aceptación (usuario.version_politica) para poder demostrar
// qué texto aceptó cada persona. Si el texto cambia de fondo, se sube la versión
// aquí Y en frontend/src/lib/politica.ts: el registro rechaza una aceptación
// hecha sobre una versión que ya no es la vigente.
module.exports = { VERSION_POLITICA: '1.0' };
