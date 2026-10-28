# Contexto del Backend — Proyecto Embarazo

> Este archivo reemplaza el informe anterior, que describía un backend de 4 CRUD (usuarios, tipos de examen, tipos de control y contenido) sin autenticación y con contraseñas en texto plano, construido sobre un esquema distinto (`script.sql`). Ese backend quedó **obsoleto**.

## Estado actual

- **Código:** [`backend/`](backend/README.md), con Node.js 20, Express, PostgreSQL 16 y JWT.
- **Base de datos:** [`db/migrations/`](db/migrations) (`001` a `007`: esquema, signos de alarma, tuteo, privacidad y recuperación, estado `ANULADA`, corrección de datos y configuración real), con datos de prueba en [`db/seeds.sql`](db/seeds.sql) y documentación en [`db/MODELO.md`](db/MODELO.md).
- **URL base local:** `http://localhost:4000/api/v1`. El puerto 3000 queda libre para el frontend Next.js.
- **Pruebas:** `cd backend && npm test`, 152 pruebas de integración contra PostgreSQL; `cd frontend && npm run test:e2e` para las de extremo a extremo y accesibilidad.
- **Despliegue y puesta en producción:** [`DESPLIEGUE.md`](DESPLIEGUE.md).

## Cobertura de requisitos

| Requisito | Dónde |
|---|---|
| RF-01, RF-02 Registro e inicio de sesión | `/auth/*` |
| RF-03, RNF-02 Roles | `middlewares/roles.js` |
| RF-04 Embarazo y semana de gestación | `/embarazos` (FPP, `semanas+días`, trimestre, IMC) |
| RF-05 Controles | `/embarazos/:id/controles` |
| RF-06 Síntomas | `/embarazos/:id/sintomas` (con signos de alarma) |
| RF-07 Citas | `/embarazos/:id/citas`, `/citas` |
| RF-08 Exámenes | `/embarazos/:id/examenes` |
| RF-09 Historial | `/embarazos/:id/historial` |
| RF-10 Gráficas | `/embarazos/:id/mediciones/serie` |
| RF-11, RF-12 Alertas | `services/alertas.js`, `/alertas` |
| RF-13 Pacientes | `/pacientes` |
| RF-14 Usuarios | `/usuarios` |
| RF-15 Asignaciones | `/asignaciones` |
| RF-16 Contenido educativo | `/contenido` |
| RF-17 Panel por rol | `/dashboard` |
| RNF-01 Hash de contraseñas | bcrypt |
| RNF-03 Privacidad | `middlewares/acceso.js` (asignación activa) |
| RNF-10 Validación | zod + CHECK/triggers |
| RNF-14 Trazabilidad | `auditoria` (append-only) |

La lista completa de endpoints, el modelo de seguridad y el detalle del motor de alertas están en [`backend/README.md`](backend/README.md).
