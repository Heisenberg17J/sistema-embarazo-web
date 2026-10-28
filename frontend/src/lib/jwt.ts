/**
 * Lee el contenido de un JWT SIN verificar la firma.
 *
 * Solo se usa para decidir si conviene renovar el token y para orientar la
 * navegación. La autoridad real es el backend, que sí verifica la firma en cada
 * petición: si alguien manipulara el token, la API responderá 401 o 403.
 */
export interface PayloadToken {
    sub: number;
    rol: "GESTANTE" | "PROFESIONAL" | "ADMINISTRADOR";
    exp: number;
}

export const leerPayload = (token: string | undefined): PayloadToken | null => {
    if (!token) return null;
    const partes = token.split(".");
    if (partes.length !== 3) return null;
    try {
        const json = atob(partes[1].replace(/-/g, "+").replace(/_/g, "/"));
        const payload = JSON.parse(json) as PayloadToken;
        return typeof payload.exp === "number" ? payload : null;
    } catch {
        return null;
    }
};

/** true si al token le queda menos del margen indicado (30 s por defecto). */
export const porExpirar = (token: string | undefined, margenSeg = 30) => {
    const payload = leerPayload(token);
    if (!payload) return true;
    return payload.exp * 1000 - Date.now() < margenSeg * 1000;
};
