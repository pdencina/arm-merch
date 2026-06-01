'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ShoppingCart, Package, BarChart3,
  Users, ClipboardList, ArrowLeftRight, Receipt,
  ArrowRightLeft, User, Calculator, MapPin, Tags,
  X, Truck, Layers, PanelLeftClose, PanelLeftOpen,
  BrainCircuit, Sparkles, LineChart, Telescope, ChevronDown, DollarSign, TrendingUp,
  ShieldCheck,
} from 'lucide-react'
import { clsx } from 'clsx'

type Role = 'super_admin' | 'adm_merch' | 'admin' | 'voluntario'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  roles: Role[]
  section: string
  permKey?: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', permKey: 'dashboard.view', icon: <LayoutDashboard size={16} />, roles: ['voluntario', 'admin', 'adm_merch', 'super_admin'], section: 'General' },
  { label: 'Punto de Venta', href: '/pos', permKey: 'pos.view', icon: <ShoppingCart size={16} />, roles: ['voluntario', 'admin', 'adm_merch', 'super_admin'], section: 'Ventas' },
  { label: 'Órdenes', href: '/orders', permKey: 'orders.view', icon: <Receipt size={16} />, roles: ['voluntario', 'admin', 'adm_merch', 'super_admin'], section: 'Ventas' },
  { label: 'Pedidos entrega', href: '/production', permKey: 'deliveries.view', icon: <Truck size={16} />, roles: ['voluntario', 'admin', 'adm_merch', 'super_admin'], section: 'Ventas' },
  { label: 'Inventario', href: '/inventory', permKey: 'inventory.view', icon: <Package size={16} />, roles: ['admin', 'adm_merch', 'super_admin'], section: 'Inventario' },
  { label: 'Movimientos', href: '/inventory/movements', permKey: 'movements.view', icon: <ArrowLeftRight size={16} />, roles: ['admin', 'adm_merch', 'super_admin'], section: 'Inventario' },
  { label: 'Transferencias', href: '/transfers', icon: <ArrowRightLeft size={16} />, roles: ['adm_merch', 'super_admin'], section: 'Inventario' },
  { label: 'Productos', href: '/products', permKey: 'products.view', icon: <ClipboardList size={16} />, roles: ['admin', 'adm_merch', 'super_admin'], section: 'Gestión' },
  { label: 'Reportes', href: '/reports', permKey: 'reports.view', icon: <BarChart3 size={16} />, roles: ['admin', 'adm_merch', 'super_admin'], section: 'Gestión' },

  { label: 'Executive Center', href: '/intelligence', permKey: 'executive.view', icon: <BrainCircuit size={16} />, roles: ['adm_merch', 'super_admin'], section: 'Inteligencia' },
  { label: 'Analytics', href: '/intelligence/analytics', permKey: 'analytics.view', icon: <LineChart size={16} />, roles: ['adm_merch', 'admin', 'super_admin'], section: 'Inteligencia' },
  { label: 'IA Insights', href: '/intelligence/ai-insights', permKey: 'ai_insights.view', icon: <Sparkles size={16} />, roles: ['adm_merch', 'super_admin'], section: 'Inteligencia' },
  { label: 'Forecast', href: '/intelligence/forecast', permKey: 'forecast.view', icon: <Telescope size={16} />, roles: ['adm_merch', 'super_admin'], section: 'Inteligencia' },
  { label: 'Pricing Center', href: '/pricing', permKey: 'pricing.view', icon: <DollarSign size={16} />, roles: ['adm_merch', 'super_admin'], section: 'Gestión' },
  { label: 'Historial precios', href: '/pricing/history', permKey: 'pricing.history', icon: <Receipt size={16} />, roles: ['adm_merch', 'super_admin'], section: 'Gestión' },
  { label: 'Márgenes', href: '/pricing/margins', permKey: 'pricing.margins', icon: <TrendingUp size={16} />, roles: ['adm_merch', 'super_admin'], section: 'Gestión' },
  { label: 'Cierre de caja', href: '/close-day', permKey: 'close_day.view', icon: <Calculator size={16} />, roles: ['admin', 'adm_merch', 'super_admin'], section: 'Gestión' },
  { label: 'Usuarios', href: '/settings/users', icon: <Users size={16} />, roles: ['super_admin'], section: 'Configuración' },
  { label: 'Campus', href: '/settings/campus', icon: <MapPin size={16} />, roles: ['super_admin'], section: 'Configuración' },
  { label: 'Categorías', href: '/settings/categories', permKey: 'categories.view', icon: <Tags size={16} />, roles: ['adm_merch', 'super_admin'], section: 'Configuración' },
  { label: 'Módulos', href: '/settings/modules', icon: <Layers size={16} />, roles: ['super_admin'], section: 'Configuración' },
  { label: 'Auditoría', href: '/settings/audit', icon: <ShieldCheck size={16} />, roles: ['super_admin'], section: 'Configuración' },
  { label: 'Mi perfil', href: '/profile', icon: <User size={16} />, roles: ['voluntario', 'admin', 'adm_merch', 'super_admin'], section: 'Mi cuenta' },
]

