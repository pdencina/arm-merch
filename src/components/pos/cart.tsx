'use client'

import { useState } from 'react'

type CartItem = {
  id: string
  name: string
  price: number
  quantity: number
}

export default function SmartPOSCart() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [sumupSmartOpen, setSumupSmartOpen] = useState(false)
  const [sumupSmartOrder, setSumupSmartOrder] = useState<any>(null)
  const [isPolling, setIsPolling] = useState(false)

  // 🧠 TOTAL
  const total = () => {
    return cart.reduce((sum, item) => {
      return sum + Number(item.price) * Number(item.quantity)
    }, 0)
  }

  // 🧹 LIMPIAR CARRITO
  const clearCart = () => {
    setCart([])
  }

  // 🔄 POLLING (simulación)
  const startPollingForPayment = async (amount: number) => {
    setIsPolling(true)

    const interval = setInterval(async () => {
      console.log('🔎 Buscando pago en SumUp...', amount)

      // ⚠️ AQUÍ debes conectar tu API real
      const found = await fakeCheckPayment(amount)

      if (found) {
        clearInterval(interval)
        setIsPolling(false)

        alert('✅ Pago detectado automáticamente')

        setSumupSmartOpen(false)
        setSumupSmartOrder(null)
      }
    }, 4000)

    // ⛔ corta después de 2 minutos
    setTimeout(() => {
      clearInterval(interval)
      setIsPolling(false)
    }, 120000)
  }

  // 🎯 SIMULACIÓN (reemplazar por API real)
  const fakeCheckPayment = async (amount: number) => {
    return false
  }

  // 💳 SMART POS
  const handleSumupSmart = async () => {
    const orderTotal = total()

    if (orderTotal <= 0) {
      alert('Agrega productos al carrito antes de cobrar.')
      return
    }

    const orderId = crypto.randomUUID()
    const orderNumber = Math.floor(Math.random() * 10000)

    setSumupSmartOrder({
      id: orderId,
      number: orderNumber,
      total: orderTotal,
    })

    setSumupSmartOpen(true)

    // 🧹 limpiar carrito después de guardar total
    clearCart()

    // 🚀 iniciar polling
    startPollingForPayment(orderTotal)
  }

  return (
    <div className="p-6">

      <h1 className="mb-4 text-2xl font-bold">POS Demo</h1>

      {/* BOTÓN AGREGAR PRODUCTO */}
      <button
        onClick={() =>
          setCart([
            ...cart,
            {
              id: crypto.randomUUID(),
              name: 'Producto Demo',
              price: 100,
              quantity: 1,
            },
          ])
        }
        className="mb-4 rounded bg-blue-600 px-4 py-2 text-white"
      >
        Agregar producto $100
      </button>

      {/* TOTAL */}
      <div className="mb-4 text-xl">
        Total: ${total().toLocaleString('es-CL')}
      </div>

      {/* BOTÓN COBRAR */}
      <button
        onClick={handleSumupSmart}
        className="rounded bg-emerald-600 px-6 py-3 text-white font-semibold"
      >
        Cobrar con Smart POS
      </button>

      {/* MODAL SMART POS */}
      {sumupSmartOpen && sumupSmartOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-md rounded-3xl bg-zinc-900 p-8 text-center text-white shadow-xl">

            <div className="mb-4 text-4xl">💳</div>

            <h2 className="mb-2 text-xl font-bold">
              Cobro con Smart POS
            </h2>

            <p className="mb-6 text-zinc-400">
              Orden #{sumupSmartOrder.number}
            </p>

            <div className="mb-6 text-3xl font-bold text-emerald-400">
              ${sumupSmartOrder.total.toLocaleString('es-CL')}
            </div>

            <div className="mb-6 rounded-2xl bg-zinc-800 p-4 text-left text-sm text-zinc-300">
              <p className="mb-2 font-semibold text-white">Instrucciones:</p>

              <p>1. Cobra este monto en el Smart POS</p>
              <p>2. Espera aprobación del cliente</p>
              <p>3. El sistema detectará el pago automáticamente</p>
            </div>

            {isPolling && (
              <div className="flex items-center justify-center gap-2 text-yellow-400">
                <div className="h-2 w-2 animate-ping rounded-full bg-yellow-400"></div>
                <span className="text-sm">Esperando pago...</span>
              </div>
            )}

            <button
              onClick={() => {
                setSumupSmartOpen(false)
                setSumupSmartOrder(null)
              }}
              className="mt-6 text-sm text-zinc-400 hover:text-white"
            >
              Cancelar
            </button>

          </div>
        </div>
      )}
    </div>
  )
}