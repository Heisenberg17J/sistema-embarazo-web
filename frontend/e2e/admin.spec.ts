import { expect, test, type Page } from "@playwright/test";
import { USUARIOS, entrar, reiniciarBase, salir } from "./ayudas";

/** Identificadores de los datos de prueba (`db/seeds.sql`). */
const DIANA = 5; // gestante sin profesional asignado

const contenido = (page: Page) => page.getByRole("main");

/** Cierra la hoja de un diálogo; al cerrarse, la lista se refresca. */
async function cerrarHoja(page: Page) {
    await page.getByRole("dialog").getByRole("button", { name: "Cerrar" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
}

test.describe("Pantallas del administrador", () => {
    // Estas pruebas crean usuarios, asignaciones, contenido y reglas.
    test.beforeAll(() => reiniciarBase());

    test.beforeEach(async ({ page }) => {
        await entrar(page, USUARIOS.admin);
    });

    test("las estadísticas resumen el sistema y llevan a lo pendiente (RF-17)", async ({
        page,
    }) => {
        await expect(page).toHaveURL(/\/admin$/);
        await expect(contenido(page).getByText("Usuarios por rol")).toBeVisible();

        await contenido(page)
            .getByRole("link", { name: /Gestantes sin profesional/ })
            .click();
        await expect(page).toHaveURL(/\/admin\/asignaciones$/);
    });

    test("crea un profesional con contraseña temporal que debe cambiar (RF-14)", async ({
        page,
    }, info) => {
        const correo = `nuevo.${info.project.name}@seguimiento.co`;
        await page.goto("/admin/usuarios");
        await page.getByRole("button", { name: "Crear usuario" }).click();

        const hoja = page.getByRole("dialog");
        await hoja.getByLabel("Rol").selectOption("PROFESIONAL");
        await hoja.getByLabel("Nombre").fill("Julián");
        await hoja.getByLabel("Apellido").fill("Rojas");
        // Un correo ya registrado: el error no borra lo escrito.
        await hoja.getByLabel("Correo electrónico").fill(USUARIOS.profesional.correo);
        await hoja.getByLabel("Contraseña temporal").fill("Temporal2026");
        await hoja.getByLabel("Registro profesional").fill(`RP-${info.project.name}`);
        await hoja.getByLabel("Especialidad").fill("Medicina general");
        await hoja.getByRole("button", { name: "Crear cuenta" }).click();

        await expect(hoja.getByRole("alert")).toContainText("ya está registrado");
        await expect(hoja.getByLabel("Especialidad")).toHaveValue("Medicina general");

        await hoja.getByLabel("Correo electrónico").fill(correo);
        await hoja.getByLabel("Contraseña temporal").fill("Temporal2026");
        await hoja.getByRole("button", { name: "Crear cuenta" }).click();
        await expect(hoja.getByRole("status")).toContainText("Julián Rojas");

        // Al entrar, lo primero es cambiar la contraseña temporal.
        await salir(page);
        await entrar(page, { correo, contrasena: "Temporal2026" });
        await expect(page).toHaveURL(/\/cambiar-contrasena/);
    });

    test("asignar una gestante le da acceso al profesional y finalizar se lo quita (RF-15)", async ({
        page,
    }) => {
        await page.goto("/admin/asignaciones");
        const pendientes = contenido(page)
            .getByRole("listitem")
            .filter({ hasText: "Diana Cruz" });
        await pendientes.getByRole("button", { name: "Asignar" }).click();

        const hoja = page.getByRole("dialog");
        await expect(hoja.getByLabel("Gestante")).toHaveValue(String(DIANA));
        await hoja.getByLabel("Profesional").selectOption({ label: "Ana Duarte" });
        await hoja.getByRole("button", { name: "Asignar" }).click();
        await expect(hoja.getByRole("status")).toContainText("Ana Duarte");
        await cerrarHoja(page);

        await expect(page.getByText("Gestantes sin profesional")).toBeHidden();

        await salir(page);
        await entrar(page, USUARIOS.profesional2);
        await page.goto("/pro/pacientes");
        await expect(contenido(page).getByText("Diana Cruz")).toBeVisible();

        // Se finaliza y la profesional deja de verla.
        await salir(page);
        await entrar(page, USUARIOS.admin);
        await page.goto("/admin/asignaciones");
        await contenido(page)
            .getByRole("listitem")
            .filter({ hasText: "Ana Duarte" })
            .getByRole("button", { name: "Finalizar" })
            .click();
        await page.getByRole("dialog").getByRole("button", { name: "Finalizar" }).click();
        await expect(page.getByText("Gestantes sin profesional")).toBeVisible();

        await salir(page);
        await entrar(page, USUARIOS.profesional2);
        await page.goto(`/pro/pacientes/${DIANA}`);
        await expect(page.getByText("Esta página no existe")).toBeVisible();
    });

    test("una cuenta desactivada no puede entrar hasta reactivarla (RF-14)", async ({
        page,
    }) => {
        await page.goto(`/admin/usuarios/${DIANA}`);
        await page.getByRole("button", { name: "Desactivar" }).click();
        await page.getByRole("dialog").getByRole("button", { name: "Desactivar" }).click();
        await expect(contenido(page).getByText("Desactivada")).toBeVisible();

        await salir(page);
        await page.goto("/login");
        await page.getByLabel("Correo electrónico").fill(USUARIOS.gestante2.correo);
        await page.getByLabel(/^Contraseña/).fill(USUARIOS.gestante2.contrasena);
        await page.getByRole("button", { name: "Entrar" }).click();
        await expect(page.locator("form").getByRole("alert")).toContainText("desactivada");

        await entrar(page, USUARIOS.admin);
        await page.goto(`/admin/usuarios/${DIANA}`);
        await page.getByRole("button", { name: "Reactivar" }).click();
        await page.getByRole("dialog").getByRole("button", { name: "Reactivar" }).click();
        await expect(contenido(page).getByText("Activa", { exact: true })).toBeVisible();
    });

    test("el contenido publicado le llega a la gestante de esa semana (RF-16)", async ({
        page,
    }, info) => {
        const titulo = `Movimientos fetales (${info.project.name})`;
        await page.goto("/admin/contenido");
        await page.getByRole("button", { name: "Nuevo contenido" }).click();

        const hoja = page.getByRole("dialog");
        await hoja.getByLabel("Título").fill(titulo);
        await hoja.getByLabel("Desde la semana").fill("25");
        await hoja.getByLabel("Hasta la semana").fill("10");
        await hoja.getByRole("textbox", { name: /^Contenido/ }).fill("Cuenta los movimientos cada día.");
        await hoja.getByRole("button", { name: "Guardar" }).click();
        await expect(hoja.getByText("Debe ser igual o posterior")).toBeVisible();

        // Sin publicar: queda como borrador.
        await hoja.getByLabel("Desde la semana").fill("0");
        await hoja.getByLabel("Hasta la semana").fill("45");
        await hoja.getByRole("button", { name: "Guardar" }).click();
        await expect(hoja.getByRole("status")).toContainText("borrador");
        await cerrarHoja(page);

        const fila = contenido(page).getByRole("listitem").filter({ hasText: titulo });
        await expect(fila.getByText("Borrador")).toBeVisible();
        await fila.getByRole("button", { name: "Publicar" }).click();
        await expect(fila.getByText("Publicado")).toBeVisible();

        await salir(page);
        await entrar(page, USUARIOS.gestante);
        await page.goto("/aprendizaje");
        await expect(contenido(page).getByText(titulo).first()).toBeVisible();
    });

    test("un síntoma nuevo marcado como signo de alarma exige su mensaje", async ({
        page,
    }, info) => {
        await page.goto("/admin/catalogos?seccion=tipos-sintoma");
        await page.getByRole("button", { name: "Agregar" }).click();

        const hoja = page.getByRole("dialog");
        await hoja.getByLabel("Código").fill(`PRURITO_${info.project.name.toUpperCase()}`);
        await hoja.getByLabel("Nombre").fill(`Picazón intensa (${info.project.name})`);
        await hoja.getByLabel("Es un signo de alarma").check();
        await hoja.getByRole("button", { name: "Guardar" }).click();
        await expect(hoja.getByText("Escribe lo que verá la gestante")).toBeVisible();

        await hoja
            .getByLabel("Mensaje para la gestante")
            .fill("Picazón intensa en manos y pies: consulta hoy con tu profesional.");
        await hoja.getByRole("button", { name: "Guardar" }).click();
        await expect(hoja.getByRole("status")).toContainText("guardado");
    });

    test("ajustar una regla cambia el umbral de la alerta (RF-11)", async ({ page }) => {
        await page.goto("/admin/reglas-alerta");
        const regla = contenido(page)
            .getByRole("listitem")
            .filter({ hasText: "PAS_ELEVADA" });
        await regla.getByRole("button", { name: "Editar" }).click();

        const hoja = page.getByRole("dialog");
        await hoja.getByLabel(/Valor de referencia/).fill("135");
        await hoja.getByRole("button", { name: "Guardar regla" }).click();
        await expect(hoja.getByRole("status")).toContainText("PAS_ELEVADA");
        await cerrarHoja(page);

        await expect(regla.getByText("≥ 135 mmHg")).toBeVisible();

        // La acción queda en la auditoría.
        await page.goto("/admin/auditoria?accion=MODIFICAR");
        await expect(contenido(page).getByText("Regla de alerta").first()).toBeVisible();
    });

    test("cambiar un parámetro queda guardado", async ({ page }) => {
        await page.goto("/admin/configuracion");
        const fila = contenido(page)
            .getByRole("listitem")
            .filter({ hasText: "dias_recordatorio_cita" });
        await fila.getByLabel(/Valor de/).fill("5");
        await fila.getByRole("button", { name: "Guardar" }).click();
        await expect(fila.getByRole("button", { name: "Guardado" })).toBeVisible();

        await page.reload();
        await expect(fila.getByLabel(/Valor de/)).toHaveValue("5");
    });

    test("un valor fuera de rango se rechaza y los parámetros del entorno no aparecen", async ({
        page,
    }) => {
        await page.goto("/admin/configuracion");
        await expect(contenido(page).getByText("sesion_horas_vigencia")).toHaveCount(0);
        await expect(contenido(page).getByText("backup_frecuencia_horas")).toHaveCount(0);

        const fila = contenido(page)
            .getByRole("listitem")
            .filter({ hasText: "semanas_max_gestacion" });
        await fila.getByLabel(/Valor de/).fill("60");
        await fila.getByRole("button", { name: "Guardar" }).click();
        await expect(fila.locator("[role=alert]").filter({ hasText: /entre 38 y 45/ })).toBeVisible();
    });

    test("los días de aviso configurados destacan la próxima cita de la gestante", async ({
        page,
    }) => {
        // La cita de prueba es dentro de 7 días: con 10 de aviso se destaca.
        await page.goto("/admin/configuracion");
        const fila = contenido(page)
            .getByRole("listitem")
            .filter({ hasText: "dias_recordatorio_cita" });
        await fila.getByLabel(/Valor de/).fill("10");
        await fila.getByRole("button", { name: "Guardar" }).click();
        await expect(fila.getByRole("button", { name: "Guardado" })).toBeVisible();

        await salir(page);
        await entrar(page, USUARIOS.gestante);
        await expect(page.getByRole("main").getByText("Faltan 7 días")).toBeVisible();
    });
});
