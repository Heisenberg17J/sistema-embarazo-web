-- =============================================================================
--  Migración 002 · Signos de alarma, reglas clínicas base y datos de apoyo
--  Ejecutar DESPUÉS de 001_esquema.sql
-- =============================================================================
--  Cambios:
--   1. tipo_sintoma marca los signos de alarma obstétricos y su severidad.
--   2. alerta puede nacer de una medición (regla) o de un síntoma (signo de alarma).
--   3. Reglas clínicas base de presión arterial, FCF, glucosa y temperatura.
--   4. Datos de apoyo: talla, peso pregestacional, grupo sanguíneo, contacto de emergencia.
--   5. Edad gestacional en formato clínico "semanas+días".
--   6. Auditoría append-only real (RNF-14).
--   7. Vistas de historial y pacientes ampliadas.
--  Las alertas siguen siendo informativas: orientan a consultar, nunca diagnostican.
-- =============================================================================

SET search_path TO seguimiento_embarazo, public;

-- =============================================================================
-- 1. SIGNOS DE ALARMA EN EL CATÁLOGO DE SÍNTOMAS
-- =============================================================================

ALTER TABLE tipo_sintoma
    ADD COLUMN es_signo_alarma     BOOLEAN          NOT NULL DEFAULT FALSE,
    ADD COLUMN severidad           severidad_alerta,
    ADD COLUMN mensaje_alarma      VARCHAR(255),
    -- Si se informa, el síntoma solo es alarma ANTES de esa semana (p. ej. contracciones < 37).
    ADD COLUMN alarma_hasta_semana SMALLINT,
    ADD CONSTRAINT ck_tipo_sintoma_alarma CHECK (
        NOT es_signo_alarma OR (severidad IS NOT NULL AND mensaje_alarma IS NOT NULL)),
    ADD CONSTRAINT ck_tipo_sintoma_semana CHECK (
        alarma_hasta_semana IS NULL OR alarma_hasta_semana BETWEEN 1 AND 45);

COMMENT ON COLUMN tipo_sintoma.es_signo_alarma IS
    'Signo de alarma obstétrico: registrarlo genera una alerta inmediata para la gestante y su profesional.';

UPDATE tipo_sintoma
   SET es_signo_alarma = TRUE, severidad = 'CRITICA',
       mensaje_alarma = 'Sangrado vaginal: acuda de inmediato al servicio de urgencias más cercano.'
 WHERE codigo = 'SANGRADO';

UPDATE tipo_sintoma
   SET es_signo_alarma = TRUE, severidad = 'CRITICA', alarma_hasta_semana = 37,
       mensaje_alarma = 'Contracciones antes de la semana 37: acuda de inmediato a urgencias.'
 WHERE codigo = 'CONTRACCIONES';

INSERT INTO tipo_sintoma (codigo, nombre, es_signo_alarma, severidad, mensaje_alarma) VALUES
    ('CEFALEA_INTENSA',         'Dolor de cabeza intenso que no mejora', TRUE, 'CRITICA',
        'Dolor de cabeza intenso: acuda de inmediato a urgencias y pida que le tomen la presión arterial.'),
    ('VISION_BORROSA',          'Visión borrosa o ver luces',            TRUE, 'CRITICA',
        'Alteraciones de la visión: acuda de inmediato a urgencias y pida que le tomen la presión arterial.'),
    ('DOLOR_EPIGASTRICO',       'Dolor fuerte en la boca del estómago',   TRUE, 'CRITICA',
        'Dolor en la boca del estómago: acuda de inmediato al servicio de urgencias.'),
    ('SALIDA_LIQUIDO',          'Salida de líquido por la vagina',        TRUE, 'CRITICA',
        'Salida de líquido por la vagina: acuda de inmediato al servicio de urgencias.'),
    ('DISMINUCION_MOV_FETALES', 'El bebé se mueve menos o no se mueve',   TRUE, 'CRITICA',
        'Disminución de los movimientos del bebé: acuda de inmediato al servicio de urgencias.'),
    ('CONVULSION',              'Convulsiones o desmayo',                 TRUE, 'CRITICA',
        'Convulsión o desmayo: llame a la línea de emergencias o acuda de inmediato a urgencias.'),
    ('DOLOR_ABDOMINAL_INTENSO', 'Dolor abdominal intenso',                TRUE, 'CRITICA',
        'Dolor abdominal intenso: acuda de inmediato al servicio de urgencias.'),
    ('DIFICULTAD_RESPIRAR',     'Dificultad para respirar',               TRUE, 'CRITICA',
        'Dificultad para respirar: acuda de inmediato al servicio de urgencias.'),
    ('HINCHAZON_SUBITA',        'Hinchazón repentina de cara o manos',    TRUE, 'ADVERTENCIA',
        'Hinchazón repentina de cara o manos: consulte hoy con su profesional de salud y vigile su presión arterial.'),
    ('FIEBRE',                  'Fiebre (38 °C o más)',                   TRUE, 'ADVERTENCIA',
        'Fiebre durante el embarazo: consulte hoy con su profesional de salud.'),
    ('VOMITO_PERSISTENTE',      'Vómito que no permite comer ni beber',   TRUE, 'ADVERTENCIA',
        'Vómito persistente: consulte hoy con su profesional de salud para evitar la deshidratación.'),
    ('ARDOR_ORINAR',            'Ardor o dolor al orinar',                TRUE, 'ADVERTENCIA',
        'Ardor al orinar: consulte con su profesional de salud; las infecciones urinarias deben tratarse.');

