import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas de extremo a extremo.
 *
 * Requieren el backend corriendo en el puerto 4000, preferiblemente con
 * NODE_ENV=test para que no aplique el límite de intentos de inicio de sesión.
 *
 * Antes de empezar, `e2e/preparar.ts` reinicia la base con los datos de prueba,
 * así que la suite es repetible. Las pruebas escriben datos reales: NO deben
 * correr contra una base con información de verdad.
 */
export default defineConfig({
    testDir: "./e2e",
    globalSetup: "./e2e/preparar.ts",
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [["list"]],
    use: {
        baseURL: process.env.BASE_URL ?? "http://localhost:3000",
        locale: "es-CO",
        timezoneId: "America/Bogota",
        trace: "retain-on-failure",
    },
    projects: [
        { name: "escritorio", use: { ...devices["Desktop Chrome"] } },
        { name: "movil", use: { ...devices["Pixel 5"] } },
    ],
    webServer: {
        command: "npm start",
        url: "http://localhost:3000/login",
        reuseExistingServer: true,
        timeout: 120_000,
    },
});
