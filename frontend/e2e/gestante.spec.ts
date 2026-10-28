import { expect, test } from "@playwright/test";
import { USUARIOS, entrar, reiniciarBase } from "./ayudas";

test.describe("Pantallas de la gestante", () => {
    // Estas pruebas cancelan una cita, marcan un contenido como leído y
    // completan el contacto de emergencia. Sin reiniciar, la segunda corrida
    // (la de móvil) encontraría los cambios de la primera.
    test.beforeAll(() => reiniciarBase());

    test.beforeEach(async ({ page }) => {
        await entrar(page, USUARIOS.gestante);
    });

    /**
     * El contenido de la página, sin el encabezado ni la barra inferior de
     * navegación: en móvil esa barra también son <li> y <a>, y se colaría en
     * las búsquedas por rol.
     */
    const contenido = (page: import("@playwright/test").Page) =>
        page.getByRole("main");

    test("las citas se agrupan y cancelar una exige el motivo (RF-07)", async ({
        page,
    }) => {
        await page.goto("/citas");
        await expect(page.getByRole("heading", { name: "Mis citas" })).toBeVisible();

        // Los datos de prueba traen un control prenatal programado.
        const proximas = contenido(page)
            .getByRole("listitem")
            .filter({ hasText: "Programada" });
        await expect(proximas.first()).toContainText("Control prenatal");

        await page.getByRole("button", { name: "Cancelar" }).first().click();
        const hoja = page.getByRole("dialog");

        // Sin motivo no deja cancelar.
        await hoja.getByRole("button", { name: "Sí, cancelar la cita" }).click();
        await expect(hoja.getByRole("alert")).toContainText("Revisa los datos");

        await hoja
            .getByLabel("¿Por qué no podrás asistir?")
            .fill("Tengo un viaje familiar ese día");
        await hoja.getByRole("button", { name: "Sí, cancelar la cita" }).click();

        await expect(hoja).toBeHidden();
        await expect(page.getByText("Tengo un viaje familiar ese día")).toBeVisible();
        await expect(
            contenido(page)
                .getByRole("listitem")
                .filter({ hasText: "Cancelada" })
                .first(),
        ).toBeVisible();
    });

    test("el historial filtra por tipo de registro (RF-09)", async ({ page }) => {
        await page.goto("/historial");

        const eventos = contenido(page).getByRole("listitem");
        // La paginación dice el total; leerlo evita contar la lista mientras
        // todavía se está pintando.
        const total = async () => {
            const texto = await contenido(page)
                .getByText(/de \d+ registros?$/)
                .innerText();
            return Number(texto.match(/de (\d+) registros?$/)![1]);
        };

        const sinFiltro = await total();
        expect(sinFiltro).toBeGreaterThan(1);

        // Acotado al grupo de filtros: "Citas" y "Exámenes" también son
        // enlaces de la navegación principal.
        const filtros = page.getByRole("group", { name: "Tipo de registro" });
        await filtros.getByRole("link", { name: "Exámenes", exact: true }).click();
        await expect(page).toHaveURL(/tipo=EXAMEN/);
        await expect(eventos.first()).toContainText("Hemograma");

        // Con el filtro puesto solo quedan exámenes.
        expect(await total()).toBe(1);
        for (const texto of await eventos.allTextContents()) {
            expect(texto).toContain("Hemograma");
        }

        // "Todo" lleva un valor explícito en la URL: un enlace a la ruta
        // desnuda no navegaba a la primera pulsación.
        await filtros.getByRole("link", { name: "Todo", exact: true }).click();
        await expect(page).toHaveURL(/tipo=todos/);
        await expect
            .poll(total, { message: "vuelve a verse el historial completo" })
            .toBe(sinFiltro);
    });

    test("la evolución dibuja las gráficas con sus umbrales (RF-10)", async ({
        page,
    }) => {
        await page.goto("/evolucion");

        await expect(page.getByText("Peso por semana")).toBeVisible();
        await expect(page.getByText("Sistólica y diastólica")).toBeVisible();

        // Equivalente en texto de la gráfica, para lectores de pantalla.
        await expect(
            page.getByText(/Peso corporal: semana \d+, [\d.]+ kg/),
        ).toBeAttached();

        // Las líneas de umbral se dibujan como SVG dentro de la tarjeta.
        expect(await page.locator("svg.recharts-surface").count()).toBeGreaterThan(0);
    });

    test("un contenido queda marcado como leído y lo sigue estando (RF-16)", async ({
        page,
    }) => {
        await page.goto("/aprendizaje");

        const tarjeta = contenido(page)
            .getByRole("link")
            .filter({ hasText: "Segundo trimestre" })
            .first();
        await expect(tarjeta).toBeVisible();
        await expect(tarjeta).not.toContainText("Leído");

        await tarjeta.click();
        await expect(
            page.getByRole("heading", { name: /Segundo trimestre/ }),
        ).toBeVisible();

        await page.goto("/aprendizaje");
        await expect(
            contenido(page)
                .getByRole("link")
                .filter({ hasText: "Segundo trimestre" })
                .first(),
        ).toContainText("Leído");
    });

    test("el aviso de contacto de emergencia desaparece al registrarlo", async ({
        page,
    }) => {
        const aviso = page.getByText("Falta tu contacto de emergencia");

        // Los datos de prueba no traen contacto de emergencia.
        await expect(aviso).toBeVisible();

        // En el perfil no se repite el aviso: se destaca la sección donde se
        // arregla, para que no haya dos indicadores que puedan discrepar.
        await page.goto("/perfil");
        const contacto = page.getByRole("group", { name: "Contacto de emergencia" });
        await expect(contacto).toContainText("Todavía no lo has registrado");
        await contacto.getByLabel("Nombre").fill("Mi esposo Andrés");
        await contacto.getByLabel("Teléfono").fill("3001234567");
        await page.getByRole("button", { name: "Guardar cambios" }).click();

        await expect(page.getByRole("status")).toContainText("guardados");

        await page.goto("/panel");
        await expect(page.getByRole("heading", { level: 1 })).toContainText("María");
        await expect(aviso).toBeHidden();

        // Y el aviso de atención inmediata ya puede ofrecer la llamada.
        await page.getByRole("button", { name: "Síntoma" }).click();
        const hoja = page.getByRole("dialog");
        await hoja.getByLabel("¿Qué está sintiendo?").selectOption("SANGRADO");
        await hoja.getByRole("button", { name: "Guardar síntoma" }).click();

        const urgente = page.getByRole("alertdialog");
        await expect(urgente).toBeVisible();
        await expect(
            urgente.getByRole("link", { name: /Llamar a Mi esposo Andrés/ }),
        ).toBeVisible();
    });

    test("síntomas y exámenes muestran lo registrado", async ({ page }) => {
        await page.goto("/sintomas");
        await expect(page.getByText("Dolor de cabeza persistente")).toBeVisible();

        await page.goto("/examenes");
        await expect(page.getByText("Hemograma completo")).toBeVisible();
        await expect(page.getByText(/Hemoglobina/)).toBeVisible();
    });
});
