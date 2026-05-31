export type RoleKey = 'super_admin' | 'adm_merch' | 'admin' | 'voluntario'

export type PermissionAction = {
  key: string
  label: string
  description?: string
}

export const ALL_PERMISSION_KEYS = [
  'dashboard.view',

  'pos.view',
  'pos.sell',
  'pos.all_payments',
  'pos.discount',
  'pos.smart_pos',
  'pos.link_payment',
  'pos.pending_orders',

  'orders.view',
  'orders.detail',
  'orders.export',
  'orders.refund',

  'deliveries.view',
  'deliveries.ready',
  'deliveries.deliver',
  'deliveries.whatsapp',

  'production.view',
  'production.collect_balance',
  'production.mark_ready',
  'production.mark_delivered',
  'production.tracking',

  'inventory.view',
  'inventory.movements',
  'inventory.movements.view',
  'inventory.scan',
  'inventory.adjust',
  'inventory.transfer',
  'inventory.transfers.view',

  'movements.view',

  'products.view',
  'products.create',
  'products.edit',
  'products.delete',
  'products.labels',
  'products.prices',

  'pricing.view',
  'pricing.edit',
  'pricing.history',
  'pricing.margins',

  'reports.view',
  'reports.all_campus',
  'reports.export',

  'close_day.view',
  'close_day.open',
  'close_day.close',
  'close_day.all',

  'categories.view',
  'categories.manage',

  'executive.view',
  'analytics.view',
  'analytics.export',
  'ai_insights.view',
  'forecast.view',

  'profile.view',
] as const

export type PermissionKey = typeof ALL_PERMISSION_KEYS[number]

const allTrue = Object.fromEntries(ALL_PERMISSION_KEYS.map((key) => [key, true]))

export const DEFAULT_ROLE_PERMISSION_MAP: Record<string, Record<string, boolean>> = {
  super_admin: allTrue,

  adm_merch: {
    ...allTrue,
    'products.delete': false,
  },

  admin: {
    'dashboard.view': true,

    'pos.view': true,
    'pos.sell': true,
    'pos.all_payments': true,
    'pos.discount': false,
    'pos.smart_pos': true,
    'pos.link_payment': true,
    'pos.pending_orders': true,

    'orders.view': true,
    'orders.detail': true,
    'orders.export': true,
    'orders.refund': false,

    'deliveries.view': true,
    'deliveries.ready': false,
    'deliveries.deliver': true,
    'deliveries.whatsapp': true,

    'production.view': true,
    'production.collect_balance': true,
    'production.mark_ready': true,
    'production.mark_delivered': true,
    'production.tracking': true,

    'inventory.view': true,
    'inventory.movements': true,
    'inventory.movements.view': true,
    'inventory.scan': true,
    'inventory.adjust': false,
    'inventory.transfer': false,
    'inventory.transfers.view': false,

    'movements.view': true,

    'products.view': true,
    'products.create': false,
    'products.edit': false,
    'products.delete': false,
    'products.labels': true,
    'products.prices': true,

    'pricing.view': false,
    'pricing.edit': false,
    'pricing.history': false,
    'pricing.margins': false,

    'reports.view': true,
    'reports.all_campus': false,
    'reports.export': false,

    'close_day.view': true,
    'close_day.open': true,
    'close_day.close': true,
    'close_day.all': false,

    'categories.view': true,
    'categories.manage': false,

    'executive.view': false,
    'analytics.view': true,
    'analytics.export': false,
    'ai_insights.view': false,
    'forecast.view': false,

    'profile.view': true,
  },

  voluntario: {
    'dashboard.view': false,

    'pos.view': true,
    'pos.sell': true,
    'pos.all_payments': false,
    'pos.discount': false,
    'pos.smart_pos': false,
    'pos.link_payment': false,
    'pos.pending_orders': false,

    'orders.view': true,
    'orders.detail': true,
    'orders.export': false,
    'orders.refund': false,

    'deliveries.view': true,
    'deliveries.ready': false,
    'deliveries.deliver': true,
    'deliveries.whatsapp': false,

    'production.view': true,
    'production.collect_balance': true,
    'production.mark_ready': false,
    'production.mark_delivered': true,
    'production.tracking': true,

    'inventory.view': true,
    'inventory.movements': false,
    'inventory.movements.view': false,
    'inventory.scan': false,
    'inventory.adjust': false,
    'inventory.transfer': false,
    'inventory.transfers.view': false,

    'movements.view': false,

    'products.view': true,
    'products.create': false,
    'products.edit': false,
    'products.delete': false,
    'products.labels': false,
    'products.prices': false,

    'pricing.view': false,
    'pricing.edit': false,
    'pricing.history': false,
    'pricing.margins': false,

    'reports.view': false,
    'reports.all_campus': false,
    'reports.export': false,

    'close_day.view': false,
    'close_day.open': false,
    'close_day.close': false,
    'close_day.all': false,

    'categories.view': false,
    'categories.manage': false,

    'executive.view': false,
    'analytics.view': false,
    'analytics.export': false,
    'ai_insights.view': false,
    'forecast.view': false,

    'profile.view': true,
  },
}

export function getDefaultPermissionsForRole(role: string | null | undefined) {
  if (!role) return {}
  if (role === 'super_admin') return DEFAULT_ROLE_PERMISSION_MAP.super_admin
  return DEFAULT_ROLE_PERMISSION_MAP[role] ?? {}
}

export function mergeRolePermissions(
  role: string | null | undefined,
  overrides?: Record<string, boolean>,
) {
  if (role === 'super_admin') {
    return new Proxy({}, { get: () => true }) as Record<string, boolean>
  }

  return {
    ...getDefaultPermissionsForRole(role),
    ...(overrides ?? {}),
  }
}

export function hasPermission(
  role: string | null | undefined,
  permission: string,
  permissions?: Record<string, boolean>,
) {
  if (!role) return false
  if (role === 'super_admin') return true
  const effective = permissions ?? getDefaultPermissionsForRole(role)
  return effective[permission] === true
}

export function permissionRowsFromMap(role: string, permissions: Record<string, boolean>) {
  return Object.entries(permissions).map(([module, enabled]) => ({
    role,
    module,
    enabled,
    updated_at: new Date().toISOString(),
  }))
}
