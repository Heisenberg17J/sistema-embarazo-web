# Modelo de datos · Sistema Web de Seguimiento del Embarazo

Motor: **PostgreSQL 14+** · Esquema: `seguimiento_embarazo` · **22 tablas**
Validado ejecutando `01_esquema.sql` y `02_datos_prueba.sql` sobre PostgreSQL 16.

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
4. **Alertas parametrizables.** `regla_alerta` guarda operador, umbrales y ventana de semanas; `alerta` guarda el valor detectado y el ciclo de vida PENDIENTE → REVISADA. La regla se conserva con `ON DELETE RESTRICT` para no perder la trazabilidad de las alertas ya emitidas.
5. **Borrado en cascada acotado.** Los datos de una gestante caen en cascada desde `embarazo`; las referencias a catálogos y a profesionales usan `RESTRICT` o `SET NULL` para no perder histórico clínico.

## Restricciones destacadas

- `uq_embarazo_activo`: índice único parcial, un solo embarazo `ACTIVO` por gestante (RF-04).
- `uq_cita_agenda`: índice único parcial, un profesional no puede tener dos citas vigentes a la misma fecha y hora (RF-07).
- `ck_alerta_revision`: `estado = REVISADA` exige revisor y fecha de revisión; `PENDIENTE` exige que ambos sean nulos.
- `ck_embarazo_fpp`: la fecha probable de parto debe ser posterior a la FUM y no exceder 320 días.
- `ck_usuario_hash` y el índice `uq_usuario_correo_lower`: nunca se guarda texto plano (RNF-01) y el correo es único sin importar mayúsculas (RF-01).
- Trigger `tg_medicion_rango`: valida cada valor contra el rango técnico de su tipo y contra el permiso de registro de la gestante (RNF-10).

## Funciones y vistas

- `fn_semana_gestacion(fecha_inicio, fecha)`: semana calculada, nunca almacenada como dato maestro (RF-04).
- `fn_set_actualizado_en()`: mantiene `actualizado_en` en las tablas mutables.
- `v_historial_embarazo`: historial cronológico unificado de controles, síntomas, exámenes, citas y alertas (RF-09).
- `v_pacientes_profesional`: pacientes vigentes por profesional, con semana actual y alertas pendientes (RF-13).
- `v_embarazo_actual`: estado y semana de cada embarazo.

## Archivos

- `01_esquema.sql` — script de creación completo (tipos, tablas, restricciones, índices, triggers, vistas y catálogos iniciales).
- `02_datos_prueba.sql` — datos de ejemplo opcionales para demostrar los flujos.
- `06_modelo_er.puml` / `.png` — diagrama entidad-relación.
