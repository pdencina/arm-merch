'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { NotifyModal, useNotify } from '@/components/ui/notify-modal'
import {
  ShoppingCart, Receipt, Package, ArrowLeftRight,
  ClipboardList, BarChart3, Calculator, Tags,
  Truck, Users, Settings, Barcode, RefreshCw,
  ChevronDown, ChevronRight,
  BrainCircuit, Sparkles, LineChart, Telescope,
  DollarSign, TrendingUp,
} from 'lucide-react'

// ── Módulos y permisos granulares ──────────────────────────────────────────
const PERMISSION_GROUPS = [
  {
    section: '📊 General',
    modules: [
      {
        key: 'dashboard',
        label: 'Dashboard',
        icon: BarChart3,
        description: 'Vista general con métricas y estadísticas',
        permissions: [
          { key: 'dashboard.view', label: 'Ver el Dashboard' },
        ]
      },
    ]
  },
  {
    section: '🛒 Ventas',
    modules: [
      {
        key: 'pos',
        label: 'Punto de Venta (POS)',
        icon: ShoppingCart,
        description: 'Acceso al POS para registrar ventas',
        permissions: [
          { key: 'pos.view',            label: 'Ver el POS' },
          { key: 'pos.sell',            label: 'Registrar ventas' },
          { key: 'pos.all_payments',    label: 'Usar todos los métodos de pago' },
          { key: 'pos.discount',        label: 'Aplicar descuentos' },
          { key: 'pos.smart_pos',       label: 'Cobrar con Smart POS' },
          { key: 'pos.link_payment',    label: 'Enviar link de pago WhatsApp' },
          { key: 'pos.pending_orders',  label: 'Crear pedidos bajo demanda' },
        ]
      },
      {
        key: 'orders',
        label: 'Órdenes',
        icon: Receipt,
        description: 'Historial y gestión de órdenes',
        permissions: [
          { key: 'orders.view',         label: 'Ver órdenes' },
          { key: 'orders.export',       label: 'Exportar órdenes' },
          { key: 'orders.refund',       label: 'Anular/reembolsar órdenes' },
        ]
      },
      {
        key: 'deliveries',
        label: 'Pedidos de Entrega',
        icon: Truck,
        description: 'Gestión de pedidos bajo demanda',
        permissions: [
          { key: 'deliveries.view',     label: 'Ver pedidos de entrega' },
          { key: 'deliveries.ready',    label: 'Marcar como "Listo para entregar"' },
          { key: 'deliveries.deliver',  label: 'Marcar como "Entregado al cliente"' },
          { key: 'deliveries.whatsapp', label: 'Enviar notificación WhatsApp' },
        ]
      },
    ]
  },
  {
    section: '📦 Inventario',
    modules: [
      {
        key: 'inventory',
        label: 'Inventario',
        icon: Package,
        description: 'Ver y gestionar el stock',
        permissions: [
          { key: 'inventory.view',      label: 'Ver inventario' },
          { key: 'inventory.movements', label: 'Registrar movimientos de stock' },
          { key: 'inventory.scan',      label: 'Usar modo escaneo de inventario' },
          { key: 'inventory.adjust',    label: 'Ajustar stock manualmente' },
          { key: 'inventory.transfer',  label: 'Transferir entre campus' },
        ]
      },
      {
        key: 'movements',
        label: 'Historial de Movimientos',
        icon: ArrowLeftRight,
        description: 'Ver el historial de movimientos de inventario',
        permissions: [
          { key: 'movements.view',      label: 'Ver historial de movimientos' },
        ]
      },
    ]
  },
  {
    section: '⚙️ Gestión',
    modules: [
      {
        key: 'products',
        label: 'Productos',
        icon: ClipboardList,
        description: 'Gestión del catálogo de productos',
        permissions: [
          { key: 'products.view',       label: 'Ver productos' },
          { key: 'products.create',     label: 'Crear productos' },
          { key: 'products.edit',       label: 'Editar productos' },
          { key: 'products.delete',     label: 'Eliminar productos' },
          { key: 'products.labels',     label: 'Generar etiquetas con código de barra' },
          { key: 'products.prices',     label: 'Ver y editar precios' },
        ]
      },

      {
        key: 'pricing_center',
        label: 'Pricing Center',
        icon: DollarSign,
        description: 'Gestión avanzada de precios',
        permissions: [
          { key: 'pricing.view', label: 'Ver Pricing Center' },
          { key: 'pricing.edit', label: 'Editar precios' },
          { key: 'pricing.history', label: 'Ver historial de precios' },
          { key: 'pricing.margins', label: 'Ver márgenes' },
        ]
      },

      {
        key: 'reports',
        label: 'Reportes',
        icon: BarChart3,
        description: 'Acceso a reportes y analíticas',
        permissions: [
          { key: 'reports.view',        label: 'Ver reportes' },
          { key: 'reports.all_campus',  label: 'Ver reportes de todos los campus' },
          { key: 'reports.export',      label: 'Exportar reportes' },
        ]
      },
      {
        key: 'close_day',
        label: 'Cierre de Caja',
        icon: Calculator,
        description: 'Apertura y cierre de caja',
        permissions: [
          { key: 'close_day.view',      label: 'Ver cierre de caja' },
          { key: 'close_day.open',      label: 'Abrir caja' },
          { key: 'close_day.close',     label: 'Cerrar caja' },
          { key: 'close_day.all',       label: 'Ver cierres de todos los campus' },
        ]
      },
      {
        key: 'categories',
        label: 'Categorías',
        icon: Tags,
        description: 'Gestión de categorías de productos',
        permissions: [
          { key: 'categories.view',     label: 'Ver categorías' },
          { key: 'categories.manage',   label: 'Crear y editar categorías' },
        ]
      },
    ]
  },

  {
    section: '🧠 Inteligencia',
    modules: [
      {
        key: 'executive_center',
        label: 'Executive Center',
        icon: BrainCircuit,
        description: 'Panel ejecutivo principal',
        permissions: [
          { key: 'executive.view', label: 'Ver Executive Center' },
        ]
      },
      {
        key: 'analytics',
        label: 'Analytics',
        icon: LineChart,
        description: 'Análisis operacional',
        permissions: [
          { key: 'analytics.view', label: 'Ver Analytics' },
          { key: 'analytics.export', label: 'Exportar Analytics' },
        ]
      },
      {
        key: 'ai_insights',
        label: 'IA Insights',
        icon: Sparkles,
        description: 'Insights automáticos',
        permissions: [
          { key: 'ai_insights.view', label: 'Ver IA Insights' },
        ]
      },
      {
        key: 'forecast',
        label: 'Forecast',
        icon: Telescope,
        description: 'Proyecciones inteligentes',
        permissions: [
          { key: 'forecast.view', label: 'Ver Forecast' },
        ]
      },
    ]
  },

]

