import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartProduct {
  id: string
  name: string
  price: number
  image_url: string | null
  stock: number
  sku?: string | null
  category_id?: string | null
}

export interface CartItem {
  product: CartProduct
  quantity: number
  unit_price: number       // precio al momento de agregar (respeta congelado)
  discount_pct: number     // descuento por ítem (0-100)
}

export interface Promotion {
  id: string
  code: string
  label: string
  type: 'percent' | 'fixed'
  value: number
  min_amount?: number      // monto mínimo para activar
  max_uses?: number
}

interface CartStore {
  // Estado
  items: CartItem[]
  paymentMethod: string
  globalDiscount: number        // descuento fijo global en CLP
  appliedPromo: Promotion | null
  clientName: string
  clientEmail: string
  notes: string

  // Acciones de items
  addItem: (product: CartProduct) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  setItemDiscount: (productId: string, pct: number) => void
  clearCart: () => void

  // Acciones de pago/descuento
  setPaymentMethod: (method: string) => void
  setGlobalDiscount: (amount: number) => void
  applyPromo: (promo: Promotion) => void
  removePromo: () => void

  // Datos del cliente
  setClientName: (name: string) => void
  setClientEmail: (email: string) => void
  setNotes: (notes: string) => void

  // Derivados
  subtotal: () => number
  promoDiscount: () => number
  total: () => number
  itemCount: () => number
  hasStock: (productId: string, qty: number) => boolean
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      paymentMethod: 'efectivo',
      globalDiscount: 0,
      appliedPromo: null,
      clientName: '',
      clientEmail: '',
      notes: '',

      addItem: (product) =>
        set((state) => {
          const existing = state.items.find((i) => i.product.id === product.id)
          if (existing) {
            if (existing.quantity >= product.stock) return state
            return {
              items: state.items.map((i) =>
                i.product.id === product.id
                  ? { ...i, quantity: i.quantity + 1 }
                  : i
              ),
            }
          }
          return {
            items: [
              ...state.items,
              {
                product,
                quantity: 1,
                unit_price: product.price,
                discount_pct: 0,
              },
            ],
          }
        }),

      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((i) => i.product.id !== productId),
        })),

      updateQuantity: (productId, quantity) =>
        set((state) => {
          if (quantity <= 0)
            return { items: state.items.filter((i) => i.product.id !== productId) }
          const item = state.items.find((i) => i.product.id === productId)
          if (item && quantity > item.product.stock) return state
          return {
            items: state.items.map((i) =>
              i.product.id === productId ? { ...i, quantity } : i
            ),
          }
        }),

      setItemDiscount: (productId, pct) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.product.id === productId
              ? { ...i, discount_pct: Math.min(100, Math.max(0, pct)) }
              : i
          ),
        })),

      clearCart: () =>
        set({
          items: [],
          globalDiscount: 0,
          appliedPromo: null,
          clientName: '',
          clientEmail: '',
          notes: '',
        }),

      setPaymentMethod: (method) => set({ paymentMethod: method }),
      setGlobalDiscount: (amount) => set({ globalDiscount: Math.max(0, amount) }),

      applyPromo: (promo) =>
        set((state) => {
          const sub = state.items.reduce(
            (sum, i) =>
              sum + i.unit_price * i.quantity * (1 - i.discount_pct / 100),
            0
          )
          if (promo.min_amount && sub < promo.min_amount) return state
          return { appliedPromo: promo }
        }),

      removePromo: () => set({ appliedPromo: null }),

      setClientName: (name) => set({ clientName: name }),
      setClientEmail: (email) => set({ clientEmail: email }),
      setNotes: (notes) => set({ notes }),

      subtotal: () =>
        get().items.reduce(
          (sum, i) =>
            sum + i.unit_price * i.quantity * (1 - i.discount_pct / 100),
          0
        ),

      promoDiscount: () => {
        const { appliedPromo, items } = get()
        if (!appliedPromo) return 0
        const sub = items.reduce(
          (sum, i) =>
            sum + i.unit_price * i.quantity * (1 - i.discount_pct / 100),
          0
        )
        if (appliedPromo.type === 'percent')
          return Math.round((sub * appliedPromo.value) / 100)
        return Math.min(appliedPromo.value, sub)
      },

      total: () => {
        const { globalDiscount } = get()
        const sub = get().subtotal()
        const promo = get().promoDiscount()
        return Math.max(0, sub - promo - globalDiscount)
      },

      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      hasStock: (productId, qty) => {
        const item = get().items.find((i) => i.product.id === productId)
        if (!item) return true
        return item.quantity + qty <= item.product.stock
      },
    }),
    {
      name: 'arm-merch-cart',
      // Solo persistir datos del cliente y método de pago, no los items (evita stock desactualizado)
      partialize: (state) => ({
        paymentMethod: state.paymentMethod,
        clientName: state.clientName,
        clientEmail: state.clientEmail,
      }),
    }
  )
)
