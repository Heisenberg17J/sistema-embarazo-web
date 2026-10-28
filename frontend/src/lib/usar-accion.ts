"use client";

import { startTransition, useActionState, type FormEvent } from "react";

/**
 * Envía un formulario a una Server Action SIN que React lo restablezca después.
 *
 * Con `<form action={accion}>`, React 19 restablece el formulario cuando la
 * acción termina, también si falló. Un `<select>` o una casilla vuelven en el
 * DOM a su valor inicial mientras el estado de React sigue diciendo otra cosa:
 * la pantalla muestra "Rechazar la solicitud" y el siguiente envío manda
 * "Anonimizar la cuenta". Eso ya ocurrió en una acción irreversible.
 *
 * Aquí se envía por `onSubmit`: no hay restablecimiento, los campos conservan
 * lo que la persona eligió y lo que muestra la pantalla es lo que se envía.
 *
 *     const [estado, enviar, enviando] = useAccion(miAccion, {});
 *     <form onSubmit={enviar}> …
 *
 * Todos los formularios con estado de la app deben usar este hook en lugar de
 * `useActionState` + `<form action>`. Los de un solo botón sin estado (cerrar
 * sesión) pueden seguir con `action`.
 */
export function useAccion<E>(
    accion: (previo: E, datos: FormData) => Promise<E>,
    inicial: E,
) {
    // Los estados de los formularios son objetos planos (nunca promesas), así que
    // Awaited<E> es E; TypeScript no lo puede deducir para un genérico.
    const [estado, despachar, enviando] = useActionState(
        accion as (previo: Awaited<E>, datos: FormData) => Promise<Awaited<E>>,
        inicial as Awaited<E>,
    );

    const enviar = (evento: FormEvent<HTMLFormElement>) => {
        evento.preventDefault();
        // El botón que envió el formulario aporta su propio nombre y valor.
        const remitente = (evento.nativeEvent as SubmitEvent).submitter;
        const datos = new FormData(evento.currentTarget, remitente);
        // Fuera de la prop `action`, el despacho debe ir dentro de una transición.
        startTransition(() => despachar(datos));
    };

    return [estado as E, enviar, enviando] as const;
}
