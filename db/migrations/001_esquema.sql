-- =============================================================================
--  Sistema Web de Seguimiento del Embarazo
--  Script de creación de la base de datos — PostgreSQL 14+
--  Esquema: seguimiento_embarazo
--  Autor: Jean Angelo Caicedo Rojas, Hejembert Fabian Jaramillo Betancur
-- =============================================================================
--  Ejecución:  psql -U postgres -d seguimiento_embarazo -f 001_esquema.sql
-- =============================================================================

-- CREATE DATABASE seguimiento_embarazo
--     WITH ENCODING 'UTF8' LC_COLLATE 'es_CO.UTF-8' LC_CTYPE 'es_CO.UTF-8' TEMPLATE template0;
-- \c seguimiento_embarazo

CREATE SCHEMA IF NOT EXISTS seguimiento_embarazo;
SET search_path TO seguimiento_embarazo, public;

-- pgcrypto: solo para generar hashes de prueba (crypt/gen_salt). El hashing
-- de producción se hace en el backend (RNF-01); la BD nunca ve texto plano.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 1. TIPOS ENUMERADOS (dominios cerrados y controlados por el motor)
-- =============================================================================

CREATE TYPE estado_embarazo    AS ENUM ('ACTIVO', 'FINALIZADO', 'CANCELADO');
CREATE TYPE estado_cita        AS ENUM ('PROGRAMADA', 'REPROGRAMADA', 'CUMPLIDA', 'CANCELADA', 'NO_ASISTIO');
CREATE TYPE estado_alerta      AS ENUM ('PENDIENTE', 'REVISADA', 'DESCARTADA');
CREATE TYPE severidad_alerta   AS ENUM ('INFORMATIVA', 'ADVERTENCIA', 'CRITICA');
CREATE TYPE origen_medicion    AS ENUM ('GESTANTE', 'PROFESIONAL');
CREATE TYPE operador_regla     AS ENUM ('MENOR', 'MENOR_IGUAL', 'MAYOR', 'MAYOR_IGUAL', 'FUERA_DE_RANGO');
CREATE TYPE accion_auditoria   AS ENUM ('LOGIN', 'LOGIN_FALLIDO', 'LOGOUT', 'CREAR', 'MODIFICAR', 'DESACTIVAR', 'CONSULTAR_SENSIBLE');

-- =============================================================================
-- 2. FUNCIONES Y DISPARADORES DE APOYO
-- =============================================================================

-- Mantiene actualizado_en en cada UPDATE.
CREATE OR REPLACE FUNCTION fn_set_actualizado_en()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$;

-- Semana de gestación a partir de la fecha de inicio (FUM) y una fecha dada.
CREATE OR REPLACE FUNCTION fn_semana_gestacion(p_fecha_inicio DATE, p_fecha DATE)
RETURNS SMALLINT LANGUAGE sql IMMUTABLE AS $$
    SELECT GREATEST(0, FLOOR((p_fecha - p_fecha_inicio) / 7.0))::SMALLINT;
$$;

-- =============================================================================
-- 3. TABLAS DE SEGURIDAD Y USUARIOS
-- =============================================================================

-- T01 · rol -------------------------------------------------------------------
CREATE TABLE rol (
    id          SMALLINT     PRIMARY KEY,
    codigo      VARCHAR(20)  NOT NULL,
    nombre      VARCHAR(60)  NOT NULL,
    descripcion TEXT,
    CONSTRAINT uq_rol_codigo  UNIQUE (codigo),
    CONSTRAINT ck_rol_codigo  CHECK (codigo IN ('GESTANTE', 'PROFESIONAL', 'ADMINISTRADOR'))
);
COMMENT ON TABLE rol IS 'RF-03. Catálogo cerrado de los tres roles del sistema.';

