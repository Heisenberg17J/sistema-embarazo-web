import http from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";
import { fetchConReintentos } from "../src/lib/reintentos";

/**
 * Una API gratuita que se duerme responde 502/503/504 mientras despierta. Estas pruebas levantan un
 * servidor que falla las primeras N veces y comprueban qué se reintenta y qué no.
 */

const ESPERAS = [5, 5, 5];

async function servidor(fallos: number, estado: number) {
    let peticiones = 0;
    const srv = http.createServer((req, res) => {
        peticiones++;
        req.resume();
        if (peticiones <= fallos) {
            res.writeHead(estado, { "content-type": "text/html" }).end("<html>waking up</html>");
        } else {
            res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}');
        }
    });
    await new Promise<void>((r) => srv.listen(0, r));
    return {
        url: `http://127.0.0.1:${(srv.address() as AddressInfo).port}`,
        peticiones: () => peticiones,
        cerrar: () => new Promise<void>((r) => srv.close(() => r())),
    };
}

test.describe("Reintentos cuando la API está arrancando", () => {
    test("un GET que recibe 502 dos veces acaba bien", async () => {
        const s = await servidor(2, 502);
        const r = await fetchConReintentos(s.url, { method: "GET" }, ESPERAS);
        expect(r.status).toBe(200);
        expect(s.peticiones()).toBe(3);
        await s.cerrar();
    });

    test("un POST se reintenta con 503", async () => {
        const s = await servidor(2, 503);
        const r = await fetchConReintentos(s.url, { method: "POST", body: "{}" }, ESPERAS);
        expect(r.status).toBe(200);
        expect(s.peticiones()).toBe(3);
        await s.cerrar();
    });

    test("un POST NO se reintenta con 502: la API pudo haber guardado algo", async () => {
        const s = await servidor(1, 502);
        const r = await fetchConReintentos(s.url, { method: "POST", body: "{}" }, ESPERAS);
        expect(r.status).toBe(502);
        expect(s.peticiones()).toBe(1);
        await s.cerrar();
    });

    test("tras agotar los reintentos devuelve el error, no se queda colgado", async () => {
        const s = await servidor(99, 503);
        const r = await fetchConReintentos(s.url, { method: "GET" }, ESPERAS);
        expect(r.status).toBe(503);
        expect(s.peticiones()).toBe(ESPERAS.length + 1);
        await s.cerrar();
    });

    test("un error normal de la API (400, 401, 404, 500) no se reintenta", async () => {
        for (const estado of [400, 401, 404, 500]) {
            const s = await servidor(99, estado);
            const r = await fetchConReintentos(s.url, { method: "GET" }, ESPERAS);
            expect(r.status).toBe(estado);
            expect(s.peticiones()).toBe(1);
            await s.cerrar();
        }
    });

    test("un fallo de conexión se reintenta hasta que el servidor responde", async () => {
        const s = await servidor(0, 200);
        const puerto = new URL(s.url).port;
        await s.cerrar();
        // Con el puerto cerrado, la conexión es rechazada; lo levantamos en medio de los reintentos.
        let levantado: http.Server | undefined;
        setTimeout(() => {
            levantado = http.createServer((_req, res) => res.writeHead(200).end("ok")).listen(Number(puerto));
        }, 8);
        const r = await fetchConReintentos(`http://127.0.0.1:${puerto}`, { method: "GET" }, [5, 5, 5, 5, 5, 5]);
        expect(r.status).toBe(200);
        levantado?.close();
    });
});
