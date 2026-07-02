'use client'

import Link from 'next/link'
import {
  ArrowRight,
  LockKeyhole,
  MapPin,
  PackageCheck,
  ShoppingBag,
  Truck,
} from 'lucide-react'

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#F5F1EA] text-[#141414]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(151,168,155,0.26),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(223,202,171,0.24),transparent_30%)]" />

      <header className="relative z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-black/10 bg-black shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="ARM Merch" className="h-7 w-auto" />
            </div>

            <div>
              <p className="text-base font-black leading-none tracking-tight">ARM Merch</p>
              <p className="mt-1 text-xs text-[#77736D]">Productos oficiales ARM</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/track"
              className="hidden rounded-xl border border-black/10 bg-white/70 px-4 py-2.5 text-sm font-bold text-[#141414] shadow-sm transition hover:bg-white sm:inline-flex"
            >
              Seguir pedido
            </Link>

            <Link
              href="/login"
              className="rounded-xl bg-[#141414] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:scale-[1.02]"
            >
              Ingresar
            </Link>
          </div>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pb-24 lg:pt-20">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#B7C7B9]/60 bg-white/70 px-4 py-2 text-sm font-semibold text-[#5D6F64] shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[#9FB7A3]" />
            Próximamente compra online
          </div>

          <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
            ARM Merch
            <span className="block text-[#8DA08F]">muy pronto online.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-[#66615B] sm:text-lg">
            Estamos preparando una experiencia simple para conocer productos oficiales ARM,
            seguir pedidos y retirar en campus.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/track"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#141414] px-6 py-4 font-black text-white shadow-lg transition hover:scale-[1.02]"
            >
              Seguir mi pedido
              <ArrowRight size={18} />
            </Link>

            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-6 py-4 font-bold text-[#141414] shadow-sm transition hover:bg-white"
            >
              Ingresar al sistema
              <LockKeyhole size={17} />
            </Link>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 rounded-[2.5rem] bg-[#B7C7B9]/30 blur-3xl" />

          <div className="relative rounded-[2rem] border border-black/10 bg-white/70 p-5 shadow-2xl shadow-black/10 backdrop-blur">
            <div className="rounded-[1.6rem] border border-black/10 bg-[#FBFAF7] p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#7C917F]">
                    Vitrina ARM
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-[#141414]">
                    Productos oficiales
                  </h2>
                </div>

                <div className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
                  <ShoppingBag className="text-[#7C917F]" size={25} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { title: 'Ropa ARM', desc: 'Poleras y básicos' },
                  { title: 'Polerones', desc: 'Colecciones especiales' },
                  { title: 'Accesorios', desc: 'Detalles oficiales' },
                  { title: 'Café y botellas', desc: 'Productos de comunidad' },
                ].map((item, index) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm"
                  >
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF2EC] text-sm font-black text-[#6B7D6E]">
                      0{index + 1}
                    </div>

                    <h3 className="font-black text-[#141414]">{item.title}</h3>
                    <p className="mt-1 text-sm text-[#7B766F]">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-[#B7C7B9]/50 bg-[#EEF2EC] p-4">
                <div className="flex items-start gap-3">
                  <PackageCheck className="mt-0.5 text-[#6B7D6E]" size={20} />

                  <div>
                    <h3 className="font-black text-[#141414]">
                      Compra online en preparación
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-[#66615B]">
                      Por ahora puedes seguir tus pedidos o ingresar al sistema si eres parte del equipo.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                  <MapPin size={18} className="text-[#7C917F]" />
                  <span className="text-sm font-bold text-[#5F5A55]">Retiro en campus</span>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                  <Truck size={18} className="text-[#7C917F]" />
                  <span className="text-sm font-bold text-[#5F5A55]">Seguimiento simple</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
