# Qué falta para salir a producción

## Contexto

Las tres fases están terminadas y commiteadas: base de datos (22 tablas, 3 migraciones), API REST que cubre RF-01 a RF-17 y frontend completo para los tres roles. 40 pruebas de backend y 48 de extremo a extremo en verde.

El objetivo acordado es un **piloto controlado**: unas pocas gestantes reales acompañadas por un profesional que conoce el sistema, desplegado en un **servicio gestionado** (Render, Railway o similar) con PostgreSQL administrado.

Eso cambia el listón respecto a una demo. Desde el momento en que una gestante real escribe su presión arterial, el sistema maneja **datos sensibles de salud** y una alerta que no llega tiene consecuencias. Este documento separa lo que impide abrir el piloto de lo que puede esperar.

Todo lo que sigue fue verificado contra el código, no supuesto.

---

## 1. Bloqueantes: no se puede abrir el piloto sin esto

### 1.1 Autorización de tratamiento de datos y política de privacidad

**Estado: no existe nada.** Ni una casilla de aceptación en el registro, ni una política, ni registro de quién aceptó qué y cuándo.

En Colombia los datos de salud son **datos sensibles** (Ley 1581 de 2012 y Decreto 1377 de 2013). Su tratamiento exige autorización previa, expresa e informada, con la finalidad declarada, y garantizar los derechos de consulta, rectificación y supresión. Un piloto con gestantes reales sin esto no debería arrancar.

Qué hace falta:
- Migración `004` que añada a `usuario`: `acepto_terminos_en TIMESTAMPTZ` y `version_politica VARCHAR(20)`, para dejar constancia de qué versión aceptó cada persona.
- Página pública `/politica-de-privacidad` y `/terminos`, con la finalidad del tratamiento, quién es el responsable, cuánto se conservan los datos y cómo ejercer los derechos.
- Casilla obligatoria en `frontend/src/app/(publico)/registro/formulario-registro.tsx`, validada también en `src/acciones/auth.ts` y en el backend.
- `GET /auth/mis-datos`: descarga en JSON de todo lo que el sistema guarda de esa persona (derecho de consulta).
- Flujo de supresión. Ojo: borrar sin más choca con la conservación de la historia clínica. Lo razonable es una solicitud que el administrador atiende, con anonimización en lugar de borrado físico, y dejarlo escrito en la política.

> El texto de la política debería revisarlo alguien con criterio jurídico. Yo puedo redactar el borrador y toda la parte técnica, pero no sustituyo esa revisión.

### 1.2 Validación clínica de los umbrales

**Estado: los umbrales los escribí yo a partir de guías generales de control prenatal.** Están en `db/migrations/002_signos_alarma.sql`: presión ≥140/90 y ≥160/110, FCF fuera de 110-160, glucosa en ayunas ≥95, temperatura ≥38, y catorce signos de alarma.

Son razonables, pero **nadie con responsabilidad clínica los ha aprobado**. En un piloto real, un umbral mal puesto genera o bien falsas alarmas que agotan a la gestante, o bien silencio cuando hacía falta avisar.

Qué hace falta:
- Que el profesional que acompaña el piloto revise y firme cada regla y cada signo de alarma.
- Dejar rastro de esa aprobación: `regla_alerta` ya tiene `creada_por`, pero no `aprobada_por` ni `aprobada_en`. Añadirlos en la migración `004`.
- Revisar también los **textos** que lee la gestante. Hoy dicen "acude de inmediato a urgencias"; quien responde por esa indicación debe estar de acuerdo con ella.

### 1.3 Recuperación de contraseña

**Estado: no existe.** Verificado: no hay ningún endpoint ni pantalla. Una gestante que olvide su contraseña queda fuera hasta que un administrador se la restablezca a mano con `POST /usuarios/:id/restablecer-contrasena`.

En un piloto esto va a pasar en las primeras semanas. Y el administrador tendría que comunicarle la contraseña temporal por un canal inseguro.

Qué hace falta:
- Proveedor de correo (Resend o SendGrid tienen capa gratuita suficiente para un piloto).
- Migración `004`: tabla `recuperacion_contrasena` con `usuario_id`, `token_hash`, `expira_en`, `usado_en`. Mismo patrón que `sesion`: solo se guarda el hash.
- `POST /auth/recuperar` y `POST /auth/restablecer`, con límite de intentos como el del login (`backend/src/modules/auth/routes.js` ya tiene el `rateLimit` listo para copiar) y respuesta siempre idéntica, para no revelar qué correos existen.
- Pantallas `/recuperar` y `/restablecer/[token]`, con el patrón de formulario que ya usan login y registro.

