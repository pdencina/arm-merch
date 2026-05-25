
// SUMUP UNIFICATION FIX

// Normalizar método
export function normalizePaymentMethod(payment_method: string) {
  if (payment_method === 'sumup_solo') {
    return 'sumup'
  }

  return payment_method
}

// Label UI
export function getPaymentMethodLabel(payment_method: string) {
  const normalized = normalizePaymentMethod(payment_method)

  switch (normalized) {
    case 'sumup':
      return 'SumUp POS'

    case 'cash':
      return 'Efectivo'

    case 'transfer':
      return 'Transferencia'

    case 'payment_link':
      return 'Link pago'

    default:
      return payment_method
  }
}

/*
SQL opcional para limpiar históricos:

UPDATE orders
SET
  payment_method = 'sumup_solo',
  payment_status = 'paid',
  status = 'paid'
WHERE payment_method = 'sumup'
AND payment_status = 'pending';

*/
