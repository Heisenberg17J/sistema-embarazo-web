import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { USUARIOS, entrar, registrarGestante as registrar, reiniciarBase, salir } from "./ayudas";

const contenido = (page: Page) => page.getByRole("main");

test.describe("Autorización de datos y derechos del titular (Ley 1581)", () => {
    // Estas pruebas crean cuentas y anonimizan una.
    test.beforeAll(() => reiniciarBase());

    test("no se crea la cuenta sin aceptar la política, y al aceptar sí", async ({ page }, info) => {
        const correo = `acepta.${info.project.name}.${Date.now()}@prueba.co`;
        const casilla = await registrar(page, correo, "Lucía");

        // Sin marcar la casilla.
        await expect(casilla).not.toBeChecked();
        await page.getByRole("button", { name: "Crear cuenta" }).click();
        await expect(page.getByText("Debes aceptar la política de tratamiento de datos")).toBeVisible();
        await expect(page).toHaveURL(/\/registro$/);

        // Lo escrito se conserva y la casilla sigue sin marcar: nada se acepta por defecto.
        await expect(page.getByLabel("Nombre").first()).toHaveValue("Lucía");
        await expect(casilla).not.toBeChecked();

        // Tras el error nada de lo escrito se pierde, tampoco las contraseñas.
        const acceso = page.getByRole("group", { name: "Acceso" });
        await expect(acceso.getByLabel(/^Contraseña/)).toHaveValue("Clave1234");

        await casilla.check();
        await page.getByRole("button", { name: "Crear cuenta" }).click();
        await expect(page).toHaveURL(/\/embarazo\/nuevo$/);
    });

    test("la política se lee antes de aceptarla y también con la sesión iniciada", async ({ page }) => {
        // Sin sesión: desde el propio registro.
        await page.goto("/registro");
        const [politica] = await Promise.all([
            page.context().waitForEvent("page"),
            page.getByRole("link", { name: "política de tratamiento de datos" }).click(),
        ]);
        await expect(politica.getByRole("heading", { level: 1 })).toContainText("Política de tratamiento");
        // Mientras sea un borrador sin revisión jurídica, el texto lo dice.
        await expect(politica.getByRole("note")).toContainText("Borrador pendiente de revisión jurídica");
        await politica.close();

        await page.goto("/terminos");
        await expect(page.getByRole("heading", { level: 1 })).toContainText("Términos de uso");
        await expect(contenido(page)).toContainText("llama a la línea de emergencias 123");

        // Con sesión no la redirige al panel: sigue pudiéndose leer.
        await entrar(page, USUARIOS.gestante);
        await page.goto("/politica-de-privacidad");
        await expect(page).toHaveURL(/\/politica-de-privacidad$/);
        await expect(page.getByRole("heading", { level: 1 })).toContainText("Política de tratamiento");
    });

    test("descargar mis datos entrega un archivo con lo propio y sin credenciales", async ({ page }) => {
        await entrar(page, USUARIOS.gestante);
        await page.goto("/perfil");

        const [descarga] = await Promise.all([
            page.waitForEvent("download"),
            page.getByRole("button", { name: "Descargar mis datos" }).click(),
        ]);
        expect(descarga.suggestedFilename()).toMatch(/^mis-datos-\d{4}-\d{2}-\d{2}\.json$/);

        const texto = readFileSync((await descarga.path())!, "utf8");
        const datos = JSON.parse(texto);
        expect(datos.usuario.correo).toBe(USUARIOS.gestante.correo);
        expect(datos.embarazos.length).toBeGreaterThan(0);
        expect(datos.mediciones.length).toBeGreaterThan(0);
        // Nada de otra persona ni ninguna credencial.
        expect(texto).not.toContain(USUARIOS.gestante2.correo);
        expect(texto).not.toMatch(/hash_contrasena|token_hash|\$2[aby]\$/);
    });

    test("pedir la eliminación de la cuenta: el administrador anonimiza y ya no se puede entrar", async ({ page }, info) => {
        const correo = `elimina.${info.project.name}.${Date.now()}@prueba.co`;
        const casilla = await registrar(page, correo, "Marta");
        await casilla.check();
        await page.getByRole("button", { name: "Crear cuenta" }).click();
        await expect(page).toHaveURL(/\/embarazo\/nuevo$/);

        // La gestante pide la eliminación, entendiendo lo que implica.
        await page.goto("/perfil");
        await page.getByRole("button", { name: "Eliminar mi cuenta" }).click();
        const hoja = page.getByRole("dialog");
        await expect(hoja).toContainText("anonimizada");
        await expect(hoja).toContainText("historia clínica no se borra");
        await hoja.getByLabel(/motivo/).fill("Ya no quiero usar el servicio");
        await hoja.getByRole("button", { name: "Enviar la solicitud" }).click();

        await expect(hoja).toBeHidden();
        await expect(contenido(page).getByRole("status")).toContainText("solicitud de eliminación está pendiente");
        // No puede acumular solicitudes: el botón desaparece mientras haya una pendiente.
        await expect(page.getByRole("button", { name: "Eliminar mi cuenta" })).toBeHidden();

        // El administrador la ve destacada en su panel y la atiende.
        await salir(page);
        await entrar(page, USUARIOS.admin);
        await expect(contenido(page)).toContainText("solicitud de supresión de datos");
        await page.goto("/admin/solicitudes");
        const fila = contenido(page).getByRole("listitem").filter({ hasText: "Marta Prueba" });
        await expect(fila).toContainText("Ya no quiero usar el servicio");
        await fila.getByRole("button", { name: "Atender" }).click();

        const atender = page.getByRole("dialog");
        await expect(atender).toContainText("No se puede deshacer");
        await atender.getByRole("button", { name: "Anonimizar la cuenta" }).click();
        await expect(atender).toBeHidden();
        await expect(contenido(page).getByText("Marta Prueba")).toBeHidden();

        // Quedó anonimizada.
        await page.goto("/admin/solicitudes?estado=ATENDIDA");
        await expect(contenido(page)).toContainText("Cuenta anonimizada");

        // La persona ya no puede entrar con sus datos de antes.
        await salir(page);
        await page.goto("/login");
        await page.getByLabel("Correo electrónico").fill(correo);
        await page.getByLabel(/^Contraseña/).fill("Clave1234");
        await page.getByRole("button", { name: "Entrar" }).click();
        await expect(page.locator("form").getByRole("alert")).toContainText("Correo o contraseña incorrectos");
    });

    test("rechazar una solicitud exige explicarle a la persona por qué", async ({ page }, info) => {
        const correo = `rechaza.${info.project.name}.${Date.now()}@prueba.co`;
        const casilla = await registrar(page, correo, "Elena");
        await casilla.check();
        await page.getByRole("button", { name: "Crear cuenta" }).click();
        await expect(page).toHaveURL(/\/embarazo\/nuevo$/);

        await page.goto("/perfil");
        await page.getByRole("button", { name: "Eliminar mi cuenta" }).click();
        await page.getByRole("dialog").getByRole("button", { name: "Enviar la solicitud" }).click();
        await expect(page.getByRole("dialog")).toBeHidden();

        await salir(page);
        await entrar(page, USUARIOS.admin);
        await page.goto("/admin/solicitudes");
        await contenido(page).getByRole("listitem").filter({ hasText: "Elena Prueba" })
            .getByRole("button", { name: "Atender" }).click();

        const atender = page.getByRole("dialog");
        await atender.getByLabel("¿Qué se hace?").selectOption("RECHAZAR");
        await atender.getByRole("button", { name: "Rechazar la solicitud" }).click();
        await expect(atender.getByText("Explica por qué se rechaza")).toBeVisible();

        // Regresión: tras el error, el desplegable debe seguir en "Rechazar". Antes React
        // lo devolvía a "Anonimizar" por detrás y el siguiente envío anonimizaba la cuenta.
        await expect(atender.getByLabel("¿Qué se hace?")).toHaveValue("RECHAZAR");

        await atender.getByLabel(/Respuesta para la persona/).fill("La ley nos obliga a conservar tu historia clínica.");
        await atender.getByRole("button", { name: "Rechazar la solicitud" }).click();
        await expect(atender).toBeHidden();

        // La cuenta sigue intacta y la persona lee la respuesta en su perfil.
        await salir(page);
        await entrar(page, { correo, contrasena: "Clave1234" });
        await page.goto("/perfil");
        await expect(contenido(page)).toContainText("no se pudo atender");
        await expect(contenido(page)).toContainText("La ley nos obliga a conservar tu historia clínica.");
    });
});
