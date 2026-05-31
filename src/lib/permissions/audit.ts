export async function auditPermissionAction(
  adminClient: any,
  payload: {
    actor_id: string
    action: string
    permission?: string | null
    target_type?: string | null
    target_id?: string | null
    metadata?: Record<string, any> | null
  },
) {
  try {
    await adminClient.from('permission_audit_logs').insert({
      actor_id: payload.actor_id,
      action: payload.action,
      permission: payload.permission ?? null,
      target_type: payload.target_type ?? null,
      target_id: payload.target_id ?? null,
      metadata: payload.metadata ?? null,
    })
  } catch (error) {
    console.error('permission audit failed:', error)
  }
}
