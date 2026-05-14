'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { NotifyModal, useNotify } from '@/components/ui/notify-modal'
import { Barcode, Package, Plus, Minus, Trash2, CheckCircle2, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

type ScannedItem = {
  product_id: string
  inventory_id: string
  campus_id: string
  name: string
  sku: string
  barcode: string
  current_stock: number
  quantity: number
}

export default function ScanInventoryPage() {
  const supabase = createClient()
  const { notify, success, error, close } = useNotify()
  const inputRef = useRef<HTMLInputElement>(null)

  const [scanBuffer, setScanBuffer] = useState('')
  const [items, setItems] = useState<ScannedItem[]>([])
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastScanned, setLastScanned] = useState<string | null>(null)
  const [movType, setMovType] = useState<'entrada' | 'salida'>('entrada')
  const [notes, setNotes] = useState('')
  const [campusName, setCampusName] = useState('')

  useEffect(() => {
    // Focus the hidden input to capture scanner input
    inputRef.current?.focus()
    loadCampus()
  }, [])

  async function loadCampus() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: profile } = await supabase
      .from('profiles')
      .select('campus_id, campus:campus_id(name)')
      .eq('id', session.user.id)
      .single()
    const campus = (profile?.campus as any)
    if (campus?.name) setCampusName(campus.name)
  }

  // ── Barcode scanner input handler ─────────────────────────────────────────
  // Scanners send characters rapidly and finish with Enter
  const handleScanInput = useCallback(async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const code = scanBuffer.trim()
      setScanBuffer('')

      if (!code) return
      await processBarcode(code)
    }
  }, [scanBuffer, items])

  async function processBarcode(code: string) {
    setScanning(true)
    setLastScanned(code)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { error('Sesión expirada'); setScanning(false); return }

      // Check if already in list
      const existing = items.find(i => i.barcode === code || i.sku === code)
      if (existing) {
        // Increment quantity
        setItems(prev => prev.map(i =>
          (i.barcode === code || i.sku === code)
            ? { ...i, quantity: i.quantity + 1 }
            : i
        ))
        setScanning(false)
        return
      }

      // Obtener campus del usuario
      const { data: profile } = await supabase
        .from('profiles')
        .select('campus_id')
        .eq('id', session.user.id)
        .single()

      const currentCampusId = profile?.campus_id

      // Buscar producto SOLO del campus actual
      const { data: products } = await supabase
        .from('products_with_stock')
        .select(`
          id,
          name,
          sku,
          barcode,
          stock,
          inventory_id,
          campus_id
        `)
        .eq('campus_id', currentCampusId)
        .or(`barcode.eq.${code},sku.eq.${code}`)
        .limit(1)

      if (!products?.length) {
        error('Producto no encontrado', `No existe producto con código: ${code}`)
        setScanning(false)
        return
      }

      const p = products[0]

      if (!p.inventory_id) {
        error('Sin inventario', `El producto "${p.name}" no tiene inventario en este campus`)
        setScanning(false)
        return
      }

      setItems(prev => [...prev, {
        product_id:    p.id,
        inventory_id:  p.inventory_id,
        campus_id:     p.campus_id,
        name:          p.name,
        sku:           p.sku ?? code,
        barcode:       p.barcode ?? code,
        current_stock: p.stock ?? 0,
        quantity:      1,
      }])

    } catch (e: any) {
      error('Error', e.message)
    }

    setScanning(false)
    inputRef.current?.focus()
  }

  function updateQty(product_id: string, delta: number) {
    setItems(prev => prev.map(i =>
      i.product_id === product_id
        ? { ...i, quantity: Math.max(1, i.quantity + delta) }
        : i
    ))
  }

  function removeItem(product_id: string) {
    setItems(prev => prev.filter(i => i.product_id !== product_id))
  }

  // ── Confirm and save all movements ───────────────────────────────────────
  async function handleConfirm() {
    if (!items.length) { error('Sin productos', 'Escanea al menos un producto'); return }

    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { error('Sesión expirada'); setSaving(false); return }

    try {
      let successCount = 0

      for (const item of items) {
        const newStock = movType === 'entrada'
          ? item.current_stock + item.quantity
          : Math.max(0, item.current_stock - item.quantity)

        // Insert movement
        await supabase.from('inventory_movements').insert({
          product_id: item.product_id,
          campus_id:  item.campus_id,
          type:       movType,
          quantity:   item.quantity,
          notes:      notes.trim() || `${movType === 'entrada' ? 'Entrada' : 'Salida'} por escaneo`,
          created_by: session.user.id,
        })

        // Update stock
        await fetch('/api/inventory', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            inventory_id: item.inventory_id,
            stock: newStock,
          }),
        })

        successCount++
      }

      success(
        `${movType === 'entrada' ? 'Entrada' : 'Salida'} registrada`,
        `${successCount} producto${successCount > 1 ? 's' : ''} actualizados correctamente`,
        movType === 'entrada' ? '📦' : '✅'
      )
      setItems([])
      setNotes('')
      setLastScanned(null)

    } catch (e: any) {
      error('Error al guardar', e.message)
    }

    setSaving(false)
    inputRef.current?.focus()
  }

  const fmt = (n: number) => new Intl.NumberFormat('es-CL').format(n)

  return (
    <div className="flex flex-col gap-5 h-full" onClick={() => inputRef.current?.focus()}>
      <NotifyModal notify={notify} onClose={close} />

      {/* Hidden input captures scanner */}
      <input
        ref={inputRef}
        value={scanBuffer}
        onChange={e => setScanBuffer(e.target.value)}
        onKeyDown={handleScanInput}
        className="absolute opacity-0 w-0 h-0 pointer-events-none"
        autoFocus
        autoComplete="off"
      />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/inventory" className="rounded-xl border border-zinc-700 p-2 text-zinc-400 hover:text-white transition">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-white flex items-center gap-2">
              <Barcode size={18} className="text-amber-400" />
              Escaneo de inventario
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">{campusName || 'Campus'}</p>
          </div>
        </div>

        {items.length > 0 && (
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold rounded-xl px-5 py-2.5 text-sm transition"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {saving ? 'Guardando...' : `Confirmar ${movType} (${items.reduce((a, i) => a + i.quantity, 0)} uds)`}
          </button>
        )}
      </div>

      {/* Type selector */}
      <div className="grid grid-cols-2 gap-2">
        {(['entrada', 'salida'] as const).map(t => (
          <button
            key={t}
            onClick={() => setMovType(t)}
            className={`rounded-xl border py-3 text-sm font-semibold transition ${
              movType === t
                ? t === 'entrada'
                  ? 'border-green-500/40 bg-green-500/10 text-green-400'
                  : 'border-red-500/40 bg-red-500/10 text-red-400'
                : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
            }`}
          >
            {t === 'entrada' ? '📦 Entrada de mercadería' : '📤 Salida de mercadería'}
          </button>
        ))}
      </div>

      {/* Scan zone */}
      <div
        className={`flex items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-8 transition cursor-pointer ${
          scanning
            ? 'border-amber-500 bg-amber-500/5'
            : 'border-zinc-700 hover:border-zinc-500'
        }`}
        onClick={() => inputRef.current?.focus()}
      >
        <Barcode size={32} className={scanning ? 'text-amber-400' : 'text-zinc-600'} />
        <div>
          <p className={`font-semibold ${scanning ? 'text-amber-400' : 'text-zinc-400'}`}>
            {scanning ? 'Procesando...' : 'Zona de escaneo activa'}
          </p>
          <p className="text-xs text-zinc-600">
            {lastScanned ? `Último: ${lastScanned}` : 'Escanea un código de barra o escríbelo aquí'}
          </p>
        </div>
      </div>

      {/* Manual input */}
      <div className="flex gap-2">
        <input
          placeholder="O ingresa el código manualmente y presiona Enter"
          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition"
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const val = (e.target as HTMLInputElement).value.trim()
              if (val) { processBarcode(val); (e.target as HTMLInputElement).value = '' }
            }
          }}
        />
      </div>

      {/* Scanned items */}
      {items.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Productos escaneados ({items.length})
            </p>
            <button onClick={() => setItems([])} className="text-xs text-zinc-600 hover:text-red-400 transition">
              Limpiar todo
            </button>
          </div>

          <div className="rounded-xl border border-zinc-800 overflow-hidden divide-y divide-zinc-800">
            {items.map(item => (
              <div key={item.product_id} className="flex items-center gap-3 px-4 py-3 bg-zinc-900">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.name}</p>
                  <p className="text-xs text-zinc-500">{item.barcode} · Stock actual: {fmt(item.current_stock)}</p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => updateQty(item.product_id, -1)}
                    className="h-7 w-7 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white flex items-center justify-center transition">
                    <Minus size={12} />
                  </button>
                  <span className="w-10 text-center text-sm font-bold text-white">{item.quantity}</span>
                  <button onClick={() => updateQty(item.product_id, 1)}
                    className="h-7 w-7 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white flex items-center justify-center transition">
                    <Plus size={12} />
                  </button>
                </div>

                <div className="text-right shrink-0">
                  <p className={`text-xs font-bold ${movType === 'entrada' ? 'text-green-400' : 'text-red-400'}`}>
                    {movType === 'entrada' ? '+' : '-'}{item.quantity}
                  </p>
                  <p className="text-[10px] text-zinc-600">
                    → {movType === 'entrada' ? item.current_stock + item.quantity : Math.max(0, item.current_stock - item.quantity)}
                  </p>
                </div>

                <button onClick={() => removeItem(item.product_id)}
                  className="text-zinc-700 hover:text-red-400 transition shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Notes */}
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Nota del movimiento (opcional)"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-12 text-center">
          <Package size={36} className="text-zinc-700" />
          <p className="mt-3 text-sm text-zinc-600">Escanea productos para comenzar</p>
          <p className="mt-1 text-xs text-zinc-700">
            Los productos con código EAN o SKU registrado aparecerán aquí
          </p>
        </div>
      )}
    </div>
  )
}
