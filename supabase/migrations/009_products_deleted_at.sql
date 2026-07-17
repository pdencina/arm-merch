-- Agregar columna deleted_at para soft delete de productos
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Índice para filtrar productos no eliminados
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products (deleted_at) WHERE deleted_at IS NULL;
