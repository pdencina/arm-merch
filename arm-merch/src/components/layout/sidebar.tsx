'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ShoppingCart, Package, BarChart3,
  Users, ClipboardList, ArrowLeftRight, Receipt,
  ArrowRightLeft, User, Calculator, MapPin, TrendingUp
} from 'lucide-react'
import { clsx } from 'clsx'

type Role = 'super_admin' | 'admin' | 'voluntario'

interface NavItem {
  label: string; href: string; icon: React.ReactNode
  roles: Role[]; section?: string
}

// ─────────────────────────────────────────────────────────
//  SUPER ADMIN → ve todo, todos los campus
//  ADMIN       → gestiona su campus (pastor)
//  VOLUNTARIO  → solo ventas y su perfil
// ─────────────────────────────────────────────────────────
const NAV_ITEMS: NavItem[] = [
  // Dashboard — todos lo ven (super_admin ve global, admin ve su campus, voluntario ve sus ventas)
  { label: 'Dashboard',      href: '/dashboard',           icon: <LayoutDashboard size={16}/>, roles: ['voluntario','admin','super_admin'] },

  // Ventas — todos pueden vender
  { label: 'Punto de Venta', href: '/pos',                 icon: <ShoppingCart size={16}/>,    roles: ['voluntario','admin','super_admin'], section:'Ventas' },
  { label: 'Órdenes',        href: '/orders',              icon: <Receipt size={16}/>,         roles: ['voluntario','admin','super_admin'] },

  // Inventario — admin y super_admin
  { label: 'Inventario',     href: '/inventory',           icon: <Package size={16}/>,         roles: ['admin','super_admin'], section:'Inventario' },
  { label: 'Movimientos',    href: '/inventory/movements', icon: <ArrowLeftRight size={16}/>,  roles: ['admin','super_admin'] },
  { label: 'Transferencias', href: '/transfers',           icon: <ArrowRightLeft size={16}/>,  roles: ['admin','super_admin'] },

  // Gestión campus — admin y super_admin
  { label: 'Productos',      href: '/products',            icon: <ClipboardList size={16}/>,   roles: ['admin','super_admin'], section:'Gestión' },
  { label: 'Reportes',       href: '/reports',             icon: <BarChart3 size={16}/>,       roles: ['admin','super_admin'] },
  { label: 'Cierre de caja', href: '/close-day',           icon: <Calculator size={16}/>,      roles: ['admin','super_admin'] },

  // Configuración — solo super_admin
  { label: 'Usuarios',       href: '/settings/users',      icon: <Users size={16}/>,           roles: ['super_admin'], section:'Configuración' },
  { label: 'Campus',         href: '/settings/campus',     icon: <MapPin size={16}/>,          roles: ['super_admin'] },

  // Mi cuenta — todos
  { label: 'Mi perfil',      href: '/profile',             icon: <User size={16}/>,            roles: ['voluntario','admin','super_admin'], section:'Mi cuenta' },
]

const ROLE_CONFIG: Record<Role, { label: string; color: string; badge: string; description: string }> = {
  super_admin: {
    label:       'Super Admin',
    description: 'Acceso global · Todos los campus',
    color:       'bg-purple-500/10 text-purple-400 border-purple-500/20',
    badge:       'bg-purple-500/10 text-purple-400',
  },
  admin: {
    label:       'Admin Campus',
    description: 'Pastor · Gestión de sede',
    color:       'bg-blue-500/10 text-blue-400 border-blue-500/20',
    badge:       'bg-blue-500/10 text-blue-400',
  },
  voluntario: {
    label:       'Voluntario',
    description: 'Ventas y punto de venta',
    color:       'bg-green-500/10 text-green-400 border-green-500/20',
    badge:       'bg-green-500/10 text-green-400',
  },
}

export default function Sidebar({ role, campusName }: { role: Role; campusName?: string }) {
  const pathname = usePathname()
  const visible  = NAV_ITEMS.filter(i => i.roles.includes(role))
  const sections = Array.from(new Set(visible.map(i => i.section ?? '')))
  const config   = ROLE_CONFIG[role] ?? ROLE_CONFIG.voluntario

  return (
    <aside className="w-52 flex flex-col bg-zinc-950 border-r border-zinc-800/60 py-5 px-2.5 shrink-0 overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2.5 mb-5">
        <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
          <span className="text-xs font-black text-zinc-950">A</span>
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-none">ARM Merch</p>
          <p className="text-[9px] text-zinc-600 mt-0.5">Sistema de Merch</p>
        </div>
      </div>

      {/* Badge de rol */}
      <div className={`mx-2.5 mb-4 rounded-xl px-3 py-2.5 border ${config.color}`}>
        <p className="text-[10px] font-bold uppercase tracking-widest">{config.label}</p>
        <p className="text-[9px] opacity-70 mt-0.5">
          {role === 'admin' && campusName ? campusName : config.description}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1">
        {sections.map(section => {
          const items = visible.filter(i => (i.section ?? '') === section)
          return (
            <div key={section} className="mb-1">
              {section && (
                <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-semibold px-2.5 mb-1 mt-2">
                  {section}
                </p>
              )}
              {items.map(item => {
                const active = pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
                return (
                  <Link key={item.href} href={item.href}
                    className={clsx(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all',
                      active
                        ? 'bg-amber-500/10 text-amber-400 font-semibold'
                        : 'text-zinc-500 hover:text-white hover:bg-zinc-800/60'
                    )}>
                    {item.icon}{item.label}
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
