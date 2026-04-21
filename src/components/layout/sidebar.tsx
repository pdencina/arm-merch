'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BarChart3,
  Users,
  ClipboardList,
  ArrowLeftRight,
  Receipt,
  ArrowRightLeft,
  User,
  Calculator,
  MapPin,
  Tags,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'

type Role = 'super_admin' | 'admin' | 'voluntario'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  roles: Role[]
  section?: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={16} />, roles: ['voluntario', 'admin', 'super_admin'] },

  { label: 'Punto de Venta', href: '/pos', icon: <ShoppingCart size={16} />, roles: ['voluntario', 'admin', 'super_admin'], section: 'Ventas' },
  { label: 'Órdenes', href: '/orders', icon: <Receipt size={16} />, roles: ['voluntario', 'admin', 'super_admin'] },

  { label: 'Inventario', href: '/inventory', icon: <Package size={16} />, roles: ['admin', 'super_admin'], section: 'Inventario' },
  { label: 'Movimientos', href: '/inventory/movements', icon: <ArrowLeftRight size={16} />, roles: ['admin', 'super_admin'] },
  { label: 'Transferencias', href: '/transfers', icon: <ArrowRightLeft size={16} />, roles: ['super_admin'] },

  { label: 'Productos', href: '/products', icon: <ClipboardList size={16} />, roles: ['admin', 'super_admin'], section: 'Gestión' },
  { label: 'Reportes', href: '/reports', icon: <BarChart3 size={16} />, roles: ['admin', 'super_admin'] },
  { label: 'Cierre de caja', href: '/close-day', icon: <Calculator size={16} />, roles: ['admin', 'super_admin'] },

  { label: 'Usuarios', href: '/settings/users', icon: <Users size={16} />, roles: ['super_admin'], section: 'Configuración' },
  { label: 'Campus', href: '/settings/campus', icon: <MapPin size={16} />, roles: ['super_admin'] },
  { label: 'Categorías', href: '/settings/categories', icon: <Tags size={16} />, roles: ['super_admin'] },

  { label: 'Mi perfil', href: '/profile', icon: <User size={16} />, roles: ['voluntario', 'admin', 'super_admin'], section: 'Mi cuenta' },
]

const ROLE_CONFIG: Record<
  Role,
  { label: string; color: string; description: string }
> = {
  super_admin: {
    label: 'Super Admin',
    description: 'Acceso global · Todos los campus',
    color: 'bg-slate-400/10 text-slate-300 border-slate-400/20',
  },
  admin: {
    label: 'Admin Campus',
    description: 'Pastor · Gestión de sede',
    color: 'bg-slate-400/10 text-slate-300 border-slate-400/20',
  },
  voluntario: {
    label: 'Voluntario',
    description: 'Ventas y punto de venta',
    color: 'bg-slate-400/10 text-slate-300 border-slate-400/20',
  },
}

export default function Sidebar({
  role,
  campusName,
  mobileOpen,
  onClose,
}: {
  role: Role
  campusName?: string
  mobileOpen?: boolean
  onClose?: () => void
}) {
  const pathname = usePathname()
  const visible = NAV_ITEMS.filter((i) => i.roles.includes(role))
  const sections = Array.from(new Set(visible.map((i) => i.section ?? '')))
  const config = ROLE_CONFIG[role] ?? ROLE_CONFIG.voluntario

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col overflow-y-auto border-r border-zinc-800/60 bg-zinc-950 px-3 py-5 lg:w-56">
      <div className="mb-5 flex items-center justify-between gap-3 px-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200">
            <span className="text-xs font-black text-black">A</span>
          </div>
          <div>
            <p className="text-sm font-bold leading-none text-white">ARM Merch</p>
            <p className="mt-0.5 text-[10px] text-zinc-600">Sistema de Merch</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-zinc-400 transition hover:bg-zinc-800 hover:text-white lg:hidden"
        >
          <X size={16} />
        </button>
      </div>

      <div className={`mx-2 mb-4 rounded-2xl border px-3 py-3 ${config.color}`}>
        <p className="text-[10px] font-bold uppercase tracking-widest">{config.label}</p>
        <p className="mt-1 text-[10px] opacity-70">
          {role === 'admin' && campusName ? campusName : config.description}
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {sections.map((section) => {
          const items = visible.filter((i) => (i.section ?? '') === section)

          return (
            <div key={section} className="mb-2">
              {section && (
                <p className="mb-2 mt-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                  {section}
                </p>
              )}

              {items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={clsx(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all',
                      active
                        ? 'bg-slate-200/10 font-semibold text-slate-300'
                        : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-white'
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}