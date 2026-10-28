# Frontend · Seguimiento del Embarazo

Interfaz web en **Next.js 15 (App Router) + React 19 + Tailwind v4 + TypeScript**. Consume la API de [`backend/`](../backend/README.md).

> El nombre de la app está en un solo archivo: [`src/lib/marca.ts`](src/lib/marca.ts). Cuando se decida el nombre definitivo del producto, se cambia ahí y queda aplicado en el encabezado, el título de las pestañas y el pie.

## Puesta en marcha

```bash
# 1. Base de datos y API (desde la raíz del repositorio)
docker compose up -d
cd backend && npm install && npm run db:reset && npm run dev   # puerto 4000

# 2. Frontend
cd frontend
cp .env.example .env.local
npm install
npm run dev                                                     # puerto 3000
```

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en el puerto 3000 |
| `npm run build` / `npm start` | Compila y sirve la versión de producción |
| `npm run typecheck` | Comprueba los tipos |
| `npm run test:e2e` | 22 pruebas de extremo a extremo (Playwright), en escritorio y móvil |
| `npm run lint` | ESLint |

Las pruebas necesitan la API en el puerto 4000 con los datos de `db/seeds.sql`, y conviene arrancarla con `NODE_ENV=test` para que no aplique el límite de intentos de inicio de sesión. **Registran datos reales: no las ejecute contra una base con información de verdad.**

Usuarios de prueba: `maria.gomez@correo.co` / `Gest*2026`, `cmejia@seguimiento.co` / `Prof*2026`, `admin@seguimiento.co` / `Admin*2026`.

Para ver cómo quedan las pantallas: `npx playwright test e2e/capturas.spec.ts` deja las imágenes en `e2e/capturas/`.

## Autenticación: el token nunca llega al navegador

El backend emite un token de acceso de 15 minutos y un refresh token. El frontend los guarda en **cookies httpOnly**, de modo que el JavaScript de la página no puede leerlos: si algún día hubiera un fallo de XSS, no se llevaría la sesión ni los datos clínicos (RNF-03).

- Las **Server Actions** (`src/acciones/`) hacen el login, el registro y todas las escrituras. Son las únicas que fijan cookies.
- Las lecturas van por `src/lib/api.ts`, que corre en el servidor de Next y añade el token desde la cookie. Como las peticiones salen del servidor y no del navegador, CORS no interviene.
- `src/middleware.ts` es el **único sitio** que renueva el token, antes de que corra cualquier página. También aplica el guardián de rutas por rol y obliga a cambiar la contraseña temporal.
- Existe una tercera cookie, `se_sesion`, que **sí** es legible: solo lleva rol y nombre para pintar el encabezado. No es una frontera de seguridad; la autoridad es el token firmado que verifica el backend.

Hay una prueba que lo comprueba: no debe aparecer ningún JWT en `document.cookie`, `localStorage` ni `sessionStorage`.

## Sistema de diseño

Los tokens salen del mockup de referencia y viven en [`src/app/globals.css`](src/app/globals.css): fondo degradado lavanda → rosa → crema, tarjetas de vidrio translúcido (`.glass`, `.glass-soft`), esquinas de 24 px, **Fraunces** para títulos y cifras e **Inter** para el texto.

Tres decisiones que el mockup no resolvía:

1. **Escala de severidad.** El mockup tiene un solo color de alerta; el backend devuelve tres severidades. `CRITICA` va en coral, `ADVERTENCIA` en ámbar e `INFORMATIVA` en el azul de marca ([`src/lib/severidad.ts`](src/lib/severidad.ts)). El color nunca va solo: cada alerta lleva icono y etiqueta de texto.
2. **Navegación móvil.** Barra inferior de pestañas, al alcance del pulgar, porque la gestante usa la app de pie y con una mano. En escritorio, pestañas en el encabezado.
3. **Aviso de atención inmediata.** Cuando la API marca una alerta con `accion_inmediata` (un signo de alarma o una presión severa), se abre un panel a pantalla completa con el mensaje y, si lo tiene registrado, un botón para llamar a su contacto de emergencia. No se cierra tocando fuera ni con Escape: cerrarlo por accidente sin leerlo sería grave.

### Accesibilidad

El vidrio translúcido y el gris claro son el riesgo de este diseño en una app que usan personas con distinta experiencia tecnológica, a veces con malestar o prisa. Por eso:

- Todos los colores de texto se verificaron contra **AA 4.5:1** sobre las superficies de vidrio; los del mockup que no llegaban se oscurecieron (`--muted-foreground`, `--brand-deep`, `--primary`).
- Hay alternativa opaca para `prefers-reduced-transparency` y se respeta `prefers-reduced-motion`.
- Cada campo tiene etiqueta visible (nunca solo el *placeholder*), con su error asociado por `aria-describedby`.
- Objetivos táctiles de 44 px y registrar una medición o un síntoma siempre está a un toque desde el panel.
- Las barras de evolución tienen su equivalente en texto para lectores de pantalla.

### Formularios

React 19 limpia los campos no controlados cuando termina una acción. Para que un error de validación no borre un formulario largo, las acciones devuelven en `valores` lo que la usuaria había escrito y los campos se repintan desde ahí. Las contraseñas nunca se devuelven.

## Estructura

```
src/
  app/
    (publico)/      login, registro
    (privado)/      layout con sesión + todas las pantallas con marco de app
    cambiar-contrasena/   fuera de (privado): es la salida del bloqueo por contraseña temporal
  acciones/         Server Actions: auth, registros (medición/síntoma), embarazo
  components/
    ui/             boton, tarjeta, campo, dialogo, insignia, vacio…
    layout/         encabezado, navegación por rol, pie con el descargo
    paneles/        anillo de gestación, alertas, mini evolución, aviso crítico
    formularios/    diálogos de medición y síntoma
  lib/              api, datos, sesión, formato, severidad, umbrales, marca
e2e/                pruebas de extremo a extremo y generador de capturas
```

## Estado de las pantallas

| Rol | Listas | Pendientes |
|---|---|---|
| Público | Login, registro de gestante, cambio de contraseña | — |
| Gestante | **Completo**: panel, registrar embarazo, citas, evolución, síntomas, exámenes, historial, alertas, aprendizaje y su detalle, perfil, menú "Más", aviso de atención inmediata | — |
| Profesional | — | Pacientes, ficha de paciente, agenda, bandeja de alertas |
| Administrador | — | Estadísticas, usuarios, asignaciones, catálogos, reglas, contenido, auditoría, configuración |

Las pantallas pendientes existen como marcadores navegables que enumeran lo que va a contener cada una, para que la navegación funcione mientras se construyen.

## Dos cosas que conviene saber al tocar este código

**Las Server Actions no llaman a `revalidatePath`.** Hacerlo desde dentro de una acción remonta el componente que la invocó y borra su estado: el aviso de atención inmediata y los mensajes de confirmación nunca llegaban a verse. En su lugar, el cliente pide `router.refresh()` cuando ya mostró el resultado. Como el cliente de la API usa `no-store`, no hay caché de servidor que invalidar.

**Los filtros llevan un valor explícito en la URL** (`?tipo=todos` en lugar de quitar el parámetro) y las listas filtrables suspenden solo la lista, no la página entera. Con `loading.tsx` a nivel de ruta, cambiar de filtro desmontaba la barra de filtros y se perdía la pulsación siguiente.
