'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, Loader2, CheckCircle } from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

const CAMPUS_COLORS: Record<string, string> = {
  'ARM Santiago':    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'ARM Puente Alto': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'ARM Punta Arenas':'bg-teal-500/10 text-teal-400 border-teal-500/20',
  'ARM Montevideo':  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'ARM Maracaibo':   'bg-red-500/10 text-red-400 border-red-500/20',
}

export default function TransfersPage() {
  const [campus, setCampus]       = useState<any[]>([])
  const [products, setProducts]   = useState<any[]>([])
  const [fromCampus, setFrom]     = useState('')
  const [toCampus, setTo]         = useState('')
  const [productId, setProduct]   = useState('')
  const [quantity, setQuantity]   = useState('')
  const [notes, setNotes]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [success, setSuccess]     = useState(false)
  const [error, setError]         = useState('')
  const [history, setHistory]     = useState<any[]>([])

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('campus').select('id, name').eq('active', true).order('name'),
      supabase.from('products_with_stock').select('id, name, stock, campus_id, campus_name').order('name'),
    ]).then(([{ data: c }, { data: p }]) => {
      setCampus(c ?? [])
      setProducts(p ?? [])
    })
    loadHistory()
  }, [])

  async function loadHistory() {
    const supabase = createClient()
    const { data } = await supabase.from('inventory_movements')
      .select('id, quantity, notes, created_at, product:products(name), created_by_profile:profiles(full_name)')
      .ilike('notes', '%Transferencia%')
      .order('created_at', { ascending: false }).limit(20)
    setHistory(data ?? [])
  }

  const filteredProducts = fromCampus
    ? products.filter(p => p.campus_id === fromCampus)
    : products

  const selectedProduct = products.find(p => p.id === productId)
  const qty = parseInt(quantity) || 0

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault()
    if (!fromCampus || !toCampus || !productId || !qty) { setError('Completa todos los campos'); return }
    if (fromCampus === toCampus) { setError('El campus origen y destino deben ser distintos'); return }
    if (selectedProduct && qty > selectedProduct.stock) { setError(`Stock insuficiente (${selectedProduct.stock} disponibles)`); return }

    setLoading(true); setError('')
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Sesión expirada'); setLoading(false); return }

    const fromName = campus.find(c => c.id === fromCampus)?.name ?? fromCampus
    const toName   = campus.find(c => c.id === toCampus)?.name ?? toCampus
    const noteText = `Transferencia de ${fromName} → ${toName}${notes ? `. ${notes}` : ''}`

    // Registrar salida del campus origen
    const { error: e1 } = await supabase.from('inventory_movements').insert({
      product_id: productId, type: 'salida', quantity: qty,
      notes: noteText, created_by: session.user.id,
    })
    if (e1) { setError(e1.message); setLoading(false); return }

    // Actualizar stock y campus del producto (ahora en campus destino)
    const newStock = (selectedProduct?.stock ?? 0) - qty
    const { error: e2 } = await supabase.from('inventory')
      .update({ stock: newStock, campus_id: toCampus })
      .eq('product_id', productId)

    if (e2) { setError(e2.message); setLoading(false); return }

    setSuccess(true); setLoading(false)
    setFrom(''); setTo(''); setProduct(''); setQuantity(''); setNotes('')

    // Recargar
    const { data: p } = await supabase.from('products_with_stock').select('id, name, stock, campus_id, campus_name').order('name')
    setProducts(p ?? [])
    loadHistory()
    setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-white">Transferencias entre campus</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Mueve stock de una sede a otra</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Formulario */}
        <form onSubmit={handleTransfer} className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-5 flex flex-col gap-4">
          <p className="text-sm font-medium text-white">Nueva transferencia</p>

          {/* Origen → Destino */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">Campus origen</label>
              <select value={fromCampus} onChange={e => { setFrom(e.target.value); setProduct('') }}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition">
                <option value="">Seleccionar...</option>
                {campus.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="mt-5 text-zinc-600"><ArrowRight size={16} /></div>
            <div className="flex-1">
              <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">Campus destino</label>
              <select value={toCampus} onChange={e => setTo(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition">
                <option value="">Seleccionar...</option>
                {campus.filter(c => c.id !== fromCampus).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Producto */}
          <div>
            <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">Producto</label>
            <select value={productId} onChange={e => setProduct(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition">
              <option value="">Seleccionar producto...</option>
              {filteredProducts.map(p => (
                <option key={p.id} value={p.id}>{p.name} — Stock: {p.stock}</option>
              ))}
            </select>
          </div>

          {/* Stock disponible */}
          {selectedProduct && (
            <div className="bg-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-zinc-500">Stock disponible en origen</span>
              <span className="text-base font-bold text-white">{selectedProduct.stock} uds.</span>
            </div>
          )}

          {/* Cantidad */}
          <div>
            <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">Cantidad a transferir</label>
            <input type="number" min="1" value={quantity} onChange={e => { setQuantity(e.target.value); setError('') }}
              placeholder="0" className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600
                         rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition text-center font-bold text-lg" />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">Notas <span className="text-zinc-600">(opcional)</span></label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Para evento del domingo"
              className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600
                         rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition" />
          </div>

          {error && <p className="text-red-400 text-xs bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">{error}</p>}
          {success && (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2.5">
              <CheckCircle size={14} className="text-green-400" />
              <span className="text-xs text-green-400 font-medium">Transferencia registrada exitosamente</span>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 font-bold
                       rounded-xl py-3 text-sm transition flex items-center justify-center gap-2">
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Transfiriendo...' : 'Registrar transferencia'}
          </button>
        </form>

        {/* Historial */}
        <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-4">
          <p className="text-sm font-medium text-white mb-3">Historial de transferencias</p>
          {history.length === 0 ? (
            <p className="text-zinc-600 text-xs py-8 text-center">Sin transferencias registradas</p>
          ) : history.map(h => (
            <div key={h.id} className="py-2.5 border-b border-zinc-700/30 last:border-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-medium text-zinc-200">{h.product?.name ?? '—'}</span>
                <span className="text-xs font-bold text-amber-400">{h.quantity} uds.</span>
              </div>
              <p className="text-[11px] text-zinc-500 truncate">{h.notes}</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">{h.created_by_profile?.full_name ?? '—'} · {new Date(h.created_at).toLocaleDateString('es-CL', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
