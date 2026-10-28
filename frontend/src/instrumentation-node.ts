/**
 * Parte de `instrumentation.ts` que usa APIs de Node (`process.stderr`).
 *
 * Va en un módulo aparte, cargado solo cuando el runtime es Node, porque
 * `instrumentation.ts` también se empaqueta para el runtime Edge (el del
 * middleware), donde esas APIs no existen.
 */

/**
 * Fija la zona horaria del proceso. Las fechas con hora que llegan de la API
 * (el momento de una alerta, de una cita) se formatean en el servidor, así que
 * en un alojamiento que corre en UTC se mostrarían cinco horas corridas.
 */
export function fijarZonaHoraria() {
    process.env.TZ = process.env.APP_TZ || "America/Bogota";
}

/**
 * Registra un error de renderizado en JSON, con el mismo `digest` que ve la
 * persona en pantalla ("Código del error").
 *
 * En producción Next oculta el mensaje real al navegador y solo muestra el
 * `digest`; sin esto, el error verdadero no quedaría en ninguna parte. No se
 * registran cabeceras, cookies ni cuerpos: contienen la sesión y datos de
 * salud. La ruta va sin cadena de consulta.
 */
export function registrarErrorDePagina(
    error: unknown,
    request: { path: string; method: string },
    context: { routerKind: string; routePath: string; routeType: string },
) {
    const e = error as Error & { digest?: string };
    process.stderr.write(
        `${JSON.stringify({
            ts: new Date().toISOString(),
            nivel: "error",
            msg: "error al generar una página",
            digest: e.digest,
            metodo: request.method,
            ruta: request.path.split("?")[0],
            tipo: context.routeType,
            error: e.message,
            pila: e.stack,
        })}\n`,
    );
}