const ROLES = [
  { key: 'adm_merch',  label: 'ADM Merch',  color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
  { key: 'admin',      label: 'Admin',      color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
  { key: 'voluntario', label: 'Voluntario', color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20' },
]

// Default permissions per role
const DEFAULTS: Record<string, Record<string, boolean>> = {
  adm_merch: {
    'dashboard.view': true,

    'pos.view': true,
    'pos.sell': true,
    'pos.all_payments': true,
    'pos.discount': true,
    'pos.smart_pos': true,
    'pos.link_payment': true,
    'pos.pending_orders': true,

    'orders.view': true,
    'orders.export': true,
    'orders.refund': true,

    'deliveries.view': true,
    'deliveries.ready': true,
    'deliveries.deliver': true,
    'deliveries.whatsapp': true,

    'inventory.view': true,
    'inventory.movements': true,
    'inventory.scan': true,
    'inventory.adjust': true,
    'inventory.transfer': true,

    'movements.view': true,

    'products.view': true,
    'products.create': true,
    'products.edit': true,
    'products.delete': false,
    'products.labels': true,
    'products.prices': true,

    'reports.view': true,
    'reports.all_campus': true,
    'reports.export': true,

    'close_day.view': true,
    'close_day.open': true,
    'close_day.close': true,
    'close_day.all': true,

    'categories.view': true,
    'categories.manage': true,

    'pricing.view': true,
    'pricing.edit': true,
    'pricing.history': true,
    'pricing.margins': true,

    'executive.view': true,
    'analytics.view': true,
    'analytics.export': true,
    'ai_insights.view': true,
    'forecast.view': true,
  },

  admin: {
    'dashboard.view': true,
    'pos.view': true, 'pos.sell': true, 'pos.all_payments': true, 'pos.discount': false,
    'pos.smart_pos': true, 'pos.link_payment': true, 'pos.pending_orders': true,
    'orders.view': true, 'orders.export': true, 'orders.refund': false,
    'deliveries.view': true, 'deliveries.ready': false, 'deliveries.deliver': true, 'deliveries.whatsapp': true,
    'inventory.view': true, 'inventory.movements': true, 'inventory.scan': true, 'inventory.adjust': false, 'inventory.transfer': false,
    'movements.view': true,
    'products.view': true, 'products.create': false, 'products.edit': false, 'products.delete': false, 'products.labels': true, 'products.prices': true,
    'reports.view': true, 'reports.all_campus': false, 'reports.export': false,
    'close_day.view': true, 'close_day.open': true, 'close_day.close': true, 'close_day.all': false,
    'categories.view': true, 'categories.manage': false,
  },
  voluntario: {
    'dashboard.view': false,
    'pos.view': true, 'pos.sell': true, 'pos.all_payments': false, 'pos.discount': false,
    'pos.smart_pos': false, 'pos.link_payment': false, 'pos.pending_orders': false,
    'orders.view': true, 'orders.export': false, 'orders.refund': false,
    'deliveries.view': true, 'deliveries.ready': false, 'deliveries.deliver': true, 'deliveries.whatsapp': false,
    'inventory.view': true, 'inventory.movements': false, 'inventory.scan': false, 'inventory.adjust': false, 'inventory.transfer': false,
    'movements.view': false,
    'products.view': true, 'products.create': false, 'products.edit': false, 'products.delete': false, 'products.labels': false, 'products.prices': false,
    'reports.view': false, 'reports.all_campus': false, 'reports.export': false,
    'close_day.view': false, 'close_day.open': false, 'close_day.close': false, 'close_day.all': false,
    'categories.view': false, 'categories.manage': false,
  },
}

type PermMap = Record<string, Record<string, boolean>>

export default function ModulePermissionsPage() {
  const supabase = createClient()
  const { notify, success, error, close } = useNotify()
  const [perms, setPerms]     = useState<PermMap>(DEFAULTS)
  const [saving, setSaving]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, err } = await supabase
      .from('module_permissions')
      .select('module, role, enabled') as any

    if (data?.length) {
      const map: PermMap = { ...DEFAULTS }
      data.forEach((row: any) => {
        if (!map[row.role]) map[row.role] = {}
        map[row.role][row.module] = row.enabled
      })
      setPerms(map)
    }
    setLoading(false)
  }

  async function toggle(role: string, permKey: string, current: boolean) {
    const key = `${role}:${permKey}`
    setSaving(key)

    const { error: err } = await supabase
      .from('module_permissions')
      .upsert(
        { module: permKey, role, enabled: !current, updated_at: new Date().toISOString() },
        { onConflict: 'module,role' }
      )

    if (err) {
      error('Error', err.message)
    } else {
      setPerms(prev => ({
        ...prev,
        [role]: { ...(prev[role] ?? {}), [permKey]: !current }
      }))
    }
    setSaving(null)
  }

  async function resetRole(role: string) {
    setSaving(`reset:${role}`)
    const defaults = DEFAULTS[role] ?? {}
    const rows = Object.entries(defaults).map(([module, enabled]) => ({
      module, role, enabled, updated_at: new Date().toISOString()
    }))
    await supabase.from('module_permissions').upsert(rows, { onConflict: 'module,role' })
    setPerms(prev => ({ ...prev, [role]: defaults }))
    setSaving(null)
    success(`Permisos de ${role} restaurados`, 'Se aplicaron los valores por defecto', '🔄')
  }

  function toggleExpanded(key: string) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <NotifyModal notify={notify} onClose={close} />

      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-white">Permisos por rol</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          Controla exactamente qué puede hacer cada rol en el sistema. El Super Admin siempre tiene acceso total.
        </p>
      </div>

      {/* Role columns */}
      <div className="grid gap-4 lg:grid-cols-2">
        {ROLES.map(role => (
          <div key={role.key} className={`rounded-2xl border ${role.bg} overflow-hidden`}>
            {/* Role header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div>
                <p className={`font-bold text-base ${role.color}`}>{role.label}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {Object.values(perms[role.key] ?? {}).filter(Boolean).length} de{' '}
                  {Object.values(perms[role.key] ?? {}).length} permisos activos
                </p>
              </div>
              <button
                onClick={() => resetRole(role.key)}
                disabled={saving === `reset:${role.key}`}
                className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-white"
              >
                <RefreshCw size={11} className={saving === `reset:${role.key}` ? 'animate-spin' : ''} />
                Restaurar
              </button>
            </div>

            {/* Permission groups */}
            <div className="divide-y divide-white/5">
              {PERMISSION_GROUPS.map(group => (
                <div key={group.section}>
                  {/* Section label */}
                  <div className="px-5 py-2 bg-black/20">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      {group.section}
                    </p>
                  </div>

                  {/* Modules */}
                  {group.modules.map(mod => {
                    const expandKey = `${role.key}:${mod.key}`
                    const isExpanded = expanded[expandKey]
                    const ModIcon = mod.icon
                    const activeCount = mod.permissions.filter(p => perms[role.key]?.[p.key]).length

                    return (
                      <div key={mod.key}>
                        {/* Module header - clickable to expand */}
                        <button
                          onClick={() => toggleExpanded(expandKey)}
                          className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition text-left"
                        >
                          <ModIcon size={14} className="text-zinc-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-zinc-300">{mod.label}</p>
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            activeCount === mod.permissions.length
                              ? 'bg-green-500/20 text-green-400'
                              : activeCount === 0
                              ? 'bg-red-500/10 text-red-400'
                              : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {activeCount}/{mod.permissions.length}
                          </span>
                          {isExpanded
                            ? <ChevronDown size={13} className="text-zinc-600 shrink-0" />
                            : <ChevronRight size={13} className="text-zinc-600 shrink-0" />}
                        </button>

                        {/* Granular permissions */}
                        {isExpanded && (
                          <div className="bg-black/20 divide-y divide-white/5">
                            {mod.permissions.map(perm => {
                              const isEnabled = perms[role.key]?.[perm.key] ?? false
                              const isSaving  = saving === `${role.key}:${perm.key}`

                              return (
                                <div key={perm.key} className="flex items-center justify-between px-8 py-2.5">
                                  <p className="text-xs text-zinc-400">{perm.label}</p>
                                  <button
                                    onClick={() => toggle(role.key, perm.key, isEnabled)}
                                    disabled={!!saving}
                                    className={`relative flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                                      isEnabled ? 'bg-amber-500' : 'bg-zinc-700'
                                    }`}
                                  >
                                    {isSaving
                                      ? <span className="absolute inset-0 flex items-center justify-center">
                                          <span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
                                        </span>
                                      : <span className={`absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-all ${
                                          isEnabled ? 'left-[18px]' : 'left-[3px]'
                                        }`} />
                                    }
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Notas importantes</p>
        <div className="space-y-1.5 text-xs text-zinc-500">
          <p>• El <strong className="text-white">Super Admin</strong> siempre tiene acceso total a todo el sistema — sus permisos no se pueden restringir.</p>
          <p>• Los permisos se aplican inmediatamente — el usuario verá los cambios en su próxima acción.</p>
          <p>• Haz clic en cada módulo para ver y configurar los permisos granulares.</p>
          <p>• El botón <strong className="text-white">Restaurar</strong> vuelve a los valores por defecto recomendados para ese rol.</p>
        </div>
      </div>
    </div>
  )
}
