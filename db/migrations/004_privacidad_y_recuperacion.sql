-- =============================================================================
--  Migración 004 · Privacidad, aprobación clínica y recuperación de contraseña
--  Ejecutar DESPUÉS de 003_tuteo.sql
-- =============================================================================
--  Preparan el sistema para un piloto con gestantes reales:
--   1. Constancia de la autorización de tratamiento de datos (Ley 1581 de 2012).
--   2. Derecho de supresión: solicitud + anonimización (no borrado físico).
--   3. Aprobación clínica de las reglas de alerta y de los signos de alarma.
--   4. Recuperación de contraseña por correo.
-- =============================================================================

SET search_path TO seguimiento_embarazo, public;

-- =============================================================================
-- 1. AUTORIZACIÓN DE TRATAMIENTO DE DATOS
-- =============================================================================
--  Los datos de salud son datos sensibles: el tratamiento exige autorización
--  previa, expresa e informada. Se guarda QUÉ versión de la política aceptó cada
--  persona y CUÁNDO, para poder demostrarlo y para pedir una nueva aceptación si
--  la política cambia.

ALTER TABLE usuario
    ADD COLUMN acepto_politica_en TIMESTAMPTZ,
    ADD COLUMN version_politica   VARCHAR(20),
    ADD COLUMN anonimizado_en     TIMESTAMPTZ,
    -- Ambos o ninguno: no puede haber una fecha de aceptación sin versión.
    ADD CONSTRAINT ck_usuario_politica CHECK ((acepto_politica_en IS NULL) = (version_politica IS NULL));

COMMENT ON COLUMN usuario.acepto_politica_en IS
    'Cuándo aceptó la política de tratamiento de datos. NULL en cuentas creadas antes de la migración 004 o por el administrador.';
COMMENT ON COLUMN usuario.anonimizado_en IS
    'Cuándo se anonimizó la cuenta por una solicitud de supresión. La historia clínica se conserva sin identificar a la persona.';

-- =============================================================================
-- 2. DERECHO DE SUPRESIÓN
-- =============================================================================
--  La historia clínica no se puede borrar sin más (hay obligación legal de
--  conservarla). Lo que se hace es ANONIMIZAR a la persona: se destruyen los
--  datos que la identifican y se conservan los registros clínicos sin nombre.

CREATE TYPE estado_solicitud AS ENUM ('PENDIENTE', 'ATENDIDA', 'RECHAZADA');

CREATE TABLE solicitud_supresion (
    id             BIGINT           GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id     BIGINT           NOT NULL,
    motivo         VARCHAR(500),
    estado         estado_solicitud NOT NULL DEFAULT 'PENDIENTE',
    solicitada_en  TIMESTAMPTZ      NOT NULL DEFAULT now(),
    atendida_por   BIGINT,
    atendida_en    TIMESTAMPTZ,
    respuesta      VARCHAR(500),
    CONSTRAINT fk_supresion_usuario FOREIGN KEY (usuario_id)   REFERENCES usuario (id) ON DELETE CASCADE,
    CONSTRAINT fk_supresion_admin   FOREIGN KEY (atendida_por) REFERENCES usuario (id) ON DELETE SET NULL,
    -- Una solicitud pendiente no tiene respuesta; una resuelta siempre tiene fecha.
    CONSTRAINT ck_supresion_atencion CHECK (
        (estado = 'PENDIENTE' AND atendida_en IS NULL) OR
        (estado <> 'PENDIENTE' AND atendida_en IS NOT NULL))
);
COMMENT ON TABLE solicitud_supresion IS
    'Derecho de supresión (Ley 1581). La atiende el administrador anonimizando la cuenta.';

-- Una persona no acumula solicitudes pendientes.
CREATE UNIQUE INDEX uq_supresion_pendiente ON solicitud_supresion (usuario_id) WHERE estado = 'PENDIENTE';
CREATE INDEX ix_supresion_estado ON solicitud_supresion (estado, solicitada_en);

