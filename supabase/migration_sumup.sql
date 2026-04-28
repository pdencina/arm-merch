-- ============================================================
-- ARM MERCH — SumUp checkout tracking
-- ============================================================

-- Columna para guardar el checkout_id de SumUp en la orden
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS sumup_checkout_id TEXT DEFAULT NULL;

-- Índice para buscar rápido por checkout_id
CREATE INDEX IF NOT EXISTS idx_orders_sumup_checkout
  ON orders(sumup_checkout_id) WHERE sumup_checkout_id IS NOT NULL;

-- Verificar
SELECT 'sumup_checkout_id agregado' AS resultado;
