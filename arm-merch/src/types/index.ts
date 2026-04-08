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
  stock: number | null
  low_stock_alert: number | null
  low_stock: boolean | null
  [key: string]: any
}

export interface Profile {
  id: string
  full_name: string
  email: string
  role: 'super_admin' | 'admin' | 'voluntario'
  avatar_url: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type UserRole = 'super_admin' | 'admin' | 'voluntario'
