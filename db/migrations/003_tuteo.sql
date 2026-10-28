-- =============================================================================
--  Migración 003 · Tratamiento de "tú" en los mensajes dirigidos a la gestante
--  Ejecutar DESPUÉS de 002_signos_alarma.sql
-- =============================================================================
--  La interfaz tutea a la gestante. Los mensajes de los signos de alarma y de
--  las reglas de alerta se guardan en la base y venían redactados de "usted",
--  así que la app mezclaba los dos tratamientos en la misma pantalla.
--
--  No se edita la migración 002: quien ya la aplicó no recibiría el cambio,
--  porque el control de migraciones la da por ejecutada.
--
--  Solo cambia la redacción. Los umbrales, las severidades y la semana límite
--  de cada signo se conservan tal cual.
-- =============================================================================

SET search_path TO seguimiento_embarazo, public;

-- =============================================================================
-- 1. SIGNOS DE ALARMA
-- =============================================================================

UPDATE tipo_sintoma ts
   SET mensaje_alarma = v.mensaje
  FROM (VALUES
    ('SANGRADO',
        'Sangrado vaginal: acude de inmediato al servicio de urgencias más cercano.'),
    ('CONTRACCIONES',
        'Contracciones antes de la semana 37: acude de inmediato a urgencias.'),
    ('CEFALEA_INTENSA',
        'Dolor de cabeza intenso: acude de inmediato a urgencias y pide que te tomen la presión arterial.'),
    ('VISION_BORROSA',
        'Alteraciones de la visión: acude de inmediato a urgencias y pide que te tomen la presión arterial.'),
    ('DOLOR_EPIGASTRICO',
        'Dolor en la boca del estómago: acude de inmediato al servicio de urgencias.'),
    ('SALIDA_LIQUIDO',
        'Salida de líquido por la vagina: acude de inmediato al servicio de urgencias.'),
    ('DISMINUCION_MOV_FETALES',
        'Disminución de los movimientos del bebé: acude de inmediato al servicio de urgencias.'),
    ('CONVULSION',
        'Convulsión o desmayo: llama a la línea de emergencias o acude de inmediato a urgencias.'),
    ('DOLOR_ABDOMINAL_INTENSO',
        'Dolor abdominal intenso: acude de inmediato al servicio de urgencias.'),
    ('DIFICULTAD_RESPIRAR',
        'Dificultad para respirar: acude de inmediato al servicio de urgencias.'),
    ('HINCHAZON_SUBITA',
        'Hinchazón repentina de cara o manos: consulta hoy con tu profesional de salud y vigila tu presión arterial.'),
    ('FIEBRE',
        'Fiebre durante el embarazo: consulta hoy con tu profesional de salud.'),
    ('VOMITO_PERSISTENTE',
        'Vómito persistente: consulta hoy con tu profesional de salud para evitar la deshidratación.'),
    ('ARDOR_ORINAR',
        'Ardor al orinar: consulta con tu profesional de salud; las infecciones urinarias deben tratarse.')
  ) AS v(codigo, mensaje)
 WHERE ts.codigo = v.codigo;

-- =============================================================================
-- 2. REGLAS DE ALERTA
-- =============================================================================

UPDATE regla_alerta r
   SET mensaje = v.mensaje
  FROM (VALUES
    ('PAS_SEVERA',
        'Presión sistólica de 160 o más: acude de inmediato al servicio de urgencias.'),
    ('PAS_ELEVADA',
        'Presión sistólica de 140 o más: repite la toma en reposo y consulta hoy con tu profesional de salud.'),
    ('PAS_BAJA',
        'Presión sistólica baja: si tienes mareo o desmayo, consulta con tu profesional de salud.'),
    ('PAD_SEVERA',
        'Presión diastólica de 110 o más: acude de inmediato al servicio de urgencias.'),
    ('PAD_ELEVADA',
        'Presión diastólica de 90 o más: repite la toma en reposo y consulta hoy con tu profesional de salud.'),
    ('GLUCOSA_AYUNAS_ALTA',
        'Glucosa en ayunas de 95 mg/dL o más: comenta este resultado con tu profesional de salud.'),
    ('FIEBRE',
        'Temperatura de 38 °C o más: consulta hoy con tu profesional de salud.'),
    ('PESO_FUERA_RANGO',
        'Tu peso registrado está fuera del rango configurado: coméntalo en tu próximo control.')
  ) AS v(codigo, mensaje)
 WHERE r.codigo = v.codigo;

-- FCF_FUERA_RANGO no cambia: su mensaje es impersonal y lo lee el profesional.

-- =============================================================================
-- FIN DE LA MIGRACIÓN 003
-- =============================================================================