-- =============================================================================
-- 2. ALERTAS ORIGINADAS EN SÍNTOMAS
-- =============================================================================

ALTER TABLE alerta DROP CONSTRAINT ck_alerta_origen;

ALTER TABLE alerta
    ALTER COLUMN regla_alerta_id DROP NOT NULL,
    ALTER COLUMN valor_detectado DROP NOT NULL,
    ADD COLUMN sintoma_id BIGINT,
    ADD CONSTRAINT fk_alerta_sintoma FOREIGN KEY (sintoma_id) REFERENCES sintoma (id) ON DELETE CASCADE,
    -- Una alerta nace exactamente de una medición (con regla y valor) o de un síntoma.
    ADD CONSTRAINT ck_alerta_origen CHECK (
        num_nonnulls(medicion_id, sintoma_id) = 1
        AND (medicion_id IS NULL OR (regla_alerta_id IS NOT NULL AND valor_detectado IS NOT NULL))),
    ADD CONSTRAINT uq_alerta_sintoma UNIQUE (sintoma_id);

-- =============================================================================
-- 3. REGLAS CLÍNICAS BASE
-- =============================================================================
--  Umbrales de referencia de guías de control prenatal (hipertensión en el
--  embarazo ≥140/90; severa ≥160/110). El administrador puede ajustarlos o
--  desactivarlos. Las reglas del sistema no tienen creador (creada_por NULL).

ALTER TABLE regla_alerta ALTER COLUMN creada_por DROP NOT NULL;

INSERT INTO tipo_medicion (codigo, nombre, unidad, valor_min, valor_max, decimales, registrable_por_gestante) VALUES
    ('GLUCOSA_AYUNAS', 'Glucosa en ayunas',    'mg/dL', 20.0, 600.0, 0, TRUE),
    ('TEMPERATURA',    'Temperatura corporal', '°C',    34.0,  43.0, 1, TRUE);

INSERT INTO regla_alerta (tipo_medicion_id, codigo, operador, valor_referencia, valor_min, valor_max,
                          semana_desde, semana_hasta, severidad, mensaje)
SELECT tm.id, v.codigo, v.operador::operador_regla, v.ref, v.vmin, v.vmax, v.desde, v.hasta,
       v.severidad::severidad_alerta, v.mensaje
