export type CustomerDisplayItem = {
  id?: string
  name: string
  variant?: string | null
  image_url?: string | null
  quantity: number
  unit_price: number
  subtotal?: number
}

export type CustomerDisplayStatus =
  | 'idle'
  | 'cart'
  | 'awaiting_payment'
  | 'awaiting_link'
  | 'awaiting_transfer'
  | 'paid'
  | 'rejected'
  | 'cancelled'

export type CustomerDisplayState = {
  status: CustomerDisplayStatus
  items: CustomerDisplayItem[]
  total: number
  payment_method?: string | null
  payment_url?: string | null
  transfer_reference?: string | null
  bank_account?: {
    holder: string
    rut: string
    bank: string
    account_type: string
    account_number: string
    email: string
  } | null
  order_number?: string | number | null
  message?: string | null
  updated_at?: string
}

const STORAGE_KEY = 'arm_merch_customer_display_state'
const CHANNEL_NAME = 'arm-merch-customer-display'

export function publishCustomerDisplayState(input: CustomerDisplayState) {
  if (typeof window === 'undefined') return

  const state: CustomerDisplayState = {
    ...input,
    updated_at: new Date().toISOString(),
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

  try {
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channel.postMessage(state)
    channel.close()
  } catch {
    window.dispatchEvent(new StorageEvent('storage', {
      key: STORAGE_KEY,
      newValue: JSON.stringify(state),
    }))
  }
}

export function clearCustomerDisplay() {
  publishCustomerDisplayState({
    status: 'idle',
    items: [],
    total: 0,
  })
}

export function showCustomerCart(items: CustomerDisplayItem[], total?: number) {
  publishCustomerDisplayState({
    status: 'cart',
    items,
    total: total ?? items.reduce((sum, item) => {
      return sum + Number(item.subtotal ?? Number(item.unit_price || 0) * Number(item.quantity || 0))
    }, 0),
  })
}

export function showCustomerPayment(input: {
  items: CustomerDisplayItem[]
  total: number
  payment_method: string
  payment_url?: string | null
}) {
  publishCustomerDisplayState({
    status: input.payment_url ? 'awaiting_link' : 'awaiting_payment',
    items: input.items,
    total: input.total,
    payment_method: input.payment_method,
    payment_url: input.payment_url ?? null,
  })
}


export function showCustomerTransferPayment(input: {
  items: CustomerDisplayItem[]
  total: number
  order_number: string | number
  transfer_reference: string
  bank_account: {
    holder: string
    rut: string
    bank: string
    account_type: string
    account_number: string
    email: string
  }
}) {
  publishCustomerDisplayState({
    status: 'awaiting_transfer',
    items: input.items,
    total: input.total,
    payment_method: 'transferencia',
    order_number: input.order_number,
    transfer_reference: input.transfer_reference,
    bank_account: input.bank_account,
    message: 'Transferencia bancaria pendiente de validación',
  })
}

export function showCustomerPaid(input: {
  items: CustomerDisplayItem[]
  total: number
  payment_method?: string | null
  order_number?: string | number | null
}) {
  publishCustomerDisplayState({
    status: 'paid',
    items: input.items,
    total: input.total,
    payment_method: input.payment_method ?? null,
    order_number: input.order_number ?? null,
  })
}

export function showCustomerRejected(input: {
  items: CustomerDisplayItem[]
  total: number
  payment_method?: string | null
  message?: string | null
}) {
  publishCustomerDisplayState({
    status: 'rejected',
    items: input.items,
    total: input.total,
    payment_method: input.payment_method ?? null,
    message: input.message ?? null,
  })
}
