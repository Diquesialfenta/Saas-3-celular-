# Encauza

Plataforma SaaS para que agencias, empresas de servicios y profesionales independientes gestionen todo el ciclo con sus clientes: propuesta, contrato con firma electrónica, cobro, onboarding, proyecto, portal del cliente, posventa y fidelización.

> «Encauza» es un nombre provisional. Se cambia en un solo sitio: `src/lib/config.ts` (`APP_NAME`).

## Tipos de usuario

| Usuario | Qué tiene |
|---|---|
| **Independiente** | Cuenta propia con su plan: CRM, propuestas, contratos, facturación, proyectos, portal, automatizaciones e IA. |
| **Empresa** | Lo anterior más equipo, departamentos, roles y permisos personalizados, carga de trabajo, productividad y analítica de equipo. |
| **Cliente final** | Acceso gratuito por invitación a un portal privado con la marca del proveedor. |
| **Superadministrador** | Panel `/admin`: cuentas, usuarios, planes y precios, promociones, ingresos, consumo, soporte y avisos globales. |

Un independiente pasa a empresa desde **Configuración → Plan**. Es la misma cuenta (mismo `workspaceId`): no se mueve ni se pierde ningún dato.

## Módulos

- **CRM**: clientes, contactos, historial, notas, etiquetas, embudo de oportunidades con arrastrar y soltar.
- **Propuestas interactivas**: editor con secciones, conceptos opcionales y periódicos, impuestos, descuentos, anticipo y plazos. Enlace público donde el cliente elige los extras y acepta o rechaza. Seguimiento de envío y apertura.
- **Contratos con firma electrónica**: plantillas con variables (`{{cliente.nombre}}`, `{{propuesta.total}}`…), firma del proveedor y del cliente con trazo, nombre, IP, fecha y huella SHA-256 del documento, y registro imprimible en PDF.
- **Facturación y cobros**: facturas, anticipo y pagos fraccionados generados desde la propuesta, cobros recurrentes, pagos manuales, pago con tarjeta vía Stripe de cada cuenta (con webhook), facturas vencidas y recordatorios.
- **Proyectos**: etapas, tareas, subtareas, prioridades, responsables, fechas, estimaciones y horas, hitos, tablero kanban, entregables con aprobación del cliente, archivos con versiones y visibilidad por cliente, solicitudes de cambio y ampliación (con propuesta automática), documentos e informes, reuniones.
- **Onboarding automático**: activa el portal, publica la bienvenida, pide el formulario y los archivos, crea el proyecto desde plantilla y comparte el enlace para agendar la reunión inicial.
- **Portal del cliente**: inicio con pendientes, proyectos y cronograma, entregas para aprobar o pedir cambios, documentos y formularios, pagos y contratos, mensajes, soporte por tickets, catálogo de servicios adicionales, recomendaciones y asistente de IA.
- **Automatizaciones**: disparadores (propuesta aceptada, contrato firmado, pago confirmado, entregable aprobado, proyecto completado…) con condiciones y acciones encadenadas; recetas listas e historial de ejecuciones.
- **Plantillas y formularios**: propuestas, contratos, proyectos, documentos, correos y procesos de onboarding; constructor de formularios inteligentes.
- **IA (Claude)**: redacción de propuestas, contratos, plantillas, briefs, planes de trabajo, informes y resúmenes de reunión; asistente del equipo y asistente del portal, cada uno limitado a los datos que su usuario puede ver. El consumo cuenta para los créditos del plan.
- **Fidelización**: encuestas NPS, testimonios con moderación, programa de referidos (conversión a cliente), detección de renovaciones y ventas adicionales.
- **Agenda**: calendario, enlaces públicos de reserva con disponibilidad y zona horaria, archivo `.ics` por reunión y suscripción ICS para Google Calendar, Outlook o Apple.
- **Integraciones**: Stripe, correo propio por HTTPS, WhatsApp Business (API de Meta), sala de videollamadas, webhook firmado con HMAC y calendario. Las claves se guardan cifradas con AES-256-GCM.

## Arquitectura

