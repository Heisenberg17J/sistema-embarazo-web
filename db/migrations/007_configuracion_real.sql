-- =============================================================================
--  Migración 007 · La configuración del sistema pasa a hacer lo que dice
--  Ejecutar DESPUÉS de 006_correccion_datos.sql
-- =============================================================================
--  El panel del administrador mostraba cuatro parámetros y ninguno se leía en
--  ningún sitio: cambiarlos no hacía nada, y una pantalla que promete lo que no
--  cumple es peor que no tenerla.
--
--  - semanas_max_gestacion y dias_recordatorio_cita: ahora los lee el backend.
--  - sesion_horas_vigencia: la vigencia real sale de JWT_EXPIRA y REFRESH_DIAS del
--    entorno; un número editable aquí sería una mentira.
--  - backup_frecuencia_horas: los respaldos los hace el proveedor de la base; este
--    valor nunca programó nada.
-- =============================================================================

SET search_path TO seguimiento_embarazo, public;

DELETE FROM configuracion_sistema
 WHERE clave IN ('sesion_horas_vigencia', 'backup_frecuencia_horas');

UPDATE configuracion_sistema
   SET descripcion = 'Semana de gestación máxima que admite el sistema (entre 38 y 45). Una fecha de última menstruación más antigua se rechaza al registrar un embarazo.'
 WHERE clave = 'semanas_max_gestacion';

UPDATE configuracion_sistema
   SET descripcion = 'Con cuántos días de anticipación se destaca la próxima cita en el panel de la gestante (entre 0 y 30; 0 la destaca solo el mismo día).'
 WHERE clave = 'dias_recordatorio_cita';