### 1.4 No se pueden corregir los datos clínicos

**Estado: confirmado.** `controles`, `examenes`, `sintomas` y `mediciones` solo tienen `GET` y `POST`. No hay forma de editar ni de borrar, ni en el backend ni en la interfaz.

Esto es más grave de lo que parece. Si la gestante teclea 1680 en vez de 168 en la presión sistólica, el sistema le lanza una alerta crítica que le dice que vaya a urgencias, y **ese dato queda ahí para siempre**, contaminando la gráfica de evolución y la bandeja del profesional. No hay salida.

Qué hace falta:
- `PATCH` y `DELETE` sobre `medicion` y `sintoma` para la gestante, limitados a sus propios registros y a una ventana corta (24 horas) para que no reescriba el historial.
- `PATCH` y `DELETE` sobre `control` y `examen` para el profesional que los registró.
- **Lo importante y lo que hay que decidir con cuidado:** qué pasa con la alerta que ese dato generó. Corregir una medición debe retirar o recalcular su alerta. Propongo un estado nuevo `ANULADA` en `estado_alerta` en lugar de borrarla, para que quede el rastro.
- Todo ello auditado con `registrarAuditoria` (`backend/src/services/auditoria.js`), que ya distingue la acción `MODIFICAR`.

### 1.5 Respaldos probados

**Estado: no hay nada configurado.** El parámetro `backup_frecuencia_horas` existe en la base pero **nadie lo lee** (verificado).

Un servicio gestionado incluye respaldos automáticos, lo cual resuelve la mitad del problema. La otra mitad es que **un respaldo que nunca se restauró no es un respaldo**.

Qué hace falta:
- Activar y documentar la retención del proveedor.
- Probar una restauración completa sobre una base vacía, al menos una vez, y dejar escrito el procedimiento en `db/MODELO.md`.
- Un volcado semanal adicional fuera del proveedor, por si se pierde la cuenta.

### 1.6 Zona horaria

**Estado: riesgo real, no detectado antes.** `docker-compose.yml` fija `TZ: America/Bogota` **solo en el contenedor de PostgreSQL**. El proceso de Node no tiene zona horaria fijada en ninguna parte.

En desarrollo funciona porque la máquina está en hora de Colombia. En un servicio gestionado el servidor casi siempre corre en **UTC**, y entonces `new Date()` en Node y `CURRENT_DATE` en PostgreSQL dejan de coincidir durante cinco horas cada día. Eso rompe, de forma intermitente y difícil de reproducir:

- `fn_semana_gestacion`, que calcula la semana a partir de `CURRENT_DATE`.
- Los `CHECK (fecha <= CURRENT_DATE)` de controles, síntomas y exámenes: un registro hecho a las 8 de la noche sería "del futuro" y se rechazaría.
- Las "citas de hoy" del panel del profesional.
- `hoyLocal()` y `enDias()` en `frontend/src/lib/formato.ts`.

Qué hace falta: fijar `TZ=America/Bogota` como variable de entorno del backend y del frontend en el proveedor, añadirla a los dos `.env.example`, y una prueba que registre un síntoma simulando las 23:00 hora local.

---

## 2. Importantes: afectan el piloto desde el primer día

### 2.1 Las alertas no salen de la aplicación

Hoy una alerta crítica solo existe si alguien abre la app. No hay correo, ni SMS, ni notificación. Verificado: no hay ninguna dependencia de envío en el backend.

El sistema entero gira alrededor de avisar a tiempo, así que esto desdibuja su propósito. Para un piloto hay dos caminos y conviene elegirlo explícitamente:

- **Procedimental:** se acuerda con el profesional que revisa la bandeja al menos dos veces al día, y a la gestante se le explica que la app no sustituye llamar. Cuesta cero y es defendible en un piloto de pocas personas.
- **Técnico:** correo al profesional cuando se genera una alerta crítica, reutilizando el proveedor de correo de la recuperación de contraseña. Es media jornada de trabajo y quita un riesgo real.

