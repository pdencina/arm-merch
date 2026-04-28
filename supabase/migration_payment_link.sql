-- ============================================================
-- ARM MERCH — Agregar 'link' al enum payment_method
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- Ver valores actuales del enum
SELECT enumlabel
FROM pg_enum
JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
WHERE pg_type.typname = 'payment_method'
ORDER BY enumsortorder;

-- Agregar 'link' al enum
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'link';

-- Verificar
SELECT enumlabel
FROM pg_enum
JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
WHERE pg_type.typname = 'payment_method'
ORDER BY enumsortorder;
