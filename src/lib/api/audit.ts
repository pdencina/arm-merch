import type { SupabaseClient } from '@supabase/supabase-js'

export interface AuditEntry {
  actor_id: string
  action: string
  entity_type: string
  entity_id?: string
  campus_id?: string | null
  metadata?: Record<string, any>
  ip_address?: string | null
}

/**
 * Log an audit event. Fire-and-forget — never throws.
 */
export async function logAudit(
  adminClient: SupabaseClient,
  entry: AuditEntry
): Promise<void> {
  try {
    await adminClient.from('audit_log').insert({
      actor_id: entry.actor_id,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id ?? null,
      campus_id: entry.campus_id ?? null,
      metadata: entry.metadata ?? {},
      ip_address: entry.ip_address ?? null,
    })
  } catch (err) {
    console.error('[audit] Failed to log:', err)
  }
}

/**
 * Common audit actions for consistency
 */
export const AUDIT_ACTIONS = {
  // Orders
  ORDER_CREATED: 'order.created',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_REFUNDED: 'order.refunded',

  // Inventory
  INVENTORY_ADJUSTED: 'inventory.adjusted',
  INVENTORY_SCANNED: 'inventory.scanned',

  // Transfers
  TRANSFER_CREATED: 'transfer.created',
  TRANSFER_APPROVED: 'transfer.approved',
  TRANSFER_RECEIVED: 'transfer.received',
  TRANSFER_CANCELLED: 'transfer.cancelled',

  // Products
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  PRODUCT_DELETED: 'product.deleted',

  // Users
  USER_CREATED: 'user.created',
  USER_DEACTIVATED: 'user.deactivated',
  USER_ROLE_CHANGED: 'user.role_changed',

  // Cash
  CASH_SESSION_OPENED: 'cash.session_opened',
  CASH_SESSION_CLOSED: 'cash.session_closed',

  // Auth
  LOGIN_SUCCESS: 'auth.login',
  LOGIN_FAILED: 'auth.login_failed',
} as const
