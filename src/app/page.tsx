'use client'

import Link from 'next/link'
import {
  ArrowRight,
  LockKeyhole,
  MapPin,
  PackageCheck,
  Sparkles,
  ShoppingBag,
  Truck,
} from 'lucide-react'

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#07080B] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,179,0,0.16),transparent_38%)]" />

      <header className="relative z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFB300] text-lg font-black text-black">
              A
            </div>

            <div>
              <p className="text-base font-black leading-none">ARM Merch</p>
              <p className="mt-1 text-xs text-zinc-500">Productos oficiales ARM</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/track"
              className="hidden rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 sm:inline-flex"
            >
              Seguir pedido
            </Link>

            <Link
              href="/login"
              className="rounded-xl bg-[#FFB300] px-4 py-2.5 text-sm font-black text-black transition hover:scale-[1.03]"
            >
              Ingresar
            </Link>
          </div>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pb-24 lg:pt-20">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#FFB300]/25 bg-[#FFB300]/10 px-4 py-2 text-sm font-semibold text-[#FFCC4D]">
            <Sparkles size={15} />
            Próximamente compra online
          </div>

          <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
            ARM Merch
            <span className="block text-[#FFB300]">muy pronto online.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg">
            Estamos preparando una experiencia simple para conocer productos
            oficiales ARM, seguir pedidos y retirar en campus.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/track"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#FFB300] px-6 py-4 font-black text-black transition hover:scale-[1.03]"
            >
              Seguir mi pedido
              <ArrowRight size={18} />
            </Link>

            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-bold text-white transition hover:bg-white/10"
            >
              Ingresar al sistema
              <LockKeyhole size={17} />
            </Link>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 rounded-[2.5rem] bg-[#FFB300]/20 blur-3xl" />

          <div className="relative rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="rounded-[1.6rem] border border-white/10 bg-[#0D1016] p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#FFB300]">
                    Vitrina ARM
                  </p>
                  <h2 className="mt-2 text-2xl font-black">
                    Productos oficiales
                  </h2>
                </div>

                <div className="rounded-2xl bg-[#FFB300] p-3 text-black">
                  <ShoppingBag size={26} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['👕', 'Ropa ARM'],
                  ['🧥', 'Polerones'],
                  ['🧢', 'Accesorios'],
                  ['☕', 'Café y botellas'],
                ].map(([icon, title]) => (
                  <div
                    key={title}
                    className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.04] p-4"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-2xl">
                      {icon}
                    </div>
                    <div>
                      <p className="font-bold">{title}</p>
                      <p className="text-xs text-zinc-500">Próximamente</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-[#FFB300]/20 bg-[#FFB300]/10 p-4">
                <p className="text-sm font-bold text-[#FFCC4D]">
                  Compra online en preparación
                </p>
                <p className="mt-1 text-xs leading-5 text-zinc-400">
                  Por ahora puedes seguir tus pedidos o ingresar al sistema si eres parte del equipo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-t border-white/5 bg-[#0B0D12]">
        <div className="mx-auto grid max-w-6xl gap-4 px-5 py-10 sm:px-6 md:grid-cols-3">
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
            <PackageCheck className="mb-3 text-[#FFB300]" size={24} />
            <h3 className="font-black">Productos oficiales</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Merch diseñado para la comunidad ARM.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
            <MapPin className="mb-3 text-[#FFB300]" size={24} />
            <h3 className="font-black">Retiro en campus</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Retira tus productos según disponibilidad.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
            <Truck className="mb-3 text-[#FFB300]" size={24} />
            <h3 className="font-black">Seguimiento</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Revisa el avance de pedidos en producción.
            </p>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-6 text-xs text-zinc-600 sm:px-6 md:flex-row">
          <p>© {new Date().getFullYear()} ARM Merch</p>
          <p>Plataforma oficial ARM Global</p>
        </div>
      </footer>
    </main>
  )
}
