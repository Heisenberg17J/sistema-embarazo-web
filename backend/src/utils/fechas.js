const env = require('../config/env');

// Las fechas de negocio (la semana de gestación, "citas de hoy", fecha de un
// síntoma) son fechas de Colombia, no del servidor. Se calculan con la zona
// explícita en lugar de confiar en la del proceso.
const formato = new Intl.DateTimeFormat('en-CA', {
    timeZone: env.zonaHoraria, year: 'numeric', month: '2-digit', day: '2-digit'
});

// "AAAA-MM-DD" de hoy en la zona de la aplicación.
const hoy = () => formato.format(new Date());

const aDiaUtc = (fechaIso) => {
    const [a, m, d] = fechaIso.split('-').map(Number);
    return Date.UTC(a, m - 1, d);
};

// Días de calendario entre dos fechas "AAAA-MM-DD" (b - a). No depende de la
// zona del proceso ni de cambios de hora.
const diasEntre = (a, b) => Math.round((aDiaUtc(b) - aDiaUtc(a)) / 86400000);

module.exports = { hoy, diasEntre };