Recomiendo el técnico, precisamente porque ya habrá proveedor de correo por el punto 1.3.

### 2.2 Ciclo de vida del embarazo incompleto

El backend ya tiene `PATCH /embarazos/:id` y `PATCH /embarazos/:id/finalizar`, y `POST /embarazos` acepta `gestante_id` para que el profesional registre el de una paciente. **Nada de eso tiene pantalla.**

Consecuencias concretas:
- Una gestante no puede cerrar su embarazo cuando nace el bebé, y como el índice `uq_embarazo_activo` solo permite uno activo, **nunca podrá registrar un embarazo siguiente**.
- Nadie puede corregir una fecha de última menstruación mal escrita, que es lo que determina toda la semana de gestación.
- No se ven los embarazos anteriores, aunque `GET /embarazos` los devuelve y `v_historial_embarazo` los conserva.
- El profesional no puede registrarle el embarazo a una paciente que no se maneja bien con la app.

Qué hace falta: pantalla `/embarazo` para la gestante (ver, editar, finalizar, listar anteriores), el botón de finalizar también en la ficha del profesional, y permitir registrar el embarazo desde `pro/pacientes/[gestanteId]` cuando no haya uno activo.

### 2.3 Pantallas que faltan en los menús

- **La gestante no tiene pantalla de controles.** Solo ve el último en el panel y los demás mezclados en el historial. Es de lo primero que va a buscar después de una consulta.
- **El profesional no tiene vistas generales** de controles, exámenes ni historial: todo está dentro de cada paciente. Para revisar lo que hizo en la semana tiene que entrar paciente por paciente.
- **El historial de la ficha de paciente no se puede filtrar por tipo**, aunque la pantalla de la gestante sí puede. Es desigual sin razón: `frontend/src/components/ui/filtros.tsx` ya está hecho y solo hay que usarlo en `pro/pacientes/[gestanteId]/secciones.tsx`.

### 2.4 La configuración del sistema no hace nada

**Verificado:** `configuracion_sistema` solo se lee y se escribe desde el CRUD del administrador. Ningún otro punto del código la consulta.

El administrador ve una pantalla que promete que puede cambiar cuatro parámetros, y los cuatro son decorativos:

| Parámetro | Qué promete | Qué pasa de verdad |
|---|---|---|
| `semanas_max_gestacion` = 45 | Semana máxima en las validaciones | `embarazos/controller.js` usa `44 * 7` fijo, y los `CHECK` de la base usan 45. Tres sitios, dos valores |
| `dias_recordatorio_cita` = 3 | Destacar la próxima cita | Nadie lo lee |
| `sesion_horas_vigencia` = 8 | Vigencia de la sesión | La vigencia real sale de `JWT_EXPIRA` y `REFRESH_DIAS` del entorno |
| `backup_frecuencia_horas` = 24 | Frecuencia del respaldo | No hay respaldos |

Una pantalla que miente es peor que no tenerla. Hay que elegir: o se leen de verdad (un servicio con caché corta en `backend/src/services/configuracion.js`), o se quitan los que no apliquen y se marca el resto como informativo. Recomiendo leer `semanas_max_gestacion` y `dias_recordatorio_cita`, y sacar los otros dos de la tabla porque pertenecen al entorno y al proveedor.

### 2.5 No se ve nada cuando algo falla

No hay captura de errores, ni logs estructurados, ni aviso de caída. Si la API deja de responder un domingo, nadie se entera hasta que una gestante lo reporte.

Para un piloto basta con poco: Sentry en su capa gratuita para backend y frontend, logs en JSON en lugar de `console.error` suelto (`backend/src/middlewares/errores.js`), y el chequeo de disponibilidad del proveedor apuntando a `/api/v1/salud`, que ya existe y ya comprueba la base de datos.

---

## 3. Deuda menor

