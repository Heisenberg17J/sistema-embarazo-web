import { expect, test, type Page } from "@playwright/test";
import { USUARIOS, entrar, reiniciarBase, salir } from "./ayudas";

/** Identificadores de los datos de prueba (`db/seeds.sql`). */
const MARIA = 4; // asignada a Carlos Mejía
const DIANA = 5; // sin profesional asignado

/** El contenido, sin la barra inferior de navegación (en móvil son <li> y <a>). */
const contenido = (page: Page) => page.getByRole("main");

test.describe("Pantallas del profesional", () => {
    // Estas pruebas registran controles, citas y revisiones.
    test.beforeAll(() => reiniciarBase());

    test.beforeEach(async ({ page }) => {
        await entrar(page, USUARIOS.profesional);
    });

    test("el panel resume la consulta y lleva a cada sección (RF-17)", async ({
        page,
    }) => {
        await expect(page).toHaveURL(/\/pro$/);
        await expect(page.getByRole("heading", { level: 1 })).toContainText("Carlos");

        // Los datos de prueba dejan una paciente y una alerta sin revisar.
        const pacientes = contenido(page).getByRole("link", { name: /Pacientes/ });
        await expect(pacientes).toContainText("1");

        await contenido(page)
            .getByRole("link", { name: /Alertas sin revisar/ })
            .click();
        await expect(page).toHaveURL(/\/pro\/alertas$/);
    });

    test("solo ve a sus pacientes asignadas (RNF-03)", async ({ page }) => {
        await page.goto("/pro/pacientes");
        await expect(contenido(page).getByText("María Gómez")).toBeVisible();
        await expect(contenido(page).getByText("Diana Cruz")).toBeHidden();

        // La ficha de una gestante no asignada no existe para él.
        await page.goto(`/pro/pacientes/${DIANA}`);
        await expect(page.getByText("Esta página no existe")).toBeVisible();
    });

    test("la ficha cambia de sección sin perder las pestañas", async ({ page }) => {
        await page.goto(`/pro/pacientes/${MARIA}`);
        await expect(page.getByRole("heading", { level: 1 })).toContainText("María");

        const pestanas = page.getByRole("navigation", {
            name: "Secciones de la ficha",
        });

        await pestanas.getByRole("link", { name: "Exámenes" }).click();
        await expect(page).toHaveURL(/seccion=examenes/);
        await expect(contenido(page).getByText("Hemograma completo")).toBeVisible();

        // Dos cambios seguidos: la barra no se desmonta entre uno y otro.
        await pestanas.getByRole("link", { name: "Síntomas" }).click();
        await expect(page).toHaveURL(/seccion=sintomas/);
        await expect(
            contenido(page).getByText("Dolor de cabeza persistente"),
        ).toBeVisible();
    });

    test("un control con frecuencia cardiaca fetal baja genera una alerta crítica (RF-05, RF-11)", async ({
        page,
    }) => {
        await page.goto(`/pro/pacientes/${MARIA}`);
        await page.getByRole("button", { name: "Registrar control" }).click();

        const hoja = page.getByRole("dialog");
        await expect(hoja).toContainText("Registrar control prenatal");

        // Por el rol: cada fila tiene además un botón "Quitar …" con el mismo
        // nombre accesible.
        await hoja
            .getByRole("spinbutton", { name: /Frecuencia cardiaca fetal/ })
            .fill("95");
        await hoja.getByRole("spinbutton", { name: /Peso corporal/ }).fill("69");
        await hoja
            .getByLabel("Observaciones")
            .fill("Se solicita monitoreo fetal de inmediato.");
        await hoja.getByRole("button", { name: "Guardar control" }).click();

        // La alerta que generó el control se muestra en el mismo diálogo.
        await expect(hoja.getByRole("status")).toContainText("registrado");
        await expect(hoja).toContainText("Atención inmediata");
        await expect(hoja).toContainText(/frecuencia cardiaca fetal/i);
    });

    test("una cita a una hora ya ocupada avisa en vez de fallar (RF-07)", async ({
        page,
    }) => {
        await page.goto("/pro/agenda");

        // Los datos de prueba traen una cita dentro de siete días a las 09:00.
        const existente = contenido(page).getByText("09:00").first();
        await expect(existente).toBeVisible();
        const fecha = new Date();
        fecha.setDate(fecha.getDate() + 7);
        const mismaFecha = fecha.toISOString().slice(0, 10);

        await page.getByRole("button", { name: "Programar cita" }).click();
        const hoja = page.getByRole("dialog");
        // La primera opción real: el marcador "Elige una paciente" está deshabilitado.
        await hoja.getByLabel("Paciente").selectOption({ index: 1 });
        await hoja.getByLabel("Tipo de control").selectOption("ECOGRAFIA");
        await hoja.getByLabel("Fecha").fill(mismaFecha);
        await hoja.getByLabel("Hora").fill("09:00");
        await hoja.getByRole("button", { name: "Programar cita" }).click();

        await expect(hoja.getByRole("alert")).toContainText(
            "ya tiene una cita programada",
        );

        // A otra hora sí entra.
        await hoja.getByLabel("Hora").fill("10:30");
        await hoja.getByRole("button", { name: "Programar cita" }).click();
        await expect(hoja.getByRole("status")).toContainText("María Gómez");
    });

    test("revisar una alerta la saca de la bandeja y la gestante lo ve (RF-12)", async ({
        page,
    }) => {
        await page.goto("/pro/alertas");

        // Se apunta a esta alerta en concreto: en la bandeja puede haber otras.
        const mensaje = "Presión sistólica de 140 o más";
        const fila = contenido(page)
            .getByRole("listitem")
            .filter({ hasText: mensaje });
        await expect(fila).toHaveCount(1);

        await fila.getByRole("button", { name: "Revisar" }).click();
        const hoja = page.getByRole("dialog");
        await hoja.getByLabel("Resultado de la revisión").selectOption("REVISADA");
        await hoja
            .getByLabel("Observación")
            .fill("Se contactó a la paciente; cita de control adelantada.");
        await hoja.getByRole("button", { name: "Guardar revisión" }).click();

        await expect(hoja).toBeHidden();
        // Sale de las pendientes, aunque queden otras.
        await expect(contenido(page).getByText(mensaje)).toBeHidden();

        // La gestante ve el cambio de estado y la observación.
        await salir(page);
        await entrar(page, USUARIOS.gestante);
        await page.goto("/alertas?estado=REVISADA");
        await expect(
            contenido(page).getByText("Se contactó a la paciente"),
        ).toBeVisible();
    });

    test("una cita programada le aparece a la gestante (RF-07)", async ({ page }) => {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() + 3);
        const dia = fecha.toISOString().slice(0, 10);

        await page.goto(`/pro/pacientes/${MARIA}`);
        await page.getByRole("button", { name: "Citar" }).click();
        const hoja = page.getByRole("dialog");
        await hoja.getByLabel("Tipo de control").selectOption("ECOGRAFIA");
        await hoja.getByLabel("Fecha").fill(dia);
        await hoja.getByLabel("Hora").fill("15:45");
        await hoja.getByRole("button", { name: "Programar cita" }).click();
        await expect(hoja.getByRole("status")).toContainText("15:45");

        await salir(page);
        await entrar(page, USUARIOS.gestante);
        await page.goto("/citas");
        await expect(contenido(page).getByText("Ecografía").first()).toBeVisible();
        await expect(contenido(page).getByText("15:45")).toBeVisible();
    });

    test("el profesional revisa y aprueba lo que el sistema les dice a las gestantes", async ({ page }) => {
        // El panel avisa de lo que falta: nadie ha avalado todavía los umbrales.
        const aviso = contenido(page).getByRole("link", { name: /esperan tu revisión/ });
        await expect(aviso).toBeVisible();
        await aviso.click();
        await expect(page).toHaveURL(/\/pro\/revision-clinica$/);

        const regla = contenido(page)
            .getByRole("listitem")
            .filter({ hasText: "Presión sistólica de 160 o más" });
        await expect(regla).toContainText("Sin aprobar");

        // Aprobar deja constancia de quién avala el mensaje, y lo dice antes de confirmar.
        await regla.getByRole("button", { name: "Aprobar" }).click();
        const hoja = page.getByRole("dialog");
        await expect(hoja).toContainText("avalas");
        await expect(hoja).toContainText("acude de inmediato");
        await hoja.getByRole("button", { name: "Sí, lo apruebo" }).click();

        await expect(hoja).toBeHidden();
        await expect(regla).toContainText("Aprobada por Carlos Mejía");
        await expect(regla.getByRole("button", { name: "Aprobar" })).toBeHidden();
    });

    test("el administrador ve qué reglas siguen sin aprobación clínica", async ({ page }) => {
        await salir(page);
        await entrar(page, USUARIOS.admin);

        await expect(contenido(page)).toContainText("sin aprobación de un profesional de salud");
        await page.goto("/admin/reglas-alerta");
        await expect(contenido(page).getByText("Sin aprobación clínica").first()).toBeVisible();
    });

    test("cerrar una cita como cancelada sin motivo falla y no la deja cumplida por error", async ({ page }) => {
        // Regresión del mismo fallo que anonimizó una cuenta por error: tras un envío que falla,
        // un desplegable no puede volver solo a su opción inicial ("cumplida").
        await page.goto("/pro/agenda");
        const cita = contenido(page).getByRole("listitem").filter({ hasText: "Programada" }).first();
        await cita.getByRole("button", { name: "Cerrar" }).click();

        const hoja = page.getByRole("dialog");
        await hoja.getByLabel("¿Qué pasó con la cita?").selectOption("CANCELADA");
        await hoja.getByRole("button", { name: "Guardar" }).click();
        await expect(hoja.getByText("Indica por qué se cancela")).toBeVisible();
        await expect(hoja.getByLabel("¿Qué pasó con la cita?")).toHaveValue("CANCELADA");

        await hoja.getByLabel("Motivo").fill("La paciente avisó que no puede venir");
        await hoja.getByRole("button", { name: "Guardar" }).click();
        await expect(hoja).toBeHidden();

        await expect(contenido(page).getByText("La paciente avisó que no puede venir")).toBeVisible();
    });

    test("el historial de la ficha se filtra por tipo", async ({ page }) => {
        await page.goto(`/pro/pacientes/${MARIA}?seccion=historial`);
        const filtros = contenido(page).getByRole("group", { name: "Tipo de registro" });
        await filtros.getByRole("link", { name: "Exámenes" }).click();
        await expect(page).toHaveURL(/tipo=EXAMEN/);
        await expect(contenido(page).getByText("Hemograma completo")).toBeVisible();
        await expect(contenido(page).getByText("Dolor de cabeza persistente")).toHaveCount(0);

        // Se mantiene la sección y se puede volver a ver todo.
        await expect(page).toHaveURL(/seccion=historial/);
        await filtros.getByRole("link", { name: "Todo" }).click();
        await expect(contenido(page).getByText("Dolor de cabeza persistente")).toBeVisible();
    });

    test("la actividad reúne lo registrado en todas las pacientes", async ({ page }) => {
        await page.goto("/mas");
        await contenido(page).getByRole("link", { name: "Actividad" }).click();
        await expect(page).toHaveURL(/\/pro\/actividad$/);
        await expect(page.getByRole("heading", { name: "Actividad" })).toBeVisible();

        // Cada registro dice de quién es y lleva a su ficha.
        const enlace = contenido(page).getByRole("link", { name: /María/ }).first();
        await expect(enlace).toBeVisible();

        const filtros = contenido(page).getByRole("group", { name: "Tipo de registro" });
        await filtros.getByRole("link", { name: "Exámenes" }).click();
        await expect(page).toHaveURL(/tipo=EXAMEN/);
        await expect(contenido(page).getByText("Hemograma completo")).toBeVisible();

        await contenido(page).getByRole("link", { name: /María/ }).first().click();
        await expect(page).toHaveURL(new RegExp(`/pro/pacientes/${MARIA}\\?seccion=examenes`));
    });
});
