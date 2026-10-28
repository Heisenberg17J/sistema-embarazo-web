# Modelo de datos · Sistema Web de Seguimiento del Embarazo

Motor: **PostgreSQL 14+** · Esquema: `seguimiento_embarazo` · **22 tablas**
Validado sobre PostgreSQL 16 aplicando `migrations/001_esquema.sql`, `migrations/002_signos_alarma.sql` y `seeds.sql`.

Las migraciones se aplican en orden con `cd backend && npm run migrate`, que las registra en `public.schema_migraciones`.
Todo cambio nuevo va en un archivo `00N_descripcion.sql`; nunca se editan las migraciones ya aplicadas.

## Capas del modelo

| Capa | Tablas | Propósito |
|---|---|---|
| Seguridad e identidad | `rol`, `usuario`, `perfil_gestante`, `perfil_profesional`, `sesion`, `asignacion` | Autenticación (RF-01, RF-02), roles (RF-03) y la asignación que habilita el acceso clínico (RF-15, RNF-03) |
| Catálogos | `tipo_control`, `tipo_medicion`, `tipo_sintoma`, `tipo_examen` | Dominios extensibles sin cambiar el código (RNF-12) |
| Seguimiento | `embarazo`, `cita`, `control`, `medicion`, `sintoma`, `examen` | Núcleo de RF-04 a RF-10 |
| Alertas | `regla_alerta`, `alerta` | Reglas parametrizables y alertas generadas (RF-11, RF-12) |
| Soporte | `contenido_educativo`, `contenido_lectura`, `auditoria`, `configuracion_sistema` | RF-16, RNF-14 y parámetros globales |

## Decisiones de diseño

1. **Herencia por especialización.** `usuario` guarda la identidad común y `perfil_gestante` / `perfil_profesional` los atributos propios de cada rol. La FK compuesta `(usuario_id, rol_id)` contra `usuario(id, rol_id)`, más un `CHECK (rol_id = 1|2)`, impide a nivel de motor que un administrador tenga perfil de gestante.
2. **`asignacion` como relación N:M.** Es la precondición de todo acceso del profesional a los datos de una gestante. Un índice único parcial (`WHERE activa`) evita asignaciones activas duplicadas y conserva el histórico.
3. **`medicion` separada de `control`.** El README permite que tanto la gestante como el profesional registren peso y presión arterial. Se modela una serie temporal con `tipo_medicion_id`, `origen` y `control_id` opcional: alimenta las gráficas (RF-10) y el motor de alertas (RF-11) con una sola estructura, y agregar una variable nueva es una fila de catálogo, no una columna.
4. **Alertas parametrizables.** `regla_alerta` guarda operador, umbrales y ventana de semanas; `alerta` guarda el valor detectado y el ciclo de vida PENDIENTE → REVISADA/DESCARTADA. La regla se conserva con `ON DELETE RESTRICT` para no perder la trazabilidad de las alertas ya emitidas.
5. **Borrado en cascada acotado.** Los datos de una gestante caen en cascada desde `embarazo`; las referencias a catálogos y a profesionales usan `RESTRICT` o `SET NULL` para no perder histórico clínico.
6. **Signos de alarma (migración 002).** Una alerta nace de **una medición** (regla + valor) **o de un síntoma** (`sintoma_id`), y `ck_alerta_origen` exige exactamente uno de los dos. `tipo_sintoma.es_signo_alarma`, junto con `severidad`, `mensaje_alarma` y `alarma_hasta_semana`, marca los signos de alarma obstétricos (sangrado, salida de líquido, visión borrosa, cefalea intensa, disminución de movimientos fetales, contracciones antes de la semana 37, etc.). Las reglas clínicas base (PA ≥140/90 y ≥160/110, FCF 110-160, glucosa en ayunas ≥95, temperatura ≥38) vienen precargadas con `creada_por` NULL.

## Restricciones destacadas

- `uq_embarazo_activo`: índice único parcial, un solo embarazo `ACTIVO` por gestante (RF-04).
- `uq_cita_agenda`: índice único parcial, un profesional no puede tener dos citas vigentes a la misma fecha y hora (RF-07).
- `ck_alerta_revision`: `estado = REVISADA` exige revisor y fecha de revisión; `PENDIENTE` exige que ambos sean nulos.
- `ck_embarazo_fpp`: la fecha probable de parto debe ser posterior a la FUM y no exceder 320 días.
- `ck_usuario_hash` y el índice `uq_usuario_correo_lower`: nunca se guarda texto plano (RNF-01) y el correo es único sin importar mayúsculas (RF-01).
- Trigger `tg_medicion_rango`: valida cada valor contra el rango técnico de su tipo y contra el permiso de registro de la gestante (RNF-10).
- Trigger `tg_auditoria_inmutable`: la auditoría es de solo inserción; bloquea UPDATE y DELETE (salvo el `SET NULL` de la FK de usuario) (RNF-14).
- `ck_embarazo_talla`, `ck_embarazo_peso` y `ck_gestante_grupo`: rangos de talla, peso pregestacional y grupo sanguíneo válidos.

## Funciones y vistas

- `fn_semana_gestacion(fecha_inicio, fecha)`: semana calculada, nunca almacenada como dato maestro (RF-04).
- `fn_edad_gestacional_texto(fecha_inicio, fecha)`: edad gestacional en formato clínico `semanas+días` (p. ej. `21+3`).
- `fn_set_actualizado_en()`: mantiene `actualizado_en` en las tablas mutables.
- `v_historial_embarazo`: historial cronológico unificado de controles, síntomas, exámenes, citas y alertas (RF-09).
- `v_pacientes_profesional`: pacientes vigentes por profesional, con semana, edad gestacional, alertas pendientes y críticas, y próxima cita (RF-13).
- `v_embarazo_actual`: estado, semana, edad gestacional, trimestre y días para el parto de cada embarazo.

## Archivos

- `migrations/001_esquema.sql`: creación completa (tipos, tablas, restricciones, índices, triggers, vistas y catálogos iniciales).
- `migrations/002_signos_alarma.sql`: signos de alarma, alertas desde síntomas, reglas clínicas base, datos antropométricos, contacto de emergencia y auditoría inmutable.
- `seeds.sql`: datos de ejemplo opcionales (usuarios, embarazo, mediciones de varias semanas, alertas).
- Para levantar PostgreSQL localmente, ver `docker-compose.yml` en la raíz.
