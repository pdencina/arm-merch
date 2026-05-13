-- ARM Merch - Tracking público y flujo de producción
-- Ejecutar en Supabase SQL Editor antes de subir los archivos.

create extension if not exists pgcrypto;

alter table public.orders
  add column if not exists tracking_token text,
  add column if not exists production_status text default 'not_required',
  add column if not exists pickup_campus_id uuid references public.campus(id),
  add column if not exists ready_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists delivered_by uuid references public.profiles(id);

-- Token público para seguimiento. No expone el ID interno de la orden.
update public.orders
set tracking_token = replace(gen_random_uuid()::text, '-', '')
where tracking_token is null;

create unique index if not exists orders_tracking_token_key
  on public.orders(tracking_token);

create index if not exists orders_production_status_idx
  on public.orders(production_status);

create index if not exists orders_pickup_campus_id_idx
  on public.orders(pickup_campus_id);

-- Historial tipo MercadoLibre
create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  title text not null,
  message text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists order_status_history_order_id_idx
  on public.order_status_history(order_id, created_at);

-- Backfill mínimo para órdenes antiguas sin historial.
insert into public.order_status_history (order_id, status, title, message, created_at)
select
  o.id,
  'purchase_confirmed',
  'Compra confirmada',
  case
    when o.status = 'paid' then 'Tu compra fue confirmada correctamente.'
    when o.status = 'pending' then 'Recibimos tu pedido y estamos esperando confirmación.'
    when o.status = 'cancelled' then 'La compra fue cancelada o rechazada.'
    else 'Tu pedido fue registrado.'
  end,
  o.created_at
from public.orders o
where not exists (
  select 1 from public.order_status_history h where h.order_id = o.id
);
