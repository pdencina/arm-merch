'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ShoppingCart, Package, BarChart3,
  Users, ClipboardList, ArrowLeftRight, Receipt,
  ArrowRightLeft, User, Calculator, MapPin, Tags,
  X, Truck, Layers,
} from 'lucide-react'
import { clsx } from 'clsx'

type Role = 'super_admin' | 'admin' | 'voluntario'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  roles: Role[]
  section: string
  permKey?: string
}

const NAV_ITEMS: NavItem[] = [
  // ── General ──────────────────────────────────────────────
  { label: 'Dashboard',        href: '/dashboard', permKey: 'dashboard.view',           icon: <LayoutDashboard size={16} />, roles: ['voluntario', 'admin', 'super_admin'], section: 'General' },

  // ── Ventas ───────────────────────────────────────────────
  { label: 'Punto de Venta',   href: '/pos', permKey: 'pos.view',                 icon: <ShoppingCart size={16} />,    roles: ['voluntario', 'admin', 'super_admin'], section: 'Ventas' },
  { label: 'Órdenes',          href: '/orders', permKey: 'orders.view',              icon: <Receipt size={16} />,          roles: ['voluntario', 'admin', 'super_admin'], section: 'Ventas' },
  { label: 'Pedidos entrega',  href: '/production', permKey: 'deliveries.view',          icon: <Truck size={16} />,            roles: ['voluntario', 'admin', 'super_admin'], section: 'Ventas' },

  // ── Inventario ───────────────────────────────────────────
  { label: 'Inventario',       href: '/inventory', permKey: 'inventory.view',           icon: <Package size={16} />,          roles: ['admin', 'super_admin'],              section: 'Inventario' },
  { label: 'Movimientos',      href: '/inventory/movements', permKey: 'movements.view', icon: <ArrowLeftRight size={16} />,   roles: ['admin', 'super_admin'],              section: 'Inventario' },
  { label: 'Transferencias',   href: '/transfers',           icon: <ArrowRightLeft size={16} />,   roles: ['super_admin'],                       section: 'Inventario' },

  // ── Gestión ──────────────────────────────────────────────
  { label: 'Productos',        href: '/products', permKey: 'products.view',            icon: <ClipboardList size={16} />,    roles: ['admin', 'super_admin'],              section: 'Gestión' },
  { label: 'Reportes',         href: '/reports', permKey: 'reports.view',             icon: <BarChart3 size={16} />,        roles: ['admin', 'super_admin'],              section: 'Gestión' },
  { label: 'Cierre de caja',   href: '/close-day', permKey: 'close_day.view',           icon: <Calculator size={16} />,       roles: ['admin', 'super_admin'],              section: 'Gestión' },

  // ── Configuración ────────────────────────────────────────
  { label: 'Usuarios',         href: '/settings/users',      icon: <Users size={16} />,            roles: ['super_admin'],                       section: 'Configuración' },
  { label: 'Campus',           href: '/settings/campus',     icon: <MapPin size={16} />,           roles: ['super_admin'],                       section: 'Configuración' },
  { label: 'Categorías',       href: '/settings/categories', permKey: 'categories.view', icon: <Tags size={16} />,             roles: ['super_admin'],                       section: 'Configuración' },
  { label: 'Módulos',          href: '/settings/modules',    icon: <Layers size={16} />,           roles: ['super_admin'],                       section: 'Configuración' },

  // ── Mi cuenta ────────────────────────────────────────────
  { label: 'Mi perfil',        href: '/profile',             icon: <User size={16} />,             roles: ['voluntario', 'admin', 'super_admin'], section: 'Mi cuenta' },
]

// Section order
const SECTION_ORDER = ['General', 'Ventas', 'Inventario', 'Gestión', 'Configuración', 'Mi cuenta']

const ROLE_CONFIG: Record<Role, { label: string; color: string; description: string }> = {
  super_admin: { label: 'Super Admin',   description: 'Acceso global · Todos los campus', color: 'bg-[#1B2028] text-[#B7C6F9] border-[#273041]' },
  admin:       { label: 'Admin Campus',  description: 'Pastor · Gestión de sede',         color: 'bg-[#1B2028] text-[#B7C6F9] border-[#273041]' },
  voluntario:  { label: 'Voluntario',    description: 'Ventas y punto de venta',          color: 'bg-[#1B2028] text-[#B7C6F9] border-[#273041]' },
}

export default function Sidebar({
  role,
  campusName,
  permissions = {},
  mobileOpen,
  onClose,
}: {
  role: Role
  campusName?: string
  permissions?: Record<string, boolean>
  mobileOpen?: boolean
  onClose?: () => void
}) {
  const pathname = usePathname()

  const visible = NAV_ITEMS.filter(i => {
    if (!i.roles.includes(role)) return false
    if (role === 'super_admin') return true
    if (!i.permKey) return true
    return permissions[i.permKey] !== false
  })
  const config  = ROLE_CONFIG[role] ?? ROLE_CONFIG.voluntario

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col overflow-y-auto border-r border-[#222831] bg-[#0F1216] px-3 py-5 lg:w-56">
      <div className="mb-5 flex items-center justify-between gap-3 px-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E8EEF8]">
            <span className="text-xs font-black text-[#111318]">A</span>
          </div>
          <div>
            <p className="text-sm font-bold leading-none text-[#F3F5F7]">ARM Merch</p>
            <p className="mt-0.5 text-[10px] text-[#66707F]">Sistema de Merch</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#161A20] text-[#8D97A5] transition hover:bg-[#1D232B] hover:text-white lg:hidden"
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
        {SECTION_ORDER.map(section => {
          const items = visible.filter(i => i.section === section)
          if (items.length === 0) return null
          return (
            <div key={section} className="mb-2">
              <p className="mb-1 mt-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-[#66707F]">
                {section}
              </p>
              {items.map(item => {
                const active = pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={clsx(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all',
                      active
                        ? 'bg-[#1A2230] font-semibold text-[#B7C6F9]'
                        : 'text-[#96A0AE] hover:bg-[#161C24] hover:text-[#F3F5F7]'
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