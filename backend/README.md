# Backend · API de Seguimiento del Embarazo

API REST en **Node.js 20 + Express + PostgreSQL 16**. Implementa los requisitos RF-01 a RF-17 del [README principal](../README.md) sobre el modelo de datos de [`db/`](../db/MODELO.md).

> Las alertas que genera el sistema son **informativas**: orientan a la gestante a consultar o acudir a urgencias, pero **no son un diagnóstico**.

## Puesta en marcha

```bash
# 1. Base de datos (desde la raíz del repositorio)
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env          # completar DB_PASSWORD y JWT_SECRET
npm install
npm run db:reset              # BORRA y recrea el esquema + datos de prueba (solo desarrollo)
npm run dev                   # http://localhost:4000/api/v1
```

En producción, usar `npm run migrate`, que solo aplica las migraciones pendientes y nunca borra datos.

| Script | Qué hace |
|---|---|
| `npm run dev` / `npm start` | Levanta la API |
| `npm run migrate` | Aplica las migraciones pendientes de `db/migrations/` (tabla `public.schema_migraciones`) |
| `npm run seed` | Carga `db/seeds.sql` |
| `npm run db:reset` | Borra el esquema, migra y carga los seeds (bloqueado en `NODE_ENV=production`) |
| `npm test` | 40 pruebas de integración contra PostgreSQL real (base `seguimiento_embarazo_test`, se recrea en cada corrida) |

Para las pruebas se usa `TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_USER`, `TEST_DB_PASSWORD` y `TEST_DB_NAME`. Por defecto apuntan al contenedor de `docker compose`.

### Usuarios de prueba (`db/seeds.sql`)

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@seguimiento.co | `Admin*2026` |
| Profesional | cmejia@seguimiento.co | `Prof*2026` |
| Profesional | aduarte@seguimiento.co | `Prof*2026` |
| Gestante | maria.gomez@correo.co | `Gest*2026` |

## Arquitectura (RNF-11)

```
src/
  app.js, server.js
  config/        env.js (valida variables al arrancar), db.js (pool + transacciones)
  middlewares/   auth (JWT) · roles · acceso (privacidad) · validar (zod) · errores
  services/      alertas (motor de reglas) · auditoria · mediciones · embarazo · usuarios
  modules/<recurso>/  routes.js (rutas + validación) y controller.js (lógica + SQL)
scripts/migrate.js
tests/
```

## Seguridad y privacidad

- **Contraseñas (RNF-01):** se guardan con bcrypt (costo 12) y la política mínima es de 8 caracteres con letras y números. El hash nunca aparece en una respuesta.
- **Sesión (RF-02):** el JWT de acceso dura 15 min. El refresh token es opaco y rota en cada uso; en la tabla `sesion` solo se guarda su hash SHA-256. Cerrar sesión, cambiar la contraseña o desactivar la cuenta revoca las sesiones.
- **Roles (RNF-02):** `GESTANTE`, `PROFESIONAL` y `ADMINISTRADOR`. El registro público solo crea gestantes. Los demás usuarios los crea el administrador con una contraseña temporal, que deben cambiar antes de usar el sistema.
- **Privacidad (RNF-03):** cada ruta `/embarazos/:id/...` verifica que la gestante sea la dueña o que el profesional tenga una **asignación activa**. Si no hay permiso, responde `404` para no revelar que el recurso existe. El administrador solo ve estadísticas agregadas y no tiene acceso a datos clínicos individuales.
- **Validación (RNF-10):** zod en la API y `CHECK`/triggers en la BD. Los errores de PostgreSQL se traducen a mensajes legibles sin exponer detalles internos.
- **Auditoría (RNF-14):** queda registro de los inicios de sesión (incluidos los fallidos), de las creaciones y modificaciones y de la consulta de historias clínicas. La tabla `auditoria` es de solo inserción: un trigger bloquea UPDATE y DELETE.
- **Otros:** helmet, CORS restringido a `CORS_ORIGIN`, rate limit en login y registro, y límite de 100 KB por cuerpo.

