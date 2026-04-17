'use client'

import Link from 'next/link'
import { CheckCircle2, Printer, Receipt, Plus, Mail } from 'lucide-react'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

interface Props {
  open: boolean
  orderId: string
  orderNumber: number | string
  total: number
  clientName?: string
  clientEmail?: string
  onNewSale: () => void
}

export default function SaleSuccessModal({
  open,
  orderId,
  orderNumber,
  total,
  clientName,
  clientEmail,
  onNewSale,
}: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-zinc-700 bg-zinc-950 shadow-2xl">
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle2 size={46} className="text-green-400" />
          </div>

          <h2 className="text-2xl font-bold text-white">
            Venta realizada con éxito
          </h2>

          <p className="mt-2 text-sm text-zinc-400">
            La venta fue registrada correctamente.
          </p>
        </div>

        <div className="px-6 pb-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-zinc-950/60 p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Orden
                </p>
                <p className="mt-1 text-lg font-semibold text-white">
                  #{orderNumber}
                </p>
              </div>

              <div className="rounded-xl bg-zinc-950/60 p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Total
                </p>
                <p className="mt-1 text-lg font-semibold text-amber-400">
                  {formatCurrency(total)}
                </p>
              </div>
            </div>

            {(clientName || clientEmail) && (
              <div className="mt-4 rounded-xl bg-zinc-950/60 p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Cliente
                </p>
                <p className="mt-1 text-sm font-medium text-white">
                  {clientName || 'Cliente'}
                </p>

                {clientEmail && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
                    <Mail size={14} />
                    <span>{clientEmail}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link
              href={`/orders/${orderId}/print`}
              target="_blank"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-amber-400"
            >
              <Printer size={16} />
              Imprimir voucher
            </Link>

            <Link
              href={`/orders/${orderId}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700"
            >
              <Receipt size={16} />
              Ver orden
            </Link>
          </div>

          <button
            type="button"
            onClick={onNewSale}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
          >
            <Plus size={16} />
            Nueva venta
          </button>
        </div>
      </div>
    </div>
  )
}