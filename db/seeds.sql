-- =============================================================================
--  Datos de prueba (opcional) — Sistema de Seguimiento del Embarazo
--  Ejecutar DESPUÉS de las migraciones (db/migrations/*.sql)
-- =============================================================================
SET search_path TO seguimiento_embarazo, public;

-- 1. Usuarios (hashes de ejemplo generados con pgcrypto; en producción los calcula el backend)
INSERT INTO usuario (rol_id, nombre, apellido, correo, hash_contrasena) VALUES
    (3, 'Laura',  'Restrepo', 'admin@seguimiento.co',      crypt('Admin*2026',  gen_salt('bf', 10))),
    (2, 'Carlos', 'Mejía',    'cmejia@seguimiento.co',     crypt('Prof*2026',   gen_salt('bf', 10))),
    (2, 'Ana',    'Duarte',   'aduarte@seguimiento.co',    crypt('Prof*2026',   gen_salt('bf', 10))),
    (1, 'María',  'Gómez',    'maria.gomez@correo.co',     crypt('Gest*2026',   gen_salt('bf', 10))),
    (1, 'Diana',  'Cruz',     'diana.cruz@correo.co',      crypt('Gest*2026',   gen_salt('bf', 10)));

-- 2. Perfiles
INSERT INTO perfil_profesional (usuario_id, registro_profesional, especialidad, institucion)
SELECT id, 'RM-' || id, 'Ginecología y Obstetricia', 'Hospital Universitario del Valle'
FROM usuario WHERE rol_id = 2;

INSERT INTO perfil_gestante (usuario_id, numero_documento, fecha_nacimiento, telefono, eps)
SELECT id, '10' || id || '456789', DATE '1996-05-14', '3001234567', 'EPS Sura'
FROM usuario WHERE rol_id = 1;

-- 3. Asignaciones (RF-15)
INSERT INTO asignacion (profesional_usuario_id, gestante_usuario_id, asignada_por)
SELECT p.usuario_id, g.usuario_id, (SELECT id FROM usuario WHERE rol_id = 3 LIMIT 1)
FROM perfil_profesional p
CROSS JOIN LATERAL (SELECT usuario_id FROM perfil_gestante ORDER BY usuario_id LIMIT 1) g
WHERE p.usuario_id = (SELECT min(usuario_id) FROM perfil_profesional);

-- 4. Embarazo (RF-04)
INSERT INTO embarazo (gestante_usuario_id, fecha_inicio, fecha_estimada_parto)
SELECT usuario_id, CURRENT_DATE - 150, CURRENT_DATE - 150 + 280
FROM perfil_gestante ORDER BY usuario_id LIMIT 1;

-- 5. Cita y control (RF-05, RF-07)
INSERT INTO cita (embarazo_id, profesional_usuario_id, tipo_control_id, fecha, hora)
SELECT e.id, (SELECT min(usuario_id) FROM perfil_profesional),
       (SELECT id FROM tipo_control WHERE codigo = 'CONTROL_PRENATAL'),
       CURRENT_DATE + 7, TIME '09:00'
FROM embarazo e LIMIT 1;

INSERT INTO control (embarazo_id, profesional_usuario_id, fecha, semana_gestacion, observaciones)
SELECT e.id, (SELECT min(usuario_id) FROM perfil_profesional), CURRENT_DATE,
       fn_semana_gestacion(e.fecha_inicio, CURRENT_DATE), 'Evolución dentro de lo esperado.'
FROM embarazo e LIMIT 1;

-- 6. Mediciones (RF-05, RF-10)
INSERT INTO medicion (embarazo_id, tipo_medicion_id, control_id, registrado_por, origen, valor, semana_gestacion)
SELECT c.embarazo_id, tm.id, c.id, c.profesional_usuario_id, 'PROFESIONAL', v.valor, c.semana_gestacion
FROM control c
JOIN (VALUES ('PESO', 68.4), ('PA_SISTOLICA', 118), ('PA_DIASTOLICA', 76), ('ALTURA_UTERINA', 22.0)) AS v(codigo, valor) ON TRUE
JOIN tipo_medicion tm ON tm.codigo = v.codigo;

-- Serie histórica registrada por la gestante (alimenta las gráficas de evolución)
INSERT INTO medicion (embarazo_id, tipo_medicion_id, registrado_por, origen, valor, fecha_registro, semana_gestacion)
SELECT e.id, tm.id, e.gestante_usuario_id, 'GESTANTE', v.valor,
       (e.fecha_inicio + v.semana * 7)::TIMESTAMPTZ + TIME '08:00', v.semana
FROM embarazo e
CROSS JOIN (VALUES
    ('PESO', 8, 62.0), ('PESO', 12, 63.1), ('PESO', 16, 64.5), ('PESO', 19, 66.2),
    ('PA_SISTOLICA', 8, 110), ('PA_SISTOLICA', 12, 112), ('PA_SISTOLICA', 16, 115), ('PA_SISTOLICA', 19, 117),
    ('PA_DIASTOLICA', 8, 70), ('PA_DIASTOLICA', 12, 72), ('PA_DIASTOLICA', 16, 74), ('PA_DIASTOLICA', 19, 75)
) AS v(codigo, semana, valor)
JOIN tipo_medicion tm ON tm.codigo = v.codigo
WHERE e.estado = 'ACTIVO';

-- Medición registrada por la gestante, con valor alto (dispara la regla PAS_ELEVADA)
INSERT INTO medicion (embarazo_id, tipo_medicion_id, registrado_por, origen, valor)
SELECT e.id, (SELECT id FROM tipo_medicion WHERE codigo = 'PA_SISTOLICA'),
       e.gestante_usuario_id, 'GESTANTE', 152
FROM embarazo e LIMIT 1;

-- 7. Síntoma (RF-06)
INSERT INTO sintoma (embarazo_id, tipo_sintoma_id, descripcion, intensidad)
SELECT e.id, (SELECT id FROM tipo_sintoma WHERE codigo = 'CEFALEA'), 'Dolor de cabeza persistente', 3
FROM embarazo e LIMIT 1;

-- 8. Examen (RF-08)
INSERT INTO examen (embarazo_id, tipo_examen_id, profesional_usuario_id, fecha, resultado)
SELECT e.id, (SELECT id FROM tipo_examen WHERE codigo = 'HEMOGRAMA'),
       (SELECT min(usuario_id) FROM perfil_profesional), CURRENT_DATE - 5, 'Hemoglobina 11.8 g/dL'
FROM embarazo e LIMIT 1;

-- 9. Reglas de alerta (RF-11)
--    Las reglas clínicas base (PAS/PAD, FCF, glucosa, temperatura) ya vienen de la migración 002.
INSERT INTO regla_alerta (tipo_medicion_id, codigo, operador, valor_min, valor_max, severidad, mensaje, creada_por)
SELECT tm.id, 'PESO_FUERA_RANGO', 'FUERA_DE_RANGO', 45, 110, 'ADVERTENCIA',
       'El peso registrado está fuera del rango configurado.',
       (SELECT id FROM usuario WHERE rol_id = 3 LIMIT 1)
FROM tipo_medicion tm WHERE tm.codigo = 'PESO';

-- 10. Alerta generada por el motor de reglas (lo hace el backend; aquí se simula)
INSERT INTO alerta (embarazo_id, regla_alerta_id, medicion_id, severidad, mensaje, valor_detectado)
SELECT m.embarazo_id, r.id, m.id, r.severidad, r.mensaje, m.valor
FROM medicion m
JOIN regla_alerta r ON r.tipo_medicion_id = m.tipo_medicion_id AND r.codigo = 'PAS_ELEVADA'
WHERE m.origen = 'GESTANTE' AND m.valor >= r.valor_referencia;

-- 11. Contenido educativo (RF-16) y auditoría (RNF-14)
INSERT INTO contenido_educativo (titulo, cuerpo, categoria, semana_desde, semana_hasta, publicado, creado_por)
VALUES ('Segundo trimestre: qué esperar',
        'Durante las semanas 14 a 27 suelen disminuir las náuseas y comienzan los movimientos fetales.',
        'Etapas del embarazo', 14, 27, TRUE,
        (SELECT id FROM usuario WHERE rol_id = 3 LIMIT 1));

INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle)
SELECT (SELECT min(usuario_id) FROM perfil_profesional), 'CREAR', 'control', c.id,
       jsonb_build_object('semana', c.semana_gestacion)
FROM control c LIMIT 1;
