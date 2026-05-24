export type CheckoutPaymentMode = 'full_payment' | 'deposit_50'

export function calculateProductionDeposit({
  total,
  paymentMode,
}: {
  total: number
  paymentMode: CheckoutPaymentMode
}) {
  const safeTotal = Number(total || 0)

  if (paymentMode === 'deposit_50') {
    const amountPaid = Math.round(safeTotal * 0.5)
    const balanceDue = safeTotal - amountPaid

    return {
      payment_type: 'deposit_50' as const,
      deposit_percentage: 50,
      amount_paid: amountPaid,
      balance_due: balanceDue,
      payment_status: 'partial' as const,
    }
  }

  return {
    payment_type: 'full_payment' as const,
    deposit_percentage: 100,
    amount_paid: safeTotal,
    balance_due: 0,
    payment_status: 'paid' as const,
  }
}
