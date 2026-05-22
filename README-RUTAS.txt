RUTAS A REEMPLAZAR

1) Reemplaza:
src/components/products/edit-product-form.tsx

2) Ejecuta en Supabase SQL Editor:
supabase/add-product-variants.sql

IMPORTANTE:
Si al editar el producto NO ves las variantes guardadas, tu page de detalle del producto debe traer estos campos en el SELECT:

has_variants,
variant_type,
variants

Ejemplo:
.select('id, name, description, price, sku, category_id, image_url, active, has_variants, variant_type, variants')

También el endpoint PATCH /api/products/[id] debe permitir guardar:
has_variants
variant_type
variants
