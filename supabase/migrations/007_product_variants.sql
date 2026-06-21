-- ============================================================================
-- ARM Merch — Variantes de Producto (Tamaños para cafés, etc.)
-- ============================================================================

-- Un producto puede tener múltiples variantes (ej: Chico, Mediano, Grande)
-- Cada variante tiene su propio precio y stock opcional
CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  variant_type text NOT NULL DEFAULT 'tamaño', -- 'tamaño', 'sabor', etc.
  variant_value text NOT NULL,                  -- 'Chico', 'Mediano', 'Grande'
  price numeric NOT NULL CHECK (price >= 0),
  sku text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_variants_pkey PRIMARY KEY (id),
  CONSTRAINT product_variants_product_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE,
  CONSTRAINT product_variants_unique UNIQUE (product_id, variant_type, variant_value)
);

CREATE INDEX idx_product_variants_product ON public.product_variants(product_id);
CREATE INDEX idx_product_variants_active ON public.product_variants(product_id, active);

-- Marcar productos que tienen variantes (para saber en el POS si abrir selector)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS has_variants boolean NOT NULL DEFAULT false;

-- Actualizar la vista products_with_stock para incluir has_variants
DROP VIEW IF EXISTS products_with_stock;

CREATE VIEW products_with_stock AS
SELECT 
  p.id, p.name, p.description, p.price, p.sku, p.barcode,
  p.category_id, p.image_url, p.active, p.created_by,
  p.created_at, p.updated_at, p.has_sizes, p.sale_type, p.has_variants,
  c.name AS category_name,
  i.stock, i.low_stock_alert, i.campus_id,
  ca.name AS campus_name,
  CASE WHEN i.stock <= i.low_stock_alert THEN true ELSE false END AS low_stock
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN inventory i ON i.product_id = p.id AND i.campus_id IS NOT NULL
LEFT JOIN campus ca ON ca.id = i.campus_id
WHERE p.active = true;

-- RLS
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "variants_select_all" ON public.product_variants
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "variants_manage_global" ON public.product_variants
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'adm_merch')
  );
