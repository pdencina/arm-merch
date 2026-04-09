'use client'

import { useState } from 'react'
import { Trash2, ShoppingCart } from 'lucide-react'
import { useCart } from '@/lib/hooks/use-cart'
import CheckoutModal from './checkout-modal'

const PAYMENT_METHODS = [
  { value: 'efectivo',      label: 'Efectivo'  },
  { value: 'transferencia', label: 'Transfer.' },
  { value: 'debito',        label: 'Débito'    },
  { value: 'credito',       label: 'Crédito'   },
] as const

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n)

export default function Cart() {
  const { items, removeItem, updateQuantity, setPaymentMethod,
          paymentMethod, clearCart, subtotal, total, itemCount } = useCart()
  const [showCheckout, setShowCheckout] = useState(false)
  const [clientName, setClientName]     = useState('')
  const [clientEmail, setClientEmail]   = useState('')

  const canCheckout = items.length > 0 && clientName.trim().length > 0

  return (
    <>
      <div className="w-72 xl:w-80 flex flex-col bg-zinc-900 border-l border-zinc-800 shrink-0">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <ShoppingCart size={16} className="text-zinc-400" />
            <span className="text-sm font-semibold text-white">Carrito</span>
          </div>
          <div className="flex items-center gap-2">
            {itemCount() > 0 && (
              <span className="bg-amber-500 text-zinc-950 text-[10px] font-bold px-2 py-0.5 rounded-full">{itemCount()}</span>
            )}
            {itemCount() > 0 && (
              <button onClick={clearCart} className="text-zinc-600 hover:text-red-400 transition"><Trash2 size={14} /></button>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-700 gap-3 py-10">
              <ShoppingCart size={32} />
              <p className="text-xs text-center leading-relaxed">Selecciona productos<br />del catálogo</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.product.id}
                className="flex items-center gap-2 bg-zinc-800/60 rounded-xl p-2.5 border border-zinc-700/50">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-200 truncate">{item.product.name}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{fmt(item.product.price)} c/u</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    className="w-6 h-6 rounded-md bg-zinc-700 text-zinc-300 hover:bg-zinc-600 text-sm flex items-center justify-center transition">−</button>
                  <span className="text-xs text-white font-medium w-5 text-center">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    disabled={item.quantity >= item.product.stock}
                    className="w-6 h-6 rounded-md bg-zinc-700 text-zinc-300 hover:bg-zinc-600 disabled:opacity-30 text-sm flex items-center justify-center transition">+</button>
                </div>
                <p className="text-xs font-bold text-amber-400 min-w-[52px] text-right">{fmt(item.product.price * item.quantity)}</p>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-zinc-800 flex flex-col gap-3">

          {/* Nombre */}
          <div>
            <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">
              Nombre del cliente <span className="text-red-400">*</span>
            </label>
            <input type="text" value={clientName} onChange={e => setClientName(e.target.value)}
              placeholder="Ej: Juan Pérez"
              className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600
                         rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition" />
          </div>

          {/* Email opcional */}
          <div>
            <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">
              Email <span className="text-zinc-600">(voucher por correo)</span>
            </label>
            <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)}
              placeholder="juan@ejemplo.com"
              className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600
                         rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition" />
          </div>

          {/* Método de pago */}
          <div className="grid grid-cols-4 gap-1">
            {PAYMENT_METHODS.map(m => (
              <button key={m.value} onClick={() => setPaymentMethod(m.value)}
                className={`py-1.5 rounded-lg text-[10px] font-medium transition ${
                  paymentMethod === m.value
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:text-zinc-300'
                }`}>
                {m.label}
              </button>
            ))}
          </div>

          {/* Total */}
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-zinc-500">Total a cobrar</span>
            <span className="text-xl font-bold text-white">{fmt(total())}</span>
          </div>

          {items.length > 0 && !clientName.trim() && (
            <p className="text-[10px] text-amber-500/80 text-center">Ingresa el nombre del cliente para continuar</p>
          )}

          <button onClick={() => setShowCheckout(true)} disabled={!canCheckout}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed
                       text-zinc-950 font-bold rounded-xl py-3 text-sm transition-all active:scale-[0.98]">
            Confirmar venta
          </button>
        </div>
      </div>

      {showCheckout && (
        <CheckoutModal
          clientName={clientName.trim()}
          clientEmail={clientEmail.trim()}
          onClose={() => setShowCheckout(false)}
          onSuccess={() => { setShowCheckout(false); setClientName(''); setClientEmail('') }}
        />
      )}
    </>
  )
}
