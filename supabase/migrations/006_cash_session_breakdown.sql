-- ============================================================================
-- ARM Merch — Desglose automático por método de pago en cierre de caja
-- ============================================================================

-- Agregar columna para guardar el desglose al momento del cierre
ALTER TABLE public.cash_sessions 
  ADD COLUMN IF NOT EXISTS payment_breakdown jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS total_sales numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS digital_sales numeric DEFAULT 0;

-- payment_breakdown guardará algo como:
-- [{"method": "efectivo", "total": 50000, "count": 12},
--  {"method": "transferencia", "total": 30000, "count": 5},
--  {"method": "solo", "total": 25000, "count": 8}]

COMMENT ON COLUMN public.cash_sessions.payment_breakdown IS 'Desglose por método de pago al momento del cierre';
COMMENT ON COLUMN public.cash_sessions.total_sales IS 'Total de TODAS las ventas de la sesión (efectivo + digital)';
COMMENT ON COLUMN public.cash_sessions.digital_sales IS 'Total de ventas por medios digitales (SumUp, link, transferencia)';
