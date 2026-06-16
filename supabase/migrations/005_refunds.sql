-- ============================================================================
-- ARM Merch — Sistema de Devoluciones y Reembolsos Parciales
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  refund_number serial,
  type text NOT NULL DEFAULT 'partial' CHECK (type IN ('partial', 'full')),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'rejected')),
  total_refunded numeric NOT NULL DEFAULT 0,
  reason text,
  notes text,
  created_by uuid,
  campus_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT refunds_pkey PRIMARY KEY (id),
  CONSTRAINT refunds_order_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT refunds_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT refunds_campus_fkey FOREIGN KEY (campus_id) REFERENCES public.campus(id)
);

CREATE TABLE IF NOT EXISTS public.refund_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  refund_id uuid NOT NULL,
  order_item_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL,
  subtotal numeric NOT NULL,
  restock boolean NOT NULL DEFAULT true,
  CONSTRAINT refund_items_pkey PRIMARY KEY (id),
  CONSTRAINT refund_items_refund_fkey FOREIGN KEY (refund_id) REFERENCES public.refunds(id),
  CONSTRAINT refund_items_order_item_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id),
  CONSTRAINT refund_items_product_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

CREATE INDEX idx_refunds_order ON public.refunds(order_id);
CREATE INDEX idx_refunds_campus ON public.refunds(campus_id);
CREATE INDEX idx_refunds_created_at ON public.refunds(created_at DESC);
CREATE INDEX idx_refund_items_refund ON public.refund_items(refund_id);

-- Agregar columna de cantidad devuelta a order_items para rastreo
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS refunded_qty integer NOT NULL DEFAULT 0;

-- RLS
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "refunds_select_global" ON public.refunds
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'adm_merch')
  );

CREATE POLICY "refunds_select_campus" ON public.refunds
  FOR SELECT USING (
    campus_id = (SELECT campus_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'voluntario')
  );

CREATE POLICY "refunds_insert_all" ON public.refunds
  FOR INSERT WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'adm_merch', 'admin')
  );

CREATE POLICY "refund_items_select" ON public.refund_items
  FOR SELECT USING (true);

CREATE POLICY "refund_items_insert" ON public.refund_items
  FOR INSERT WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'adm_merch', 'admin')
  );
