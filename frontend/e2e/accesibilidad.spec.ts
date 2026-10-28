import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { USUARIOS, entrar, reiniciarBase } from "./ayudas";

/**
 * Accesibilidad con axe-core (WCAG 2.1 A y AA) sobre las pantallas de cada rol.
 *
 * También comprueba que ninguna pantalla desborde en horizontal.
 *
 * Los colores ya se habían verificado contra AA con un script; esto cubre el resto: nombres de
 * botones y campos, etiquetas, jerarquía de encabezados, regiones y roles ARIA.
 */

const REGLAS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function revisar(page: Page, ruta: string) {
    await page.goto(ruta);
    // Que la pantalla termine de pintar antes de analizarla.
    await expect(page.getByRole("main")).toBeVisible();
    await page.waitForLoadState("networkidle");
    // Una columna que no puede encogerse ensancha toda la página en el móvil (y arrastra consigo
    // los diálogos): se midió con la tarjeta del profesional del panel.
    const ancho = await page.evaluate(() => ({
        pagina: document.documentElement.scrollWidth,
        ventana: document.documentElement.clientWidth,
    }));
    expect(ancho.pagina, `${ruta} desborda horizontalmente`).toBeLessThanOrEqual(ancho.ventana);

    const { violations } = await new AxeBuilder({ page }).withTags(REGLAS).analyze();
    // Mensaje legible: qué regla, qué elementos.
    const resumen = violations.map(
        (v) => `${v.id} (${v.impact}): ${v.help}\n   ` + v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n   "),
    );
    expect(resumen, `Problemas de accesibilidad en ${ruta}`).toEqual([]);
}

test.describe("Accesibilidad", () => {
    test.beforeAll(() => reiniciarBase());

    test("pantallas públicas", async ({ page }) => {
        for (const ruta of ["/login", "/registro", "/recuperar", "/politica-de-privacidad", "/terminos"]) {
            await revisar(page, ruta);
        }
    });

    test("gestante", async ({ page }) => {
        await entrar(page, USUARIOS.gestante);
        for (const ruta of [
            "/panel", "/citas", "/evolucion", "/aprendizaje", "/alertas", "/sintomas", "/controles",
            "/examenes", "/historial", "/embarazo", "/perfil", "/mas",
        ]) {
            await revisar(page, ruta);
        }
    });

    test("profesional", async ({ page }) => {
        await entrar(page, USUARIOS.profesional);
        for (const ruta of [
            "/pro", "/pro/pacientes", "/pro/pacientes/4", "/pro/pacientes/4?seccion=examenes",
            "/pro/agenda", "/pro/alertas", "/pro/actividad", "/pro/revision-clinica",
        ]) {
            await revisar(page, ruta);
        }
    });

    test("administrador", async ({ page }) => {
        await entrar(page, USUARIOS.admin);
        for (const ruta of [
            "/admin", "/admin/usuarios", "/admin/asignaciones", "/admin/contenido", "/admin/catalogos",
            "/admin/reglas-alerta", "/admin/solicitudes", "/admin/auditoria", "/admin/configuracion",
        ]) {
            await revisar(page, ruta);
        }
    });
});
