import ProductGrid from '@/components/pos/product-grid'
import Cart from '@/components/pos/cart'

export default function POSPage() {
  return (
    <div className="flex h-full gap-6 p-6">
      {/* PRODUCTOS */}
      <div className="flex-1 min-w-0">
        <ProductGrid />
      </div>

      {/* CARRITO */}
      <div className="w-[360px] shrink-0">
        <Cart />
      </div>
    </div>
  )
}