## Motor de alertas (RF-11)

Corre en la **misma transacción** en que se registra el dato, así que nunca queda un valor peligroso sin su alerta.

- **Mediciones:** se evalúan las reglas de `regla_alerta` activas para ese tipo y semana. Si se cumplen varias, se emite solo la más severa. Las reglas base son:

  | Regla | Condición | Severidad |
  |---|---|---|
  | PAS_SEVERA / PAD_SEVERA | ≥160 / ≥110 mmHg | CRITICA: acudir a urgencias |
  | PAS_ELEVADA / PAD_ELEVADA | ≥140 / ≥90 mmHg | ADVERTENCIA |
  | PAS_BAJA | <90 mmHg | ADVERTENCIA |
  | FCF_FUERA_RANGO | fuera de 110-160 lpm (sem ≥20) | CRITICA |
  | GLUCOSA_AYUNAS_ALTA | ≥95 mg/dL | ADVERTENCIA |
  | FIEBRE | ≥38 °C | ADVERTENCIA |

- **Síntomas:** los **signos de alarma** obstétricos generan una alerta inmediata. Son: sangrado, salida de líquido, contracciones antes de la semana 37, dolor de cabeza intenso, visión borrosa, dolor en la boca del estómago, disminución de los movimientos fetales, convulsión, dolor abdominal intenso, dificultad para respirar, hinchazón súbita, fiebre, vómito persistente y ardor al orinar. Cualquier otro síntoma con intensidad 4 o más genera una ADVERTENCIA.
- La respuesta incluye `accion_inmediata: true` en las alertas CRITICA, para que el frontend muestre el aviso de forma destacada.

El administrador puede ajustar los umbrales en `/catalogos/reglas-alerta` y los signos en `/catalogos/tipos-sintoma`.

## Endpoints (`/api/v1`)

Todas las rutas, salvo `auth/registro`, `auth/login`, `auth/refresh` y `salud`, requieren `Authorization: Bearer <access_token>`.
Los listados paginados aceptan `?page=&limit=` (máximo 100) y responden `{ datos, paginacion }`.

### Autenticación y cuenta
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/auth/registro` | público | Registro de gestante con su perfil (RF-01) |
| POST | `/auth/login` | público | Devuelve `access_token`, `refresh_token` y el usuario |
| POST | `/auth/refresh` | público | Rota el refresh token |
| POST | `/auth/logout` | todos | Revoca el refresh token |
| GET | `/auth/me` | todos | Usuario y perfil |
| PATCH | `/auth/contrasena` | todos | Cambiar la contraseña (obligatorio si es temporal) |
| PATCH | `/auth/perfil` | todos | Datos de contacto, grupo sanguíneo y contacto de emergencia |

### Administración
| Método | Ruta | Descripción |
|---|---|---|
| GET/POST | `/usuarios` | Listar (`?rol&activo&q`) y crear usuarios de cualquier rol (RF-14) |
| GET/PATCH | `/usuarios/:id` | Consultar y editar el usuario y su perfil |
| PATCH | `/usuarios/:id/estado` | Activar o desactivar `{ activo }` |
| POST | `/usuarios/:id/restablecer-contrasena` | Asigna una contraseña temporal |
| GET/POST | `/asignaciones` | Asignar profesional ↔ gestante (RF-15) |
| PATCH | `/asignaciones/:id/finalizar` | Termina la asignación; el profesional pierde el acceso |
| GET/PATCH | `/admin/configuracion[/:clave]` | Parámetros del sistema |
| GET | `/admin/auditoria` | Bitácora (`?usuario_id&accion&entidad&desde&hasta`) |

### Embarazo y seguimiento (gestante dueña o profesional asignado)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/embarazos` | Registrar embarazo (`fecha_inicio`=FUM; si no se envía la FPP, se calcula FUM+280) (RF-04) |
| GET | `/embarazos/actual` | Embarazo activo de la gestante: semana, `21+3`, trimestre, días para el parto, IMC y ganancia de peso |
| GET | `/embarazos?gestante_id=` | Embarazos actuales y anteriores |
| GET/PATCH | `/embarazos/:id` | Resumen y edición |
| PATCH | `/embarazos/:id/finalizar` | `FINALIZADO` o `CANCELADO`; cancela las citas pendientes |
| GET/POST | `/embarazos/:id/controles` | Control prenatal con mediciones (solo el profesional crea) (RF-05) |
| GET/POST | `/embarazos/:id/mediciones` | Registrar `{ mediciones: [{ tipo, valor }] }` y listar |
| GET | `/embarazos/:id/mediciones/serie?tipos=PESO,PA_SISTOLICA` | Series para gráficas con umbrales de referencia (RF-10) |
| GET/POST | `/embarazos/:id/sintomas` | Síntomas (la gestante crea) (RF-06) |
| GET/POST | `/embarazos/:id/citas` | `?ambito=proximas\|anteriores`; el profesional programa (RF-07) |
| GET/POST | `/embarazos/:id/examenes` | Resultados de exámenes (el profesional crea) (RF-08) |
| GET | `/embarazos/:id/alertas` | Alertas del embarazo |
| GET | `/embarazos/:id/historial` | Historial cronológico (`?tipo=CONTROL,SINTOMA,...`) (RF-09) |