-- T02 · usuario ---------------------------------------------------------------
CREATE TABLE usuario (
    id                BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rol_id            SMALLINT     NOT NULL,
    nombre            VARCHAR(80)  NOT NULL,
    apellido          VARCHAR(80)  NOT NULL,
    correo            VARCHAR(160) NOT NULL,
    hash_contrasena   VARCHAR(255) NOT NULL,
    activo            BOOLEAN      NOT NULL DEFAULT TRUE,
    ultimo_acceso     TIMESTAMPTZ,
    creado_en         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT fk_usuario_rol        FOREIGN KEY (rol_id) REFERENCES rol (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT uq_usuario_correo     UNIQUE (correo),
    -- Necesaria para que los perfiles puedan amarrar (id, rol_id) por clave foránea.
    CONSTRAINT uq_usuario_id_rol     UNIQUE (id, rol_id),
    CONSTRAINT ck_usuario_correo     CHECK (correo ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT ck_usuario_nombre     CHECK (length(btrim(nombre)) > 0 AND length(btrim(apellido)) > 0),
    -- RNF-01: se almacena solo el hash; se rechaza cualquier valor demasiado corto.
    CONSTRAINT ck_usuario_hash       CHECK (length(hash_contrasena) >= 20)
);
COMMENT ON TABLE usuario IS 'RF-01, RF-02, RF-14. Identidad única de todo actor del sistema.';
COMMENT ON COLUMN usuario.hash_contrasena IS 'RNF-01. Hash bcrypt/argon2 calculado en el backend.';

CREATE UNIQUE INDEX uq_usuario_correo_lower ON usuario (lower(correo));
CREATE INDEX ix_usuario_rol ON usuario (rol_id) WHERE activo;

CREATE TRIGGER tg_usuario_actualizado
    BEFORE UPDATE ON usuario
    FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

-- T03 · perfil_gestante -------------------------------------------------------
CREATE TABLE perfil_gestante (
    usuario_id         BIGINT      PRIMARY KEY,
    rol_id             SMALLINT    NOT NULL DEFAULT 1,
    tipo_documento     VARCHAR(10) NOT NULL DEFAULT 'CC',
    numero_documento   VARCHAR(20) NOT NULL,
    fecha_nacimiento   DATE        NOT NULL,
    telefono           VARCHAR(20),
    direccion          VARCHAR(160),
    eps                VARCHAR(80),
    CONSTRAINT fk_gestante_usuario  FOREIGN KEY (usuario_id, rol_id)
        REFERENCES usuario (id, rol_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT ck_gestante_rol      CHECK (rol_id = 1),          -- solo usuarios con rol GESTANTE
    CONSTRAINT uq_gestante_doc      UNIQUE (tipo_documento, numero_documento),
    CONSTRAINT ck_gestante_tipo_doc CHECK (tipo_documento IN ('CC', 'TI', 'CE', 'PA')),
    CONSTRAINT ck_gestante_nac      CHECK (fecha_nacimiento < CURRENT_DATE
                                           AND fecha_nacimiento > DATE '1940-01-01')
);
COMMENT ON TABLE perfil_gestante IS 'Datos personales de la gestante. La FK compuesta garantiza que el usuario tenga rol GESTANTE.';

-- T04 · perfil_profesional ----------------------------------------------------
CREATE TABLE perfil_profesional (
    usuario_id           BIGINT      PRIMARY KEY,
    rol_id               SMALLINT    NOT NULL DEFAULT 2,
    registro_profesional VARCHAR(30) NOT NULL,
    especialidad         VARCHAR(80) NOT NULL,
    institucion          VARCHAR(120),
    telefono             VARCHAR(20),
    CONSTRAINT fk_prof_usuario  FOREIGN KEY (usuario_id, rol_id)
        REFERENCES usuario (id, rol_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT ck_prof_rol      CHECK (rol_id = 2),               -- solo usuarios con rol PROFESIONAL
    CONSTRAINT uq_prof_registro UNIQUE (registro_profesional)
);
COMMENT ON TABLE perfil_profesional IS 'Datos del profesional de salud (RF-14).';

-- T05 · sesion ----------------------------------------------------------------
CREATE TABLE sesion (
    id           BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id   BIGINT       NOT NULL,
    token_hash   VARCHAR(255) NOT NULL,
    ip           INET,
    user_agent   VARCHAR(255),
    emitida_en   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expira_en    TIMESTAMPTZ  NOT NULL,
    revocada_en  TIMESTAMPTZ,
    CONSTRAINT fk_sesion_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id) ON DELETE CASCADE,
    CONSTRAINT uq_sesion_token   UNIQUE (token_hash),
    CONSTRAINT ck_sesion_vigencia CHECK (expira_en > emitida_en),
    CONSTRAINT ck_sesion_revocada CHECK (revocada_en IS NULL OR revocada_en >= emitida_en)
);
COMMENT ON TABLE sesion IS 'RF-02, RNF-14. Sesiones/refresh tokens emitidos; permite revocación y trazabilidad.';

CREATE INDEX ix_sesion_usuario ON sesion (usuario_id, expira_en DESC);

-- T06 · asignacion ------------------------------------------------------------
CREATE TABLE asignacion (
    id                     BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    profesional_usuario_id BIGINT      NOT NULL,
    gestante_usuario_id    BIGINT      NOT NULL,
    asignada_por           BIGINT      NOT NULL,
    fecha_inicio           DATE        NOT NULL DEFAULT CURRENT_DATE,
    fecha_fin              DATE,
    activa                 BOOLEAN     NOT NULL DEFAULT TRUE,
    creada_en              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_asig_prof     FOREIGN KEY (profesional_usuario_id) REFERENCES perfil_profesional (usuario_id) ON DELETE RESTRICT,
    CONSTRAINT fk_asig_gest     FOREIGN KEY (gestante_usuario_id)    REFERENCES perfil_gestante   (usuario_id) ON DELETE CASCADE,
    CONSTRAINT fk_asig_admin    FOREIGN KEY (asignada_por)           REFERENCES usuario (id) ON DELETE RESTRICT,
    CONSTRAINT ck_asig_fechas   CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio),
    CONSTRAINT ck_asig_coherente CHECK ((activa AND fecha_fin IS NULL) OR (NOT activa))
);
COMMENT ON TABLE asignacion IS 'RF-15. Relación N:M entre profesional y gestante; precondición de todo acceso clínico (RNF-03).';

-- Una gestante no puede tener dos asignaciones activas con el mismo profesional.
CREATE UNIQUE INDEX uq_asignacion_activa
    ON asignacion (profesional_usuario_id, gestante_usuario_id) WHERE activa;
CREATE INDEX ix_asignacion_gestante ON asignacion (gestante_usuario_id) WHERE activa;

-- =============================================================================
-- 4. NÚCLEO DEL SEGUIMIENTO
-- =============================================================================

-- T07 · embarazo --------------------------------------------------------------
CREATE TABLE embarazo (
    id                   BIGINT           GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    gestante_usuario_id  BIGINT           NOT NULL,
    fecha_inicio         DATE             NOT NULL,          -- FUM
    fecha_estimada_parto DATE             NOT NULL,
    estado               estado_embarazo  NOT NULL DEFAULT 'ACTIVO',
    fecha_finalizacion   DATE,
    observaciones        TEXT,
    creado_en            TIMESTAMPTZ      NOT NULL DEFAULT now(),
    actualizado_en       TIMESTAMPTZ      NOT NULL DEFAULT now(),
    CONSTRAINT fk_embarazo_gestante FOREIGN KEY (gestante_usuario_id)
        REFERENCES perfil_gestante (usuario_id) ON DELETE CASCADE,
    CONSTRAINT ck_embarazo_inicio   CHECK (fecha_inicio <= CURRENT_DATE),
    CONSTRAINT ck_embarazo_fpp      CHECK (fecha_estimada_parto > fecha_inicio
                                           AND fecha_estimada_parto <= fecha_inicio + INTERVAL '320 days'),
    CONSTRAINT ck_embarazo_fin      CHECK (
        (estado = 'ACTIVO'  AND fecha_finalizacion IS NULL) OR
        (estado <> 'ACTIVO' AND fecha_finalizacion IS NOT NULL AND fecha_finalizacion >= fecha_inicio))
);
COMMENT ON TABLE embarazo IS 'RF-04. Un embarazo por gestante en estado ACTIVO; los anteriores quedan como histórico.';

-- RF-04: una sola gestación activa a la vez.
CREATE UNIQUE INDEX uq_embarazo_activo
    ON embarazo (gestante_usuario_id) WHERE estado = 'ACTIVO';

CREATE TRIGGER tg_embarazo_actualizado
    BEFORE UPDATE ON embarazo
    FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

-- T08 · tipo_control ----------------------------------------------------------
CREATE TABLE tipo_control (
    id           SMALLINT    GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo       VARCHAR(30) NOT NULL,
    nombre       VARCHAR(80) NOT NULL,
    duracion_min SMALLINT    NOT NULL DEFAULT 30,
    activo       BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_tipo_control_codigo UNIQUE (codigo),
    CONSTRAINT ck_tipo_control_dur    CHECK (duracion_min BETWEEN 5 AND 240)
);
COMMENT ON TABLE tipo_control IS 'RF-07. Catálogo del tipo de control asociado a una cita.';

-- T09 · cita ------------------------------------------------------------------
CREATE TABLE cita (
    id                     BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    embarazo_id            BIGINT      NOT NULL,
    profesional_usuario_id BIGINT      NOT NULL,
    tipo_control_id        SMALLINT    NOT NULL,
    fecha                  DATE        NOT NULL,
    hora                   TIME        NOT NULL,
    duracion_min           SMALLINT    NOT NULL DEFAULT 30,
    estado                 estado_cita NOT NULL DEFAULT 'PROGRAMADA',
    motivo_cancelacion     VARCHAR(255),
    creada_en              TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_cita_embarazo FOREIGN KEY (embarazo_id)            REFERENCES embarazo (id) ON DELETE CASCADE,
    CONSTRAINT fk_cita_prof     FOREIGN KEY (profesional_usuario_id) REFERENCES perfil_profesional (usuario_id) ON DELETE RESTRICT,
    CONSTRAINT fk_cita_tipo     FOREIGN KEY (tipo_control_id)        REFERENCES tipo_control (id) ON DELETE RESTRICT,
    CONSTRAINT ck_cita_duracion CHECK (duracion_min BETWEEN 5 AND 240),
    CONSTRAINT ck_cita_cancel   CHECK (estado <> 'CANCELADA' OR motivo_cancelacion IS NOT NULL)
);
COMMENT ON TABLE cita IS 'RF-07. Programada por el profesional; la gestante solo consulta.';

-- Un profesional no puede tener dos citas vigentes a la misma hora.
CREATE UNIQUE INDEX uq_cita_agenda
    ON cita (profesional_usuario_id, fecha, hora)
    WHERE estado IN ('PROGRAMADA', 'REPROGRAMADA');
CREATE INDEX ix_cita_embarazo ON cita (embarazo_id, fecha DESC);

CREATE TRIGGER tg_cita_actualizado
    BEFORE UPDATE ON cita
    FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

-- T10 · control ---------------------------------------------------------------
CREATE TABLE control (
    id                     BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    embarazo_id            BIGINT      NOT NULL,
    profesional_usuario_id BIGINT      NOT NULL,
    cita_id                BIGINT,
    fecha                  DATE        NOT NULL DEFAULT CURRENT_DATE,
    semana_gestacion       SMALLINT    NOT NULL,
    observaciones          TEXT,
    creado_en              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_control_embarazo FOREIGN KEY (embarazo_id)            REFERENCES embarazo (id) ON DELETE CASCADE,
    CONSTRAINT fk_control_prof     FOREIGN KEY (profesional_usuario_id) REFERENCES perfil_profesional (usuario_id) ON DELETE RESTRICT,
    CONSTRAINT fk_control_cita     FOREIGN KEY (cita_id)                REFERENCES cita (id) ON DELETE SET NULL,
    CONSTRAINT uq_control_cita     UNIQUE (cita_id),      -- a lo sumo un control por cita
    CONSTRAINT ck_control_semana   CHECK (semana_gestacion BETWEEN 0 AND 45),
    CONSTRAINT ck_control_fecha    CHECK (fecha <= CURRENT_DATE)
);
COMMENT ON TABLE control IS 'RF-05. Control prenatal. Las mediciones asociadas viven en la tabla medicion.';

CREATE INDEX ix_control_embarazo ON control (embarazo_id, fecha DESC);

-- T11 · tipo_medicion ---------------------------------------------------------
CREATE TABLE tipo_medicion (
    id         SMALLINT     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo     VARCHAR(30)  NOT NULL,
    nombre     VARCHAR(80)  NOT NULL,
    unidad     VARCHAR(15)  NOT NULL,
    valor_min  NUMERIC(8,2) NOT NULL,   -- rango técnico admisible (RNF-10)
    valor_max  NUMERIC(8,2) NOT NULL,
    decimales  SMALLINT     NOT NULL DEFAULT 1,
    registrable_por_gestante BOOLEAN NOT NULL DEFAULT TRUE,
    activo     BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_tipo_medicion_codigo UNIQUE (codigo),
    CONSTRAINT ck_tipo_medicion_rango  CHECK (valor_max > valor_min),
    CONSTRAINT ck_tipo_medicion_dec    CHECK (decimales BETWEEN 0 AND 3)
);
COMMENT ON TABLE tipo_medicion IS 'RNF-12. Catálogo extensible de variables medibles (peso, PA sistólica, PA diastólica, etc.).';

-- T12 · medicion --------------------------------------------------------------
CREATE TABLE medicion (
    id                     BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    embarazo_id            BIGINT          NOT NULL,
    tipo_medicion_id       SMALLINT        NOT NULL,
    control_id             BIGINT,                       -- NULL si la registró la gestante por fuera de un control
    registrado_por         BIGINT          NOT NULL,
    origen                 origen_medicion NOT NULL,
    valor                  NUMERIC(8,2)    NOT NULL,
    fecha_registro         TIMESTAMPTZ     NOT NULL DEFAULT now(),
    semana_gestacion       SMALLINT,
    observaciones          VARCHAR(255),
    CONSTRAINT fk_medicion_embarazo FOREIGN KEY (embarazo_id)      REFERENCES embarazo (id) ON DELETE CASCADE,
    CONSTRAINT fk_medicion_tipo     FOREIGN KEY (tipo_medicion_id) REFERENCES tipo_medicion (id) ON DELETE RESTRICT,
    CONSTRAINT fk_medicion_control  FOREIGN KEY (control_id)       REFERENCES control (id) ON DELETE CASCADE,
    CONSTRAINT fk_medicion_usuario  FOREIGN KEY (registrado_por)   REFERENCES usuario (id) ON DELETE RESTRICT,
    CONSTRAINT ck_medicion_semana   CHECK (semana_gestacion IS NULL OR semana_gestacion BETWEEN 0 AND 45),
    -- Coherencia: si la registró la gestante no puede venir amarrada a un control.
    CONSTRAINT ck_medicion_origen   CHECK (origen = 'PROFESIONAL' OR control_id IS NULL)
);
COMMENT ON TABLE medicion IS 'RF-05, RF-10. Serie temporal de valores; alimenta las gráficas de evolución y el motor de alertas.';

CREATE INDEX ix_medicion_serie   ON medicion (embarazo_id, tipo_medicion_id, fecha_registro);
CREATE INDEX ix_medicion_control ON medicion (control_id);

-- Valida el valor contra el rango técnico del tipo de medición (RNF-10).
CREATE OR REPLACE FUNCTION fn_valida_rango_medicion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_min NUMERIC(8,2);
    v_max NUMERIC(8,2);
    v_nom VARCHAR(80);
    v_permitida BOOLEAN;
BEGIN
    SELECT valor_min, valor_max, nombre, registrable_por_gestante
      INTO v_min, v_max, v_nom, v_permitida
      FROM tipo_medicion WHERE id = NEW.tipo_medicion_id;

    IF NEW.valor < v_min OR NEW.valor > v_max THEN
        RAISE EXCEPTION 'Valor % fuera del rango técnico de "%" (% a %)', NEW.valor, v_nom, v_min, v_max
            USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.origen = 'GESTANTE' AND NOT v_permitida THEN
        RAISE EXCEPTION 'La gestante no está autorizada a registrar "%"', v_nom
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER tg_medicion_rango
    BEFORE INSERT OR UPDATE ON medicion
    FOR EACH ROW EXECUTE FUNCTION fn_valida_rango_medicion();

-- T13 · tipo_sintoma ----------------------------------------------------------
CREATE TABLE tipo_sintoma (
    id     SMALLINT    GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL,
    nombre VARCHAR(80) NOT NULL,
    activo BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_tipo_sintoma_codigo UNIQUE (codigo)
);
COMMENT ON TABLE tipo_sintoma IS 'RF-06. Catálogo de síntomas frecuentes; admite descripción libre adicional.';

-- T14 · sintoma ---------------------------------------------------------------
CREATE TABLE sintoma (
    id              BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    embarazo_id     BIGINT      NOT NULL,
    tipo_sintoma_id SMALLINT,
    descripcion     VARCHAR(255) NOT NULL,
    intensidad      SMALLINT,
    fecha           DATE        NOT NULL DEFAULT CURRENT_DATE,
    observaciones   TEXT,
    registrado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_sintoma_embarazo FOREIGN KEY (embarazo_id)     REFERENCES embarazo (id) ON DELETE CASCADE,
    CONSTRAINT fk_sintoma_tipo     FOREIGN KEY (tipo_sintoma_id) REFERENCES tipo_sintoma (id) ON DELETE SET NULL,
    CONSTRAINT ck_sintoma_intens   CHECK (intensidad IS NULL OR intensidad BETWEEN 1 AND 5),
    CONSTRAINT ck_sintoma_fecha    CHECK (fecha <= CURRENT_DATE),
    CONSTRAINT ck_sintoma_desc     CHECK (length(btrim(descripcion)) > 0)
);
COMMENT ON TABLE sintoma IS 'RF-06. Lo registra la gestante; lo consulta el profesional asignado.';

CREATE INDEX ix_sintoma_embarazo ON sintoma (embarazo_id, fecha DESC);

-- T15 · tipo_examen -----------------------------------------------------------
CREATE TABLE tipo_examen (
    id          SMALLINT    GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo      VARCHAR(30) NOT NULL,
    nombre      VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo      BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_tipo_examen_codigo UNIQUE (codigo)
);
COMMENT ON TABLE tipo_examen IS 'RF-08. Catálogo de exámenes (laboratorio, ecografía, etc.).';

-- T16 · examen ----------------------------------------------------------------
CREATE TABLE examen (
    id                     BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    embarazo_id            BIGINT      NOT NULL,
    tipo_examen_id         SMALLINT    NOT NULL,
    profesional_usuario_id BIGINT      NOT NULL,
    fecha                  DATE        NOT NULL,
    resultado              TEXT        NOT NULL,
    observaciones          TEXT,
    registrado_en          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_examen_embarazo FOREIGN KEY (embarazo_id)            REFERENCES embarazo (id) ON DELETE CASCADE,
    CONSTRAINT fk_examen_tipo     FOREIGN KEY (tipo_examen_id)         REFERENCES tipo_examen (id) ON DELETE RESTRICT,
    CONSTRAINT fk_examen_prof     FOREIGN KEY (profesional_usuario_id) REFERENCES perfil_profesional (usuario_id) ON DELETE RESTRICT,
    CONSTRAINT ck_examen_fecha    CHECK (fecha <= CURRENT_DATE),
    CONSTRAINT ck_examen_result   CHECK (length(btrim(resultado)) > 0)
);
COMMENT ON TABLE examen IS 'RF-08. Lo registra el profesional; la gestante lo consulta en modo lectura.';

CREATE INDEX ix_examen_embarazo ON examen (embarazo_id, fecha DESC);

-- =============================================================================
-- 5. MOTOR DE ALERTAS
-- =============================================================================

-- T17 · regla_alerta ----------------------------------------------------------
CREATE TABLE regla_alerta (
    id               BIGINT           GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo_medicion_id SMALLINT         NOT NULL,
    codigo           VARCHAR(40)      NOT NULL,
    operador         operador_regla   NOT NULL,
    valor_referencia NUMERIC(8,2),
    valor_min        NUMERIC(8,2),
    valor_max        NUMERIC(8,2),
    semana_desde     SMALLINT         NOT NULL DEFAULT 0,
    semana_hasta     SMALLINT         NOT NULL DEFAULT 45,
    severidad        severidad_alerta NOT NULL DEFAULT 'ADVERTENCIA',
    mensaje          VARCHAR(255)     NOT NULL,
    activa           BOOLEAN          NOT NULL DEFAULT TRUE,
    creada_por       BIGINT           NOT NULL,
    creada_en        TIMESTAMPTZ      NOT NULL DEFAULT now(),
    CONSTRAINT fk_regla_tipo   FOREIGN KEY (tipo_medicion_id) REFERENCES tipo_medicion (id) ON DELETE CASCADE,
    CONSTRAINT fk_regla_admin  FOREIGN KEY (creada_por)       REFERENCES usuario (id) ON DELETE RESTRICT,
    CONSTRAINT uq_regla_codigo UNIQUE (codigo),
    CONSTRAINT ck_regla_semana CHECK (semana_desde <= semana_hasta AND semana_hasta <= 45),
    -- Coherencia entre operador y los valores que exige
    CONSTRAINT ck_regla_valores CHECK (
        (operador = 'FUERA_DE_RANGO' AND valor_min IS NOT NULL AND valor_max IS NOT NULL AND valor_max > valor_min)
        OR (operador <> 'FUERA_DE_RANGO' AND valor_referencia IS NOT NULL))
);
COMMENT ON TABLE regla_alerta IS 'RF-11. Umbrales configurables por el administrador; hacen las alertas parametrizables sin tocar el código.';

-- T18 · alerta ----------------------------------------------------------------
CREATE TABLE alerta (
    id                   BIGINT           GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    embarazo_id          BIGINT           NOT NULL,
    regla_alerta_id      BIGINT           NOT NULL,
    medicion_id          BIGINT,
    control_id           BIGINT,
    severidad            severidad_alerta NOT NULL,
    mensaje              VARCHAR(255)     NOT NULL,
    valor_detectado      NUMERIC(8,2)     NOT NULL,
    estado               estado_alerta    NOT NULL DEFAULT 'PENDIENTE',
    generada_en          TIMESTAMPTZ      NOT NULL DEFAULT now(),
    revisada_por         BIGINT,
    fecha_revision       TIMESTAMPTZ,
    observacion_revision VARCHAR(255),
    CONSTRAINT fk_alerta_embarazo FOREIGN KEY (embarazo_id)     REFERENCES embarazo (id) ON DELETE CASCADE,
    CONSTRAINT fk_alerta_regla    FOREIGN KEY (regla_alerta_id) REFERENCES regla_alerta (id) ON DELETE RESTRICT,
    CONSTRAINT fk_alerta_medicion FOREIGN KEY (medicion_id)     REFERENCES medicion (id) ON DELETE CASCADE,
    CONSTRAINT fk_alerta_control  FOREIGN KEY (control_id)      REFERENCES control (id) ON DELETE CASCADE,
    CONSTRAINT fk_alerta_revisor  FOREIGN KEY (revisada_por)    REFERENCES perfil_profesional (usuario_id) ON DELETE SET NULL,
    -- Una alerta siempre nace de una medición (que puede o no pertenecer a un control).
    CONSTRAINT ck_alerta_origen   CHECK (medicion_id IS NOT NULL),
    -- Coherencia del ciclo de vida: revisada <=> hay revisor y fecha.
    CONSTRAINT ck_alerta_revision CHECK (
        (estado = 'PENDIENTE' AND revisada_por IS NULL     AND fecha_revision IS NULL) OR
        (estado <> 'PENDIENTE' AND revisada_por IS NOT NULL AND fecha_revision IS NOT NULL)),
    -- No se duplica la misma alerta para la misma medición y regla.
    CONSTRAINT uq_alerta_medicion_regla UNIQUE (medicion_id, regla_alerta_id)
);
COMMENT ON TABLE alerta IS 'RF-11, RF-12. Informativa, nunca diagnóstica. La revisa el profesional asignado.';

CREATE INDEX ix_alerta_pendiente ON alerta (embarazo_id, generada_en DESC) WHERE estado = 'PENDIENTE';

-- =============================================================================
-- 6. CONTENIDO EDUCATIVO, AUDITORÍA Y CONFIGURACIÓN
-- =============================================================================

-- T19 · contenido_educativo ---------------------------------------------------
CREATE TABLE contenido_educativo (
    id            BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    titulo        VARCHAR(160) NOT NULL,
    cuerpo        TEXT         NOT NULL,
    categoria     VARCHAR(60),
    semana_desde  SMALLINT     NOT NULL,
    semana_hasta  SMALLINT     NOT NULL,
    publicado     BOOLEAN      NOT NULL DEFAULT FALSE,
    creado_por    BIGINT       NOT NULL,
    creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_contenido_admin FOREIGN KEY (creado_por) REFERENCES usuario (id) ON DELETE RESTRICT,
    CONSTRAINT ck_contenido_sem   CHECK (semana_desde BETWEEN 0 AND 45
                                         AND semana_hasta BETWEEN 0 AND 45
                                         AND semana_desde <= semana_hasta),
    CONSTRAINT ck_contenido_texto CHECK (length(btrim(titulo)) > 0 AND length(btrim(cuerpo)) > 0)
);
COMMENT ON TABLE contenido_educativo IS 'RF-16. Se muestra a la gestante según su semana de gestación.';

CREATE INDEX ix_contenido_semana ON contenido_educativo (semana_desde, semana_hasta) WHERE publicado;

CREATE TRIGGER tg_contenido_actualizado
    BEFORE UPDATE ON contenido_educativo
    FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

-- T20 · contenido_lectura -----------------------------------------------------
CREATE TABLE contenido_lectura (
    contenido_id BIGINT      NOT NULL,
    usuario_id   BIGINT      NOT NULL,
    leido_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_contenido_lectura PRIMARY KEY (contenido_id, usuario_id),
    CONSTRAINT fk_lectura_contenido FOREIGN KEY (contenido_id) REFERENCES contenido_educativo (id) ON DELETE CASCADE,
    CONSTRAINT fk_lectura_usuario   FOREIGN KEY (usuario_id)   REFERENCES usuario (id) ON DELETE CASCADE
);
COMMENT ON TABLE contenido_lectura IS 'Tabla puente N:M: qué contenido ha consultado cada gestante (insumo de estadísticas, RF-16).';

-- T21 · auditoria -------------------------------------------------------------
CREATE TABLE auditoria (
    id          BIGINT            GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id  BIGINT,
    accion      accion_auditoria  NOT NULL,
    entidad     VARCHAR(40)       NOT NULL,
    entidad_id  BIGINT,
    detalle     JSONB,
    ip          INET,
    ocurrido_en TIMESTAMPTZ       NOT NULL DEFAULT now(),
    CONSTRAINT fk_auditoria_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id) ON DELETE SET NULL,
    CONSTRAINT ck_auditoria_entidad CHECK (length(btrim(entidad)) > 0)
);
COMMENT ON TABLE auditoria IS 'RNF-14. Registro append-only de acciones relevantes: quién, qué y cuándo.';

CREATE INDEX ix_auditoria_usuario ON auditoria (usuario_id, ocurrido_en DESC);
CREATE INDEX ix_auditoria_entidad ON auditoria (entidad, entidad_id);

-- T22 · configuracion_sistema -------------------------------------------------
CREATE TABLE configuracion_sistema (
    clave           VARCHAR(60)  PRIMARY KEY,
    valor           VARCHAR(255) NOT NULL,
    descripcion     TEXT,
    actualizado_por BIGINT,
    actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT fk_config_usuario FOREIGN KEY (actualizado_por) REFERENCES usuario (id) ON DELETE SET NULL
);
COMMENT ON TABLE configuracion_sistema IS 'Parámetros globales editables por el administrador (RF-14).';

-- =============================================================================
-- 7. VISTAS DE CONSULTA (RF-09, RF-10, RF-13)
-- =============================================================================

-- Estado actual de cada embarazo, con la semana calculada al vuelo.
CREATE OR REPLACE VIEW v_embarazo_actual AS
SELECT e.id                AS embarazo_id,
       e.gestante_usuario_id,
       u.nombre || ' ' || u.apellido AS gestante,
       e.fecha_inicio,
       e.fecha_estimada_parto,
       e.estado,
       fn_semana_gestacion(e.fecha_inicio, CURRENT_DATE) AS semana_actual
FROM embarazo e
JOIN usuario  u ON u.id = e.gestante_usuario_id;

-- RF-09: historial cronológico unificado del embarazo.
CREATE OR REPLACE VIEW v_historial_embarazo AS
SELECT c.embarazo_id, 'CONTROL'::TEXT AS tipo, c.id AS registro_id,
       c.fecha::TIMESTAMPTZ AS fecha, COALESCE(c.observaciones, 'Control prenatal') AS detalle
FROM control c
UNION ALL
SELECT s.embarazo_id, 'SINTOMA', s.id, s.fecha::TIMESTAMPTZ, s.descripcion FROM sintoma s
UNION ALL
SELECT x.embarazo_id, 'EXAMEN', x.id, x.fecha::TIMESTAMPTZ, x.resultado FROM examen x
UNION ALL
SELECT ci.embarazo_id, 'CITA', ci.id, (ci.fecha + ci.hora)::TIMESTAMPTZ, ci.estado::TEXT FROM cita ci
UNION ALL
SELECT a.embarazo_id, 'ALERTA', a.id, a.generada_en, a.mensaje FROM alerta a;

-- RF-13: pacientes vigentes de cada profesional.
CREATE OR REPLACE VIEW v_pacientes_profesional AS
SELECT asg.profesional_usuario_id,
       asg.gestante_usuario_id,
       u.nombre || ' ' || u.apellido AS gestante,
       e.id AS embarazo_id,
       fn_semana_gestacion(e.fecha_inicio, CURRENT_DATE) AS semana_actual,
       (SELECT count(*) FROM alerta al
         WHERE al.embarazo_id = e.id AND al.estado = 'PENDIENTE') AS alertas_pendientes
FROM asignacion asg
JOIN usuario  u ON u.id = asg.gestante_usuario_id
LEFT JOIN embarazo e ON e.gestante_usuario_id = asg.gestante_usuario_id AND e.estado = 'ACTIVO'
WHERE asg.activa;

-- =============================================================================
-- 8. DATOS INICIALES DE CATÁLOGOS
-- =============================================================================

INSERT INTO rol (id, codigo, nombre, descripcion) VALUES
    (1, 'GESTANTE',      'Gestante',            'Registra y consulta la información de su propio embarazo.'),
    (2, 'PROFESIONAL',   'Profesional de salud','Atiende a las gestantes que tiene asignadas.'),
    (3, 'ADMINISTRADOR', 'Administrador',       'Gestiona usuarios, asignaciones, reglas y contenido.');

INSERT INTO tipo_medicion (codigo, nombre, unidad, valor_min, valor_max, decimales, registrable_por_gestante) VALUES
    ('PESO',           'Peso corporal',            'kg',    30.0, 200.0, 1, TRUE),
    ('PA_SISTOLICA',   'Presión arterial sistólica','mmHg',  60.0, 260.0, 0, TRUE),
    ('PA_DIASTOLICA',  'Presión arterial diastólica','mmHg', 30.0, 180.0, 0, TRUE),
    ('ALTURA_UTERINA', 'Altura uterina',           'cm',     5.0,  50.0, 1, FALSE),
    ('FCF',            'Frecuencia cardiaca fetal','lpm',   60.0, 220.0, 0, FALSE);

INSERT INTO tipo_control (codigo, nombre, duracion_min) VALUES
    ('PRIMERA_CONSULTA', 'Primera consulta prenatal', 45),
    ('CONTROL_PRENATAL', 'Control prenatal',          30),
    ('ECOGRAFIA',        'Ecografía',                 30),
    ('CONTROL_RIESGO',   'Control de alto riesgo',    45);

INSERT INTO tipo_examen (codigo, nombre, descripcion) VALUES
    ('HEMOGRAMA',    'Hemograma completo',        'Cuadro hemático de rutina.'),
    ('GLICEMIA',     'Glicemia',                  'Tamizaje de diabetes gestacional.'),
    ('UROANALISIS',  'Uroanálisis',               'Detección de infección urinaria.'),
    ('ECO_OBSTETRICA','Ecografía obstétrica',     'Valoración del crecimiento fetal.'),
    ('SEROLOGIA',    'Serología',                 'Tamizaje de sífilis.');

INSERT INTO tipo_sintoma (codigo, nombre) VALUES
    ('NAUSEAS',        'Náuseas'),
    ('CEFALEA',        'Dolor de cabeza'),
    ('EDEMA',          'Hinchazón de pies o manos'),
    ('SANGRADO',       'Sangrado'),
    ('CONTRACCIONES',  'Contracciones'),
    ('MAREO',          'Mareo'),
    ('OTRO',           'Otro');

INSERT INTO configuracion_sistema (clave, valor, descripcion) VALUES
    ('semanas_max_gestacion',     '45',   'Semana máxima admitida en validaciones.'),
    ('dias_recordatorio_cita',    '3',    'Días de anticipación para destacar la próxima cita.'),
    ('sesion_horas_vigencia',     '8',    'Vigencia del token de sesión en horas.'),
    ('backup_frecuencia_horas',   '24',   'RNF-13. Frecuencia del respaldo automático.');

-- =============================================================================
-- FIN DEL SCRIPT
-- =============================================================================
