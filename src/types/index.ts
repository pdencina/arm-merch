export interface Product {
  id: string
  name: string
  price: number
  description: string | null
  sku: string | null
  category_id: string | null
  category_name: string | null
  image_url: string | null
  active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  sale_type: 'stock' | 'encargo'
  has_sizes: boolean
  stock: number | null
  low_stock_alert: number | null
  low_stock: boolean | null
  [key: string]: any
}

export interface Profile {
  id: string
  full_name: string
  email: string
  role: UserRole
  avatar_url: string | null
  active: boolean
  campus_id: string | null
  created_at: string
  updated_at: string
}

export type UserRole = 'super_admin' | 'adm_merch' | 'admin' | 'voluntario'

export interface Campus {
  id: string
  name: string
  city: string | null
  country: string | null
  active: boolean
  created_at: string
}

export interface InventoryTransfer {
  id: string
  from_campus_id: string
  to_campus_id: string
  product_id: string
  quantity: number
  status: 'pending' | 'in_transit' | 'received' | 'cancelled'
  notes: string | null
  requested_by: string | null
  approved_by: string | null
  received_by: string | null
  requested_at: string
  approved_at: string | null
  received_at: string | null
}

export interface AuditLogEntry {
  id: string
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  campus_id: string | null
  metadata: Record<string, any>
  ip_address: string | null
  created_at: string
}

export interface Order {
  id: string
  order_number: number
  status: 'pending' | 'paid' | 'cancelled' | 'refunded'
  payment_method: string
  subtotal: number
  discount: number
  total: number
  notes: string | null
  seller_id: string | null
  campus_id: string | null
  promo_code: string | null
  delivery_status: 'pending' | 'ready' | 'delivered' | null
  client_phone: string | null
  created_at: string
  updated_at: string
}

export interface CashSession {
  id: string
  campus_id: string
  opened_by: string | null
  closed_by: string | null
  opened_at: string
  closed_at: string | null
  opening_amount: number
  closing_amount_declared: number | null
  sales_total: number
  orders_count: number
  difference: number
  status: 'open' | 'closed'
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  description: string | null
  active: boolean
  created_at: string
}

export interface Promotion {
  id: string
  code: string
  label: string
  type: 'percent' | 'fixed'
  value: number
  min_amount: number | null
  max_uses: number | null
  used_count: number
  active: boolean
  valid_from: string | null
  valid_until: string | null
  campus_id: string | null
  created_by: string | null
  created_at: string
}