### Agenda, alertas y pacientes
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/citas` | gestante, profesional | Agenda propia (`?desde&hasta&estado`) |
| PATCH | `/citas/:id` | profesional | Reprogramar |
| PATCH | `/citas/:id/estado` | ambos | `CUMPLIDA`, `NO_ASISTIO` o `CANCELADA` (con motivo); la gestante solo puede cancelar |
| GET | `/alertas` | gestante, profesional | Alertas propias o de las pacientes asignadas, críticas primero (RF-12) |
| PATCH | `/alertas/:id/revisar` | profesional | `REVISADA` o `DESCARTADA` con observación |
| GET | `/pacientes` | profesional | Pacientes asignadas con semana, alertas y próxima cita (RF-13) |
| GET | `/pacientes/:gestanteId` | profesional | Perfil y embarazos de la paciente |

### Catálogos, contenido y panel
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/catalogos/{tipos-control,tipos-examen,tipos-sintoma,tipos-medicion}` | Catálogos activos (el administrador puede pedir `?todos=true`) |
| POST/PATCH | `/catalogos/<catalogo>[/:id]` | Solo administrador; se desactivan con `activo:false` |
| GET/POST/PATCH | `/catalogos/reglas-alerta[/:id]` | Umbrales de alerta |
| GET | `/contenido/mi-semana` | Contenido para la semana actual de la gestante (RF-16) |
| GET | `/contenido[/:id]` | Contenido publicado (el administrador ve también los borradores) |
| POST | `/contenido/:id/leido` | Marcar como leído |
| POST/PATCH/DELETE | `/contenido[/:id]` | Gestión por el administrador |
| GET | `/dashboard` | Panel según el rol (RF-17) |
| GET | `/salud` | Estado de la API y de la BD |

### Códigos de respuesta
`200`/`201` éxito · `400` datos inválidos (con `detalles: [{ campo, mensaje }]`) · `401` sin sesión · `403` rol no autorizado · `404` no existe o no tiene acceso · `409` conflicto (duplicado o estado no válido) · `422` regla de negocio o clínica · `500` error interno.

## Pendiente fuera del alcance de esta fase

- Respaldos automáticos (RNF-13): programar `pg_dump` en el servidor de despliegue.
- HTTPS (RNF-04): se configura en el proxy o plataforma de despliegue (`TRUST_PROXY=true`).
- Notificaciones por correo/SMS de alertas críticas y recuperación de contraseña por correo.
