-- Limpieza opcional de variantes antiguas de café
-- Úsalo si ya habías activado variantes en productos de café.
-- Desde ahora cada tamaño debe ser un producto separado con SKU y stock propio.

UPDATE products
SET
  has_variants = false,
  variant_type = null,
  variants = null,
  updated_at = now()
WHERE
  lower(name) LIKE '%cafe%'
  OR lower(name) LIKE '%café%'
  OR lower(name) LIKE '%capuchino%'
  OR lower(name) LIKE '%cappuccino%'
  OR lower(name) LIKE '%latte%'
  OR lower(name) LIKE '%americano%'
  OR lower(name) LIKE '%mocca%'
  OR lower(name) LIKE '%mocha%';
