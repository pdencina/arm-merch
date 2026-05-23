'use client'

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowRight, PackageSearch, Search, Home } from "lucide-react"

export default function TrackPage() {
  const router = useRouter()
  const [trackingCode, setTrackingCode] = useState('')

  function handleTrack() {
    const clean = trackingCode.trim()

    if (!clean) return

    router.push(`/track/${encodeURIComponent(clean)}`)
  }

  return (
    <main className="min-h-screen bg-[#F5F4EF] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,181,162,0.20),transparent_45%)]" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center shadow-sm">
              <span className="text-white font-black text-xl">A</span>
            </div>

            <div>
              <h1 className="text-2xl font-black text-[#111111]">
                ARM Merch
              </h1>
              <p className="text-[#7E9078] text-sm">
                Seguimiento de pedidos
              </p>
            </div>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border border-[#D8DDD2] bg-white text-[#111111] font-semibold hover:bg-[#F7F8F5] transition-all"
          >
            <Home className="w-4 h-4" />
            Inicio
          </Link>
        </div>

        {/* HERO */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-white/80 backdrop-blur-xl border border-[#D8DDD2] rounded-[36px] shadow-[0_10px_40px_rgba(0,0,0,0.04)] p-8 md:p-12">

            <div className="flex justify-center mb-8">
              <div className="w-24 h-24 rounded-[28px] bg-[#A8B5A2] flex items-center justify-center shadow-sm">
                <PackageSearch className="w-12 h-12 text-white" />
              </div>
            </div>

            <div className="text-center mb-10">
              <p className="uppercase tracking-[0.35em] text-[#7E9078] text-sm font-black mb-4">
                Seguimiento
              </p>

              <h2 className="text-5xl md:text-6xl font-black text-[#111111] leading-none mb-6">
                Revisa tu pedido
              </h2>

              <p className="text-[#5F5F5F] text-lg leading-relaxed max-w-2xl mx-auto">
                Ingresa el código de seguimiento que recibiste por correo
                para revisar el estado actual de tu pedido ARM Merch.
              </p>
            </div>

            {/* INPUT */}
            <div className="space-y-6">
              <div>
                <label className="block uppercase tracking-[0.18em] text-[#7E9078] text-sm font-black mb-4">
                  Código de seguimiento
                </label>

                <div className="relative">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7E9078]" />

                  <input
                    type="text"
                    value={trackingCode}
                    onChange={(e) => setTrackingCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleTrack()
                      }
                    }}
                    placeholder="Ej: ARM-1021"
                    className="w-full h-16 rounded-2xl border border-[#D8DDD2] bg-[#FCFCFA] px-14 text-[#111111] text-lg outline-none focus:ring-4 focus:ring-[#A8B5A2]/20 focus:border-[#A8B5A2] transition-all"
                  />
                </div>
              </div>

              <button
                onClick={handleTrack}
                className="w-full h-16 rounded-2xl bg-[#111111] hover:bg-[#1D1D1D] text-white font-black text-lg transition-all flex items-center justify-center gap-3"
              >
                Ver seguimiento
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            {/* INFO */}
            <div className="mt-8 rounded-2xl border border-[#D8DDD2] bg-[#EEF2EA] p-5">
              <p className="text-[#52604C] leading-relaxed">
                El seguimiento aplica especialmente para productos en producción,
                pedidos personalizados, polerones o productos con retiro en campus.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