-- =============================================================================
-- 3. APROBACIÓN CLÍNICA
-- =============================================================================
--  Los umbrales y los mensajes que lee la gestante ("acude de inmediato a
--  urgencias") deben estar avalados por quien responde clínicamente por ellos.
--  Se deja constancia de quién los aprobó y cuándo.
--
--  ON DELETE RESTRICT: un profesional que aprobó reglas no se borra, se desactiva.

ALTER TABLE regla_alerta
    ADD COLUMN aprobada_por BIGINT,
    ADD COLUMN aprobada_en  TIMESTAMPTZ,
    ADD CONSTRAINT fk_regla_aprobador FOREIGN KEY (aprobada_por)
        REFERENCES perfil_profesional (usuario_id) ON DELETE RESTRICT,
    ADD CONSTRAINT ck_regla_aprobacion CHECK ((aprobada_por IS NULL) = (aprobada_en IS NULL));

ALTER TABLE tipo_sintoma
    ADD COLUMN aprobada_por BIGINT,
    ADD COLUMN aprobada_en  TIMESTAMPTZ,
    ADD CONSTRAINT fk_sintoma_aprobador FOREIGN KEY (aprobada_por)
        REFERENCES perfil_profesional (usuario_id) ON DELETE RESTRICT,
    ADD CONSTRAINT ck_sintoma_aprobacion CHECK ((aprobada_por IS NULL) = (aprobada_en IS NULL));

-- Si alguien cambia lo que se aprobó (un umbral, la severidad, el texto), la
-- aprobación deja de valer: lo que firmó el profesional ya no es lo que está
-- vigente. Va en la base y no en la API para que no se pueda saltar.

CREATE OR REPLACE FUNCTION fn_invalidar_aprobacion_regla()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF ROW(NEW.tipo_medicion_id, NEW.operador, NEW.valor_referencia, NEW.valor_min, NEW.valor_max,
           NEW.semana_desde, NEW.semana_hasta, NEW.severidad, NEW.mensaje)
       IS DISTINCT FROM
       ROW(OLD.tipo_medicion_id, OLD.operador, OLD.valor_referencia, OLD.valor_min, OLD.valor_max,
           OLD.semana_desde, OLD.semana_hasta, OLD.severidad, OLD.mensaje)
       -- Salvo que esta misma sentencia sea la que aprueba.
       AND NEW.aprobada_por IS NOT DISTINCT FROM OLD.aprobada_por
       AND NEW.aprobada_en  IS NOT DISTINCT FROM OLD.aprobada_en
    THEN
        NEW.aprobada_por := NULL;
        NEW.aprobada_en  := NULL;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tg_regla_invalida_aprobacion
    BEFORE UPDATE ON regla_alerta
    FOR EACH ROW EXECUTE FUNCTION fn_invalidar_aprobacion_regla();

CREATE OR REPLACE FUNCTION fn_invalidar_aprobacion_sintoma()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF ROW(NEW.es_signo_alarma, NEW.severidad, NEW.mensaje_alarma, NEW.alarma_hasta_semana)
       IS DISTINCT FROM
       ROW(OLD.es_signo_alarma, OLD.severidad, OLD.mensaje_alarma, OLD.alarma_hasta_semana)
       AND NEW.aprobada_por IS NOT DISTINCT FROM OLD.aprobada_por
       AND NEW.aprobada_en  IS NOT DISTINCT FROM OLD.aprobada_en
    THEN
        NEW.aprobada_por := NULL;
        NEW.aprobada_en  := NULL;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tg_sintoma_invalida_aprobacion
    BEFORE UPDATE ON tipo_sintoma
    FOR EACH ROW EXECUTE FUNCTION fn_invalidar_aprobacion_sintoma();

-- =============================================================================
-- 4. RECUPERACIÓN DE CONTRASEÑA
-- =============================================================================
--  Mismo criterio que `sesion`: solo se guarda el hash del token. Quien lea la
--  base no puede usar un enlace pendiente.

CREATE TABLE recuperacion_contrasena (
    id            BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id    BIGINT       NOT NULL,
    token_hash    VARCHAR(64)  NOT NULL,
    solicitada_en TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expira_en     TIMESTAMPTZ  NOT NULL,
    usada_en      TIMESTAMPTZ,
    ip            INET,
    CONSTRAINT fk_recuperacion_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id) ON DELETE CASCADE,
    CONSTRAINT uq_recuperacion_token   UNIQUE (token_hash),
    CONSTRAINT ck_recuperacion_vigencia CHECK (expira_en > solicitada_en)
);
COMMENT ON TABLE recuperacion_contrasena IS
    'Enlaces de restablecimiento de contraseña. De un solo uso y de vida corta; solo se guarda el hash.';

CREATE INDEX ix_recuperacion_usuario ON recuperacion_contrasena (usuario_id, solicitada_en DESC);

-- =============================================================================
-- FIN DE LA MIGRACIÓN 004
-- =============================================================================
