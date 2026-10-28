# Despliegue y puesta en producción

Guía para publicar el **piloto controlado** (pocas gestantes reales acompañadas por un profesional) en un servicio gestionado con PostgreSQL administrado (Render, Railway o equivalente). Todo lo de aquí se probó localmente; lo que depende de la cuenta del proveedor se marca como tal.

## Piezas

| Pieza | Imagen | Puerto | Salud |
|---|---|---|---|
| API (Node 20 + Express) | `backend/Dockerfile` (contexto: raíz del repo) | 4000 | `GET /api/v1/salud` (responde 503 si la base no contesta) |
| Web (Next.js 15) | `frontend/Dockerfile` (contexto: `frontend/`) | 3000 | `GET /login` |
| Base de datos | PostgreSQL 16 administrado | 5432 | — |

```bash
docker build -f backend/Dockerfile -t embarazo-api .
docker build --build-arg API_URL=https://api.tu-dominio.com/api/v1 -t embarazo-web frontend
```

La web llama a la API **desde su servidor** (las cookies `httpOnly` nunca dejan pasar el token al navegador), así que `API_URL` puede ser una dirección interna del proveedor. Pásala **al construir y al ejecutar** con el mismo valor: el middleware de Next puede incrustarla en la compilación.

## Variables de entorno

### API

| Variable | Valor | Notas |
|---|---|---|
| `NODE_ENV` | `production` | Impide `db:reset`. **Nunca `test`**: desactiva los límites de intentos |
| `PORT` | `4000` | |
| `APP_TZ` | `America/Bogota` | Entre las 7 p. m. y la medianoche "hoy" sería ya "mañana" si el servidor corre en UTC |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | los de la base administrada | |
| `DB_SSL` | `true` | La mayoría de los proveedores lo exigen |
| `JWT_SECRET` | 48+ bytes aleatorios | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Si cambia, se cierran todas las sesiones |
| `JWT_EXPIRA` `REFRESH_DIAS` | `15m` / `7` | `REFRESH_DIAS` debe ser igual en la web |
| `CORS_ORIGIN` | URL pública de la web | Varias separadas por coma |
| `TRUST_PROXY` | `true` | Detrás del proxy del proveedor; sin esto la IP registrada es la del proxy |
| `APP_URL` | URL pública de la web | Los correos enlazan a ella |
| `RESEND_API_KEY` `CORREO_REMITENTE` | de Resend | **Verifica un dominio propio**: con el remitente de prueba solo puedes escribirte a ti mismo |

### Web

| Variable | Valor |
|---|---|
| `API_URL` | URL de la API incluyendo `/api/v1` (también como *build arg*) |
| `REFRESH_DIAS` | igual que en la API |
| `APP_TZ` | `America/Bogota` |

## Primer despliegue

1. Crea la base administrada y **activa sus respaldos automáticos** (ver abajo).
2. Despliega la API con su comando de *release*/*pre-deploy*: `node scripts/migrate.js`. Las migraciones **no** corren al arrancar, para que varias réplicas no compitan.
3. **No cargues `db/seeds.sql`**: trae usuarios de prueba con contraseñas conocidas. Crea el primer administrador:
   ```bash
   ADMIN_CORREO=ana@tu-dominio.com ADMIN_NOMBRE=Ana ADMIN_APELLIDO=Pérez node scripts/crear-admin.js
   ```
   Muestra una contraseña temporal una sola vez; la cuenta debe cambiarla al entrar. (Con `ADMIN_CONTRASENA` puedes fijar la tuya.)
4. Despliega la web.
5. Apunta el chequeo de disponibilidad del proveedor a `/api/v1/salud` y activa el aviso por correo si falla.
6. Programa `node scripts/limpiar.js` una vez por semana (cron del proveedor): quita sesiones y enlaces de recuperación vencidos.
7. HTTPS lo termina el proveedor; asegúrate de que la web solo se sirva por HTTPS (las cookies de sesión lo requieren en producción).

## Respaldos (RNF-13)

Un respaldo que nunca se restauró no es un respaldo.

- **Del proveedor:** activa la retención automática (en la mayoría de los planes de pago; el gratuito de algunos no la incluye, y entonces el piloto no debe abrirse). Anota cuántos días conserva y cómo se restaura desde su panel.
- **Propio, fuera del proveedor** (por si se pierde la cuenta): una vez por semana, desde una máquina que **no** sea la del proveedor:
  ```bash
  PGHOST=… PGPORT=… PGUSER=… PGPASSWORD=… PGDATABASE=… ./db/respaldo.sh /ruta/segura
  ```
  Verifica que el archivo se pueda leer y lo guarda con permisos solo del dueño. **Contiene datos de salud: guárdalo cifrado.**
- **Restaurar** en una base vacía:
  ```bash
  PGHOST=… PGUSER=… PGPASSWORD=… PGDATABASE=base_nueva ./db/restaurar.sh respaldo-AAAAMMDD-HHMMSS.dump
  ```
  Se niega a hacerlo si la base ya tiene el esquema. Después: `node scripts/migrate.js` no debe aplicar nada, y la API debe arrancar y dejar iniciar sesión.

**Probado el 2026-10-28** con la base de desarrollo: respaldo, restauración en un PostgreSQL 16 vacío, 24 tablas y 86 filas idénticas, 7 migraciones registradas, API arrancada contra la copia con inicio de sesión correcto. **Falta** hacer lo mismo con el respaldo real del proveedor antes del piloto.

## Integración continua

`.github/workflows/ci.yml` corre en cada push y pull request: pruebas de la API (PostgreSQL 16 como servicio), tipos y lint del frontend, compilación, pruebas de extremo a extremo y de accesibilidad en Chrome, Firefox y WebKit (escritorio y móvil), y la construcción de las dos imágenes. Si falla una prueba e2e, sube `test-results` y el registro de la API como artefacto.

## Antes de abrir el piloto: lo que NO es código

Estas cosas las tiene que hacer una persona; el sistema las deja listas pero no las puede decidir.

- [ ] **Revisión jurídica de la política de privacidad y los términos** (`frontend/src/lib/politica.ts`). Completar responsable, correo de contacto y plazos, y solo entonces poner `borrador: false`. Mientras sea borrador, las páginas lo dicen.
- [ ] **Aprobación clínica**: un profesional revisa y aprueba cada regla de alerta y cada signo de alarma en `/pro/revision-clinica`, incluidos los textos que lee la gestante ("acude de inmediato a urgencias"). Quien responde por esa indicación debe estar de acuerdo con ella.
- [ ] **Dominio verificado en Resend**, y probar de verdad un correo de recuperación y uno de alerta crítica.
- [ ] **Menores de edad**: el registro admite tarjeta de identidad. Para una adolescente, la autorización debe darla su representante legal; hay que decidir cómo se obtiene.
- [ ] **Restauración real** del respaldo del proveedor (ver arriba).
- [ ] **Contenido educativo real** redactado y revisado por un profesional, por rango de semanas (hoy hay dos entradas de muestra).
- [ ] **Acordar el procedimiento de alertas**: aunque el profesional recibe un correo por cada alerta crítica, define con él cada cuánto revisa la bandeja y explica a las gestantes que la app no sustituye llamar o ir a urgencias.
- [ ] **Plazo de conservación de la auditoría**: la tabla es inmutable; decidir cuánto se conserva y cómo se archiva es una decisión legal.
- [ ] **Captura de errores** (Sentry u otra): no está implementada. Hoy hay registros JSON de la API y el chequeo `/salud`, pero nadie recibe un aviso automático si algo se rompe.
