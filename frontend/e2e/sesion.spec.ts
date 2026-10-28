import { expect, test } from "@playwright/test";
import { USUARIOS, almacenamientoVisible, entrar, salir } from "./ayudas";

test.describe("Sesión y control de acceso", () => {
    test("cada rol entra a su propia pantalla de inicio", async ({ page }) => {
        await entrar(page, USUARIOS.gestante);
        await expect(page).toHaveURL(/\/panel$/);
        await expect(page.getByRole("heading", { level: 1 })).toContainText("María");

        await salir(page);

        await entrar(page, USUARIOS.profesional);
        await expect(page).toHaveURL(/\/pro$/);
        await salir(page);

        await entrar(page, USUARIOS.admin);
        await expect(page).toHaveURL(/\/admin$/);
    });

    test("se cierra la sesión desde el menú del encabezado", async ({ page }) => {
        await entrar(page, USUARIOS.admin);
        await page.getByRole("button", { name: /^Menú de / }).click();
        await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
        await expect(page).toHaveURL(/\/login$/);

        // La sesión quedó cerrada de verdad: lo privado vuelve a pedir acceso.
        await page.goto("/admin");
        await expect(page).toHaveURL(/\/login/);
    });

    test("una ruta protegida sin sesión manda al login y vuelve al destino", async ({
        page,
    }) => {
        await page.goto("/evolucion");
        await expect(page).toHaveURL("/login?siguiente=%2Fevolucion");

        await page.getByLabel("Correo electrónico").fill(USUARIOS.gestante.correo);
        await page.getByLabel(/^Contraseña/).fill(USUARIOS.gestante.contrasena);
        await page.getByRole("button", { name: "Entrar" }).click();
        await expect(page).toHaveURL(/\/evolucion$/);
    });

    test("credenciales incorrectas muestran un error sin revelar si el correo existe", async ({
        page,
    }) => {
        await page.goto("/login");
        await page.getByLabel("Correo electrónico").fill(USUARIOS.gestante.correo);
        await page.getByLabel(/^Contraseña/).fill("Equivocada1");
        await page.getByRole("button", { name: "Entrar" }).click();

        const error = page.locator("form").getByRole("alert");
        await expect(error).toContainText("Correo o contraseña incorrectos");

        // El correo se conserva.
        await expect(page.getByLabel("Correo electrónico")).toHaveValue(
            USUARIOS.gestante.correo,
        );

        await page.getByLabel("Correo electrónico").fill("noexiste@ejemplo.co");
        await page.getByLabel(/^Contraseña/).fill("Equivocada1");
        await page.getByRole("button", { name: "Entrar" }).click();
        await expect(error).toContainText("Correo o contraseña incorrectos");
    });

    test("el registro conserva lo escrito cuando hay un error de validación", async ({
        page,
    }) => {
        await page.goto("/registro");

        // Los campos se localizan por su sección: "Nombre" existe también en
        // el contacto de emergencia.
        const datos = page.getByRole("group", { name: "Tus datos" });
        const acceso = page.getByRole("group", { name: "Acceso" });
        const contacto = page.getByRole("group", { name: "Contacto y salud" });

        await datos.getByLabel("Nombre").fill("Ana");
        await datos.getByLabel("Apellido").fill("Suárez");
        await datos.getByLabel("Número de documento").fill("1098765432");
        await datos.getByLabel("Fecha de nacimiento").fill("1994-07-12");
        await acceso.getByLabel("Correo electrónico").fill("ana.suarez@ejemplo.co");
        await contacto.getByLabel("EPS").fill("Sanitas");

        // Contraseñas que no coinciden: debe fallar la validación.
        await acceso.getByLabel(/^Contraseña/).fill("Clave1234");
        await acceso.getByLabel("Repetir contraseña").fill("Clave9999");
        await page.getByRole("button", { name: "Crear cuenta" }).click();

        await expect(page.locator("form").getByRole("alert").first()).toContainText(
            "Revisa los datos marcados",
        );
        await expect(page).toHaveURL(/\/registro$/);

        // Nada de lo escrito se pierde.
        await expect(datos.getByLabel("Nombre")).toHaveValue("Ana");
        await expect(datos.getByLabel("Apellido")).toHaveValue("Suárez");
        await expect(datos.getByLabel("Número de documento")).toHaveValue("1098765432");
        await expect(datos.getByLabel("Fecha de nacimiento")).toHaveValue("1994-07-12");
        await expect(acceso.getByLabel("Correo electrónico")).toHaveValue(
            "ana.suarez@ejemplo.co",
        );
        await expect(contacto.getByLabel("EPS")).toHaveValue("Sanitas");

        // Las contraseñas también se conservan: volver a escribirlas tras cada error es un castigo.
        await expect(acceso.getByLabel(/^Contraseña/)).toHaveValue("Clave1234");
    });

    test("el token de sesión no queda al alcance del JavaScript (RNF-03)", async ({
        page,
    }) => {
        await entrar(page, USUARIOS.gestante);
        const visible = await almacenamientoVisible(page);

        // Las cookies del token son httpOnly: no aparecen en document.cookie.
        expect(visible.cookies).not.toContain("se_acceso");
        expect(visible.cookies).not.toContain("se_refresh");

        // Ningún JWT (cabecera.carga.firma) en cookies ni almacenamiento.
        const jwt = /eyJ[\w-]+\.eyJ[\w-]+\./;
        expect(visible.cookies).not.toMatch(jwt);
        expect(visible.local).not.toMatch(jwt);
        expect(visible.sesion).not.toMatch(jwt);

        // La única cookie legible lleva solo datos para pintar la interfaz.
        const legible = JSON.parse(
            Buffer.from(
                decodeURIComponent(visible.cookies).split("se_sesion=")[1],
                "base64url",
            ).toString(),
        );
        expect(Object.keys(legible).sort()).toEqual([
            "apellido",
            "cambio",
            "id",
            "nombre",
            "rol",
        ]);
    });

    test("una gestante no entra a las pantallas de otros roles", async ({ page }) => {
        await entrar(page, USUARIOS.gestante);

        for (const ruta of ["/admin", "/admin/usuarios", "/pro", "/pro/pacientes"]) {
            await page.goto(ruta);
            await expect(page).toHaveURL(/\/panel$/);
        }
    });

    test("un profesional no entra a las pantallas de la gestante ni del administrador", async ({
        page,
    }) => {
        await entrar(page, USUARIOS.profesional);

        for (const ruta of ["/panel", "/evolucion", "/admin"]) {
            await page.goto(ruta);
            await expect(page).toHaveURL(/\/pro$/);
        }
    });
});
