'use client'

import { useState } from 'react'
import { CheckCircle, X, Loader2, User, Printer, Mail, CreditCard, Smartphone, AlertCircle } from 'lucide-react'
import { useCart } from '@/lib/hooks/use-cart'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Props {
  clientName: string
  clientEmail: string
  onClose: () => void
  onNewSale: () => void
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }).format(n)

const fmtDate = (d: Date) =>
  d.toLocaleDateString('es-CL', { day:'2-digit', month:'2-digit', year:'numeric' }) + ' ' +
  d.toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' })

type Step = 'confirm' | 'loading' | 'sumup_waiting' | 'success'

interface OrderSnapshot {
  total: number; subtotal: number; discount: number
  method: string; orderNumber: number; orderId: string; date: Date
  items: { name: string; quantity: number; price: number }[]
}

export default function CheckoutModal({ clientName, clientEmail, onClose, onNewSale }: Props) {
  const { items, paymentMethod, subtotal, total, discount, clearCart } = useCart()
  const [step, setStep]             = useState<Step>('confirm')
  const [snapshot, setSnapshot]     = useState<OrderSnapshot | null>(null)
  const [emailSent, setEmailSent]   = useState(false)
  const [emailSending, setEmailSending] = useState(false)

  const isSumup = paymentMethod === 'debito' || paymentMethod === 'credito'

  async function handleConfirm() {
    setStep('loading')
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { toast.error('Sesión expirada'); setStep('confirm'); return }

    // Crear orden como pendiente
    const { data: order, error } = await supabase.from('orders').insert({
      seller_id:      session.user.id,
      payment_method: paymentMethod,
      subtotal:       subtotal(),
      discount,
      total:          total(),
      notes:          `Cliente: ${clientName}${clientEmail ? ` | Email: ${clientEmail}` : ''}${isSumup ? ' | SumUp' : ''}`,
      status:         isSumup ? 'pendiente' : 'completada',
    }).select().single()

    if (error) { toast.error(error.message); setStep('confirm'); return }

    await supabase.from('order_items').insert(
      items.map(i => ({ order_id: order.id, product_id: i.product.id, quantity: i.quantity, unit_price: i.product.price }))
    )

    const snap: OrderSnapshot = {
      total: total(), subtotal: subtotal(), discount,
      method: paymentMethod, orderNumber: order.order_number,
      orderId: order.id, date: new Date(),
      items: items.map(i => ({ name: i.product.name, quantity: i.quantity, price: i.product.price })),
    }

    clearCart()
    setSnapshot(snap)

    if (!isSumup) {
      if (clientEmail?.includes('@')) sendEmail(snap, clientEmail)
      toast.success(`Venta #${order.order_number} completada — ${fmt(snap.total)}`)
      setStep('success')
    } else {
      setStep('sumup_waiting')
    }
  }

  async function confirmSumupPaid() {
    if (!snapshot) return
    const supabase = createClient()
    await supabase.from('orders').update({ status: 'completada' }).eq('id', snapshot.orderId)
    if (clientEmail?.includes('@')) sendEmail(snapshot, clientEmail)
    toast.success(`Venta #${snapshot.orderNumber} completada — ${fmt(snapshot.total)}`)
    setStep('success')
  }

  async function cancelSumupPaid() {
    if (!snapshot) return
    const supabase = createClient()
    await supabase.from('orders').update({ status: 'cancelada' }).eq('id', snapshot.orderId)
    toast.error('Pago cancelado')
    onClose()
  }

  async function sendEmail(snap: OrderSnapshot, email: string) {
    setEmailSending(true)
    try {
      await fetch('/api/send-voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email, clientName, orderNumber: snap.orderNumber,
          items: snap.items, subtotal: snap.subtotal,
          discount: snap.discount, total: snap.total,
          paymentMethod: snap.method, date: fmtDate(snap.date),
        }),
      })
      setEmailSent(true)
    } catch {}
    setEmailSending(false)
  }

  function handlePrint() {
    if (!snapshot) return

    const METHOD_LABEL: Record<string, string> = {
      efectivo:'Efectivo', transferencia:'Transferencia',
      debito:'Tarjeta débito', credito:'Tarjeta crédito'
    }

    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<title>Comprobante ARM Merch #${snapshot.orderNumber}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;font-size:12px;width:80mm;padding:5mm;color:#000;background:#fff}
.c{text-align:center}.b{font-weight:700}.s{font-size:10px;color:#555}
.d{border-top:1px dashed #ccc;margin:8px 0}.D{border-top:2px solid #000;margin:8px 0}
.r{display:flex;justify-content:space-between;align-items:baseline;margin:3px 0}
.T{display:flex;justify-content:space-between;align-items:baseline;margin-top:4px}
.f{font-size:10px;color:#777;text-align:center;margin-top:8px;line-height:1.6}
@media print{body{width:80mm}@page{margin:0;size:80mm auto}}
</style></head><body>
<div class="c" style="margin-bottom:10px">
  <div style="font-size:22px;font-weight:900;letter-spacing:-0.5px">ARM MERCH</div>
  <div class="s" style="margin-top:2px">ARM Global · Sistema de Merch</div>
</div>
<div class="D"></div>
<div style="margin:8px 0">
  <div class="r"><span class="s">N° Orden</span><span class="b">#${snapshot.orderNumber}</span></div>
  <div class="r"><span class="s">Fecha</span><span>${fmtDate(snapshot.date)}</span></div>
  <div class="r"><span class="s">Cliente</span><span class="b">${clientName}</span></div>
  <div class="r"><span class="s">Pago</span><span>${METHOD_LABEL[snapshot.method] ?? snapshot.method}</span></div>
</div>
<div class="d"></div>
<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;color:#555">Productos</div>
${snapshot.items.map((i: any) => `<div style="margin-bottom:6px">
  <div class="b">${i.name}</div>
  <div class="r s"><span>${i.quantity} x ${fmt(i.price)}</span><span class="b" style="color:#000;font-size:12px">${fmt(i.price * i.quantity)}</span></div>
</div>`).join('')}
<div class="d"></div>
${snapshot.discount > 0 ? `<div class="r s"><span>Subtotal</span><span>${fmt(snapshot.subtotal)}</span></div>
<div class="r" style="color:#16a34a;font-size:11px"><span>Descuento</span><span>-${fmt(snapshot.discount)}</span></div>
<div style="border-top:1px solid #eee;margin:4px 0"></div>` : ''}
<div class="T"><span style="font-size:13px;font-weight:700">TOTAL</span><span style="font-size:18px;font-weight:900">${fmt(snapshot.total)}</span></div>
<div class="D"></div>
<div class="f"><div>Gracias por tu compra!</div><div>Que Dios bendiga tu vida</div><div style="margin-top:4px;font-size:9px">ARM Global</div></div>
</body></html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    const win  = window.open(url, '_blank', 'width=420,height=650')
    if (win) setTimeout(() => { win.print() }, 500)
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}
      onClick={e => { if (e.target === e.currentTarget && step !== 'loading') onClose() }}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-sm mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-white">
            {step === 'success'       ? '¡Venta completada!' :
             step === 'sumup_waiting' ? 'Cobrar con SumUp' : 'Confirmar venta'}
          </h2>
          {(step === 'confirm' || step === 'success') && (
            <button onClick={step === 'success' ? onNewSale : onClose}
              className="text-zinc-500 hover:text-white transition"><X size={16} /></button>
          )}
        </div>

        {/* CONFIRM */}
        {step === 'confirm' && (
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3 bg-zinc-800/60 rounded-xl px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                <User size={14} className="text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{clientName}</p>
                {clientEmail && <p className="text-xs text-zinc-500 truncate">{clientEmail}</p>}
              </div>
              {clientEmail && <Mail size={14} className="text-amber-400 shrink-0" />}
            </div>

            <div className="flex flex-col gap-2 max-h-44 overflow-y-auto">
              {items.map(item => (
                <div key={item.product.id} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-300">{item.product.name}
                    <span className="text-zinc-600 ml-1">×{item.quantity}</span>
                  </span>
                  <span className="text-zinc-300 font-medium">{fmt(item.product.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-zinc-800 pt-3 flex flex-col gap-1.5">
              {discount > 0 && <>
                <div className="flex justify-between text-xs text-zinc-500"><span>Subtotal</span><span>{fmt(subtotal())}</span></div>
                <div className="flex justify-between text-xs text-green-400"><span>Descuento</span><span>−{fmt(discount)}</span></div>
              </>}
              <div className="flex justify-between text-base font-bold text-white mt-1">
                <span>Total</span><span>{fmt(total())}</span>
              </div>
            </div>

            <div className="bg-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-zinc-500">Método de pago</span>
              <div className="flex items-center gap-1.5">
                {isSumup && <CreditCard size={12} className="text-blue-400" />}
                <span className="text-xs font-semibold text-amber-400 capitalize">{paymentMethod}</span>
                {isSumup && <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-semibold">SumUp</span>}
              </div>
            </div>

            {isSumup && (
              <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2">
                <Smartphone size={12} className="text-blue-400 shrink-0" />
                <p className="text-[11px] text-blue-400">Cobrarás manualmente desde el terminal SumUp Solo</p>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={onClose}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl py-2.5 text-sm transition">
                Cancelar
              </button>
              <button onClick={handleConfirm}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl py-2.5 text-sm transition active:scale-[0.98]">
                Cobrar {fmt(total())}
              </button>
            </div>
          </div>
        )}

        {/* LOADING */}
        {step === 'loading' && (
          <div className="p-10 flex flex-col items-center gap-4">
            <Loader2 size={32} className="text-amber-500 animate-spin" />
            <p className="text-sm text-zinc-400">Registrando venta...</p>
          </div>
        )}

        {/* SUMUP WAITING — flujo manual */}
        {step === 'sumup_waiting' && snapshot && (
          <div className="p-5 flex flex-col gap-4">
            <div className="flex flex-col items-center text-center gap-3 py-2">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <CreditCard size={26} className="text-blue-400" />
              </div>
              <div>
                <p className="text-white font-semibold">Cobrar en el terminal</p>
                <p className="text-zinc-500 text-xs mt-1">Ingresa el monto en el SumUp Solo y pasa la tarjeta</p>
              </div>
            </div>

            {/* Monto grande y visible */}
            <div className="bg-zinc-800 rounded-2xl px-5 py-5 text-center border border-zinc-700">
              <p className="text-xs text-zinc-500 mb-1">Monto a cobrar</p>
              <p className="text-3xl font-black text-amber-400">{fmt(snapshot.total)}</p>
              <p className="text-xs text-zinc-500 mt-2">Cliente: <span className="text-zinc-300 font-medium">{clientName}</span></p>
              <p className="text-xs text-zinc-500">Orden: <span className="text-zinc-300 font-medium">#{snapshot.orderNumber}</span></p>
            </div>

            {/* Pasos */}
            <div className="flex flex-col gap-2">
              {[
                { n:1, text:'Ingresa el monto en el SumUp Solo' },
                { n:2, text:'El cliente acerca la tarjeta al terminal' },
                { n:3, text:'Confirma aquí cuando el pago sea aprobado' },
              ].map(s => (
                <div key={s.n} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0">{s.n}</div>
                  <p className="text-xs text-zinc-400">{s.text}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={cancelSumupPaid}
                className="flex-1 bg-zinc-800 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 border border-zinc-700 text-zinc-400 font-medium rounded-xl py-3 text-sm transition">
                Cancelar pago
              </button>
              <button onClick={confirmSumupPaid}
                className="flex-1 bg-green-500 hover:bg-green-400 text-zinc-950 font-bold rounded-xl py-3 text-sm transition active:scale-[0.98] flex items-center justify-center gap-2">
                <CheckCircle size={15} />
                Pago aprobado
              </button>
            </div>
          </div>
        )}

        {/* SUCCESS */}
        {step === 'success' && snapshot && (
          <div className="p-6 flex flex-col gap-4">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle size={24} className="text-green-400" />
              </div>
              <div>
                <p className="text-white font-semibold">¡Venta registrada!</p>
                <p className="text-zinc-400 text-xs">Orden #{snapshot.orderNumber} · {clientName}</p>
              </div>
            </div>

            <div className="bg-zinc-800 rounded-xl px-4 py-3 flex flex-col gap-1.5">
              {snapshot.items.map((item, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-zinc-400">{item.name} ×{item.quantity}</span>
                  <span className="text-zinc-300">{fmt(item.price * item.quantity)}</span>
                </div>
              ))}
              <div className="border-t border-zinc-700 mt-1.5 pt-2 flex justify-between">
                <span className="text-xs text-zinc-500 capitalize">{snapshot.method}</span>
                <span className="text-lg font-bold text-amber-400">{fmt(snapshot.total)}</span>
              </div>
            </div>

            {clientEmail && (
              <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border ${
                emailSent ? 'bg-green-500/10 border-green-500/20' : 'bg-zinc-800 border-zinc-700'}`}>
                {emailSending
                  ? <><Loader2 size={13} className="text-zinc-400 animate-spin shrink-0" /><span className="text-xs text-zinc-400">Enviando voucher...</span></>
                  : emailSent
                  ? <><CheckCircle size={13} className="text-green-400 shrink-0" /><span className="text-xs text-green-400">Voucher enviado a {clientEmail}</span></>
                  : <><Mail size={13} className="text-zinc-500 shrink-0" /><button onClick={() => sendEmail(snapshot, clientEmail)} className="text-xs text-zinc-400 hover:text-amber-400 transition">Reenviar voucher</button></>}
              </div>
            )}

            <button onClick={handlePrint}
              className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-white font-medium rounded-xl py-3 text-sm transition">
              <Printer size={15} />Imprimir voucher
            </button>
            <button onClick={onNewSale}
              className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl py-3 text-sm transition active:scale-[0.98]">
              Nueva venta
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
