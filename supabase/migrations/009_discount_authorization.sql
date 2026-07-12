-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  Descuentos autorizados por PIN                              ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- Tabla de PINs de autorización (puede haber varios autorizadores)
CREATE TABLE IF NOT EXISTS discount_authorizers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  pin_hash text NOT NULL, -- PIN hasheado (SHA-256)
  max_discount_pct integer NOT NULL DEFAULT 50, -- máximo % que puede autorizar
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Agregar campo de descuento autorizado en orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_pct numeric DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_authorized_by text; -- nombre del autorizador

COMMENT ON TABLE discount_authorizers IS 'Personas autorizadas para aprobar descuentos en el POS mediante PIN';
COMMENT ON COLUMN discount_authorizers.pin_hash IS 'SHA-256 del PIN numérico';
COMMENT ON COLUMN discount_authorizers.max_discount_pct IS 'Porcentaje máximo de descuento que esta persona puede autorizar';

-- Insertar a Felipe Burgos con PIN inicial (cámbialo después)
-- PIN por defecto: 1234 → SHA-256 hash
-- Para generar el hash de otro PIN: SELECT encode(sha256('TU_PIN'::bytea), 'hex')
INSERT INTO discount_authorizers (name, pin_hash, max_discount_pct)
VALUES ('Felipe Burgos', encode(sha256('1234'::bytea), 'hex'), 50)
ON CONFLICT DO NOTHING;
