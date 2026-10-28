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
