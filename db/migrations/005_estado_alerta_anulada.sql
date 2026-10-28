-- =============================================================================
--  Migración 005 · Nuevo estado de alerta: ANULADA
--  Ejecutar DESPUÉS de 004_privacidad_y_recuperacion.sql
-- =============================================================================
--  Va sola porque PostgreSQL no permite USAR un valor de enum en la misma
--  transacción que lo crea; la 006 ya lo usa.
-- =============================================================================

SET search_path TO seguimiento_embarazo, public;

ALTER TYPE estado_alerta ADD VALUE IF NOT EXISTS 'ANULADA';
