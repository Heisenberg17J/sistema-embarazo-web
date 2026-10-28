# Sistema Web de Seguimiento del Embarazo

## Descripción

Aplicación web para facilitar el seguimiento y registro de la evolución de un embarazo, permitiendo que las gestantes y los profesionales de salud consulten y gestionen información relevante durante las diferentes etapas del embarazo.

El sistema busca centralizar información como controles médicos, citas, síntomas, mediciones y resultados de exámenes, proporcionando una visualización sencilla de la evolución del embarazo.

> **Nota:** El sistema tiene como objetivo apoyar el seguimiento y organización de información, no realizar diagnósticos médicos ni reemplazar la valoración de un profesional de salud.

---

## Objetivo

Desarrollar una aplicación web que permita registrar, consultar y visualizar información relacionada con el seguimiento de un embarazo mediante diferentes roles de usuario.

---

## Roles del sistema

### 1. Gestante

La gestante podrá:

* Registrar y consultar información personal.
* Consultar el estado actual de su embarazo.
* Registrar síntomas y observaciones.
* Registrar peso y presión arterial.
* Consultar sus controles médicos.
* Consultar resultados de exámenes registrados por el profesional.
* Consultar próximas citas.
* Visualizar gráficas de evolución.
* Recibir alertas relacionadas con valores registrados.
* Consultar información educativa según la semana de gestación.

### 2. Profesional de salud

El profesional podrá:

* Consultar las gestantes que tiene asignadas.
* Consultar el historial de seguimiento.
* Registrar controles médicos.
* Registrar resultados de exámenes.
* Registrar observaciones.
* Programar y gestionar citas.
* Consultar la evolución de las mediciones.
* Revisar alertas generadas por el sistema.

### 3. Administrador

El administrador podrá:

* Crear, modificar y desactivar usuarios.
* Gestionar los roles del sistema.
* Asignar profesionales a gestantes.
* Gestionar información educativa.
* Consultar estadísticas generales.
* Gestionar configuraciones del sistema.

---

# Requisitos funcionales

Los requisitos funcionales describen las acciones y servicios que debe proporcionar el sistema.

### RF-01 — Registro de usuarios

El sistema deberá permitir registrar nuevos usuarios proporcionando como mínimo:

* Nombre.
* Apellido.
* Correo electrónico.
* Contraseña.
* Tipo de usuario.

El sistema deberá validar que el correo electrónico no esté registrado previamente.

### RF-02 — Inicio de sesión

El sistema deberá permitir a los usuarios autenticarse mediante correo electrónico y contraseña.

Después de iniciar sesión, el sistema deberá mostrar las funcionalidades correspondientes al rol del usuario.

### RF-03 — Gestión de roles y permisos

El sistema deberá manejar tres roles:

* Gestante.
* Profesional de salud.
* Administrador.

Cada rol deberá tener acceso únicamente a las funcionalidades autorizadas.

### RF-04 — Registro del embarazo

El sistema deberá permitir a una gestante registrar un embarazo con información como:

* Fecha de inicio.
* Fecha estimada de parto.
* Estado del embarazo.

El sistema deberá calcular y mostrar la semana aproximada de gestación a partir de las fechas registradas.

### RF-05 — Registro de controles

El profesional de salud deberá poder registrar controles asociados a una gestante.

Cada control podrá contener:

* Fecha.
* Semana de gestación.
* Peso.
* Presión arterial.
* Observaciones.
* Profesional responsable.

### RF-06 — Registro de síntomas

La gestante deberá poder registrar síntomas indicando:

* Fecha.
* Tipo o descripción del síntoma.
* Observaciones.

El profesional podrá consultar estos registros durante el seguimiento.

### RF-07 — Gestión de citas

El profesional deberá poder crear y gestionar citas.

La información de una cita deberá incluir:

* Gestante.
* Profesional.
* Fecha.
* Hora.
* Tipo de control.
* Estado.

La gestante deberá poder consultar sus próximas y anteriores citas.

### RF-08 — Registro de exámenes

El profesional deberá poder registrar los resultados de exámenes relacionados con el seguimiento.

Cada registro deberá incluir:

* Tipo de examen.
* Fecha.
* Resultado.
* Observaciones.

La gestante podrá consultar los resultados registrados.

### RF-09 — Historial de seguimiento

El sistema deberá mostrar un historial cronológico de los controles, síntomas, exámenes y citas relacionados con el embarazo.

### RF-10 — Visualización de evolución

El sistema deberá generar gráficas a partir de los datos registrados.

Por ejemplo:

* Evolución del peso.
* Evolución de la presión arterial.
* Evolución de determinadas mediciones registradas.

