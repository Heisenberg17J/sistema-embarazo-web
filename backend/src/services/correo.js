const env = require('../config/env');
const registro = require('./registro');

// Correo transaccional. Hoy hay un solo proveedor (Resend, por su API HTTP: no
// hace falta ninguna dependencia), pero el resto del backend solo conoce
// `enviarCorreo`, así que cambiarlo es tocar este archivo.
//
// Contrato importante: enviarCorreo NUNCA lanza ni bloquea a quien lo llama. Un
// proveedor caído no puede impedir que una gestante registre un dato o que se
// guarde una alerta. El error se registra y listo.

// En pruebas se guarda lo que se habría enviado, para poder comprobarlo.
const bandeja = [];

const enviarCorreo = ({ para, asunto, texto, html }) => {
    const mensaje = { para, asunto, texto, html: html ?? null };

    if (env.entorno === 'test') {
        bandeja.push(mensaje);
        return Promise.resolve({ enviado: false, motivo: 'prueba' });
    }

    if (!env.correo.apiKey) {
        // Sin proveedor configurado: en desarrollo sirve ver el mensaje (con su enlace).
        if (env.entorno === 'production') {
            registro.error('correo sin enviar: falta RESEND_API_KEY', { asunto });
        } else {
            console.log(`\n[correo] (no se envía, falta RESEND_API_KEY)\nPara: ${para}\nAsunto: ${asunto}\n${texto}\n`);
        }
        return Promise.resolve({ enviado: false, motivo: 'sin-proveedor' });
    }

    return fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.correo.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.correo.remitente, to: [para], subject: asunto, text: texto, ...(html && { html }) }),
        signal: AbortSignal.timeout(10000)
    })
        .then(async (r) => {
            if (!r.ok) {
                registro.error('el proveedor de correo rechazó el envío', { asunto, estado: r.status });
                return { enviado: false, motivo: `http-${r.status}` };
            }
            return { enviado: true };
        })
        .catch((error) => {
            registro.error('no se pudo enviar un correo', { asunto, error: error.message });
            return { enviado: false, motivo: 'red' };
        });
};

module.exports = { enviarCorreo, bandeja };
