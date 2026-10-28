import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Imagen de Docker mínima: con NEXT_OUTPUT=standalone (lo fija el Dockerfile), `next build`
    // deja en .next/standalone el servidor con lo justo. En local no se activa: `next start`
    // no funciona con esa salida.
    output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
    outputFileTracingRoot: __dirname,
    // El repositorio tiene varios package-lock.json (raíz, backend, frontend);
    // esto le dice a Turbopack cuál es la raíz de este proyecto.
    turbopack: { root: __dirname },
    // Cabeceras de seguridad para una app con datos de salud (RNF-03, RNF-04).
    async headers() {
        return [
            {
                source: "/:ruta*",
                headers: [
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "same-origin" },
                    { key: "X-Frame-Options", value: "DENY" },
                    {
                        key: "Permissions-Policy",
                        value: "camera=(), microphone=(), geolocation=()",
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
