-- Seed seguro para visibilidad global de órdenes.
-- No pisa configuraciones existentes: solo inserta si falta la fila.

INSERT INTO public.module_permissions (role, module, enabled, updated_at)
SELECT 'adm_merch', 'orders.all_campus', true, now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.module_permissions
  WHERE role = 'adm_merch' AND module = 'orders.all_campus'
);

INSERT INTO public.module_permissions (role, module, enabled, updated_at)
SELECT 'admin', 'orders.all_campus', false, now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.module_permissions
  WHERE role = 'admin' AND module = 'orders.all_campus'
);

INSERT INTO public.module_permissions (role, module, enabled, updated_at)
SELECT 'voluntario', 'orders.all_campus', false, now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.module_permissions
  WHERE role = 'voluntario' AND module = 'orders.all_campus'
);
