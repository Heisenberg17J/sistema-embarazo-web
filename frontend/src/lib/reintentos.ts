/**
 * Reintentos para cuando la API está arrancando.
 *
 * En un servicio gratuito la API se duerme tras unos minutos sin tráfico y tarda ~15 s en
 * despertar. Mientras tanto el proxy del proveedor responde 502, 503 o 504 con una página HTML,
 * o rechaza la conexión. Sin reintentos la persona veía "Ocurrió un error inesperado" al entrar.
 *
 * Solo se reintenta lo que seguro no llegó a ejecutarse:
 *  - fallo de conexión y 503 (el proxy no pudo pasar la petición): cualquier método;
 *  - 502 y 504: solo GET, porque en un POST la API pudo haber alcanzado a guardar algo.
 */

const ESPERAS_MS = [2000, 3000, 4000, 5000, 6000];

export const ESTADOS_ARRANCANDO = [502, 503, 504];

const puedeReintentarse = (metodo: string, estado: number | null) =>
    estado === null || estado === 503 || (metodo === "GET" && ESTADOS_ARRANCANDO.includes(estado));

export async function fetchConReintentos(
    url: string,
    init: RequestInit,
    esperas: readonly number[] = ESPERAS_MS,
): Promise<Response> {
    const metodo = (init.method ?? "GET").toUpperCase();
    let intento = 0;
    for (;;) {
        let respuesta: Response | null = null;
        try {
            respuesta = await fetch(url, init);
        } catch (error) {
            if (intento >= esperas.length || !puedeReintentarse(metodo, null)) throw error;
        }
        if (respuesta && !(ESTADOS_ARRANCANDO.includes(respuesta.status) && puedeReintentarse(metodo, respuesta.status))) {
            return respuesta;
        }
        if (respuesta && intento >= esperas.length) return respuesta;
        await new Promise((r) => setTimeout(r, esperas[intento]));
        intento++;
    }
}