### RF-11 — Generación de alertas

El sistema deberá generar una alerta cuando un valor registrado cumpla una condición previamente configurada.

Por ejemplo, si una medición supera un umbral definido:

```text
⚠️ ALERTA

Se ha registrado un valor fuera
del rango configurado.

Se recomienda consultar al
profesional de salud.
```

Las alertas deberán ser informativas y no deberán considerarse diagnósticos.

### RF-12 — Consulta de alertas

El profesional deberá poder consultar las alertas asociadas a sus pacientes.

También deberá poder marcar una alerta como revisada.

### RF-13 — Gestión de pacientes

El profesional deberá poder consultar las gestantes que tenga asignadas y acceder a su información de seguimiento.

### RF-14 — Gestión de usuarios

El administrador deberá poder:

* Crear usuarios.
* Editar usuarios.
* Desactivar usuarios.
* Consultar usuarios.
* Asignar roles.

### RF-15 — Asignación de profesionales

El administrador deberá poder asignar una o más gestantes a un profesional de salud.

### RF-16 — Gestión de contenido educativo

El administrador deberá poder crear, modificar y eliminar contenido educativo relacionado con las diferentes etapas del embarazo.

### RF-17 — Panel principal

El sistema deberá proporcionar un panel personalizado dependiendo del rol.

Ejemplo:

```text
GESTANTE
├── Mi embarazo
├── Próxima cita
├── Controles
├── Síntomas
├── Exámenes
├── Evolución
└── Alertas
```

```text
PROFESIONAL
├── Mis pacientes
├── Citas
├── Controles
├── Exámenes
├── Alertas
└── Historial
```

```text
ADMINISTRADOR
├── Usuarios
├── Profesionales
├── Gestantes
├── Contenido
└── Estadísticas
```

---

# Requisitos no funcionales

Los requisitos no funcionales establecen las características de calidad y restricciones que debe cumplir el sistema.

### RNF-01 — Seguridad

El sistema deberá proteger las credenciales de los usuarios y no deberá almacenar contraseñas en texto plano.

Las contraseñas deberán almacenarse utilizando un mecanismo seguro de hashing.

### RNF-02 — Control de acceso

El sistema deberá implementar autorización basada en roles.

Un usuario no deberá poder acceder directamente a funcionalidades que no correspondan a su rol.

### RNF-03 — Privacidad

La información de las gestantes deberá ser accesible únicamente por usuarios autorizados.

El sistema deberá evitar exponer información personal o médica a otros usuarios sin autorización.

### RNF-04 — Protección de datos

La aplicación deberá utilizar conexiones HTTPS en ambientes de producción para proteger la información transmitida entre cliente y servidor.

### RNF-05 — Disponibilidad

El sistema deberá estar disponible para los usuarios durante el horario definido para su funcionamiento.

En caso de una interrupción, deberá ser posible recuperar el sistema sin pérdida significativa de información.

### RNF-06 — Rendimiento

Las operaciones habituales, como iniciar sesión, consultar el historial o cargar el panel principal, deberán responder en un tiempo razonable bajo condiciones normales de uso.

Como objetivo para el MVP, las operaciones comunes deberían responder en menos de **3 segundos**, excluyendo problemas de red o servicios externos.

### RNF-07 — Usabilidad

La interfaz deberá ser sencilla e intuitiva para usuarios con diferentes niveles de experiencia tecnológica.

Las funciones principales deberán poder localizarse fácilmente desde el panel correspondiente.

### RNF-08 — Compatibilidad

La aplicación deberá funcionar correctamente en los principales navegadores modernos:

* Google Chrome.
* Mozilla Firefox.
* Microsoft Edge.
* Safari.

### RNF-09 — Diseño responsive

La interfaz deberá adaptarse a diferentes tamaños de pantalla, incluyendo:

* Computadores.
* Tablets.
* Teléfonos móviles.

### RNF-10 — Integridad de la información

El sistema deberá validar los datos introducidos por los usuarios antes de almacenarlos.

Por ejemplo:

* No permitir fechas inválidas.
* No permitir campos obligatorios vacíos.
* Validar formatos numéricos.
* Validar valores dentro de los rangos técnicos establecidos por el sistema.

### RNF-11 — Mantenibilidad

El código deberá estar organizado en módulos independientes para facilitar su mantenimiento y futura ampliación.

Se deberán separar, como mínimo:

* Frontend.
* Backend.
* Acceso a datos.
* Autenticación.
* Lógica de negocio.

### RNF-12 — Escalabilidad

La arquitectura deberá permitir agregar posteriormente nuevas funcionalidades sin necesidad de modificar completamente el sistema.

