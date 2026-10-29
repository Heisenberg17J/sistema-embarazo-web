import { Logo } from "@/components/layout/logo";
import { PieDescargo } from "@/components/layout/pie-descargo";
import { MARCA } from "@/lib/marca";

/**
 * Pantallas sin sesión: login, registro y recuperación.
 * En escritorio, un panel ilustrado a la izquierda y el formulario a la
 * derecha; en móvil, una cabecera compacta con la ilustración y el formulario
 * debajo. El panel es decorativo: el único texto real es el lema.
 */
export default function LayoutPublico({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            {/* Escritorio: panel a toda la altura que acompaña al desplazamiento. */}
            <aside className="hidden p-4 lg:block">
                <div className="panel-colinas sticky top-4 flex h-[calc(100dvh-2rem)] flex-col items-center justify-between rounded-3xl px-10 pb-6 pt-14 text-center">
                    <div className="max-w-sm">
                        <p className="font-display text-3xl font-semibold leading-tight text-balance text-foreground xl:text-4xl">
                            Acompañándote en cada etapa de esta hermosa aventura
                        </p>
                        <p className="mt-3 text-sm font-medium text-muted-foreground">
                            {MARCA.nombre}
                        </p>
                    </div>
                    <span
                        aria-hidden
                        className="ilustracion-color w-full max-w-[22rem] max-h-[52dvh]"
                    />
                </div>
            </aside>

            <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-6 lg:py-8">
                <main className="w-full max-w-md">
                    {/* Móvil: cabecera compacta con la ilustración a la derecha. */}
                    <div className="panel-colinas mb-4 flex h-[6.75rem] items-center justify-between gap-3 rounded-3xl pl-4 pr-3 lg:hidden">
                        <Logo />
                        <span
                            aria-hidden
                            className="ilustracion-color h-[5.75rem] shrink-0"
                        />
                    </div>
                    <div className="mb-6 hidden justify-center lg:flex">
                        <Logo />
                    </div>
                    {children}
                </main>
                <PieDescargo className="mt-6" />
            </div>
        </div>
    );
}
