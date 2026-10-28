import { expect, test } from "@playwright/test";
import { USUARIOS, entrar } from "./ayudas";

test.describe("Alertas y signos de alarma (RF-11)", () => {
    test("una presión severa muestra el aviso de atención inmediata", async ({
        page,
    }) => {
        await entrar(page, USUARIOS.gestante);

        await page.getByRole("button", { name: "Medición" }).click();
        const hoja = page.getByRole("dialog");
        await expect(hoja.getByText("Registrar una medición")).toBeVisible();

        await hoja.getByLabel("Sistólica").fill("165");
        await hoja.getByLabel("Diastólica").fill("112");
        await hoja.getByRole("button", { name: "Guardar medición" }).click();

        // El aviso crítico reemplaza al formulario y dice qué hacer.
        const aviso = page.getByRole("alertdialog");
        await expect(aviso).toBeVisible();
        await expect(aviso).toContainText("Atención inmediata");
        await expect(aviso).toContainText(/urgencias/i);
        await expect(aviso).toContainText("reemplaza la valoración");

        // No se cierra por accidente al tocar fuera.
        await page.mouse.click(5, 5);
        await expect(aviso).toBeVisible();

        await aviso.getByRole("button", { name: "Entendido" }).click();
        await expect(aviso).toBeHidden();

        // La alerta queda registrada y el panel la muestra.
        await page.reload();
        await expect(
            page.getByRole("article").filter({ hasText: "Atención inmediata" }).first(),
        ).toBeVisible();
    });

    test("una presión normal se guarda sin generar alerta", async ({ page }) => {
        await entrar(page, USUARIOS.gestante);

        await page.getByRole("button", { name: "Medición" }).click();
        const hoja = page.getByRole("dialog");
        await hoja.getByLabel("Sistólica").fill("112");
        await hoja.getByLabel("Diastólica").fill("72");
        await hoja.getByRole("button", { name: "Guardar medición" }).click();

        await expect(hoja.getByRole("status")).toContainText("registrada");
        await expect(page.getByRole("alertdialog")).toBeHidden();
    });

    test("un signo de alarma avisa al momento de registrarlo", async ({ page }) => {
        await entrar(page, USUARIOS.gestante);

        await page.getByRole("button", { name: "Síntoma" }).click();
        const hoja = page.getByRole("dialog");
        await hoja.getByLabel("¿Qué está sintiendo?").selectOption("SANGRADO");

        // Antes de guardar ya se advierte qué va a pasar.
        await expect(hoja).toContainText("te indicamos qué hacer");

        await hoja.getByRole("button", { name: "Guardar síntoma" }).click();

        const aviso = page.getByRole("alertdialog");
        await expect(aviso).toBeVisible();
        await expect(aviso).toContainText(/urgencias/i);
    });

    test("un valor fuera del rango técnico se rechaza con un mensaje claro", async ({
        page,
    }) => {
        await entrar(page, USUARIOS.gestante);

        await page.getByRole("button", { name: "Medición" }).click();
        const hoja = page.getByRole("dialog");
        await hoja.getByLabel("Sistólica").fill("400");
        await hoja.getByLabel("Diastólica").fill("90");
        await hoja.getByRole("button", { name: "Guardar medición" }).click();

        await expect(hoja.getByRole("alert")).toContainText("fuera del rango técnico");
    });
});
