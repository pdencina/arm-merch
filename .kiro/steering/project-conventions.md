# ARM Merch — Convenciones del Proyecto

## Stack
- Next.js 14 (App Router) + TypeScript
- Supabase (Auth, Postgres, Storage, Realtime)
- Tailwind CSS + Radix UI
- Zustand para estado del carrito
- SumUp para pagos con tarjeta

## Arquitectura Multi-Campus
- Cada usuario tiene `campus_id` en su perfil
- El inventario, órdenes, y sesiones de caja están aisladas por campus
- Roles globales (`super_admin`, `adm_merch`) pueden ver todos los campus
- Roles locales (`admin`, `voluntario`) solo ven su campus
- Las transferencias mueven productos entre campus

## Roles
- `super_admin`: Acceso total, gestión global
- `adm_merch`: Gestión operacional multi-campus
- `admin`: Pastor/admin de una sede específica
- `voluntario`: Solo ventas (POS) y entregas

## API Routes
- Usar `withAuth` de `@/lib/api` para autenticación
- Usar `getEffectiveCampusId()` para resolver el campus correcto
- Usar `verifyCampusAccess()` para validar acceso a recursos
- Usar `logAudit()` para acciones críticas

## Seguridad
- RLS activo en tablas con datos por campus
- API routes usan service_role_key (bypasea RLS)
- El middleware valida auth con `getUser()` (no getSession)
- Bearer token requerido en todas las API routes

## Permisos
- 60+ permission keys granulares en `module-permissions.ts`
- Defaults por rol + overrides en tabla `module_permissions`
- Super admin usa Proxy (siempre true)

## Convenciones de código
- Idioma de UI: Español
- Idioma de código: Inglés (variables, funciones)
- Comentarios en código: Español ok
- CSS: Tailwind utility-first, tema oscuro por defecto
- Componentes: Client components con 'use client' cuando necesiten interactividad