FROM (VALUES
    ('PA_SISTOLICA',  'PAS_SEVERA',        'MAYOR_IGUAL', 160, NULL, NULL, 0, 45, 'CRITICA',
        'Presión sistólica de 160 o más: acuda de inmediato al servicio de urgencias.'),
    ('PA_SISTOLICA',  'PAS_ELEVADA',       'MAYOR_IGUAL', 140, NULL, NULL, 0, 45, 'ADVERTENCIA',
        'Presión sistólica de 140 o más: repita la toma en reposo y consulte hoy con su profesional de salud.'),
    ('PA_SISTOLICA',  'PAS_BAJA',          'MENOR',        90, NULL, NULL, 0, 45, 'ADVERTENCIA',
        'Presión sistólica baja: si tiene mareo o desmayo, consulte con su profesional de salud.'),
    ('PA_DIASTOLICA', 'PAD_SEVERA',        'MAYOR_IGUAL', 110, NULL, NULL, 0, 45, 'CRITICA',
        'Presión diastólica de 110 o más: acuda de inmediato al servicio de urgencias.'),
    ('PA_DIASTOLICA', 'PAD_ELEVADA',       'MAYOR_IGUAL',  90, NULL, NULL, 0, 45, 'ADVERTENCIA',
        'Presión diastólica de 90 o más: repita la toma en reposo y consulte hoy con su profesional de salud.'),
    ('FCF',           'FCF_FUERA_RANGO',   'FUERA_DE_RANGO', NULL, 110, 160, 20, 45, 'CRITICA',
        'Frecuencia cardiaca fetal fuera del rango de referencia (110-160 lpm).'),
    ('GLUCOSA_AYUNAS','GLUCOSA_AYUNAS_ALTA','MAYOR_IGUAL',  95, NULL, NULL, 0, 45, 'ADVERTENCIA',
        'Glucosa en ayunas de 95 mg/dL o más: comente este resultado con su profesional de salud.'),
    ('TEMPERATURA',   'FIEBRE',            'MAYOR_IGUAL',  38, NULL, NULL, 0, 45, 'ADVERTENCIA',
        'Temperatura de 38 °C o más: consulte hoy con su profesional de salud.')
) AS v(tipo, codigo, operador, ref, vmin, vmax, desde, hasta, severidad, mensaje)
JOIN tipo_medicion tm ON tm.codigo = v.tipo;

-- =============================================================================
-- 4. DATOS DE APOYO AL SEGUIMIENTO
-- =============================================================================

ALTER TABLE embarazo
    ADD COLUMN talla_cm               NUMERIC(5,1),
    ADD COLUMN peso_pregestacional_kg NUMERIC(5,1),
    ADD CONSTRAINT ck_embarazo_talla CHECK (talla_cm IS NULL OR talla_cm BETWEEN 120 AND 220),
    ADD CONSTRAINT ck_embarazo_peso  CHECK (peso_pregestacional_kg IS NULL OR peso_pregestacional_kg BETWEEN 30 AND 200);
COMMENT ON COLUMN embarazo.peso_pregestacional_kg IS 'Con talla_cm permite calcular el IMC inicial y la ganancia de peso.';