Por ejemplo:

* Aplicación móvil.
* Notificaciones.
* Nuevos tipos de mediciones.
* Nuevos roles.
* Integración con dispositivos.

### RNF-13 — Copias de seguridad

La base de datos deberá contar con un mecanismo de respaldo periódico para evitar la pérdida de información ante fallos del sistema.

### RNF-14 — Trazabilidad

El sistema deberá registrar información básica sobre determinadas acciones importantes, como:

* Inicio de sesión.
* Creación de controles.
* Modificación de información.
* Registro de exámenes.
* Gestión de usuarios.

Esto permitirá conocer qué usuario realizó una acción y cuándo.

---

## Funcionalidades principales

### Seguimiento del embarazo

El sistema permitirá registrar información relacionada con:

* Semana de gestación.
* Fecha estimada de parto.
* Peso.
* Presión arterial.
* Síntomas.
* Observaciones.
* Controles médicos.
* Exámenes.
* Citas.

### Visualización de evolución

La gestante y el profesional podrán consultar gráficas relacionadas con la evolución de determinadas variables.

Ejemplo:

```text
Peso
 │
 │              ●
 │          ●
 │      ●
 │  ●
 └────────────────────
    Semanas de gestación
```

### Sistema de alertas

El sistema podrá generar alertas cuando determinados valores registrados superen los rangos configurados.

Las alertas serán informativas y no representarán un diagnóstico médico.

### Gestión de citas

El profesional podrá registrar las citas de seguimiento y la gestante podrá consultar:

* Fecha.
* Hora.
* Profesional.
* Tipo de control.
* Estado de la cita.

---

## Flujo general

```text
Gestante
   │
   ├── Registra información
   ├── Consulta controles
   ├── Consulta citas
   └── Visualiza evolución
             │
             ▼
       Sistema de seguimiento
             │
             ├── Genera alertas
             │
             ▼
      Profesional de salud
             │
             ├── Revisa historial
             ├── Registra controles
             ├── Registra exámenes
             └── Gestiona citas
```

---

## Posible estructura de datos

```text
Usuario
 ├── id
 ├── nombre
 ├── correo
 ├── contraseña
 └── rol

Embarazo
 ├── id
 ├── gestante_id
 ├── fecha_inicio
 ├── fecha_estimada_parto
 └── estado

Control
 ├── id
 ├── embarazo_id
 ├── profesional_id
 ├── fecha
 ├── peso
 ├── presion_arterial
 └── observaciones

Sintoma
 ├── id
 ├── embarazo_id
 ├── fecha
 ├── descripcion
 └── observaciones

Cita
 ├── id
 ├── embarazo_id
 ├── profesional_id
 ├── fecha
 ├── hora
 └── estado

Examen
 ├── id
 ├── embarazo_id
 ├── tipo
 ├── fecha
 ├── resultado
 └── observaciones

Alerta
 ├── id
 ├── embarazo_id
 ├── fecha
 ├── tipo
 ├── mensaje
 └── estado
```

---

## MVP

Para una primera versión funcional se propone implementar:

1. Registro e inicio de sesión.
2. Roles de usuario.
3. Registro de un embarazo.
4. Registro de controles.
5. Registro de peso y presión arterial.
6. Gestión de citas.
7. Historial de controles.
8. Gráficas de evolución.
9. Sistema básico de alertas.
10. Panel diferente para cada rol.
11. Gestión básica de usuarios por parte del administrador.

Las funcionalidades adicionales pueden desarrollarse posteriormente.

---

## Posibles tecnologías

### Frontend

* Next.js
* Tailwind CSS

### Backend

* Express.js

### Base de datos

* PostgreSQL

### Autenticación

* JWT

### Visualización

* Chart.js

---

## Posibles funcionalidades futuras

* Integración con dispositivos de medición.
* Carga de documentos médicos.
* Visualización de ecografías.
* Notificaciones por correo.
* Aplicación móvil.
* Generación de reportes PDF.
* Estadísticas del seguimiento.
* Historial de embarazos anteriores.
* Integración con sistemas hospitalarios.

---

## Alcance

El proyecto se enfocará en el **registro, organización y visualización de información del embarazo**, evitando funciones de diagnóstico automático.

El objetivo principal es desarrollar una aplicación web funcional que permita demostrar:

* Gestión de usuarios y roles.
* Diseño de bases de datos.
* Autenticación y autorización.
* Operaciones CRUD.
* Validación de datos.
* Visualización de datos.
* Generación de alertas mediante reglas.
* Auditoría básica de acciones.
* Desarrollo de una interfaz orientada a diferentes tipos de usuarios.
