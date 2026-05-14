'use client'

import Link from 'next/link'
import {
  ArrowRight,
  ShoppingBag,
  ShieldCheck,
  Package,
  Truck,
  BarChart3,
} from 'lucide-react'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#06070A] text-white overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,179,0,0.18),transparent_40%)] pointer-events-none" />

      {/* NAVBAR */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFB300] text-black font-black">
              A
            </div>

            <div>
              <h1 className="text-lg font-black tracking-tight">
                ARM Merch
              </h1>

              <p className="text-xs text-zinc-400">
                Plataforma oficial ARM Global
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/track"
              className="hidden md:flex text-sm text-zinc-300 hover:text-white transition"
            >
              Seguir pedido
            </Link>

            <Link
              href="/login"
              className="rounded-xl bg-[#FFB300] px-5 py-2.5 text-sm font-bold text-black transition hover:scale-[1.03]"
            >
              Ingresar
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative z-10">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-24 lg:grid-cols-2 lg:items-center">
          {/* Left */}
          <div>
            <div className="mb-5 inline-flex items-center rounded-full border border-[#FFB300]/30 bg-[#FFB300]/10 px-4 py-2 text-sm text-[#FFCC4D]">
              Sistema oficial de Merch ARM Global
            </div>

            <h2 className="text-5xl font-black leading-tight tracking-tight lg:text-7xl">
              Merch que
              <span className="text-[#FFB300]"> conecta </span>
              personas.
            </h2>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-400">
              Plataforma moderna para ventas, inventario, producción,
              seguimiento de pedidos y gestión multi-campus.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/login"
                className="flex items-center gap-2 rounded-2xl bg-[#FFB300] px-6 py-4 font-bold text-black transition hover:scale-[1.03]"
              >
                Ingresar al sistema
                <ArrowRight size={18} />
              </Link>

              <Link
                href="/track"
                className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-semibold text-white transition hover:bg-white/10"
              >
                Seguir pedido
              </Link>
            </div>
          </div>

          {/* Right */}
          <div className="relative">
            <div className="rounded-[32px] border border-white/10 bg-[#10131A] p-6 shadow-2xl shadow-black/40">
              <div className="rounded-3xl border border-white/5 bg-[#0B0E13] p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-500">
                      Ventas hoy
                    </p>

                    <h3 className="mt-1 text-4xl font-black">
                      $482.990
                    </h3>
                  </div>

                  <div className="rounded-2xl bg-[#FFB300]/10 p-4 text-[#FFB300]">
                    <ShoppingBag size={28} />
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    'Polera Voluntariado',
                    'Jockey ARM',
                    'Café Máquina',
                    'Lanyard ARM',
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3"
                    >
                      <span className="font-medium">{item}</span>

                      <span className="text-sm text-zinc-400">
                        Stock OK
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating */}
            <div className="absolute -right-5 -top-5 rounded-2xl border border-white/10 bg-[#11151D] px-5 py-4 shadow-xl">
              <p className="text-xs text-zinc-500">
                Pedidos producción
              </p>

              <h4 className="mt-1 text-2xl font-black text-[#FFB300]">
                12 activos
              </h4>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="relative z-10 border-t border-white/5 bg-[#0B0D12]">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="mb-14">
            <h3 className="text-4xl font-black">
              Todo lo necesario para operar
            </h3>

            <p className="mt-4 max-w-2xl text-zinc-400">
              ARM Merch centraliza ventas, inventario, producción
              y seguimiento en una sola plataforma.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                title: 'Punto de venta',
                icon: ShoppingBag,
                desc: 'Ventas rápidas con scanner y control en tiempo real.',
              },
              {
                title: 'Inventario',
                icon: Package,
                desc: 'Control multi-campus y movimientos automáticos.',
              },
              {
                title: 'Seguimiento',
                icon: Truck,
                desc: 'Pedidos con estados y tracking para clientes.',
              },
              {
                title: 'Reportes',
                icon: BarChart3,
                desc: 'Métricas, cierres y estadísticas del sistema.',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-3xl border border-white/5 bg-white/[0.03] p-6 transition hover:border-[#FFB300]/30 hover:bg-white/[0.05]"
              >
                <div className="mb-5 inline-flex rounded-2xl bg-[#FFB300]/10 p-4 text-[#FFB300]">
                  <feature.icon size={26} />
                </div>

                <h4 className="text-xl font-bold">
                  {feature.title}
                </h4>

                <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 bg-[#07090D]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-6 py-8 text-sm text-zinc-500 md:flex-row">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} />
            Sistema protegido ARM Merch
          </div>

          <p>
            © {new Date().getFullYear()} ARM Global
          </p>
        </div>
      </footer>
    </main>
  )
}