ALTER TABLE perfil_gestante
    ADD COLUMN grupo_sanguineo              VARCHAR(3),
    ADD COLUMN contacto_emergencia_nombre   VARCHAR(120),
    ADD COLUMN contacto_emergencia_telefono VARCHAR(20),
    ADD CONSTRAINT ck_gestante_grupo CHECK (
        grupo_sanguineo IS NULL OR grupo_sanguineo IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'));

-- Usuarios creados por el administrador con contraseña temporal.
ALTER TABLE usuario ADD COLUMN debe_cambiar_contrasena BOOLEAN NOT NULL DEFAULT FALSE;

-- =============================================================================
-- 5. EDAD GESTACIONAL EN FORMATO CLÍNICO
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_edad_gestacional_texto(p_fecha_inicio DATE, p_fecha DATE)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN p_fecha < p_fecha_inicio THEN '0+0'
                ELSE ((p_fecha - p_fecha_inicio) / 7) || '+' || ((p_fecha - p_fecha_inicio) % 7)
           END;
$$;

-- =============================================================================
-- 6. AUDITORÍA APPEND-ONLY (RNF-14)
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_auditoria_inmutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Única excepción: el ON DELETE SET NULL de usuario_id.
    IF TG_OP = 'UPDATE' AND NEW.usuario_id IS NULL
       AND (to_jsonb(NEW) - 'usuario_id') = (to_jsonb(OLD) - 'usuario_id') THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'La auditoría es de solo inserción' USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER tg_auditoria_inmutable
    BEFORE UPDATE OR DELETE ON auditoria
    FOR EACH ROW EXECUTE FUNCTION fn_auditoria_inmutable();

-- =============================================================================
-- 7. VISTAS AMPLIADAS
-- =============================================================================

DROP VIEW IF EXISTS v_historial_embarazo;
CREATE VIEW v_historial_embarazo AS
SELECT c.embarazo_id, 'CONTROL'::TEXT AS tipo, c.id AS registro_id,
       c.fecha::TIMESTAMPTZ AS fecha, 'Control prenatal'::TEXT AS titulo,
       c.observaciones AS detalle, NULL::TEXT AS estado
FROM control c
UNION ALL
SELECT s.embarazo_id, 'SINTOMA', s.id, s.fecha::TIMESTAMPTZ,
       COALESCE(ts.nombre, 'Síntoma'), s.descripcion, NULL
FROM sintoma s LEFT JOIN tipo_sintoma ts ON ts.id = s.tipo_sintoma_id
UNION ALL
SELECT x.embarazo_id, 'EXAMEN', x.id, x.fecha::TIMESTAMPTZ, te.nombre, x.resultado, NULL
FROM examen x JOIN tipo_examen te ON te.id = x.tipo_examen_id
UNION ALL
SELECT ci.embarazo_id, 'CITA', ci.id, (ci.fecha + ci.hora)::TIMESTAMPTZ, tc.nombre,
       ci.motivo_cancelacion, ci.estado::TEXT
FROM cita ci JOIN tipo_control tc ON tc.id = ci.tipo_control_id
UNION ALL
SELECT a.embarazo_id, 'ALERTA', a.id, a.generada_en, a.severidad::TEXT, a.mensaje, a.estado::TEXT
FROM alerta a;

DROP VIEW IF EXISTS v_pacientes_profesional;
CREATE VIEW v_pacientes_profesional AS
SELECT asg.profesional_usuario_id,
       asg.gestante_usuario_id,
       u.nombre || ' ' || u.apellido AS gestante,
       u.correo,
       pg.telefono,
       e.id AS embarazo_id,
       e.fecha_estimada_parto,
       fn_semana_gestacion(e.fecha_inicio, CURRENT_DATE) AS semana_actual,
       fn_edad_gestacional_texto(e.fecha_inicio, CURRENT_DATE) AS edad_gestacional,
       (SELECT count(*) FROM alerta al
         WHERE al.embarazo_id = e.id AND al.estado = 'PENDIENTE') AS alertas_pendientes,
       (SELECT count(*) FROM alerta al
         WHERE al.embarazo_id = e.id AND al.estado = 'PENDIENTE' AND al.severidad = 'CRITICA') AS alertas_criticas,
       (SELECT min(ci.fecha + ci.hora) FROM cita ci
         WHERE ci.embarazo_id = e.id AND ci.estado IN ('PROGRAMADA', 'REPROGRAMADA')
           AND ci.fecha >= CURRENT_DATE) AS proxima_cita
FROM asignacion asg
JOIN usuario  u ON u.id = asg.gestante_usuario_id
JOIN perfil_gestante pg ON pg.usuario_id = asg.gestante_usuario_id
LEFT JOIN embarazo e ON e.gestante_usuario_id = asg.gestante_usuario_id AND e.estado = 'ACTIVO'
WHERE asg.activa AND u.activo;

DROP VIEW IF EXISTS v_embarazo_actual;
CREATE VIEW v_embarazo_actual AS
SELECT e.id                AS embarazo_id,
       e.gestante_usuario_id,
       u.nombre || ' ' || u.apellido AS gestante,
       e.fecha_inicio,
       e.fecha_estimada_parto,
       e.estado,
       fn_semana_gestacion(e.fecha_inicio, CURRENT_DATE) AS semana_actual,
       fn_edad_gestacional_texto(e.fecha_inicio, CURRENT_DATE) AS edad_gestacional,
       CASE WHEN fn_semana_gestacion(e.fecha_inicio, CURRENT_DATE) < 14 THEN 1
            WHEN fn_semana_gestacion(e.fecha_inicio, CURRENT_DATE) < 28 THEN 2
            ELSE 3 END AS trimestre,
       GREATEST(0, e.fecha_estimada_parto - CURRENT_DATE) AS dias_para_parto
FROM embarazo e
JOIN usuario  u ON u.id = e.gestante_usuario_id;

-- =============================================================================
-- FIN DE LA MIGRACIÓN 002
-- =============================================================================