const SECTION_ORDER = ['General', 'Ventas', 'Inventario', 'Gestión', 'Inteligencia', 'Configuración', 'Mi cuenta']

const SECTION_META: Record<string, { label: string; icon: React.ReactNode }> = {
  General: { label: 'General', icon: <LayoutDashboard size={14} /> },
  Ventas: { label: 'Ventas', icon: <ShoppingCart size={14} /> },
  Inventario: { label: 'Inventario', icon: <Package size={14} /> },
  Gestión: { label: 'Gestión', icon: <ClipboardList size={14} /> },
  Inteligencia: { label: 'Inteligencia', icon: <BrainCircuit size={14} /> },
  Configuración: { label: 'Configuración', icon: <Layers size={14} /> },
  'Mi cuenta': { label: 'Mi cuenta', icon: <User size={14} /> },
}

const ROLE_CONFIG: Record<Role, { label: string; color: string; description: string }> = {
  super_admin: { label: 'Super Admin', description: 'Acceso global · Todos los campus', color: 'bg-[#1B2028] text-[#B7C6F9] border-[#273041]' },
  adm_merch: { label: 'ADM Merch', description: 'Gestión operacional · Multi campus', color: 'bg-[#1B2028] text-[#CDB4FF] border-[#31224D]' },
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
    // SUPER ADMIN VE TODO
    if (role === 'super_admin') return true

    // SI TIENE PERMISO EXPLÍCITO → MOSTRAR
    if (item.permKey && permissions[item.permKey] === true) {
      return true
    }

    // FALLBACK POR ROL
    if (!item.roles.includes(role)) return false

    // ITEMS SIN PERMISO
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

          const meta = SECTION_META[section] ?? { label: section, icon: null }
          const sectionIsActive = items.some((item) =>
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
          )

          if (isCollapsed) {
            return (
              <div key={section} className="mb-2">
                <div
                  title={meta.label}
                  className={clsx(
                    'mx-auto my-2 flex h-8 w-8 items-center justify-center rounded-xl border text-[#66707F]',
                    sectionIsActive
                      ? 'border-[#273041] bg-[#1A2230] text-[#B7C6F9]'
                      : 'border-[#222831] bg-[#10151C]'
                  )}
                >
                  {meta.icon}
                </div>

                {items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      title={item.label}
                      className={clsx(
                        'group relative mx-auto flex h-11 w-11 items-center justify-center rounded-xl text-sm transition-all',
                        active
                          ? 'bg-[#1A2230] font-semibold text-[#B7C6F9]'
                          : 'text-[#96A0AE] hover:bg-[#161C24] hover:text-[#F3F5F7]'
                      )}
                    >
                      {item.icon}

                      <span className="pointer-events-none fixed left-[82px] z-[999] hidden whitespace-nowrap rounded-lg border border-[#222831] bg-[#151A22] px-2.5 py-1.5 text-xs font-semibold text-[#F3F5F7] shadow-xl group-hover:block">
                        {item.label}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )
          }

          return (
            <details key={section} open className="group mb-2">
              <summary
                className={clsx(
                  'mb-1 mt-2 flex cursor-pointer list-none items-center justify-between rounded-xl px-2 py-2 text-left transition marker:hidden [&::-webkit-details-marker]:hidden',
                  sectionIsActive
                    ? 'bg-[#111923] text-[#B7C6F9]'
                    : 'text-[#66707F] hover:bg-[#111923] hover:text-[#D8DEE9]'
                )}
              >
                <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                  {meta.icon}
                  {meta.label}
                </span>

                <ChevronDown
                  size={14}
                  className="transition-transform duration-200 group-open:rotate-180"
                />
              </summary>

              <div className="flex flex-col gap-1 pb-1">
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
                        'group/item relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all',
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
            </details>
          )
        })}
      </nav>
    </aside>
  )
}
