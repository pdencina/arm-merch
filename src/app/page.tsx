'use client'

import Link from 'next/link'
import {
  ArrowRight,
  ShoppingBag,
  ShieldCheck,
  Package,
  Truck,
  MapPin,
  Shirt,
  Coffee,
  Tags,
  Sparkles,
  Clock3,
  LockKeyhole,
} from 'lucide-react'

const categories = [
  {
    title: 'Ropa ARM',
    description: 'Poleras, polerones y prendas oficiales.',
    icon: Shirt,
  },
  {
    title: 'Accesorios',
    description: 'Jockeys, lanyards, bolsos y más.',
    icon: Tags,
  },
  {
    title: 'Hidratación',
    description: 'Botellas, aguas, jugos y bebidas.',
    icon: Coffee,
  },
  {
    title: 'Pedidos especiales',
    description: 'Productos a pedido y producción interna.',
    icon: Package,
  },
]

const steps = [
  {
    title: 'Explora productos',
    description: 'Conoce el merch oficial disponible para la comunidad ARM.',
    icon: ShoppingBag,
  },
  {
    title: 'Compra online pronto',
    description: 'Muy pronto podrás comprar directamente desde esta plataforma.',
    icon: Sparkles,
  },
  {
    title: 'Retira en campus',
    description: 'Elige el campus disponible y retira tu producto fácilmente.',
    icon: MapPin,
  },
  {
    title: 'Sigue tu pedido',
    description: 'Revisa el avance de tus productos en producción.',
    icon: Truck,
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#06070A] text-white">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,179,0,0.20),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(255,179,0,0.08),transparent_30%)]" />

      {/* NAVBAR */}
      <header className="relative z-10 border-b border-white/5 bg-black/30 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFB300] text-lg font-black text-black shadow-lg shadow-[#FFB300]/20">
              A
            </div>

            <div>
              <h1 className="text-lg font-black tracking-tight">ARM Merch</h1>
              <p className="text-xs text-zinc-400">Productos oficiales ARM</p>
            </div>
          </div>

          <nav className="hidden items-center gap-7 text-sm text-zinc-300 md:flex">
            <a href="#productos" className="transition hover:text-white">
              Productos
            </a>
            <a href="#como-funciona" className="transition hover:text-white">
              Cómo funciona
            </a>
            <Link href="/track" className="transition hover:text-white">
              Seguir pedido
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/10 sm:text-sm"
            >
              Ingresar
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative z-10">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#FFB300]/30 bg-[#FFB300]/10 px-4 py-2 text-sm font-semibold text-[#FFCC4D]">
              <Sparkles size={15} />
              Merch oficial para la comunidad ARM
            </div>

            <h2 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              Productos con
              <span className="block text-[#FFB300]">identidad y propósito.</span>
            </h2>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
              Explora productos oficiales ARM, revisa el avance de tus pedidos
              y prepárate: muy pronto podrás comprar online y retirar en tu campus.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <a
                href="#productos"
                className="inline-flex items-center gap-2 rounded-2xl bg-[#FFB300] px-6 py-4 font-black text-black shadow-xl shadow-[#FFB300]/20 transition hover:scale-[1.03]"
              >
                Ver productos
                <ArrowRight size={18} />
              </a>

              <Link
                href="/track"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-bold text-white transition hover:bg-white/10"
              >
                Seguir mi pedido
              </Link>
            </div>

            <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <ShieldCheck className="mb-3 text-[#FFB300]" size={22} />
                <p className="text-sm font-bold">Compra segura</p>
                <p className="mt-1 text-xs text-zinc-500">Sistema protegido</p>
              </div>

              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <MapPin className="mb-3 text-[#FFB300]" size={22} />
                <p className="text-sm font-bold">Retiro en campus</p>
                <p className="mt-1 text-xs text-zinc-500">Según disponibilidad</p>
              </div>

              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <Clock3 className="mb-3 text-[#FFB300]" size={22} />
                <p className="text-sm font-bold">Seguimiento</p>
                <p className="mt-1 text-xs text-zinc-500">Pedidos a producción</p>
              </div>
            </div>
          </div>

          {/* Public showcase card */}
          <div className="relative">
            <div className="absolute -inset-6 rounded-[40px] bg-[#FFB300]/20 blur-3xl" />

            <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#11151D] p-5 shadow-2xl shadow-black/50">
              <div className="rounded-[28px] border border-white/5 bg-[#090B10] p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#FFB300]">
                      Próximamente
                    </p>
                    <h3 className="mt-2 text-2xl font-black">
                      Compra online ARM Merch
                    </h3>
                  </div>

                  <div className="rounded-2xl bg-[#FFB300] p-3 text-black">
                    <ShoppingBag size={26} />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['Poleras oficiales', 'Ropa ARM'],
                    ['Polerones', 'Ediciones especiales'],
                    ['Jockeys y accesorios', 'Identidad ARM'],
                    ['Botellas y café', 'Uso diario'],
                  ].map(([name, detail]) => (
                    <div
                      key={name}
                      className="rounded-2xl border border-white/5 bg-white/[0.04] p-4"
                    >
                      <div className="mb-4 flex h-24 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-800 text-4xl">
                        {name.includes('Polera')
                          ? '👕'
                          : name.includes('Polerones')
                            ? '🧥'
                            : name.includes('Jockeys')
                              ? '🧢'
                              : '☕'}
                      </div>

                      <p className="font-bold">{name}</p>
                      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-[#FFB300]/20 bg-[#FFB300]/10 p-4">
                  <p className="text-sm font-bold text-[#FFCC4D]">
                    Muy pronto podrás comprar desde aquí
                  </p>
                  <p className="mt-1 text-xs leading-5 text-zinc-400">
                    Mientras tanto, puedes seguir tus pedidos o ingresar al sistema
                    si eres parte del equipo autorizado.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section id="productos" className="relative z-10 border-t border-white/5 bg-[#F5F5F4] text-zinc-950">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:py-20">
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#D18F00]">
                Catálogo
              </p>
              <h3 className="mt-2 text-3xl font-black sm:text-4xl">
                Explora nuestros productos
              </h3>
              <p className="mt-3 max-w-2xl text-zinc-600">
                Una vitrina de productos oficiales ARM. El catálogo online estará
                disponible próximamente.
              </p>
            </div>

            <span className="inline-flex rounded-full bg-zinc-950 px-4 py-2 text-sm font-bold text-white">
              Próximamente online
            </span>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <div
                key={category.title}
                className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFB300]/15 text-[#B77A00]">
                  <category.icon size={26} />
                </div>

                <h4 className="text-xl font-black">{category.title}</h4>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {category.description}
                </p>

                <p className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-blue-600">
                  Ver pronto
                  <ArrowRight size={14} />
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="como-funciona" className="relative z-10 border-t border-white/5 bg-[#0B0D12]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:py-20">
          <div className="mb-10">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#FFB300]">
              Cómo funciona
            </p>
            <h3 className="mt-2 text-3xl font-black sm:text-4xl">
              Una experiencia simple para todos
            </h3>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-3xl border border-white/5 bg-white/[0.03] p-6"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFB300]/10 text-[#FFB300]">
                    <step.icon size={26} />
                  </div>

                  <span className="text-3xl font-black text-white/10">
                    0{index + 1}
                  </span>
                </div>

                <h4 className="text-xl font-black">{step.title}</h4>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 bg-[#FFB300] text-black">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 py-12 sm:px-6 md:flex-row md:items-center">
          <div>
            <h3 className="text-3xl font-black">
              ¿Ya tienes un pedido?
            </h3>
            <p className="mt-2 max-w-xl text-black/70">
              Revisa el avance de tu producto con tu código de seguimiento.
            </p>
          </div>

          <Link
            href="/track"
            className="inline-flex items-center gap-2 rounded-2xl bg-black px-6 py-4 font-black text-white transition hover:scale-[1.03]"
          >
            Seguir pedido
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/5 bg-[#06070A]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-5 py-8 text-sm text-zinc-500 sm:px-6 md:flex-row">
          <div className="flex items-center gap-2">
            <LockKeyhole size={16} />
            ARM Merch · Plataforma oficial
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login" className="transition hover:text-white">
              Ingreso sistema
            </Link>
            <span>© {new Date().getFullYear()} ARM Global</span>
          </div>
        </div>
      </footer>
    </main>
  )
}
