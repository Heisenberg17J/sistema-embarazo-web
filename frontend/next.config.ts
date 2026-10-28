import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
