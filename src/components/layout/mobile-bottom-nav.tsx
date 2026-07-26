'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ShoppingCart,
  Receipt,
  Package,
  LayoutDashboard,
  Menu,
} from 'lucide-react'

interface MobileBottomNavProps {
  onOpenSidebar: () => void
}

const NAV_ITEMS = [
  { href: '/pos', label: 'POS', icon: ShoppingCart },
  { href: '/orders', label: 'Órdenes', icon: Receipt },
  { href: '/inventory', label: 'Inventario', icon: Package },
  { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
]

export default function MobileBottomNav({ onOpenSidebar }: MobileBottomNavProps) {
  const pathname = usePathname()

  // Hide on POS page — it has its own floating cart button
  if (pathname === '/pos') return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[80] border-t border-zinc-800/80 bg-[#0f1216]/95 backdrop-blur-xl pb-safe lg:hidden">
      <div className="grid h-16 grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive
                  ? 'text-amber-400'
                  : 'text-zinc-500 active:text-zinc-300'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
              <span className={`text-[10px] font-semibold ${isActive ? 'text-amber-400' : 'text-zinc-500'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}

        {/* More / Menu button */}
        <button
          onClick={onOpenSidebar}
          className="flex flex-col items-center justify-center gap-0.5 text-zinc-500 transition-colors active:text-zinc-300"
        >
          <Menu size={20} strokeWidth={1.8} />
          <span className="text-[10px] font-semibold text-zinc-500">Más</span>
        </button>
      </div>
    </nav>
  )
}
