import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

/**
 * Deja la base en su estado inicial.
 *
 * OJO: borra y recrea el esquema que use el backend. Nunca apuntes
 * backend/.env a una base con información real para correr las pruebas.
 */
export function reiniciarBase() {
    execFileSync("npm", ["run", "db:reset"], {
        cwd: path.join(process.cwd(), "..", "backend"),
        stdio: "ignore",
        env: { ...process.env, NODE_ENV: "development" },
    });
}

/**
 * Crea un enlace de recuperación de contraseña y devuelve su token.
 *
 * El token real solo viaja por correo y en la base solo queda su hash, así que
 * la prueba lo genera ella misma e inserta el hash, igual que lo haría el backend.
 */
export function crearTokenDeRecuperacion(correo: string): string {
    const script = `
        const crypto = require('crypto');
        const { pool } = require('./src/config/db');
        (async () => {
            const token = crypto.randomBytes(32).toString('hex');
            const hash = crypto.createHash('sha256').update(token).digest('hex');
            const r = await pool.query(
                "INSERT INTO recuperacion_contrasena (usuario_id, token_hash, expira_en) " +
                "SELECT id, $1, now() + interval '1 hour' FROM usuario WHERE lower(correo) = $2",
                [hash, process.argv[1]]
            );
            await pool.end();
            if (!r.rowCount) { process.stderr.write('no existe ' + process.argv[1]); process.exit(1); }
            process.stdout.write(token);
        })();`;
    return execFileSync(process.execPath, ["-e", script, correo.toLowerCase()], {
        cwd: path.join(process.cwd(), "..", "backend"),
        encoding: "utf8",
    });
}

/** Credenciales de `db/seeds.sql`. */
export const USUARIOS = {
    gestante: { correo: "maria.gomez@correo.co", contrasena: "Gest*2026" },
    gestante2: { correo: "diana.cruz@correo.co", contrasena: "Gest*2026" },
    profesional: { correo: "cmejia@seguimiento.co", contrasena: "Prof*2026" },
    profesional2: { correo: "aduarte@seguimiento.co", contrasena: "Prof*2026" },
    admin: { correo: "admin@seguimiento.co", contrasena: "Admin*2026" },
} as const;

export async function entrar(
    page: Page,
    usuario: { correo: string; contrasena: string },
) {
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(usuario.correo);
    await page.getByLabel(/^Contraseña/).fill(usuario.contrasena);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).not.toHaveURL(/\/login/);
}

/** Cierra la sesión y espera el regreso al login. */
export async function salir(page: Page) {
    await page.goto("/mas");
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login$/);
}

/** Lee lo que el JavaScript de la página puede ver del almacenamiento. */
export async function almacenamientoVisible(page: Page) {
    return page.evaluate(() => ({
        cookies: document.cookie,
        local: JSON.stringify(window.localStorage),
        sesion: JSON.stringify(window.sessionStorage),
    }));
}

/**
 * Registra una gestante nueva por la pantalla pública, aceptando la política.
 * Devuelve la casilla de aceptación, que queda sin marcar para poder probar el rechazo.
 */
export async function registrarGestante(page: Page, correo: string, nombre: string) {
    await page.goto("/registro");
    const datos = page.getByRole("group", { name: "Tus datos" });
    const acceso = page.getByRole("group", { name: "Acceso" });

    await datos.getByLabel("Nombre").fill(nombre);
    await datos.getByLabel("Apellido").fill("Prueba");
    await datos.getByLabel("Número de documento").fill(`D${Date.now().toString().slice(-10)}`);
    await datos.getByLabel("Fecha de nacimiento").fill("1995-03-10");
    await acceso.getByLabel("Correo electrónico").fill(correo);
    await acceso.getByLabel(/^Contraseña/).fill("Clave1234");
    await acceso.getByLabel("Repetir contraseña").fill("Clave1234");
    return page.getByRole("checkbox", { name: /Autorizo el tratamiento/ });
}

const API = process.env.API_URL ?? "http://localhost:4000/api/v1";

/** Llama a la API como administrador (para preparar datos que la pantalla haría con muchos pasos). */
async function comoAdmin<T>(ruta: string, cuerpo?: unknown): Promise<T> {
    const login = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: USUARIOS.admin.correo, contrasena: USUARIOS.admin.contrasena }),
    });
    const { access_token: token } = (await login.json()) as { access_token: string };
    const r = await fetch(`${API}${ruta}`, {
        method: cuerpo ? "POST" : "GET",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    if (!r.ok) throw new Error(`${ruta} respondió ${r.status}: ${await r.text()}`);
    return (await r.json()) as T;
}

/** Asigna una gestante a un profesional por su correo. */
export async function asignarPaciente(correoProfesional: string, correoGestante: string) {
    const buscar = async (correo: string) => {
        const lista = await comoAdmin<{ datos: { id: number; correo: string }[] }>(
            `/usuarios?q=${encodeURIComponent(correo)}`,
        );
        const u = lista.datos.find((x) => x.correo.toLowerCase() === correo.toLowerCase());
        if (!u) throw new Error(`No existe ${correo}`);
        return u.id;
    };
    await comoAdmin("/asignaciones", {
        profesional_id: await buscar(correoProfesional),
        gestante_id: await buscar(correoGestante),
    });
}
