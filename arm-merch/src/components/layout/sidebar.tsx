'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ShoppingCart, Package, BarChart3,
  Users, ClipboardList, ArrowLeftRight, Receipt, ArrowRightLeft, User
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
  { label: 'Dashboard',      href: '/dashboard',           icon: <LayoutDashboard size={16} />, roles: ['voluntario','admin','super_admin'] },
  { label: 'Punto de Venta', href: '/pos',                 icon: <ShoppingCart size={16} />,    roles: ['voluntario','admin','super_admin'] },

  { label: 'Inventario',     href: '/inventory',           icon: <Package size={16} />,         roles: ['admin','super_admin'], section: 'Inventario' },
  { label: 'Movimientos',    href: '/inventory/movements', icon: <ArrowLeftRight size={16} />,  roles: ['admin','super_admin'] },
  { label: 'Transferencias', href: '/transfers',           icon: <ArrowRightLeft size={16} />,  roles: ['admin','super_admin'] },

  { label: 'Órdenes',        href: '/orders',              icon: <Receipt size={16} />,         roles: ['admin','super_admin'], section: 'Gestión' },
  { label: 'Productos',      href: '/products',            icon: <ClipboardList size={16} />,   roles: ['admin','super_admin'] },
  { label: 'Reportes',       href: '/reports',             icon: <BarChart3 size={16} />,       roles: ['admin','super_admin'] },

  { label: 'Usuarios',       href: '/settings/users',      icon: <Users size={16} />,           roles: ['super_admin'], section: 'Configuración' },
  { label: 'Mi perfil',      href: '/profile',             icon: <User size={16} />,            roles: ['voluntario','admin','super_admin'], section: 'Mi cuenta' },
]

export default function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname()
  const visible  = NAV_ITEMS.filter(i => i.roles.includes(role))
  const sections = [...new Set(visible.map(i => i.section ?? ''))]

  return (
    <aside className="w-52 flex flex-col bg-zinc-950 border-r border-zinc-800/60 py-5 px-2.5 shrink-0 overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2.5 mb-6">
        <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
          <span className="text-xs font-black text-zinc-950">A</span>
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-none">ARM Merch</p>
          <p className="text-[9px] text-zinc-500 mt-0.5 capitalize">{role.replace('_', ' ')}</p>
        </div>
      </div>

      {/* Nav por secciones */}
      <nav className="flex flex-col gap-0.5 flex-1">
        {sections.map(section => {
          const sectionItems = visible.filter(i => (i.section ?? '') === section)
          return (
            <div key={section} className="mb-2">
              {section && (
                <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-semibold px-2.5 mb-1 mt-2">{section}</p>
              )}
              {sectionItems.map(item => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
                return (
                  <Link key={item.href} href={item.href}
                    className={clsx(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all',
                      active
                        ? 'bg-amber-500/10 text-amber-400 font-semibold'
                        : 'text-zinc-500 hover:text-white hover:bg-zinc-800/60'
                    )}>
                    {item.icon}
                    {item.label}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Role badge */}
      <div className="px-2.5 pt-3 border-t border-zinc-800/60">
        <span className={clsx(
          'text-[9px] font-semibold uppercase tracking-widest px-2 py-1 rounded',
          role === 'super_admin' && 'bg-purple-500/10 text-purple-400',
          role === 'admin'       && 'bg-blue-500/10 text-blue-400',
          role === 'voluntario'  && 'bg-green-500/10 text-green-400',
        )}>
          {role.replace('_', ' ')}
        </span>
      </div>
    </aside>
  )
}
