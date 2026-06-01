-- Seed seguro para que POS siga operativo al migrar /api/orders a permisos reales.
-- No pisa configuraciones existentes: solo inserta si falta la fila.

INSERT INTO public.module_permissions (role, module, enabled, updated_at)
SELECT 'voluntario', 'pos.sell', true, now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.module_permissions
  WHERE role = 'voluntario' AND module = 'pos.sell'
);

INSERT INTO public.module_permissions (role, module, enabled, updated_at)
SELECT 'admin', 'pos.sell', true, now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.module_permissions
  WHERE role = 'admin' AND module = 'pos.sell'
);

INSERT INTO public.module_permissions (role, module, enabled, updated_at)
SELECT 'adm_merch', 'pos.sell', true, now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.module_permissions
  WHERE role = 'adm_merch' AND module = 'pos.sell'
);
