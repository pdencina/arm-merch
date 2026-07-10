-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  Agregar variant_type y variant_value a order_items          ║
-- ║  Para guardar área/ministerio + talla en polerones           ║
-- ╚═══════════════════════════════════════════════════════════════╝

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_type text;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_value text;

COMMENT ON COLUMN order_items.variant_type IS 'Tipo de variante: talla, tamaño, multi, ministerio, área, etc.';
COMMENT ON COLUMN order_items.variant_value IS 'Valor seleccionado. Para multi-variant ej: "Stage · L" o "Servicio · M"';
