'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ShoppingCart, Package, BarChart3,
  Users, ClipboardList, ArrowLeftRight, Receipt,
  ArrowRightLeft, User, Calculator, MapPin, Tags,
  X, Truck, Layers, PanelLeftClose, PanelLeftOpen,
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
  { label: 'Dashboard', href: '/dashboard', permKey: 'dashboard.view', icon: <LayoutDashboard size={16} />, roles: ['voluntario', 'admin', 'super_admin'], section: 'General' },
  { label: 'Punto de Venta', href: '/pos', permKey: 'pos.view', icon: <ShoppingCart size={16} />, roles: ['voluntario', 'admin', 'super_admin'], section: 'Ventas' },
  { label: 'Órdenes', href: '/orders', permKey: 'orders.view', icon: <Receipt size={16} />, roles: ['voluntario', 'admin', 'super_admin'], section: 'Ventas' },
  { label: 'Pedidos entrega', href: '/production', permKey: 'deliveries.view', icon: <Truck size={16} />, roles: ['voluntario', 'admin', 'super_admin'], section: 'Ventas' },
  { label: 'Inventario', href: '/inventory', permKey: 'inventory.view', icon: <Package size={16} />, roles: ['admin', 'super_admin'], section: 'Inventario' },
  { label: 'Movimientos', href: '/inventory/movements', permKey: 'movements.view', icon: <ArrowLeftRight size={16} />, roles: ['admin', 'super_admin'], section: 'Inventario' },
  { label: 'Transferencias', href: '/transfers', icon: <ArrowRightLeft size={16} />, roles: ['super_admin'], section: 'Inventario' },
  { label: 'Productos', href: '/products', permKey: 'products.view', icon: <ClipboardList size={16} />, roles: ['admin', 'super_admin'], section: 'Gestión' },
  { label: 'Reportes', href: '/reports', permKey: 'reports.view', icon: <BarChart3 size={16} />, roles: ['admin', 'super_admin'], section: 'Gestión' },
  { label: 'Cierre de caja', href: '/close-day', permKey: 'close_day.view', icon: <Calculator size={16} />, roles: ['admin', 'super_admin'], section: 'Gestión' },
  { label: 'Usuarios', href: '/settings/users', icon: <Users size={16} />, roles: ['super_admin'], section: 'Configuración' },
  { label: 'Campus', href: '/settings/campus', icon: <MapPin size={16} />, roles: ['super_admin'], section: 'Configuración' },
  { label: 'Categorías', href: '/settings/categories', permKey: 'categories.view', icon: <Tags size={16} />, roles: ['super_admin'], section: 'Configuración' },
  { label: 'Módulos', href: '/settings/modules', icon: <Layers size={16} />, roles: ['super_admin'], section: 'Configuración' },
  { label: 'Mi perfil', href: '/profile', icon: <User size={16} />, roles: ['voluntario', 'admin', 'super_admin'], section: 'Mi cuenta' },
]

const SECTION_ORDER = ['General', 'Ventas', 'Inventario', 'Gestión', 'Configuración', 'Mi cuenta']

const ROLE_CONFIG: Record<Role, { label: string; color: string; description: string }> = {
  super_admin: { label: 'Super Admin', description: 'Acceso global · Todos los campus', color: 'bg-[#1B2028] text-[#B7C6F9] border-[#273041]' },
  admin: { label: 'Admin Campus', description: 'Pastor · Gestión de sede', color: 'bg-[#1B2028] text-[#B7C6F9] border-[#273041]' },
  voluntario: { label: 'Voluntario', description: 'Ventas y punto de venta', color: 'bg-[#1B2028] text-[#B7C6F9] border-[#273041]' },
}

