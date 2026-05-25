
// =====================================================
// ORDERS FILTER FIX
// =====================================================
//
// Objetivo:
// Ocultar órdenes incompletas o abandonadas
// del flujo operacional.
//
// =====================================================
//
// APLICAR EN:
//
// - /orders
// - /production
// - dashboards
// - analytics
// - reportes
//
// =====================================================
//
// REEMPLAZAR:
//
// .from("orders")
//
// POR:
//
// .from("orders")
// .eq("payment_status", "paid")
//
// =====================================================
//
// Opcional:
//
// excluir estados:
//
// .not("payment_status", "in", '("pending","failed","expired","abandoned")')
//
// =====================================================
//
// BENEFICIOS
//
// ✅ Reportes reales
// ✅ No confunde voluntarios
// ✅ Producción limpia
// ✅ Ventas correctas
// ✅ Cierre caja consistente
//
// =====================================================
