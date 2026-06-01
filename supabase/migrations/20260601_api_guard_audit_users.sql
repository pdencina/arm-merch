CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  permission text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super admin can read audit logs" ON public.audit_logs;

CREATE POLICY "super admin can read audit logs"
ON public.audit_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'super_admin'
  )
);

-- Permisos base para usuarios.
-- No pisa configuraciones existentes: solo inserta si falta la fila.

INSERT INTO public.module_permissions (role, module, enabled, updated_at)
SELECT 'adm_merch', 'users.view', true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.module_permissions WHERE role='adm_merch' AND module='users.view');

INSERT INTO public.module_permissions (role, module, enabled, updated_at)
SELECT 'adm_merch', 'users.edit', true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.module_permissions WHERE role='adm_merch' AND module='users.edit');

INSERT INTO public.module_permissions (role, module, enabled, updated_at)
SELECT 'adm_merch', 'users.roles', true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.module_permissions WHERE role='adm_merch' AND module='users.roles');

INSERT INTO public.module_permissions (role, module, enabled, updated_at)
SELECT 'adm_merch', 'users.passwords', true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.module_permissions WHERE role='adm_merch' AND module='users.passwords');

INSERT INTO public.module_permissions (role, module, enabled, updated_at)
SELECT 'adm_merch', 'users.activate', true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.module_permissions WHERE role='adm_merch' AND module='users.activate');

INSERT INTO public.module_permissions (role, module, enabled, updated_at)
SELECT 'admin', 'users.view', true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.module_permissions WHERE role='admin' AND module='users.view');

INSERT INTO public.module_permissions (role, module, enabled, updated_at)
SELECT 'admin', 'users.edit', true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.module_permissions WHERE role='admin' AND module='users.edit');

INSERT INTO public.module_permissions (role, module, enabled, updated_at)
SELECT 'admin', 'users.roles', false, now()
WHERE NOT EXISTS (SELECT 1 FROM public.module_permissions WHERE role='admin' AND module='users.roles');

INSERT INTO public.module_permissions (role, module, enabled, updated_at)
SELECT 'admin', 'users.passwords', false, now()
WHERE NOT EXISTS (SELECT 1 FROM public.module_permissions WHERE role='admin' AND module='users.passwords');

INSERT INTO public.module_permissions (role, module, enabled, updated_at)
SELECT 'admin', 'users.activate', true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.module_permissions WHERE role='admin' AND module='users.activate');

INSERT INTO public.module_permissions (role, module, enabled, updated_at)
SELECT 'voluntario', 'users.view', false, now()
WHERE NOT EXISTS (SELECT 1 FROM public.module_permissions WHERE role='voluntario' AND module='users.view');

INSERT INTO public.module_permissions (role, module, enabled, updated_at)
SELECT 'voluntario', 'users.edit', false, now()
WHERE NOT EXISTS (SELECT 1 FROM public.module_permissions WHERE role='voluntario' AND module='users.edit');

INSERT INTO public.module_permissions (role, module, enabled, updated_at)
SELECT 'voluntario', 'users.roles', false, now()
WHERE NOT EXISTS (SELECT 1 FROM public.module_permissions WHERE role='voluntario' AND module='users.roles');

INSERT INTO public.module_permissions (role, module, enabled, updated_at)
SELECT 'voluntario', 'users.passwords', false, now()
WHERE NOT EXISTS (SELECT 1 FROM public.module_permissions WHERE role='voluntario' AND module='users.passwords');

INSERT INTO public.module_permissions (role, module, enabled, updated_at)
SELECT 'voluntario', 'users.activate', false, now()
WHERE NOT EXISTS (SELECT 1 FROM public.module_permissions WHERE role='voluntario' AND module='users.activate');
