import { expect, test, type Page } from "@playwright/test";
import { USUARIOS, entrar, reiniciarBase, salir } from "./ayudas";

const contenido = (page: Page) => page.getByRole("main");
const MARIA = 4;

/** Registra una presión desde el panel y descarta el aviso crítico si aparece. */
async function registrarPresion(page: Page, sistolica: number, diastolica: number) {
    await page.goto("/panel");
    await page.getByRole("button", { name: "Medición" }).click();
    const hoja = page.getByRole("dialog");
    await hoja.getByLabel("Sistólica").fill(String(sistolica));
    await hoja.getByLabel("Diastólica").fill(String(diastolica));
    await hoja.getByRole("button", { name: "Guardar medición" }).click();

    const aviso = page.getByRole("alertdialog");
    if (sistolica >= 160 || diastolica >= 110) {
        await expect(aviso).toBeVisible();
        await aviso.getByRole("button", { name: "Entendido" }).click();
        await expect(aviso).toBeHidden();
    } else {
        // Puede haber además avisos de advertencia: se comprueba el de confirmación.
        await expect(hoja.getByRole("status").first()).toContainText("registrada");
    }
}

test.describe("Corrección de datos clínicos", () => {
    // Estas pruebas registran, corrigen y eliminan datos de las cuentas del seed.
    test.beforeAll(() => reiniciarBase());

    test("corregir una presión crítica anula su alerta, que sigue visible para ambas", async ({ page }) => {
        await entrar(page, USUARIOS.gestante);
        await registrarPresion(page, 168, 114);

        await page.goto("/evolucion");
        const fila = contenido(page).getByRole("listitem").filter({ hasText: "Presión arterial sistólica: 168" });
        await expect(fila).toBeVisible();
        await fila.getByRole("button", { name: "Corregir" }).click();

        const hoja = page.getByRole("dialog");
        await hoja.getByLabel(/Valor correcto/).fill("118");
        await hoja.getByRole("button", { name: "Guardar corrección" }).click();
        await expect(hoja).toBeHidden();

        // El valor cambió y ya no hay una lectura crítica en pantalla.
        await expect(contenido(page).getByRole("listitem").filter({ hasText: "Presión arterial sistólica: 118" })).toBeVisible();

        // La alerta NO desapareció: está anulada, con el motivo.
        await page.goto("/alertas?estado=ANULADA");
        const anulada = contenido(page).getByRole("article").filter({ hasText: /corrigió de 168 a 118/ });
        await expect(anulada).toBeVisible();
        await expect(anulada).toContainText("Anulada");

        // El profesional también la ve, como historia y no como algo pendiente.
        await salir(page);
        await entrar(page, USUARIOS.profesional);
        await page.goto("/pro/alertas?estado=ANULADA");
        await expect(contenido(page).getByRole("article").filter({ hasText: /corrigió de 168 a 118/ })).toBeVisible();
        await page.goto("/pro/alertas");
        await expect(contenido(page).getByText(/corrigió de 168 a 118/)).toBeHidden();
    });

    test("un valor corregido que sigue siendo crítico vuelve a mostrar el aviso de urgencias", async ({ page }) => {
        await entrar(page, USUARIOS.gestante);
        await registrarPresion(page, 150, 95);

        await page.goto("/evolucion");
        await contenido(page).getByRole("listitem").filter({ hasText: "Presión arterial sistólica: 150" })
            .getByRole("button", { name: "Corregir" }).click();
        await page.getByRole("dialog").getByLabel(/Valor correcto/).fill("175");
        await page.getByRole("dialog").getByRole("button", { name: "Guardar corrección" }).click();

        // Corregir no es una forma de silenciar un aviso.
        const aviso = page.getByRole("alertdialog");
        await expect(aviso).toBeVisible();
        await expect(aviso).toContainText("Atención inmediata");
        await aviso.getByRole("button", { name: "Entendido" }).click();
        await expect(aviso).toBeHidden();
    });

    test("un valor fuera del rango técnico no se acepta al corregir", async ({ page }) => {
        await entrar(page, USUARIOS.gestante);
        await registrarPresion(page, 120, 80);

        await page.goto("/evolucion");
        await contenido(page).getByRole("listitem").filter({ hasText: "Presión arterial sistólica: 120" })
            .getByRole("button", { name: "Corregir" }).first().click();
        const hoja = page.getByRole("dialog");
        await hoja.getByLabel(/Valor correcto/).fill("900");
        await hoja.getByRole("button", { name: "Guardar corrección" }).click();
        await expect(hoja.getByRole("alert")).toContainText("fuera del rango técnico");
    });

    test("eliminar un registro lo quita de la gráfica y de la lista", async ({ page }) => {
        await entrar(page, USUARIOS.gestante);
        await page.goto("/panel");
        await page.getByRole("button", { name: "Medición" }).click();
        const hoja = page.getByRole("dialog");
        await hoja.getByLabel("¿Qué quieres registrar?").selectOption("PESO");
        await hoja.getByLabel(/^Valor en kg/).fill("73.3");
        await hoja.getByRole("button", { name: "Guardar medición" }).click();
        await expect(hoja.getByRole("status")).toContainText("registrada");
        await page.keyboard.press("Escape");

        await page.goto("/evolucion");
        const fila = contenido(page).getByRole("listitem").filter({ hasText: "Peso corporal: 73.3" });
        await expect(fila).toBeVisible();
        await fila.getByRole("button", { name: "Eliminar" }).click();

        const confirmar = page.getByRole("dialog");
        // Se explica qué pasa con las alertas: no se borran.
        await expect(confirmar).toContainText("no se borran");
        await confirmar.getByRole("button", { name: "Sí, eliminar" }).click();
        await expect(confirmar).toBeHidden();
        await expect(contenido(page).getByRole("listitem").filter({ hasText: "Peso corporal: 73.3" })).toBeHidden();
    });

    test("un síntoma de alarma mal elegido se corrige y deja de ser una urgencia", async ({ page }) => {
        await entrar(page, USUARIOS.gestante);
        await page.goto("/panel");
        await page.getByRole("button", { name: "Síntoma" }).click();
        const hoja = page.getByRole("dialog");
        await hoja.getByLabel("¿Qué está sintiendo?").selectOption("SANGRADO");
        await hoja.getByRole("button", { name: "Guardar síntoma" }).click();
        const aviso = page.getByRole("alertdialog");
        await expect(aviso).toBeVisible();
        await aviso.getByRole("button", { name: "Entendido" }).click();

        await page.goto("/sintomas");
        const fila = contenido(page).getByRole("listitem").filter({ hasText: "Sangrado" }).first();
        await expect(fila).toContainText("Atención inmediata");
        await fila.getByRole("button", { name: "Corregir" }).click();

        const corregir = page.getByRole("dialog");
        await corregir.getByLabel("¿Qué estabas sintiendo?").selectOption("NAUSEAS");
        await corregir.getByRole("button", { name: "Guardar corrección" }).click();

        // Ya no es una urgencia: no aparece el aviso a pantalla completa.
        await expect(page.getByRole("alertdialog")).toBeHidden();
        await expect(corregir).toBeHidden();
        const corregida = contenido(page).getByRole("listitem").filter({ hasText: "Náuseas" }).first();
        await expect(corregida).toBeVisible();
        await expect(corregida).not.toContainText("Atención inmediata");
    });

    test("el profesional corrige un control, debe decir por qué, y la alerta queda anulada", async ({ page }) => {
        await entrar(page, USUARIOS.profesional);
        await page.goto(`/pro/pacientes/${MARIA}`);

        // Un control con una frecuencia cardiaca fetal que dispara una alerta crítica.
        await page.getByRole("button", { name: "Registrar control" }).click();
        const nuevo = page.getByRole("dialog");
        await nuevo.getByRole("spinbutton", { name: /Frecuencia cardiaca fetal/ }).fill("92");
        await nuevo.getByLabel("Observaciones").fill("Control para corregir en la prueba");
        await nuevo.getByRole("button", { name: "Guardar control" }).click();
        await expect(nuevo).toContainText("Atención inmediata");
        await page.keyboard.press("Escape");

        await page.goto(`/pro/pacientes/${MARIA}?seccion=controles`);
        const control = contenido(page).getByRole("listitem").filter({ hasText: "Control para corregir en la prueba" });
        await control.getByRole("button", { name: "Corregir" }).click();

        const hoja = page.getByRole("dialog");
        await hoja.getByLabel(/Frecuencia cardiaca fetal/).fill("141");

        // Sin motivo no se guarda: es un registro clínico.
        await hoja.getByRole("button", { name: "Guardar corrección" }).click();
        await expect(hoja.getByText("Indica por qué corriges este control")).toBeVisible();

        await hoja.getByLabel(/¿Por qué se corrige\?/).fill("Error al transcribir el monitoreo");
        await hoja.getByRole("button", { name: "Guardar corrección" }).click();
        await expect(hoja.getByRole("status")).toContainText("Control corregido");
        await page.keyboard.press("Escape");

        await expect(
            contenido(page).getByRole("listitem").filter({ hasText: "Control para corregir en la prueba" }),
        ).toContainText("141");

        // La alerta crítica de 92 sigue en la ficha, anulada y con su motivo.
        await page.goto(`/pro/pacientes/${MARIA}?seccion=alertas`);
        const anulada = contenido(page).getByRole("article").filter({ hasText: /corrigió de 92 a 141/ });
        await expect(anulada).toBeVisible();
        await expect(anulada).toContainText("Anulada");
    });

    test("eliminar un examen exige motivo y la paciente deja de verlo", async ({ page }) => {
        await entrar(page, USUARIOS.profesional);
        await page.goto(`/pro/pacientes/${MARIA}?seccion=examenes`);
        const fila = contenido(page).getByRole("listitem").filter({ hasText: "Hemoglobina" });
        await expect(fila).toBeVisible();
        await fila.getByRole("button", { name: "Eliminar" }).click();

        const hoja = page.getByRole("dialog");
        await hoja.getByRole("button", { name: "Sí, eliminar" }).click();
        await expect(hoja.getByText("Indica por qué se elimina")).toBeVisible();

        await hoja.getByLabel(/Motivo/).fill("Se registró en la paciente equivocada");
        await hoja.getByRole("button", { name: "Sí, eliminar" }).click();
        await expect(hoja).toBeHidden();
        await expect(contenido(page).getByText("Hemoglobina")).toBeHidden();

        await salir(page);
        await entrar(page, USUARIOS.gestante);
        await page.goto("/examenes");
        await expect(contenido(page).getByText("Hemoglobina")).toBeHidden();
    });

    test("la gestante no ve opciones para corregir lo que registró el profesional", async ({ page }) => {
        await entrar(page, USUARIOS.gestante);
        await page.goto("/evolucion");
        // Las mediciones del control de los datos de prueba las tomó el profesional.
        const deConsulta = contenido(page).getByRole("listitem").filter({ hasText: "tomada en consulta" });
        await expect(deConsulta.first()).toBeVisible();
        await expect(deConsulta.getByRole("button", { name: "Corregir" })).toHaveCount(0);
    });
});
