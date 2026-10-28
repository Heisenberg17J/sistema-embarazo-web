import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { MARCA } from "@/lib/marca";
import "./globals.css";

// Inter para el texto y Fraunces (serif) para títulos y cifras grandes,
// igual que el mockup de referencia.
const inter = Inter({
    subsets: ["latin"],
    variable: "--fuente-inter",
    display: "swap",
});

const fraunces = Fraunces({
    subsets: ["latin"],
    variable: "--fuente-fraunces",
    display: "swap",
    axes: ["SOFT", "WONK", "opsz"],
});

export const metadata: Metadata = {
    title: { default: MARCA.nombre, template: `%s · ${MARCA.nombre}` },
    description: MARCA.descripcion,
    applicationName: MARCA.nombre,
    robots: { index: false, follow: false }, // app privada con datos de salud
};

export const viewport: Viewport = {
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#e6e4f5" },
        { media: "(prefers-color-scheme: dark)", color: "#1b1a2b" },
    ],
    width: "device-width",
    initialScale: 1,
};

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="es" suppressHydrationWarning>
            {/* Extensiones como Grammarly añaden atributos al <body> antes de que
                React hidrate; esto solo ignora los atributos de este elemento. */}
            <body
                suppressHydrationWarning
                className={`${inter.variable} ${fraunces.variable} app-backdrop min-h-dvh antialiased`}
            >
                {children}
            </body>
        </html>
    );
}
