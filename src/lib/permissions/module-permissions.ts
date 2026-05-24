export type PermissionAction = {
  key: string
  label: string
  description: string
}

export type PermissionModule = {
  section: string
  module: string
  label: string
  href?: string
  permissions: PermissionAction[]
}

export const NEW_MODULE_PERMISSIONS: PermissionModule[] = [
  {
    section: 'Gestión',
    module: 'pricing',
    label: 'Pricing Center',
    href: '/pricing',
    permissions: [
      {
        key: 'pricing.view',
        label: 'Ver Pricing Center',
        description: 'Permite acceder al centro de precios.',
      },
      {
        key: 'pricing.edit',
        label: 'Editar precios',
        description: 'Permite modificar precio compra, precio venta y margen.',
      },
      {
        key: 'pricing.history',
        label: 'Ver historial de precios',
        description: 'Permite revisar cambios históricos de precios.',
      },
      {
        key: 'pricing.margins',
        label: 'Ver márgenes',
        description: 'Permite revisar rentabilidad y margen por producto.',
      },
    ],
  },
  {
    section: 'Ventas',
    module: 'production',
    label: 'Producción y retiros',
    href: '/production',
    permissions: [
      {
        key: 'production.view',
        label: 'Ver producción/retiros',
        description: 'Permite ver pedidos en producción, listos para retiro y entregados.',
      },
      {
        key: 'production.collect_balance',
        label: 'Cobrar saldo pendiente',
        description: 'Permite cobrar el 50% restante antes de entregar.',
      },
      {
        key: 'production.mark_ready',
        label: 'Marcar listo para retiro',
        description: 'Permite cambiar pedidos a estado listo para retiro.',
      },
      {
        key: 'production.mark_delivered',
        label: 'Marcar entregado',
        description: 'Permite entregar pedidos solo si no tienen saldo pendiente.',
      },
      {
        key: 'production.tracking',
        label: 'Ver tracking cliente',
        description: 'Permite abrir el seguimiento público del pedido.',
      },
    ],
  },
  {
    section: 'Inteligencia',
    module: 'executive_center',
    label: 'Executive Center',
    href: '/intelligence/executive',
    permissions: [
      {
        key: 'executive.view',
        label: 'Ver Executive Center',
        description: 'Permite acceder al tablero ejecutivo consolidado.',
      },
    ],
  },
  {
    section: 'Inteligencia',
    module: 'analytics',
    label: 'Analytics',
    href: '/intelligence/analytics',
    permissions: [
      {
        key: 'analytics.view',
        label: 'Ver Analytics',
        description: 'Permite revisar análisis de ventas, stock y operación.',
      },
      {
        key: 'analytics.export',
        label: 'Exportar Analytics',
        description: 'Permite exportar reportes analíticos.',
      },
    ],
  },
  {
    section: 'Inteligencia',
    module: 'ai_insights',
    label: 'IA Insights',
    href: '/intelligence/ai-insights',
    permissions: [
      {
        key: 'ai_insights.view',
        label: 'Ver IA Insights',
        description: 'Permite ver recomendaciones automáticas del sistema.',
      },
    ],
  },
  {
    section: 'Inteligencia',
    module: 'forecast',
    label: 'Forecast',
    href: '/intelligence/forecast',
    permissions: [
      {
        key: 'forecast.view',
        label: 'Ver Forecast',
        description: 'Permite ver proyección ejecutiva y tendencias.',
      },
    ],
  },
]

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ['*'],

  adm_merch: [
    'dashboard.view',

    'pos.view',
    'orders.view',
    'orders.detail',

    'production.view',
    'production.collect_balance',
    'production.mark_ready',
    'production.mark_delivered',
    'production.tracking',

    'inventory.view',
    'inventory.movements.view',
    'inventory.transfers.view',

    'products.view',
    'products.create',
    'products.edit',

    'pricing.view',
    'pricing.edit',
    'pricing.history',
    'pricing.margins',

    'reports.view',
    'close_day.view',

    'analytics.view',
    'forecast.view',
    'ai_insights.view',
  ],

  admin: [
    'dashboard.view',

    'pos.view',
    'orders.view',
    'orders.detail',

    'production.view',
    'production.collect_balance',
    'production.mark_ready',
    'production.mark_delivered',
    'production.tracking',

    'inventory.view',
    'inventory.movements.view',

    'products.view',
    'reports.view',
    'close_day.view',

    'analytics.view',
  ],

  voluntario: [
    'pos.view',
    'orders.view',

    'production.view',
    'production.collect_balance',
    'production.mark_delivered',
    'production.tracking',

    'inventory.view',
    'profile.view',
  ],
}

export function hasPermission(
  role: string | null | undefined,
  permission: string,
  customPermissions?: string[],
) {
  if (!role) return false

  if (role === 'super_admin') return true

  const roleDefaults = DEFAULT_ROLE_PERMISSIONS[role] ?? []
  const permissions = customPermissions?.length ? customPermissions : roleDefaults

  return permissions.includes('*') || permissions.includes(permission)
}
