import { Logo } from "@/components/layout/logo";
import { PieDescargo } from "@/components/layout/pie-descargo";

/** Pantallas sin sesión: login y registro. Tarjeta centrada sobre el degradado. */
export default function LayoutPublico({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-8">
            <main className="w-full max-w-md">
                <div className="mb-6 flex justify-center">
                    <Logo />
                </div>
                {children}
            </main>
            <PieDescargo className="mt-6" />
        </div>
    );
}
