-- ============================================================================
-- ARM Merch — Row Level Security Policies
-- Aislamiento real de datos por campus
-- ============================================================================

-- ─── INVENTORY ──────────────────────────────────────────────────────────────
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Super admin y adm_merch ven todo
CREATE POLICY "inventory_select_global" ON public.inventory
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'adm_merch')
  );

-- Admin y voluntario ven solo su campus
CREATE POLICY "inventory_select_campus" ON public.inventory
  FOR SELECT USING (
    campus_id = (SELECT campus_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'voluntario')
  );

-- Solo super_admin y adm_merch pueden insertar/actualizar sin restricción de campus
CREATE POLICY "inventory_insert_global" ON public.inventory
  FOR INSERT WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'adm_merch')
  );

CREATE POLICY "inventory_insert_campus" ON public.inventory
  FOR INSERT WITH CHECK (
    campus_id = (SELECT campus_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "inventory_update_global" ON public.inventory
  FOR UPDATE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'adm_merch')
  );

CREATE POLICY "inventory_update_campus" ON public.inventory
  FOR UPDATE USING (
    campus_id = (SELECT campus_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- ─── ORDERS ─────────────────────────────────────────────────────────────────
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select_global" ON public.orders
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'adm_merch')
  );

CREATE POLICY "orders_select_campus" ON public.orders
  FOR SELECT USING (
    campus_id = (SELECT campus_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'voluntario')
  );

CREATE POLICY "orders_insert_campus" ON public.orders
  FOR INSERT WITH CHECK (
    campus_id = (SELECT campus_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'adm_merch')
  );

CREATE POLICY "orders_update_global" ON public.orders
  FOR UPDATE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'adm_merch')
  );

CREATE POLICY "orders_update_campus" ON public.orders
  FOR UPDATE USING (
    campus_id = (SELECT campus_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'voluntario')
  );

-- ─── INVENTORY MOVEMENTS ────────────────────────────────────────────────────
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "movements_select_global" ON public.inventory_movements
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'adm_merch')
  );

CREATE POLICY "movements_select_campus" ON public.inventory_movements
  FOR SELECT USING (
    campus_id = (SELECT campus_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'voluntario')
  );

CREATE POLICY "movements_insert_all" ON public.inventory_movements
  FOR INSERT WITH CHECK (
    campus_id = (SELECT campus_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'adm_merch')
  );

-- ─── CASH SESSIONS ──────────────────────────────────────────────────────────
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_sessions_select_global" ON public.cash_sessions
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'adm_merch')
  );

CREATE POLICY "cash_sessions_select_campus" ON public.cash_sessions
  FOR SELECT USING (
    campus_id = (SELECT campus_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'voluntario')
  );

CREATE POLICY "cash_sessions_insert" ON public.cash_sessions
  FOR INSERT WITH CHECK (
    campus_id = (SELECT campus_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'adm_merch')
  );

CREATE POLICY "cash_sessions_update" ON public.cash_sessions
  FOR UPDATE USING (
    campus_id = (SELECT campus_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'adm_merch')
  );

-- ─── PROMOTIONS ─────────────────────────────────────────────────────────────
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promotions_select_all" ON public.promotions
  FOR SELECT USING (
    campus_id IS NULL
    OR campus_id = (SELECT campus_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'adm_merch')
  );

CREATE POLICY "promotions_manage_global" ON public.promotions
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'adm_merch')
  );

-- ─── PROFILES (lectura) ─────────────────────────────────────────────────────
-- NOTA: NO activamos RLS en profiles porque se consulta desde el browser client
-- en login y dashboard layout. La protección se hace a nivel de API routes.
-- Si deseas activar RLS en profiles en el futuro, asegúrate de que el browser
-- client siempre tenga un token válido antes de consultar esta tabla.
--
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
--
-- Para activar en el futuro, descomentar y ejecutar:
-- CREATE POLICY "profiles_select_authenticated" ON public.profiles
--   FOR SELECT USING (auth.role() = 'authenticated');
-- 
-- CREATE POLICY "profiles_update_own" ON public.profiles
--   FOR UPDATE USING (id = auth.uid());
--
-- CREATE POLICY "profiles_update_global" ON public.profiles
--   FOR UPDATE USING (
--     (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
--   );

-- ─── PRODUCTS (globales, todos leen) ────────────────────────────────────────
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select_all" ON public.products
  FOR SELECT USING (true);

CREATE POLICY "products_manage_admin" ON public.products
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'adm_merch')
  );

-- ─── CATEGORIES (globales, todos leen) ──────────────────────────────────────
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select_all" ON public.categories
  FOR SELECT USING (true);

CREATE POLICY "categories_manage_admin" ON public.categories
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'adm_merch')
  );

-- ─── NOTA IMPORTANTE ────────────────────────────────────────────────────────
-- Las API routes usan service_role_key que bypasea RLS.
-- RLS protege contra acceso directo desde el cliente (anon key).
-- Para tablas accedidas SOLO via API routes con service_role, RLS es una capa extra de seguridad.
