import { expect, test } from "@playwright/test";
import { USUARIOS, crearTokenDeRecuperacion, entrar, reiniciarBase } from "./ayudas";

test.describe("Recuperación de contraseña", () => {
    // Una prueba cambia la contraseña de una cuenta del seed: se restaura al terminar.
    test.beforeAll(() => reiniciarBase());
    test.afterAll(() => reiniciarBase());

    test("el formulario responde lo mismo exista o no el correo", async ({ page }) => {
        const mensaje = /Si el correo está registrado, te enviamos un enlace/;

        await page.goto("/login");
        await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).click();
        await expect(page).toHaveURL(/\/recuperar$/);

        await page.getByLabel("Correo electrónico").fill("nadie.existe@ejemplo.co");
        await page.getByRole("button", { name: "Enviarme el enlace" }).click();
        await expect(page.getByRole("status")).toContainText(mensaje);
        const sinCuenta = await page.getByRole("status").innerText();

        await page.goto("/recuperar");
        await page.getByLabel("Correo electrónico").fill(USUARIOS.gestante2.correo);
        await page.getByRole("button", { name: "Enviarme el enlace" }).click();
        await expect(page.getByRole("status")).toContainText(mensaje);
        // Idéntica: la respuesta no revela quién tiene cuenta.
        expect(await page.getByRole("status").innerText()).toBe(sinCuenta);
    });

    test("con un enlace válido se elige una contraseña nueva y se puede entrar", async ({ page }) => {
        const token = crearTokenDeRecuperacion(USUARIOS.gestante2.correo);

        await page.goto(`/restablecer/${token}`);
        await page.getByLabel(/^Contraseña nueva/).fill("NuevaClave456");
        await page.getByLabel("Repetir contraseña nueva").fill("NuevaClave456");
        await page.getByRole("button", { name: "Guardar contraseña" }).click();

        await expect(page).toHaveURL(/\/login\?cambiada=1$/);
        await expect(page.getByRole("status")).toContainText("Tu contraseña se actualizó");

        await entrar(page, { correo: USUARIOS.gestante2.correo, contrasena: "NuevaClave456" });
        await expect(page).toHaveURL(/\/panel$/);

        // El mismo enlace no sirve dos veces.
        await page.goto("/login");
        await page.context().clearCookies();
        await page.goto(`/restablecer/${token}`);
        await page.getByLabel(/^Contraseña nueva/).fill("OtraClave789");
        await page.getByLabel("Repetir contraseña nueva").fill("OtraClave789");
        await page.getByRole("button", { name: "Guardar contraseña" }).click();
        await expect(page.locator("form").getByRole("alert")).toContainText("no es válido o ya venció");
    });

    test("un enlace inventado muestra el error y deja pedir uno nuevo", async ({ page }) => {
        await page.goto(`/restablecer/${"a".repeat(64)}`);
        await page.getByLabel(/^Contraseña nueva/).fill("NuevaClave456");
        await page.getByLabel("Repetir contraseña nueva").fill("NuevaClave456");
        await page.getByRole("button", { name: "Guardar contraseña" }).click();

        await expect(page.locator("form").getByRole("alert")).toContainText("no es válido o ya venció");
        await page.getByRole("link", { name: "Pide uno nuevo" }).click();
        await expect(page).toHaveURL(/\/recuperar$/);
    });

    test("una contraseña débil se rechaza sin gastar el enlace", async ({ page }) => {
        const token = crearTokenDeRecuperacion(USUARIOS.profesional2.correo);
        await page.goto(`/restablecer/${token}`);

        await page.getByLabel(/^Contraseña nueva/).fill("corta");
        await page.getByLabel("Repetir contraseña nueva").fill("corta");
        await page.getByRole("button", { name: "Guardar contraseña" }).click();
        await expect(page.getByText("Mínimo 8 caracteres", { exact: true })).toBeVisible();
        await expect(page).toHaveURL(/\/restablecer\//);

        // El enlace sigue vivo para intentarlo de nuevo.
        await page.getByLabel(/^Contraseña nueva/).fill("ClaveValida789");
        await page.getByLabel("Repetir contraseña nueva").fill("ClaveValida789");
        await page.getByRole("button", { name: "Guardar contraseña" }).click();
        await expect(page).toHaveURL(/\/login\?cambiada=1$/);
    });
});
