// ============================================================
// Yene QR — Order State Machine
// ============================================================

export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'picked_up' | 'served' | 'paid' | 'completed' | 'cancelled'
export type KitchenItemStatus = 'pending' | 'preparing' | 'ready' | 'picked_up' | 'served' | 'cancelled'

export interface StateTransition {
  from: OrderStatus
  to: OrderStatus
  allowedBy: string[]  // Roles that can perform this transition (legacy)
  requiredPermission?: string  // Permission key that allows this transition (preferred)
  requiresReason?: boolean  // e.g., cancellation requires a reason
  autoTimeout?: number  // Auto-transition after N milliseconds
}

// ============================================================
// Order State Machine Definition
// ============================================================

export const ORDER_TRANSITIONS: StateTransition[] = [
  // Normal flow
  { from: 'pending', to: 'accepted', allowedBy: ['owner', 'manager', 'waiter', 'super_admin'], requiredPermission: 'order:manage' },
  { from: 'pending', to: 'cancelled', allowedBy: ['owner', 'manager', 'customer', 'super_admin'], requiredPermission: 'order:manage', requiresReason: true },
  { from: 'accepted', to: 'preparing', allowedBy: ['owner', 'manager', 'kitchen_staff', 'super_admin'], requiredPermission: 'kitchen:manage' },
  { from: 'accepted', to: 'cancelled', allowedBy: ['owner', 'manager', 'customer', 'super_admin'], requiredPermission: 'order:manage', requiresReason: true },
  { from: 'preparing', to: 'ready', allowedBy: ['owner', 'manager', 'kitchen_staff', 'super_admin'], requiredPermission: 'kitchen:manage' },
  { from: 'preparing', to: 'cancelled', allowedBy: ['owner', 'manager', 'super_admin'], requiredPermission: 'order:manage', requiresReason: true },
  // Waiter picks up from kitchen → delivers to table
  { from: 'ready', to: 'picked_up', allowedBy: ['owner', 'manager', 'waiter', 'super_admin'], requiredPermission: 'order:manage' },
  { from: 'picked_up', to: 'served', allowedBy: ['owner', 'manager', 'waiter', 'super_admin'], requiredPermission: 'order:manage' },
  // Legacy shortcut: ready → served (for restaurants not using picked_up)
  { from: 'ready', to: 'served', allowedBy: ['owner', 'manager', 'waiter', 'super_admin'], requiredPermission: 'order:manage' },
  { from: 'served', to: 'paid', allowedBy: ['owner', 'manager', 'cashier', 'system', 'super_admin'], requiredPermission: 'payment:manage' },
  { from: 'paid', to: 'completed', allowedBy: ['system', 'owner', 'manager', 'super_admin'], requiredPermission: 'order:manage' }, // Auto after payment or manual by admin
  { from: 'served', to: 'completed', allowedBy: ['owner', 'manager', 'super_admin'], requiredPermission: 'order:manage' }, // Direct close for stale served orders
  // Revert transitions
  { from: 'accepted', to: 'pending', allowedBy: ['owner', 'manager', 'super_admin'], requiredPermission: 'order:manage' },
]

// Kitchen item state transitions (independent from order)
export const KITCHEN_ITEM_TRANSITIONS: { from: KitchenItemStatus; to: KitchenItemStatus; allowedBy: string[]; requiredPermission?: string }[] = [
  { from: 'pending', to: 'preparing', allowedBy: ['owner', 'manager', 'kitchen_staff', 'super_admin'], requiredPermission: 'kitchen:manage' },
  { from: 'pending', to: 'cancelled', allowedBy: ['owner', 'manager', 'kitchen_staff', 'super_admin'], requiredPermission: 'kitchen:manage' },
  { from: 'preparing', to: 'ready', allowedBy: ['owner', 'manager', 'kitchen_staff', 'super_admin'], requiredPermission: 'kitchen:manage' },
  { from: 'preparing', to: 'cancelled', allowedBy: ['owner', 'manager', 'super_admin'], requiredPermission: 'order:manage' },
  { from: 'ready', to: 'picked_up', allowedBy: ['owner', 'manager', 'waiter', 'kitchen_staff', 'super_admin'], requiredPermission: 'order:manage' },
  { from: 'picked_up', to: 'served', allowedBy: ['owner', 'manager', 'waiter', 'super_admin'], requiredPermission: 'order:manage' },
  // Legacy shortcut: ready → served
  { from: 'ready', to: 'served', allowedBy: ['owner', 'manager', 'waiter', 'super_admin'], requiredPermission: 'order:manage' },
]

export function canTransitionOrder(
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
  userRole: string,
  userPermissions?: string[] | null
): boolean {
  const transition = ORDER_TRANSITIONS.find(
    t => t.from === fromStatus && t.to === toStatus
  )
  if (!transition) return false
  // Check by permission first (preferred)
  if (transition.requiredPermission && userPermissions) {
    return userPermissions.includes(transition.requiredPermission)
  }
  // Fall back to role-based check
  return transition.allowedBy.includes(userRole)
}

export function canTransitionKitchenItem(
  fromStatus: KitchenItemStatus,
  toStatus: KitchenItemStatus,
  userRole: string,
  userPermissions?: string[] | null
): boolean {
  const transition = KITCHEN_ITEM_TRANSITIONS.find(
    t => t.from === fromStatus && t.to === toStatus
  )
  if (!transition) return false
  // Check by permission first (preferred)
  if (transition.requiredPermission && userPermissions) {
    return userPermissions.includes(transition.requiredPermission)
  }
  // Fall back to role-based check
  return transition.allowedBy.includes(userRole)
}

export function getOrderNextStatuses(
  currentStatus: OrderStatus,
  userRole: string,
  userPermissions?: string[] | null
): OrderStatus[] {
  return ORDER_TRANSITIONS
    .filter(t => {
      if (t.from !== currentStatus) return false
      // Check by permission first (preferred)
      if (t.requiredPermission && userPermissions) {
        return userPermissions.includes(t.requiredPermission)
      }
      // Fall back to role-based check
      return t.allowedBy.includes(userRole)
    })
    .map(t => t.to)
}

export function getKitchenItemNextStatuses(
  currentStatus: KitchenItemStatus,
  userRole: string,
  userPermissions?: string[] | null
): KitchenItemStatus[] {
  return KITCHEN_ITEM_TRANSITIONS
    .filter(t => {
      if (t.from !== currentStatus) return false
      // Check by permission first (preferred)
      if (t.requiredPermission && userPermissions) {
        return userPermissions.includes(t.requiredPermission)
      }
      // Fall back to role-based check
      return t.allowedBy.includes(userRole)
    })
    .map(t => t.to)
}

// ============================================================
// Order Number Generation
// ============================================================

let orderCounter = 0

export function generateOrderNumber(): string {
  orderCounter++
  const num = String(orderCounter).padStart(4, '0')
  return `#${num}`
}

// ============================================================
// Auto-accept timeout (if order is not accepted within N seconds)
// ============================================================

export const ORDER_ACCEPTANCE_TIMEOUT = 5 * 60 * 1000 // 5 minutes
