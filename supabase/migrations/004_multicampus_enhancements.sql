-- ============================================================================
-- ARM Merch — Mejoras Multi-Campus
-- 1. Metas de venta por campus
-- 2. Precios diferenciados por campus
-- ============================================================================

-- ─── 1. METAS DE VENTA POR CAMPUS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campus_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campus_id uuid NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  target_amount numeric NOT NULL DEFAULT 0,
  target_orders integer,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campus_goals_pkey PRIMARY KEY (id),
  CONSTRAINT campus_goals_campus_fkey FOREIGN KEY (campus_id) REFERENCES public.campus(id),
  CONSTRAINT campus_goals_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT campus_goals_unique UNIQUE (campus_id, month, year)
);

CREATE INDEX idx_campus_goals_campus ON public.campus_goals(campus_id);
CREATE INDEX idx_campus_goals_period ON public.campus_goals(year, month);

-- ─── 2. PRECIOS POR CAMPUS ──────────────────────────────────────────────────
-- Permite tener un precio diferente por producto en cada campus.
-- Si no existe precio específico para un campus, se usa el precio base del producto.
CREATE TABLE IF NOT EXISTS public.campus_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  campus_id uuid NOT NULL,
  price numeric NOT NULL CHECK (price >= 0),
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campus_prices_pkey PRIMARY KEY (id),
  CONSTRAINT campus_prices_product_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT campus_prices_campus_fkey FOREIGN KEY (campus_id) REFERENCES public.campus(id),
  CONSTRAINT campus_prices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT campus_prices_unique UNIQUE (product_id, campus_id)
);

CREATE INDEX idx_campus_prices_product ON public.campus_prices(product_id);
CREATE INDEX idx_campus_prices_campus ON public.campus_prices(campus_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.campus_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_prices ENABLE ROW LEVEL SECURITY;

-- Goals: todos los autenticados pueden ver, solo admins globales pueden gestionar
CREATE POLICY "goals_select_all" ON public.campus_goals
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "goals_manage_global" ON public.campus_goals
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'adm_merch')
  );

-- Prices: todos pueden leer, solo admins globales gestionan
CREATE POLICY "prices_select_all" ON public.campus_prices
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "prices_manage_global" ON public.campus_prices
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'adm_merch')
  );
