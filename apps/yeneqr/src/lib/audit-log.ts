// ============================================================
// Yene QR — Audit Log Helper Module
// ============================================================
// Provides helper functions for creating AuditLog entries
// for sensitive operations (refunds, role changes, order
// cancellations, settings changes, etc.).
//
// Uses dynamic import for `db` to avoid potential circular
// dependency issues at module-load time.

interface CreateAuditLogParams {
  restaurantId: string
  branchId?: string
  userId?: string
  action: string
  entityType: string
  entityId?: string
  previousData?: Record<string, unknown> | null
  newData?: Record<string, unknown> | null
  performedByType?: string // super_admin, support_admin, restaurant_user, customer, system
  ipAddress?: string
  userAgent?: string
}

/**
 * Core function — creates an AuditLog entry.
 * Silently catches errors so audit logging never breaks the
 * primary operation.
 */
export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    const { db } = await import('@/lib/db')

    await db.auditLog.create({
      data: {
        restaurantId: params.restaurantId,
        branchId: params.branchId || null,
        userId: params.userId ?? null,
        userType: params.performedByType ?? 'system',
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        previousData: params.previousData ? JSON.stringify(params.previousData) : null,
        newData: params.newData ? JSON.stringify(params.newData) : null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    })
  } catch (error) {
    // Audit logging must never break the primary operation.
    // Log the error but do not re-throw.
    console.error('[AUDIT_LOG_ERROR]', error)
  }
}

// ── Shorthand Helpers ────────────────────────────────────────

interface RefundAuditParams {
  restaurantId: string
  branchId?: string  // Phase 2.6: branch where the refund was issued
  userId?: string
  performedByType?: string
  refundId: string
  paymentId: string
  amount: number
  reason: string
  orderId?: string
  ipAddress?: string
  userAgent?: string
}

/**
 * Log a refund creation.
 */
export async function logRefund(params: RefundAuditParams): Promise<void> {
  return createAuditLog({
    restaurantId: params.restaurantId,
    branchId: params.branchId,
    userId: params.userId,
    action: 'refund_created',
    entityType: 'refund',
    entityId: params.refundId,
    performedByType: params.performedByType,
    previousData: null,
    newData: {
      refundId: params.refundId,
      paymentId: params.paymentId,
      amount: params.amount,
      reason: params.reason,
      orderId: params.orderId,
    },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  })
}

interface RoleChangeAuditParams {
  restaurantId: string
  branchId?: string  // Phase 2.6: branch where the role change was performed
  userId?: string
  performedByType?: string
  staffId: string
  staffName?: string
  previousRole: string
  newRole: string
  ipAddress?: string
  userAgent?: string
}

/**
 * Log a staff role change.
 */
export async function logRoleChange(params: RoleChangeAuditParams): Promise<void> {
  return createAuditLog({
    restaurantId: params.restaurantId,
    branchId: params.branchId,
    userId: params.userId,
    action: 'role_change',
    entityType: 'restaurant_user',
    entityId: params.staffId,
    performedByType: params.performedByType,
    previousData: {
      role: params.previousRole,
      staffName: params.staffName,
    },
    newData: {
      role: params.newRole,
      staffName: params.staffName,
    },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  })
}

interface StaffActionAuditParams {
  restaurantId: string
  branchId?: string  // Phase 2.6: branch where the action was performed
  userId?: string
  performedByType?: string
  action: string
  entityType: string
  entityId?: string
  details?: Record<string, unknown>
  previousData?: Record<string, unknown> | null
  newData?: Record<string, unknown> | null
  ipAddress?: string
  userAgent?: string
}

/**
 * Log a general staff action (order cancellation, etc.).
 */
export async function logStaffAction(params: StaffActionAuditParams): Promise<void> {
  return createAuditLog({
    restaurantId: params.restaurantId,
    branchId: params.branchId,
    userId: params.userId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    performedByType: params.performedByType,
    previousData: params.previousData ?? null,
    newData: params.newData ?? (params.details ?? null),
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  })
}

interface SettingsChangeAuditParams {
  restaurantId: string
  branchId?: string  // Phase 2.6: branch whose settings were changed (if branch-scoped)
  userId?: string
  performedByType?: string
  previousSettings?: Record<string, unknown> | null
  newSettings?: Record<string, unknown> | null
  changedFields?: string[]
  ipAddress?: string
  userAgent?: string
}

/**
 * Log a settings change.
 */
export async function logSettingsChange(params: SettingsChangeAuditParams): Promise<void> {
  return createAuditLog({
    restaurantId: params.restaurantId,
    branchId: params.branchId,
    userId: params.userId,
    action: 'settings_updated',
    entityType: 'restaurant',
    entityId: params.restaurantId,
    performedByType: params.performedByType,
    previousData: params.previousSettings ?? null,
    newData: {
      ...(params.newSettings ?? {}),
      changedFields: params.changedFields ?? [],
    },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  })
}