- **Next.js 16** (App Router, Server Actions, Turbopack), **React 19**, **TypeScript**, **Tailwind CSS 4**.
- **Cloudflare D1** con **Prisma 6**. Esquema en `prisma/schema.prisma` y migraciones SQL en `drizzle/`.
- **Aislamiento entre cuentas**: toda entidad lleva `workspaceId`; las páginas y acciones obtienen el contexto con `requireWorkspace()` / `actionContext()` (`src/lib/tenant.ts`) y filtran siempre por él. Los permisos se comprueban en el servidor en cada acción.
- **Sesiones** propias en base de datos (cookie `httpOnly`, token con hash SHA-256), contraseñas con bcrypt.
- **Motor de eventos** en `src/lib/automations.ts`: los servicios emiten eventos y se ejecutan las automatizaciones de la cuenta, con registro de cada ejecución.
- **Archivos** en R2 (`src/lib/storage.ts`), con descargas autorizadas dentro de la aplicación.
- **Web pública** (`/`): construida con el kit de taste-skill (`public/assets`, `public/landing.css`) y servida como HTML estático desde `src/app/route.ts`, porque los scripts del kit modifican el DOM. Los precios salen de la base de datos.
- **Interfaz del producto**: sistema propio en `src/components/ui.tsx` y `src/app/(app)/globals.css`, con los mismos tokens que la web y los criterios de movimiento de emil-design-eng.

```
src/
  app/
    route.ts                 web pública (HTML estático)
    (app)/(auth)/            login, registro, invitaciones, recuperación
    (app)/(public)/          propuesta, firma, factura, formulario, encuesta, testimonio, agenda
    (app)/app/               panel de la cuenta (independiente o empresa)
    (app)/portal/            portal del cliente final
    (app)/admin/             superadministración
    api/                     archivos, Stripe, ICS, exportación, cron
  lib/                       datos, auth, tenant, permisos, IA, correo, servicios de negocio
  components/                UI compartida
  landing/                   documento de la web pública
prisma/                      esquema y semilla (planes y superadmin)
```

## Puesta en marcha

Requisitos: Node 22 o posterior y npm.

```bash
npm ci
cp .env.example .dev.vars
npm run db:push
npm run dev
```

D1 y R2 son locales en desarrollo. Los cuatro planes se inicializan una sola vez y se administran desde `/admin/planes`. Para probar superadministración local, define `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD` en `.dev.vars` y ejecuta `node --env-file=.dev.vars --import tsx prisma/seed.ts`.

### ChatGPT Sites

Compila con `npm run build:sites`. El manifiesto declara D1 y R2 y el artefacto de publicación contiene también las migraciones. Configura `APP_SECRET` y `CRON_SECRET` como secretos en Sites y `APP_URL` con la URL publicada. Para crear el primer superadministrador de producción, abre `/configurar` con la sesión de ChatGPT del propietario configurado en `SITES_OWNER_EMAIL`. La página se cierra después de la activación.

## Servicios externos

| Variable | Para qué |
|---|---|
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Activa la IA. |
| `RESEND_API_KEY`, `MAIL_FROM` | Correo de la plataforma mediante la API de Resend y un remitente verificado. |
| `SMTP_URL`, `SMTP_RELAY_URL`, `SMTP_RELAY_TOKEN` | SMTP mediante un relay HTTPS de confianza. El relay recibe un POST Bearer con `{ operation, smtpUrl, message }` y devuelve 2xx si la operación se completa. Las cuentas con SMTP de Resend también pueden usar el transporte HTTPS de Resend. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Suscripciones de la plataforma. Webhook en `/api/stripe/platform` y precios de Stripe por plan. |
| `CRON_SECRET` | Autoriza `/api/cron`. Un programador debe llamar cada hora con `Authorization: Bearer <CRON_SECRET>`; los Sites privados también requieren acceso de servicio de Sites. |

Los cobros de cada cuenta usan la clave de Stripe de **Integraciones** y el webhook `/api/stripe/webhook/<workspaceId>`. En un despliegue privado, los enlaces para clientes, los webhooks y las suscripciones de calendario requieren que Sites admita al visitante o al servicio externo.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Desarrollo local |
| `npm run build:sites` | Compila y prepara el Worker para Sites |
| `npm run typecheck` | Comprobación de tipos |
| `npm run db:push` | Aplica las migraciones de D1 en local |
| `npm run db:seed` | Crea los planes y el superadministrador local si está configurado |
