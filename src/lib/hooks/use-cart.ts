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
  unit_price: number
  discount_pct: number
  size?: string | null
  variant_type?: string | null
  variant_value?: string | null
}

export interface Promotion {
  id: string
  code: string
  label: string
  type: 'percent' | 'fixed'
  value: number
  min_amount?: number
  max_uses?: number
}

interface CartStore {
  items: CartItem[]
  paymentMethod: string
  globalDiscount: number
  discount: number
  appliedPromo: Promotion | null
  clientName: string
  clientEmail: string
  notes: string

  addItem: (
    product: CartProduct,
    size?: string | null,
    variantType?: string | null,
    variantValue?: string | null,
    customPrice?: number | null
  ) => void
  removeItem: (productId: string, variantValue?: string | null) => void
  updateQuantity: (productId: string, quantity: number, variantValue?: string | null) => void
  setItemDiscount: (productId: string, pct: number, variantValue?: string | null) => void
  clearCart: () => void

  setPaymentMethod: (method: string) => void
  setGlobalDiscount: (amount: number) => void
  applyPromo: (promo: Promotion) => void
  removePromo: () => void

  setClientName: (name: string) => void
  setClientEmail: (email: string) => void
  setNotes: (notes: string) => void

  subtotal: () => number
  promoDiscount: () => number
  total: () => number
  itemCount: () => number
  hasStock: (productId: string, qty: number, variantValue?: string | null) => boolean
}

const variantKey = (value?: string | null) => value ?? null

const sameLine = (item: CartItem, productId: string, value?: string | null) =>
  item.product.id === productId &&
  (item.variant_value ?? item.size ?? null) === variantKey(value)

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      paymentMethod: 'efectivo',
      globalDiscount: 0,
      discount: 0,
      appliedPromo: null,
      clientName: '',
      clientEmail: '',
      notes: '',

      addItem: (product, size, variantType, variantValue, customPrice) =>
        set((state) => {
          const selectedValue = variantValue ?? size ?? null
          const existing = state.items.find((i) => sameLine(i, product.id, selectedValue))

          if (existing) {
            if (existing.quantity >= product.stock) return state

            return {
              items: state.items.map((i) =>
                sameLine(i, product.id, selectedValue)
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
                unit_price: customPrice ?? product.price,
                size: size ?? null,
                variant_type: variantType ?? (size ? 'talla' : null),
                variant_value: selectedValue,
                discount_pct: 0,
              },
            ],
          }
        }),

      removeItem: (productId, variantValue) =>
        set((state) => ({
          items: state.items.filter((i) => !sameLine(i, productId, variantValue)),
        })),

      updateQuantity: (productId, quantity, variantValue) =>
        set((state) => {
          if (quantity <= 0) {
            return {
              items: state.items.filter((i) => !sameLine(i, productId, variantValue)),
            }
          }

          const item = state.items.find((i) => sameLine(i, productId, variantValue))
          if (item && quantity > item.product.stock) return state

          return {
            items: state.items.map((i) =>
              sameLine(i, productId, variantValue) ? { ...i, quantity } : i
            ),
          }
        }),

      setItemDiscount: (productId, pct, variantValue) =>
        set((state) => ({
          items: state.items.map((i) =>
            sameLine(i, productId, variantValue)
              ? { ...i, discount_pct: Math.min(100, Math.max(0, pct)) }
              : i
          ),
        })),

      clearCart: () =>
        set({
          items: [],
          globalDiscount: 0,
          discount: 0,
          appliedPromo: null,
          clientName: '',
          clientEmail: '',
          notes: '',
        }),

      setPaymentMethod: (method) => set({ paymentMethod: method }),
      setGlobalDiscount: (amount) =>
        set({ globalDiscount: Math.max(0, amount), discount: Math.max(0, amount) }),

      applyPromo: (promo) =>
        set((state) => {
          const sub = state.items.reduce(
            (sum, i) => sum + i.unit_price * i.quantity * (1 - i.discount_pct / 100),
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
          (sum, i) => sum + i.unit_price * i.quantity * (1 - i.discount_pct / 100),
          0
        ),

      promoDiscount: () => {
        const { appliedPromo, items } = get()
        if (!appliedPromo) return 0
        const sub = items.reduce(
          (sum, i) => sum + i.unit_price * i.quantity * (1 - i.discount_pct / 100),
          0
        )
        if (appliedPromo.type === 'percent') return Math.round((sub * appliedPromo.value) / 100)
        return Math.min(appliedPromo.value, sub)
      },

      total: () => {
        const { globalDiscount } = get()
        const sub = get().subtotal()
        const promo = get().promoDiscount()
        return Math.max(0, sub - promo - globalDiscount)
      },

      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      hasStock: (productId, qty, variantValue) => {
        const item = get().items.find((i) => sameLine(i, productId, variantValue))
        if (!item) return true
        return item.quantity + qty <= item.product.stock
      },
    }),
    {
      name: 'arm-merch-cart',
      partialize: (state) => ({
        paymentMethod: state.paymentMethod,
        clientName: state.clientName,
        clientEmail: state.clientEmail,
      }),
    }
  )
)
