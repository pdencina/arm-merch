'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, ShoppingCart, Package, BarChart3, Users,
  ClipboardList, ArrowLeftRight, Receipt, ArrowRightLeft,
  User, Calculator, MapPin, Tags, X, Layers, Truck,
} from 'lucide-react'
import { clsx } from 'clsx'

type Role = 'super_admin' | 'admin' | 'voluntario'

interface NavItem {
  label:     string
  href:      string
  icon:      React.ReactNode
  roles:     Role[]
  moduleKey: string | null  // null = siempre visible (dashboard, perfil)
  section?:  string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',      href: '/dashboard',            icon: <LayoutDashboard size={16} />, roles: ['voluntario', 'admin', 'super_admin'], moduleKey: null },

  { label: 'Punto de Venta', href: '/pos',                  icon: <ShoppingCart size={16} />,   roles: ['voluntario', 'admin', 'super_admin'], moduleKey: 'pos',        section: 'Ventas' },
  { label: 'Órdenes',        href: '/orders',               icon: <Receipt size={16} />,        roles: ['voluntario', 'admin', 'super_admin'], moduleKey: 'orders' },

  { label: 'Inventario',     href: '/inventory',            icon: <Package size={16} />,        roles: ['admin', 'super_admin'],               moduleKey: 'inventory',  section: 'Inventario' },
  { label: 'Movimientos',    href: '/inventory/movements',  icon: <ArrowLeftRight size={16} />, roles: ['admin', 'super_admin'],               moduleKey: 'movements' },
  { label: 'Pedidos entrega', href: '/deliveries',     icon: <Truck size={16} />,         roles: ['admin', 'voluntario', 'super_admin'], moduleKey: null, section: 'Ventas' },
  { label: 'Transferencias', href: '/transfers',            icon: <ArrowRightLeft size={16} />, roles: ['super_admin'],                        moduleKey: null },

  { label: 'Productos',      href: '/products',             icon: <ClipboardList size={16} />,  roles: ['admin', 'super_admin'],               moduleKey: 'products',   section: 'Gestión' },
  { label: 'Reportes',       href: '/reports',              icon: <BarChart3 size={16} />,      roles: ['admin', 'super_admin'],               moduleKey: 'reports' },
  { label: 'Cierre de caja', href: '/close-day',            icon: <Calculator size={16} />,     roles: ['admin', 'super_admin'],               moduleKey: 'close_day' },

  { label: 'Usuarios',       href: '/settings/users',       icon: <Users size={16} />,          roles: ['super_admin'],                        moduleKey: null,         section: 'Configuración' },
  { label: 'Campus',         href: '/settings/campus',      icon: <MapPin size={16} />,         roles: ['super_admin'],                        moduleKey: null },
  { label: 'Categorías',     href: '/settings/categories',  icon: <Tags size={16} />,           roles: ['super_admin'],                        moduleKey: 'categories' },
  { label: 'Módulos',        href: '/settings/modules',     icon: <Layers size={16} />,         roles: ['super_admin'],                        moduleKey: null },

  { label: 'Mi perfil',      href: '/profile',              icon: <User size={16} />,           roles: ['voluntario', 'admin', 'super_admin'], moduleKey: null,         section: 'Mi cuenta' },
]

const ROLE_CONFIG: Record<Role, { label: string; color: string; description: string }> = {
  super_admin: { label: 'Super Admin',  description: 'Acceso global · Todos los campus', color: 'bg-[#1B2028] text-[#B7C6F9] border-[#273041]' },
  admin:       { label: 'Admin Campus', description: 'Pastor · Gestión de sede',         color: 'bg-[#1B2028] text-[#B7C6F9] border-[#273041]' },
  voluntario:  { label: 'Voluntario',   description: 'Ventas y punto de venta',           color: 'bg-[#1B2028] text-[#B7C6F9] border-[#273041]' },
}

export default function Sidebar({
  role, campusName, mobileOpen, onClose,
}: {
  role: Role; campusName?: string; mobileOpen?: boolean; onClose?: () => void
}) {
  const pathname = usePathname()
  const [enabledModules, setEnabledModules] = useState<Set<string> | null>(null)

  // Cargar permisos desde Supabase (solo para admin y voluntario — super_admin ve todo)
  useEffect(() => {
    if (role === 'super_admin') {
      setEnabledModules(new Set(['*'])) // wildcard = todo habilitado
      return
    }

    const supabase = createClient()
    supabase
      .from('module_permissions')
      .select('module, enabled')
      .eq('role', role)
      .then(({ data }) => {
        const enabled = new Set<string>()
        ;(data ?? []).forEach((row: any) => {
          if (row.enabled) enabled.add(row.module)
        })
        setEnabledModules(enabled)
      })
  }, [role])

  // Filtrar items por rol y por permisos dinámicos
  const visible = NAV_ITEMS.filter(item => {
    // Filtro de rol base
    if (!item.roles.includes(role)) return false

    // Super admin ve todo
    if (role === 'super_admin') return true

    // Módulos sin key de permiso (dashboard, perfil, etc.) siempre visibles
    if (item.moduleKey === null) return true

    // Si los permisos aún no cargan, mostrar mientras tanto (evitar parpadeo)
    if (enabledModules === null) return true

    return enabledModules.has(item.moduleKey)
  })

  const sections = Array.from(new Set(visible.map(i => i.section ?? '')))
  const config   = ROLE_CONFIG[role] ?? ROLE_CONFIG.voluntario

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
        {/* Skeleton mientras cargan los permisos */}
        {enabledModules === null && role !== 'super_admin' && (
          <div className="space-y-1 px-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-9 animate-pulse rounded-xl bg-zinc-800/50" />
            ))}
          </div>
        )}

        {enabledModules !== null && sections.map(section => {
          const items = visible.filter(i => (i.section ?? '') === section)
          if (!items.length) return null

          return (
            <div key={section} className="mb-2">
              {section && (
                <p className="mb-2 mt-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-[#66707F]">
                  {section}
                </p>
              )}

              {items.map(item => {
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
