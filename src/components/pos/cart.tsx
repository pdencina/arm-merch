// PATCH PARA src/components/pos/cart.tsx
// Reemplaza SOLO este bloque dentro de finishAsPaid()

setTimeout(() => {
  setVerifyError(null);
  setVerifySuccess(null);
  setTxCode("");

  // Primero mostrar comprobante
  setSuccessOpen(true);

  // Limpiar carrito DESPUÉS de abrir comprobante
  clearCart();

  // Después cerrar SOLO
  setTimeout(() => {
    setSumupSmartOpen(false);
  }, 300);
}, 700);
