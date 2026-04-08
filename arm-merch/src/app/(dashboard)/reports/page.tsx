import { createClient } from '@/lib/supabase/server'
import ReportsClient from './reports-client'

export default async function ReportsPage() {
  const supabase = await createClient()

  const [{ data: ordersRaw }, { data: products }, { data: sellers }] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        id, order_number, total, status, payment_method, created_at, seller_id,
        seller:profiles(full_name),
        order_items(quantity, unit_price, product:products(name, category_id))
      `)
      .eq('status', 'completada')
      .order('created_at', { ascending: false }),
    supabase.from('products_with_stock').select('*').order('name'),
    supabase.from('profiles').select('id, full_name').eq('active', true),
  ])

  const orders = (ordersRaw ?? []) as any[]

  return (
    <ReportsClient
      orders={orders}
      products={products ?? []}
      sellers={sellers ?? []}
    />
  )
}
