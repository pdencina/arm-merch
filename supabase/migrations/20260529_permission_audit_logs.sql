CREATE TABLE IF NOT EXISTS public.permission_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  permission text,
  target_type text,
  target_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.permission_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super admin can read permission audit logs" ON public.permission_audit_logs;

CREATE POLICY "super admin can read permission audit logs"
ON public.permission_audit_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'super_admin'
  )
);