- **No se puede cambiar el rol de un usuario.** `esquemaActualizar` en `usuarios/routes.js` no incluye `rol_id`, y es deliberado: cambiar el rol dejaría huérfano el perfil por la clave foránea compuesta `(usuario_id, rol_id)`. Si se quiere permitir, hay que mover el perfil en una transacción. Para un piloto, desactivar y recrear es suficiente, pero conviene que la pantalla lo explique en vez de callarlo.
- **Las sesiones expiradas no se borran nunca** de la tabla `sesion`, ni la auditoría tiene política de retención. Ambas crecen sin fin. Una tarea semanal lo resuelve.
- **Solo hay límite de intentos en el inicio de sesión.** El resto de la API no tiene límite por usuario.
- **El contenido educativo son dos ejemplos.** La pestaña "Aprendizaje" es una de las razones para que la gestante vuelva a abrir la app; con dos entradas de muestra queda vacía. Hay que redactar y revisar contenido real por rango de semanas.
- **La gestante no tiene dónde ver quién es su profesional** ni cómo contactarlo, salvo el nombre en la próxima cita.
- **La accesibilidad no se ha medido.** Los colores sí se verificaron contra AA con un script, pero nunca se pasó axe sobre las pantallas, que era parte del plan original.

---

## 4. Correcciones puntuales

Cuatro cosas pequeñas y concretas, verificadas:

1. **`frontend/.env.example` existe en disco pero no está en git.** El `.gitignore` que genera `create-next-app` trae `.env*`, que se lo traga. Quien clone el repositorio no lo tiene, aunque el README lo mencione. Se arregla con una línea: `!.env.example`.
2. **`arrancar.sh` tiene la espera a PostgreSQL comentada y además rota.** La línea quedó como `#ntil ...`: al comentarla se perdió la `u` de `until`, así que descomentarla tal cual no funcionaría. Sin esa espera, `npm run migrate` corre antes de que la base acepte conexiones y falla en el primer arranque.
3. **El límite de semanas está en tres sitios con dos valores distintos** (ver 2.4).
4. **Las pruebas solo corren en Chrome.** Los dos proyectos de `playwright.config.ts` usan Chromium (`Desktop Chrome` y `Pixel 5`). El RNF-08 pide Firefox y Safari. Añadir `firefox` y `webkit` son cuatro líneas, y WebKit es el que de verdad puede sorprender, porque es el motor del iPhone y es donde el `backdrop-filter` del diseño de vidrio y el `background-attachment: fixed` dan más problemas.

---

## 5. Orden propuesto

**Fase A — Antes de que entre la primera gestante**
Política de privacidad y aceptación (1.1), aprobación clínica de los umbrales (1.2), recuperación de contraseña (1.3), zona horaria (1.6), y las cuatro correcciones puntuales de la sección 4.

**Fase B — Seguridad de los datos y del aviso**
Corrección de datos clínicos con anulación de alertas (1.4), respaldos probados (1.5), correo al profesional ante alerta crítica (2.1), Sentry y logs (2.5).

**Fase C — Completar el producto**
Ciclo de vida del embarazo (2.2), pantallas que faltan (2.3), configuración que de verdad se lea (2.4), contenido educativo real.

**Fase D — Despliegue**
Dockerfiles de backend y frontend, despliegue en el servicio gestionado con variables de entorno y `TRUST_PROXY=true`, HTTPS y dominio, chequeo de disponibilidad, y un flujo de integración continua que corra las 88 pruebas en cada cambio.

**Fase E — Calidad**
Firefox y WebKit en las pruebas, revisión con axe, limpieza de sesiones y auditoría, límite de peticiones general.

Las fases A y B son las que condicionan la fecha de inicio del piloto. La C se puede ir haciendo con el piloto en marcha; la D hay que hacerla antes que todo lo demás si se quiere probar en el entorno real desde temprano.

---

## Verificación

Al cerrar cada fase:

1. `npm test` en `backend/` (40 pruebas) y `npm run test:e2e` en `frontend/` (48) siguen en verde, más las nuevas de cada punto.
2. **Recorrido de extremo a extremo con datos nuevos**, no con las semillas: crear una gestante desde cero, aceptar la política, registrar embarazo, registrar una presión de 165/112, comprobar que llega el aviso a la gestante y el correo al profesional, corregirla a 125/80 y verificar que la alerta queda anulada y desaparece de la gráfica.
3. **Prueba de restauración**: levantar una base vacía desde el último respaldo y comprobar que la app arranca y los datos están completos.
4. **Prueba de zona horaria**: con el servidor en UTC, registrar un síntoma a las 23:00 hora de Colombia y comprobar que queda con la fecha correcta y no lo rechaza el `CHECK`.
5. `npm run typecheck` y `npm run lint` limpios en ambos proyectos.