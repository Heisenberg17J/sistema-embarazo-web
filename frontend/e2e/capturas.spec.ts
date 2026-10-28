import { test } from "@playwright/test";
import { USUARIOS, entrar } from "./ayudas";

/**
 * Genera capturas de las pantallas para revisar el diseño.
 *   npx playwright test e2e/capturas.spec.ts --project=escritorio
 * Las imágenes quedan en e2e/capturas/.
 */
test.describe("Capturas de pantalla", () => {
    test("panel de la gestante", async ({ page }, info) => {
        await entrar(page, USUARIOS.gestante);
        await page.getByRole("heading", { level: 1 }).waitFor();
        await page.screenshot({
            path: `e2e/capturas/panel-${info.project.name}.png`,
            fullPage: true,
        });
    });

    test("aviso de atención inmediata", async ({ page }, info) => {
        await entrar(page, USUARIOS.gestante);
        await page.getByRole("button", { name: "Medición" }).click();
        const hoja = page.getByRole("dialog");
        await hoja.getByLabel("Sistólica").fill("168");
        await hoja.getByLabel("Diastólica").fill("114");
        await hoja.getByRole("button", { name: "Guardar medición" }).click();
        await page.getByRole("alertdialog").waitFor();
        await page.screenshot({
            path: `e2e/capturas/aviso-critico-${info.project.name}.png`,
        });
    });

    test("registrar un síntoma", async ({ page }, info) => {
        await entrar(page, USUARIOS.gestante);
        await page.getByRole("button", { name: "Síntoma" }).click();
        const hoja = page.getByRole("dialog");
        await hoja.getByLabel("¿Qué está sintiendo?").selectOption("CEFALEA_INTENSA");
        await page.screenshot({
            path: `e2e/capturas/sintoma-${info.project.name}.png`,
        });
    });

    // Una captura por pantalla de la gestante.
    for (const [ruta, nombre] of [
        ["/citas", "citas"],
        ["/evolucion", "evolucion"],
        ["/sintomas", "sintomas"],
        ["/examenes", "examenes"],
        ["/historial", "historial"],
        ["/alertas", "alertas"],
        ["/aprendizaje", "aprendizaje"],
        ["/perfil", "perfil"],
    ] as const) {
        test(`pantalla ${nombre}`, async ({ page }, info) => {
            await entrar(page, USUARIOS.gestante);
            await page.goto(ruta);
            await page.getByRole("heading", { level: 1 }).waitFor();
            await page.waitForTimeout(600); // deja que la gráfica se dibuje
            await page.screenshot({
                path: `e2e/capturas/${nombre}-${info.project.name}.png`,
                fullPage: true,
            });
        });
    }

    test("inicio de sesión", async ({ page }, info) => {
        await page.goto("/login");
        await page.screenshot({
            path: `e2e/capturas/login-${info.project.name}.png`,
            fullPage: true,
        });
    });
});
