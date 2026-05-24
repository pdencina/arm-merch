-- ARM Merch — permisos nuevos módulos
-- Ejecutar en Supabase SQL Editor si usas tablas de permisos.
-- Seguro: no elimina datos existentes.

create table if not exists public.permissions (
  key text primary key,
  module text not null,
  section text not null,
  label text not null,
  description text,
  created_at timestamptz default now()
);

create table if not exists public.role_permissions (
  role text not null,
  permission_key text not null references public.permissions(key) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz default now(),
  primary key (role, permission_key)
);

insert into public.permissions (key, module, section, label, description)
values
  ('pricing.view', 'pricing', 'Gestión', 'Ver Pricing Center', 'Permite acceder al centro de precios.'),
  ('pricing.edit', 'pricing', 'Gestión', 'Editar precios', 'Permite modificar precio compra, precio venta y margen.'),
  ('pricing.history', 'pricing', 'Gestión', 'Ver historial de precios', 'Permite revisar cambios históricos de precios.'),
  ('pricing.margins', 'pricing', 'Gestión', 'Ver márgenes', 'Permite revisar rentabilidad y margen por producto.'),

  ('production.view', 'production', 'Ventas', 'Ver producción/retiros', 'Permite ver pedidos en producción, listos para retiro y entregados.'),
  ('production.collect_balance', 'production', 'Ventas', 'Cobrar saldo pendiente', 'Permite cobrar el 50% restante antes de entregar.'),
  ('production.mark_ready', 'production', 'Ventas', 'Marcar listo para retiro', 'Permite cambiar pedidos a estado listo para retiro.'),
  ('production.mark_delivered', 'production', 'Ventas', 'Marcar entregado', 'Permite entregar pedidos solo si no tienen saldo pendiente.'),
  ('production.tracking', 'production', 'Ventas', 'Ver tracking cliente', 'Permite abrir el seguimiento público del pedido.'),

  ('executive.view', 'executive_center', 'Inteligencia', 'Ver Executive Center', 'Permite acceder al tablero ejecutivo consolidado.'),
  ('analytics.view', 'analytics', 'Inteligencia', 'Ver Analytics', 'Permite revisar análisis de ventas, stock y operación.'),
  ('analytics.export', 'analytics', 'Inteligencia', 'Exportar Analytics', 'Permite exportar reportes analíticos.'),
  ('ai_insights.view', 'ai_insights', 'Inteligencia', 'Ver IA Insights', 'Permite ver recomendaciones automáticas del sistema.'),
  ('forecast.view', 'forecast', 'Inteligencia', 'Ver Forecast', 'Permite ver proyección ejecutiva y tendencias.')
on conflict (key) do update
set
  module = excluded.module,
  section = excluded.section,
  label = excluded.label,
  description = excluded.description;

-- Permisos recomendados para ADM Merch
insert into public.role_permissions (role, permission_key, enabled)
select 'adm_merch', key, true
from public.permissions
where key in (
  'pricing.view',
  'pricing.edit',
  'pricing.history',
  'pricing.margins',
  'production.view',
  'production.collect_balance',
  'production.mark_ready',
  'production.mark_delivered',
  'production.tracking',
  'analytics.view',
  'ai_insights.view',
  'forecast.view'
)
on conflict (role, permission_key) do update
set enabled = true;

-- Permisos recomendados para Admin
insert into public.role_permissions (role, permission_key, enabled)
select 'admin', key, true
from public.permissions
where key in (
  'production.view',
  'production.collect_balance',
  'production.mark_ready',
  'production.mark_delivered',
  'production.tracking',
  'analytics.view'
)
on conflict (role, permission_key) do update
set enabled = true;

-- Permisos recomendados para Voluntario
insert into public.role_permissions (role, permission_key, enabled)
select 'voluntario', key, true
from public.permissions
where key in (
  'production.view',
  'production.collect_balance',
  'production.mark_delivered',
  'production.tracking'
)
on conflict (role, permission_key) do update
set enabled = true;
