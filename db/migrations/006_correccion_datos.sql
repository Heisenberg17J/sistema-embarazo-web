-- =============================================================================
--  Migración 006 · Corrección de datos clínicos
--  Ejecutar DESPUÉS de 005_estado_alerta_anulada.sql
-- =============================================================================
--  Una gestante que escribe 1680 en lugar de 168 recibe una alerta crítica que
--  le dice que vaya a urgencias, y hasta ahora ese dato no se podía corregir.
--
--  Al corregir o eliminar un dato, las alertas que generó NO se borran: pasan a
--  ANULADA. Si se borraran, el profesional perdería sin aviso una alerta que
--  quizá estaba atendiendo; y alguien podría "esconder" un valor peligroso
--  eliminándolo. Anulada, la alerta queda visible con quién la anuló y por qué.
-- =============================================================================

SET search_path TO seguimiento_embarazo, public;

-- 1. Trazabilidad de la anulación ---------------------------------------------

ALTER TABLE alerta
    ADD COLUMN anulada_en       TIMESTAMPTZ,
    ADD COLUMN anulada_por      BIGINT,
    ADD COLUMN motivo_anulacion VARCHAR(255),
    ADD CONSTRAINT fk_alerta_anulador FOREIGN KEY (anulada_por) REFERENCES usuario (id) ON DELETE SET NULL;

-- 2. La alerta sobrevive al dato que la originó -------------------------------
--    Antes: ON DELETE CASCADE (borrar el dato borraba la alerta).
--    Ahora: SET NULL. Una alerta anulada ya no apunta a nada; conserva el valor
--    detectado y el mensaje, que es lo que importa del historial.

ALTER TABLE alerta
    DROP CONSTRAINT fk_alerta_medicion,
    DROP CONSTRAINT fk_alerta_sintoma,
    DROP CONSTRAINT fk_alerta_control;

ALTER TABLE alerta
    ADD CONSTRAINT fk_alerta_medicion FOREIGN KEY (medicion_id) REFERENCES medicion (id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_alerta_sintoma  FOREIGN KEY (sintoma_id)  REFERENCES sintoma (id)  ON DELETE SET NULL,
    ADD CONSTRAINT fk_alerta_control  FOREIGN KEY (control_id)  REFERENCES control (id)  ON DELETE SET NULL;

-- 3. Coherencia del ciclo de vida ---------------------------------------------

-- Una alerta viva nace de exactamente un dato; una anulada puede no tener ninguno.
ALTER TABLE alerta DROP CONSTRAINT ck_alerta_origen;
ALTER TABLE alerta ADD CONSTRAINT ck_alerta_origen CHECK (
    estado = 'ANULADA'
    OR (num_nonnulls(medicion_id, sintoma_id) = 1
        AND (medicion_id IS NULL OR (regla_alerta_id IS NOT NULL AND valor_detectado IS NOT NULL))));

-- PENDIENTE: sin revisor ni anulación. REVISADA/DESCARTADA: revisor y fecha.
-- ANULADA: debe constar cuándo; puede conservar al revisor si ya la habían atendido.
ALTER TABLE alerta DROP CONSTRAINT ck_alerta_revision;
ALTER TABLE alerta ADD CONSTRAINT ck_alerta_revision CHECK (
    (estado = 'PENDIENTE'  AND revisada_por IS NULL AND fecha_revision IS NULL AND anulada_en IS NULL)
    OR (estado IN ('REVISADA', 'DESCARTADA') AND revisada_por IS NOT NULL AND fecha_revision IS NOT NULL)
    OR (estado = 'ANULADA' AND anulada_en IS NOT NULL));

-- 4. Desde cuándo se puede corregir ------------------------------------------
--    La ventana para corregir se cuenta desde que el dato se GUARDÓ, no desde la
--    fecha que declara: `fecha_registro` la puede fijar quien registra (incluso en
--    el pasado) y con ella la ventana ya estaría vencida al nacer. Control, síntoma
--    y examen ya tienen ese instante (creado_en / registrado_en); la medición no.

ALTER TABLE medicion ADD COLUMN creado_en TIMESTAMPTZ NOT NULL DEFAULT now();

-- 5. Qué se puede volver a evaluar --------------------------------------------
--    Al corregir una medición se evalúa de nuevo y puede nacer una alerta nueva
--    para la misma regla; el índice único era sobre (medicion_id, regla) y con
--    el vínculo en NULL no estorba.

COMMENT ON COLUMN alerta.anulada_en IS
    'Cuándo se anuló porque el dato que la originó se corrigió o se eliminó.';
COMMENT ON COLUMN alerta.motivo_anulacion IS
    'Por qué se anuló, en palabras que pueda leer la gestante y el profesional.';

-- =============================================================================
-- FIN DE LA MIGRACIÓN 006
-- =============================================================================
