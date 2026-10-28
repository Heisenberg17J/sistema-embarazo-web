import { expect, test, type Page } from "@playwright/test";
import { USUARIOS, entrar } from "./ayudas";

const API = "http://localhost:4000/api/v1";

/** Posición vertical de la ventana. */
const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

/**
 * Cambiar de filtro, de pestaña o de página no es cambiar de pantalla: la
 * vista no debe saltar al inicio cada vez que se pulsa un botón.
 */
test.describe("La página no salta al inicio", () => {
    test("cambiar de pestaña en la ficha conserva la posición", async ({ page }) => {
        await entrar(page, USUARIOS.profesional);
        await page.goto("/pro/pacientes/4");

        const pestanas = page.getByRole("navigation", { name: "Secciones de la ficha" });
        await pestanas.evaluate((e) => e.scrollIntoView({ block: "start" }));
        const antes = await scrollY(page);
        expect(antes).toBeGreaterThan(0);

        await pestanas.getByRole("link", { name: "Exámenes" }).click();
        await expect(page).toHaveURL(/seccion=examenes/);
        await expect(page.getByRole("main").getByText("Hemograma completo")).toBeVisible();

        // Si la sección nueva es más corta, el navegador acerca la vista lo
        // justo; lo que no debe pasar es volver al inicio de la ficha.
        expect(await scrollY(page)).toBeGreaterThan(0);
        const caja = await pestanas.boundingBox();
        const alto = page.viewportSize()!.height;
        expect(caja!.y).toBeGreaterThanOrEqual(0);
        expect(caja!.y).toBeLessThan(alto);
    });

    test("cambiar de medición en Evolución conserva la posición", async ({ page, request }) => {
        // Hacen falta al menos dos "otras mediciones" para que aparezca el filtro.
        const h = {
            Authorization: `Bearer ${
                (await (await request.post(`${API}/auth/login`, { data: USUARIOS.gestante })).json())
                    .access_token
            }`,
        };
        const { embarazo_id: id } = await (
            await request.get(`${API}/embarazos/actual`, { headers: h })
        ).json();
        await request.post(`${API}/embarazos/${id}/mediciones`, {
            headers: h,
            data: {
                mediciones: [
                    { tipo: "GLUCOSA_AYUNAS", valor: 85 },
                    { tipo: "TEMPERATURA", valor: 36.6 },
                ],
            },
        });

        await entrar(page, USUARIOS.gestante);
        await page.goto("/evolucion");
        const filtros = page.getByRole("group", { name: "Tipo de medición" });
        await filtros.evaluate((e) => e.scrollIntoView({ block: "start" }));
        const antes = await scrollY(page);
        expect(antes).toBeGreaterThan(0);

        await filtros.getByRole("link", { name: "Temperatura corporal" }).click();
        await expect(page).toHaveURL(/tipo=TEMPERATURA/);
        await expect(filtros.getByRole("link", { name: "Temperatura corporal" })).toHaveAttribute(
            "aria-current",
            "true",
        );
        expect(Math.abs((await scrollY(page)) - antes)).toBeLessThan(40);
    });

    test.describe("en la auditoría", () => {
        // Más de una página de registros (30 por página).
        test.beforeAll(async ({ playwright }) => {
            const api = await playwright.request.newContext();
            for (let i = 0; i < 32; i++) {
                await api.post(`${API}/auth/login`, { data: USUARIOS.profesional2 });
            }
            await api.dispose();
        });

        test.beforeEach(async ({ page }) => {
            await entrar(page, USUARIOS.admin);
            await page.goto("/admin/auditoria");
        });

        test("un filtro conserva la posición", async ({ page }) => {
            const filtros = page.getByRole("group", { name: "Tipo de acción" });
            await filtros.evaluate((e) => e.scrollIntoView({ block: "start" }));
            const antes = await scrollY(page);
            expect(antes).toBeGreaterThan(0);

            await filtros.getByRole("link", { name: "Inicio de sesión" }).click();
            await expect(page).toHaveURL(/accion=LOGIN/);
            await expect(filtros.getByRole("link", { name: "Inicio de sesión" })).toHaveAttribute(
                "aria-current",
                "true",
            );
            expect(Math.abs((await scrollY(page)) - antes)).toBeLessThan(40);
        });

        test("la página siguiente vuelve al comienzo de la lista, no al de la pantalla", async ({
            page,
        }) => {
            const siguiente = page.getByRole("link", { name: "Página siguiente" });
            await siguiente.scrollIntoViewIfNeeded();
            await siguiente.click();
            await expect(page).toHaveURL(/page=2/);

            await expect
                .poll(async () => (await page.locator("#lista").boundingBox())?.y ?? -1)
                .toBeLessThan(40);
            const y = (await page.locator("#lista").boundingBox())!.y;
            expect(y).toBeGreaterThanOrEqual(0);
            expect(await scrollY(page)).toBeGreaterThan(0);
        });
    });

    test("buscar no recarga la página", async ({ page }) => {
        await entrar(page, USUARIOS.admin);
        await page.goto("/admin/usuarios");
        // Una recarga completa borraría esta marca.
        await page.evaluate(() => ((window as unknown as { marca: number }).marca = 1));

        await page.getByRole("searchbox", { name: "Buscar usuarios" }).fill("Gómez");
        await page.getByRole("button", { name: "Buscar" }).click();
        await expect(page).toHaveURL(/q=G%C3%B3mez/);
        await expect(page.getByRole("main").getByText("María Gómez")).toBeVisible();
        await expect(page.getByRole("main").getByText("Diana Cruz")).toBeHidden();

        expect(await page.evaluate(() => (window as unknown as { marca?: number }).marca)).toBe(1);
    });
});
