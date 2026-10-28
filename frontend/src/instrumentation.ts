/**
 * Se ejecuta una vez al arrancar el servidor de Next. Lo que usa APIs de Node
 * vive en `instrumentation-node.ts`: este archivo también se empaqueta para Edge.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { fijarZonaHoraria } = await import("./instrumentation-node");
        fijarZonaHoraria();
    }
}

/** Next la llama cuando falla el renderizado de una página o una acción. */
export async function onRequestError(
    error: unknown,
    request: { path: string; method: string },
    context: { routerKind: string; routePath: string; routeType: string },
) {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { registrarErrorDePagina } = await import("./instrumentation-node");
        registrarErrorDePagina(error, request, context);
    }
}