export default function Sidebar({
  role,
  campusName,
  permissions = {},
  mobileOpen,
  onClose,
  collapsed = false,
  onToggleCollapsed,
}: {
  role: Role
  campusName?: string
  permissions?: Record<string, boolean>
  mobileOpen?: boolean
  onClose?: () => void
  collapsed?: boolean
  onToggleCollapsed?: () => void
}) {
  const pathname = usePathname()
  const isMobile = Boolean(mobileOpen)
  const isCollapsed = collapsed && !isMobile

  const visible = NAV_ITEMS.filter((item) => {
    if (!item.roles.includes(role)) return false
    if (role === 'super_admin') return true
    if (!item.permKey) return true
    return permissions[item.permKey] !== false
  })

  const config = ROLE_CONFIG[role] ?? ROLE_CONFIG.voluntario

  return (
    <aside
      className={clsx(
        'relative flex h-full shrink-0 flex-col overflow-y-auto border-r border-[#222831] bg-[#0F1216] px-3 py-5 transition-all duration-300',
        isCollapsed ? 'w-[78px]' : 'w-[280px] lg:w-56'
      )}
    >
      <div className={clsx('mb-5 flex items-center gap-3 px-2', isCollapsed ? 'justify-center' : 'justify-between')}>
        <div className={clsx('flex items-center gap-2.5', isCollapsed && 'justify-center')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E8EEF8]">
            <span className="text-xs font-black text-[#111318]">A</span>
          </div>

          {!isCollapsed && (
            <div>
              <p className="text-sm font-bold leading-none text-[#F3F5F7]">ARM Merch</p>
              <p className="mt-0.5 text-[10px] text-[#66707F]">Sistema de Merch</p>
            </div>
          )}
        </div>

        {!isCollapsed && (
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#161A20] text-[#8D97A5] transition hover:bg-[#1D232B] hover:text-white lg:hidden"
          >
            <X size={16} />
          </button>
        )}

        {!isMobile && (
          <button
            onClick={onToggleCollapsed}
            title={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
            className={clsx(
              'hidden h-9 w-9 items-center justify-center rounded-xl bg-[#161A20] text-[#8D97A5] transition hover:bg-[#1D232B] hover:text-white lg:flex',
              isCollapsed && 'absolute left-[58px] top-5 z-20 border border-[#222831] shadow-xl'
            )}
          >
            {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        )}
      </div>

      {!isCollapsed ? (
        <div className={`mx-2 mb-4 rounded-2xl border px-3 py-3 ${config.color}`}>
          <p className="text-[10px] font-bold uppercase tracking-widest">{config.label}</p>
          <p className="mt-1 text-[10px] opacity-70">
            {role === 'admin' && campusName ? campusName : config.description}
          </p>
        </div>
      ) : (
        <div
          title={config.label}
          className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-2xl border border-[#273041] bg-[#1B2028] text-[10px] font-black text-[#B7C6F9]"
        >
          {config.label.slice(0, 2).toUpperCase()}
        </div>
      )}

      <nav className="flex flex-1 flex-col gap-1">
        {SECTION_ORDER.map((section) => {
          const items = visible.filter((item) => item.section === section)
          if (items.length === 0) return null

          return (
            <div key={section} className="mb-2">
              {!isCollapsed ? (
                <p className="mb-1 mt-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-[#66707F]">
                  {section}
                </p>
              ) : (
                <div className="mx-auto my-2 h-px w-8 bg-[#222831]" />
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
                    title={isCollapsed ? item.label : undefined}
                    className={clsx(
                      'group relative flex items-center rounded-xl text-sm transition-all',
                      isCollapsed ? 'mx-auto h-11 w-11 justify-center px-0' : 'gap-3 px-3 py-2.5',
                      active
                        ? 'bg-[#1A2230] font-semibold text-[#B7C6F9]'
                        : 'text-[#96A0AE] hover:bg-[#161C24] hover:text-[#F3F5F7]'
                    )}
                  >
                    {item.icon}
                    {!isCollapsed && item.label}

                    {isCollapsed && (
                      <span className="pointer-events-none fixed left-[82px] z-[999] hidden whitespace-nowrap rounded-lg border border-[#222831] bg-[#151A22] px-2.5 py-1.5 text-xs font-semibold text-[#F3F5F7] shadow-xl group-hover:block">
                        {item.label}
                      </span>
                    )}
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
