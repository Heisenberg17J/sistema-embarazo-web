import { expect, test, type Page } from "@playwright/test";
import { USUARIOS, asignarPaciente, entrar, registrarGestante, reiniciarBase, salir } from "./ayudas";

const contenido = (page: Page) => page.getByRole("main");

/** Fecha de hace `dias` días, en la zona de la aplicación. */
const hace = (dias: number) => {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(d);
};

/** Crea una gestante con un embarazo de `dias` días de evolución y deja la sesión abierta. */
async function gestanteConEmbarazo(page: Page, prefijo: string, dias: number) {
    const correo = `${prefijo}.${Date.now()}@prueba.co`;
    const casilla = await registrarGestante(page, correo, "Clara");
    await casilla.check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL(/\/embarazo\/nuevo$/);

    await page.getByLabel(/Fecha de tu última menstruación/).fill(hace(dias));
    await page.getByRole("button", { name: "Guardar y ver mi panel" }).click();
    await expect(page).toHaveURL(/\/panel$/);
    return correo;
}

test.describe("Ciclo de vida del embarazo", () => {
    test.beforeAll(() => reiniciarBase());

    test("la gestante corrige su fecha de última menstruación y la semana se recalcula", async ({ page }, info) => {
        await gestanteConEmbarazo(page, `corrige.${info.project.name}`, 98); // semana 14
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(contenido(page)).toContainText("tu semana 14");

        await page.goto("/embarazo");
        await page.getByRole("button", { name: "Corregir los datos" }).click();
        const hoja = page.getByRole("dialog");
        // El texto explica qué se recalcula antes de guardar.
        await expect(hoja).toContainText("se recalculan");

        // Se había escrito mal: era dos semanas antes.
        await hoja.getByLabel("Fecha de la última menstruación").fill(hace(112));
        await hoja.getByRole("button", { name: "Guardar cambios" }).click();
        await expect(hoja).toBeHidden();

        await page.goto("/panel");
        await expect(contenido(page)).toContainText("tu semana 16");
    });

    test("sin cambiar nada, el formulario no deja guardar", async ({ page }, info) => {
        await gestanteConEmbarazo(page, `sincambio.${info.project.name}`, 70);
        await page.goto("/embarazo");
        await page.getByRole("button", { name: "Corregir los datos" }).click();
        const hoja = page.getByRole("dialog");
        await hoja.getByRole("button", { name: "Guardar cambios" }).click();
        await expect(hoja.getByRole("alert")).toContainText("No cambiaste ningún dato");
    });

    test("cerrar el embarazo conserva el historial y deja registrar el siguiente", async ({ page }, info) => {
        await gestanteConEmbarazo(page, `cierra.${info.project.name}`, 250);

        await page.goto("/embarazo");
        await page.getByRole("button", { name: "Cerrar el embarazo" }).click();
        const hoja = page.getByRole("dialog");
        await expect(hoja).toContainText("no se puede deshacer");
        await expect(hoja).toContainText("¡Felicitaciones!");
        await hoja.getByRole("button", { name: "Sí, cerrar el embarazo" }).click();
        await expect(hoja).toBeHidden();

        // Ya no hay uno en curso, pero el anterior queda en el historial.
        await expect(contenido(page)).toContainText("No tienes un embarazo en curso");
        await expect(contenido(page).getByRole("heading", { name: "Embarazos anteriores" })).toBeVisible();
        await expect(contenido(page)).toContainText("Terminó con el nacimiento");

        // El panel invita a registrar uno nuevo.
        await page.goto("/panel");
        await expect(contenido(page)).toContainText("Aún no has registrado tu embarazo");

        // Y se puede registrar el siguiente.
        await page.goto("/embarazo");
        await page.getByRole("link", { name: "Registrar un embarazo" }).click();
        await page.getByLabel(/Fecha de tu última menstruación/).fill(hace(30));
        await page.getByRole("button", { name: "Guardar y ver mi panel" }).click();
        await expect(page).toHaveURL(/\/panel$/);
        await expect(contenido(page)).toContainText("tu semana 4");

        await page.goto("/embarazo");
        await expect(contenido(page)).toContainText("Embarazo actual");
        await expect(contenido(page)).toContainText("Terminó con el nacimiento"); // el anterior sigue ahí
    });

    test("cerrar un embarazo de otra manera usa un tono cuidadoso", async ({ page }, info) => {
        await gestanteConEmbarazo(page, `otra.${info.project.name}`, 60);
        await page.goto("/embarazo");
        await page.getByRole("button", { name: "Cerrar el embarazo" }).click();
        const hoja = page.getByRole("dialog");
        await hoja.getByLabel("¿Cómo terminó?").selectOption("CANCELADO");
        await expect(hoja).toContainText("Lamentamos que estés pasando por esto");
        await expect(hoja).not.toContainText("Felicitaciones");
        await hoja.getByRole("button", { name: "Sí, cerrar el embarazo" }).click();
        await expect(hoja).toBeHidden();
        await expect(contenido(page)).toContainText("Terminó de otra manera");
    });

    test("el profesional registra el embarazo de una paciente que no pudo hacerlo", async ({ page }, info) => {
        const correo = `registrada.${info.project.name}.${Date.now()}@prueba.co`;
        const casilla = await registrarGestante(page, correo, "Paula");
        await casilla.check();
        await page.getByRole("button", { name: "Crear cuenta" }).click();
        await expect(page).toHaveURL(/\/embarazo\/nuevo$/);
        await asignarPaciente(USUARIOS.profesional.correo, correo);
        await salir(page);

        await entrar(page, USUARIOS.profesional);
        await page.goto("/pro/pacientes");
        await contenido(page).getByRole("link", { name: /Paula Prueba/ }).click();
        await expect(contenido(page)).toContainText("Todavía no ha registrado su embarazo");

        await page.getByRole("button", { name: "Registrar su embarazo" }).click();
        const hoja = page.getByRole("dialog");
        await hoja.getByLabel("Fecha de la última menstruación").fill(hace(84));
        await hoja.getByRole("button", { name: "Registrar embarazo" }).click();
        await expect(hoja).toBeHidden();
        // La semana aparece bajo el nombre de la paciente.
        await expect(contenido(page)).toContainText("Semana 12");

        // Ella lo ve como suyo.
        await salir(page);
        await entrar(page, { correo, contrasena: "Clave1234" });
        await expect(contenido(page)).toContainText("tu semana 12");
    });
});
