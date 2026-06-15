-- ============================================================================
-- ARM Merch — Transferencias de inventario entre campus
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  from_campus_id uuid NOT NULL,
  to_campus_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'received', 'cancelled')),
  notes text,
  requested_by uuid,
  approved_by uuid,
  received_by uuid,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  received_at timestamptz,
  CONSTRAINT inventory_transfers_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_transfers_from_campus_fkey FOREIGN KEY (from_campus_id) REFERENCES public.campus(id),
  CONSTRAINT inventory_transfers_to_campus_fkey FOREIGN KEY (to_campus_id) REFERENCES public.campus(id),
  CONSTRAINT inventory_transfers_product_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT inventory_transfers_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.profiles(id),
  CONSTRAINT inventory_transfers_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id),
  CONSTRAINT inventory_transfers_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.profiles(id),
  CONSTRAINT inventory_transfers_different_campus CHECK (from_campus_id != to_campus_id)
);

-- Índices para búsqueda rápida
CREATE INDEX idx_transfers_from_campus ON public.inventory_transfers(from_campus_id);
CREATE INDEX idx_transfers_to_campus ON public.inventory_transfers(to_campus_id);
CREATE INDEX idx_transfers_status ON public.inventory_transfers(status);
CREATE INDEX idx_transfers_product ON public.inventory_transfers(product_id);
CREATE INDEX idx_transfers_requested_at ON public.inventory_transfers(requested_at DESC);

-- RLS
ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;

-- Global roles ven todas las transferencias
CREATE POLICY "transfers_select_global" ON public.inventory_transfers
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'adm_merch')
  );

-- Admin ve transferencias de/hacia su campus
CREATE POLICY "transfers_select_campus" ON public.inventory_transfers
  FOR SELECT USING (
    (
      from_campus_id = (SELECT campus_id FROM profiles WHERE id = auth.uid())
      OR to_campus_id = (SELECT campus_id FROM profiles WHERE id = auth.uid())
    )
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Solo adm_merch y super_admin pueden crear transferencias
CREATE POLICY "transfers_insert_global" ON public.inventory_transfers
  FOR INSERT WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'adm_merch')
  );

-- Admin puede crear transferencias DESDE su campus
CREATE POLICY "transfers_insert_campus" ON public.inventory_transfers
  FOR INSERT WITH CHECK (
    from_campus_id = (SELECT campus_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Updates solo por roles globales
CREATE POLICY "transfers_update_global" ON public.inventory_transfers
  FOR UPDATE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'adm_merch')
  );

-- Admin del campus destino puede marcar como received
CREATE POLICY "transfers_update_receive" ON public.inventory_transfers
  FOR UPDATE USING (
    to_campus_id = (SELECT campus_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    AND status = 'in_transit'
  );

-- ─── Permisos para la tabla en module_permissions ───────────────────────────
INSERT INTO public.module_permissions (module, role, enabled)
VALUES
  ('inventory.transfer', 'super_admin', true),
  ('inventory.transfer', 'adm_merch', true),
  ('inventory.transfer', 'admin', true),
  ('inventory.transfers.view', 'super_admin', true),
  ('inventory.transfers.view', 'adm_merch', true),
  ('inventory.transfers.view', 'admin', true)
ON CONFLICT DO NOTHING;
