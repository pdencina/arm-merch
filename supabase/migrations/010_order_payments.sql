-- Tabla para registrar historial de pagos por orden
CREATE TABLE IF NOT EXISTS order_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  amount numeric NOT NULL,
  payment_method text NOT NULL,
  payment_type text NOT NULL DEFAULT 'payment', -- 'deposit', 'balance', 'full_payment', 'refund'
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_payments_pkey PRIMARY KEY (id),
  CONSTRAINT order_payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT order_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id)
);

-- RLS
ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_payments_select_authenticated" 
ON order_payments FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "order_payments_insert_authenticated" 
ON order_payments FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Índice para buscar pagos por orden
CREATE INDEX IF NOT EXISTS idx_order_payments_order_id ON order_payments (order_id);
