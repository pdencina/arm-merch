// REEMPLAZAR VALIDACIÓN ACTUAL DE INVENTARIO POR ESTA

// ======================================================
// FIX PERMISOS INVENTARIO VOLUNTARIO
// ======================================================

// BUSCA algo parecido a esto:
//
// const canAdjustStock = ...
//
// o
//
// if (!permissions['inventory.manage'])
//
// y reemplázalo por:

const canAdjustStock =
  role === 'super_admin' ||
  permissions?.['inventory.adjust'] === true ||
  permissions?.['inventory.movements'] === true

// ======================================================
// VALIDACIÓN BOTÓN AJUSTAR STOCK
// ======================================================

<Button
  disabled={!canAdjustStock}
>
  Ajustar stock
</Button>

// ======================================================
// VALIDACIÓN ACCIÓN
// ======================================================

if (!canAdjustStock) {
  toast.error('No tienes permisos para ajustar inventario')
  return
}

// ======================================================
// IMPORTANTE
// ======================================================
// Después:
// 1. Guardar
// 2. git add .
// 3. git commit -m "fix permisos inventario voluntario"
// 4. git push
//
// Y el voluntario debe:
// - cerrar sesión
// - volver a entrar
