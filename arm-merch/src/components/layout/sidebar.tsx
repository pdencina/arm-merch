'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ShoppingCart, Package, BarChart3,
  Users, ClipboardList, ArrowLeftRight
} from 'lucide-react'
import { clsx } from 'clsx'

type Role = 'super_admin' | 'admin' | 'voluntario'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  roles: Role[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',      href: '/dashboard',           icon: <LayoutDashboard size={18} />, roles: ['voluntario','admin','super_admin'] },
  { label: 'Punto de Venta', href: '/pos',                 icon: <ShoppingCart size={18} />,    roles: ['voluntario','admin','super_admin'] },
  { label: 'Inventario',     href: '/inventory',           icon: <Package size={18} />,         roles: ['admin','super_admin'] },
  { label: 'Movimientos',    href: '/inventory/movements', icon: <ArrowLeftRight size={18} />,  roles: ['admin','super_admin'] },
  { label: 'Productos',      href: '/products',            icon: <ClipboardList size={18} />,   roles: ['admin','super_admin'] },
  { label: 'Reportes',       href: '/reports',             icon: <BarChart3 size={18} />,       roles: ['admin','super_admin'] },
  { label: 'Usuarios',       href: '/settings/users',      icon: <Users size={18} />,           roles: ['super_admin'] },
]

export default function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname()
  const visibleItems = NAV_ITEMS.filter(i => i.roles.includes(role))

  return (
    <aside className="w-56 flex flex-col bg-zinc-950 border-r border-zinc-800/60 py-6 px-3 shrink-0">
      <div className="flex items-center gap-3 px-3 mb-8">
        <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
          <span className="text-sm font-black text-zinc-950">A</span>
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-none">ARM Merch</p>
          <p className="text-[10px] text-zinc-500 mt-0.5 capitalize">{role.replace('_', ' ')}</p>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 flex-1">
        {visibleItems.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                active
                  ? 'bg-amber-500/10 text-amber-400 font-medium'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              )}>
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 pt-4 border-t border-zinc-800/60">
        <span className={clsx(
          'text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded',
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
