/**
 * Waiter Assignment Utilities
 * 
 * Centralized logic for looking up which waiter(s) are assigned to a table,
 * auto-assigning the least-busy waiter, and rebalancing assignments.
 * 
 * Used by: session API, order creation, waiter calls, notifications,
 *          auto-assign API, rebalance API.
 * 
 * Priority: Shift-based assignments > StaffAssignment.assignedTables
 * Algorithm: Least-tables + least-active-orders (workload balancing)
 */

import { db } from '@/lib/db'
import { getActiveWaiters, type ActiveStaffMember } from './shift-utils'

// ============================================================
// Types
// ============================================================

export interface AssignedWaiter {
  userId: string
  name: string
  phone: string | null
  assignmentId: string
  branchId: string
}

export interface WaiterWorkload {
  userId: string
  name: string
  phone: string | null
  avatar: string | null
  branchId: string
  entryId?: string          // Shift entry ID if shift-based
  shiftName?: string        // Shift name if shift-based
  assignedTableIds: string[]
  activeOrderCount: number  // Orders in non-terminal states
  totalLoad: number         // assignedTableIds.length + activeOrderCount (composite workload)
}

export interface RebalanceResult {
  waiterId: string
  waiterName: string
  previousTableIds: string[]
  newTableIds: string[]
  source: 'shift' | 'staff_assignment'
}

// ============================================================
// Existing Functions (enhanced)
// ============================================================

/**
 * Find all waiters assigned to a specific table.
 * 
 * First checks shift-based assignments (clocked-in staff with assignedTables).
 * Falls back to StaffAssignment.assignedTables if no shift-based assignments found.
 */
export async function getWaitersForTable(
  restaurantId: string,
  tableId: string
): Promise<AssignedWaiter[]> {
  try {
    // 1. Try shift-based assignments first (preferred for shift-aware restaurants)
    const table = await db.table.findUnique({
      where: { id: tableId },
      select: { branchId: true },
    })
    
    if (table) {
      const activeWaiters = await getActiveWaiters(restaurantId, table.branchId)
      const shiftAssigned = activeWaiters.filter(w => w.assignedTableIds.includes(tableId))
      
      if (shiftAssigned.length > 0) {
        return shiftAssigned.map(w => ({
          userId: w.userId,
          name: w.name,
          phone: w.phone,
          assignmentId: w.entryId, // Use shift entry ID
          branchId: w.branchId,
        }))
      }
    }

    // 2. Fall back to StaffAssignment-based lookup
    const allWaiterAssignments = await db.staffAssignment.findMany({
      where: {
        restaurantId,
        role: 'waiter',
        isActive: true,
      },
      include: {
        user: { select: { id: true, name: true, phone: true } },
      },
    })

    const assigned: AssignedWaiter[] = []

    for (const assignment of allWaiterAssignments) {
      if (!assignment.assignedTables) continue
      try {
        const assignedTableIds: string[] = JSON.parse(assignment.assignedTables)
        if (assignedTableIds.includes(tableId)) {
          assigned.push({
            userId: assignment.user.id,
            name: assignment.user.name,
            phone: assignment.user.phone || null,
            assignmentId: assignment.id,
            branchId: assignment.branchId,
          })
        }
      } catch {
        // Invalid JSON in assignedTables — skip
      }
    }

    return assigned
  } catch (err) {
    console.error('[GET_WAITERS_FOR_TABLE_ERROR]', err)
    return []
  }
}

/**
 * Find the least-busy waiter assigned to a table.
 * Considers both table count and active order count for workload balancing.
 * Falls back to first waiter if workload data is unavailable.
 */
export async function getPrimaryWaiterForTable(
  restaurantId: string,
  tableId: string
): Promise<AssignedWaiter | null> {
  const waiters = await getWaitersForTable(restaurantId, tableId)
  if (waiters.length === 0) return null
  if (waiters.length === 1) return waiters[0]

  // Multiple waiters — pick the least busy one
  const workloads = await getWaiterWorkloads(restaurantId, waiters[0].branchId)
  const workloadMap = new Map(workloads.map(w => [w.userId, w]))

  // Sort waiters by total load (ascending) — least busy first
  const sorted = [...waiters].sort((a, b) => {
    const loadA = workloadMap.get(a.userId)?.totalLoad ?? Infinity
    const loadB = workloadMap.get(b.userId)?.totalLoad ?? Infinity
    return loadA - loadB
  })

  return sorted[0]
}

// ============================================================
// New: Workload Calculation
// ============================================================

/**
 * Get workload data for all active waiters in a branch.
 * Calculates assigned tables + active orders for each waiter.
 * 
 * Uses shift-based data when available (waiters clocked into shifts),
 * falls back to StaffAssignment data otherwise.
 */
export async function getWaiterWorkloads(
  restaurantId: string,
  branchId: string
): Promise<WaiterWorkload[]> {
  try {
    // Get shift-based active waiters first
    const activeWaiters = await getActiveWaiters(restaurantId, branchId)
    const useShiftData = activeWaiters.length > 0

    // Build workload entries
    let waiterEntries: Array<{
      userId: string
      name: string
      phone: string | null
      avatar: string | null
      branchId: string
      entryId?: string
      shiftName?: string
      assignedTableIds: string[]
      source: 'shift' | 'staff_assignment'
    }>

    if (useShiftData) {
      // Use shift-based assignments — these are the currently clocked-in waiters
      waiterEntries = activeWaiters.map(w => ({
        userId: w.userId,
        name: w.name,
        phone: w.phone,
        avatar: w.avatar,
        branchId: w.branchId,
        entryId: w.entryId,
        shiftName: w.shiftName,
        assignedTableIds: w.assignedTableIds,
        source: 'shift' as const,
      }))
    } else {
      // Fall back to StaffAssignment-based data
      const assignments = await db.staffAssignment.findMany({
        where: {
          restaurantId,
          branchId,
          role: 'waiter',
          isActive: true,
        },
        include: {
          user: { select: { id: true, name: true, phone: true, avatar: true } },
        },
      })

      waiterEntries = assignments.map(a => {
        let assignedTableIds: string[] = []
        if (a.assignedTables) {
          try {
            assignedTableIds = JSON.parse(a.assignedTables)
          } catch {
            // Invalid JSON
          }
        }
        return {
          userId: a.userId,
          name: a.user.name,
          phone: a.user.phone || null,
          avatar: a.user.avatar || null,
          branchId: a.branchId,
          assignedTableIds,
          source: 'staff_assignment' as const,
        }
      })
    }

    // Get active order counts for each waiter
    // Active orders = non-terminal statuses (pending, accepted, preparing, ready, picked_up, served)
    const activeStatuses = ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'served']
    const waiterIds = waiterEntries.map(w => w.userId)

    const activeOrders = await db.order.findMany({
      where: {
        restaurantId,
        branchId,
        waiterId: { in: waiterIds },
        status: { in: activeStatuses },
      },
      select: {
        waiterId: true,
        id: true,
      },
    })

    // Count orders per waiter
    const orderCountMap = new Map<string, number>()
    for (const order of activeOrders) {
      if (order.waiterId) {
        orderCountMap.set(order.waiterId, (orderCountMap.get(order.waiterId) || 0) + 1)
      }
    }

    // Build workload objects
    return waiterEntries.map(w => {
      const activeOrderCount = orderCountMap.get(w.userId) || 0
      return {
        userId: w.userId,
        name: w.name,
        phone: w.phone,
        avatar: w.avatar,
        branchId: w.branchId,
        entryId: w.entryId,
        shiftName: w.shiftName,
        assignedTableIds: w.assignedTableIds,
        activeOrderCount,
        totalLoad: w.assignedTableIds.length + activeOrderCount,
      }
    })
  } catch (err) {
    console.error('[GET_WAITER_WORKLOADS_ERROR]', err)
    return []
  }
}

// ============================================================
// New: Least-Busy Waiter Selection
// ============================================================

/**
 * Find the least-busy waiter in a branch who can take a new table/order.
 * 
 * Algorithm:
 * 1. Get all active waiters with their workload data
 * 2. Sort by totalLoad (tables + active orders) ascending
 * 3. Return the waiter with the lowest load
 * 
 * Returns null if no waiters are available.
 */
export async function getLeastBusyWaiter(
  restaurantId: string,
  branchId: string
): Promise<WaiterWorkload | null> {
  const workloads = await getWaiterWorkloads(restaurantId, branchId)
  if (workloads.length === 0) return null

  // Sort by totalLoad (ascending) — least busy first
  workloads.sort((a, b) => a.totalLoad - b.totalLoad)
  return workloads[0]
}

/**
 * Find the least-busy waiter for a specific table.
 * 
 * If the table already has assigned waiters, returns the least-busy of those.
 * If the table has NO assigned waiters, returns the least-busy waiter in the branch
 * (auto-assigns the table to them).
 */
export async function getLeastBusyWaiterForTable(
  restaurantId: string,
  tableId: string
): Promise<AssignedWaiter | null> {
  // First check if table has existing assignments
  const assignedWaiters = await getWaitersForTable(restaurantId, tableId)
  
  if (assignedWaiters.length > 0) {
    // Table has assignments — pick least busy among assigned waiters
    const workloads = await getWaiterWorkloads(restaurantId, assignedWaiters[0].branchId)
    const workloadMap = new Map(workloads.map(w => [w.userId, w]))
    
    const sorted = [...assignedWaiters].sort((a, b) => {
      const loadA = workloadMap.get(a.userId)?.totalLoad ?? Infinity
      const loadB = workloadMap.get(b.userId)?.totalLoad ?? Infinity
      return loadA - loadB
    })
    
    return sorted[0]
  }

  // No assignments for this table — find the least busy waiter in the branch
  const table = await db.table.findUnique({
    where: { id: tableId },
    select: { branchId: true },
  })
  
  if (!table) return null
  
  const leastBusy = await getLeastBusyWaiter(restaurantId, table.branchId)
  if (!leastBusy) return null
  
  return {
    userId: leastBusy.userId,
    name: leastBusy.name,
    phone: leastBusy.phone,
    assignmentId: leastBusy.entryId || '',
    branchId: leastBusy.branchId,
  }
}

// ============================================================
// New: Enriched assignment with audit context
// ============================================================

/**
 * Result of an enriched waiter assignment — includes the chosen waiter
 * AND the decision context (candidates considered, their loads, reason).
 * Used by the orders POST route to log a full audit trail in OrderEvent.
 */
export interface WaiterAssignmentDecision {
  waiter: AssignedWaiter | null
  reason: 'least_busy_among_assigned' | 'least_busy_in_branch' | 'no_waiters_available'
  candidates: Array<{
    userId: string
    name: string
    totalLoad: number
    assignedTableCount: number
    activeOrderCount: number
    selected: boolean
  }>
}

/**
 * Same as getLeastBusyWaiterForTable, but returns the full decision context
 * so the caller can log an audit trail explaining WHY this waiter was chosen.
 *
 * This makes the auto-assignment decision visible in the Order Events Timeline:
 *   "Waiter Sara auto-assigned (least busy among 3 assigned waiters)
 *    Sara: load 4 • Abebe: load 6 • Meron: load 5"
 *
 * Without this, the assignment happens silently and managers have no way
 * to answer "why did this order go to Sara instead of Abebe?"
 */
export async function getLeastBusyWaiterForTableWithAudit(
  restaurantId: string,
  tableId: string
): Promise<WaiterAssignmentDecision> {
  const assignedWaiters = await getWaitersForTable(restaurantId, tableId)

  // ── Case 1: Table has assigned waiters → pick least busy among them ──
  if (assignedWaiters.length > 0) {
    const workloads = await getWaiterWorkloads(restaurantId, assignedWaiters[0].branchId)
    const workloadMap = new Map(workloads.map(w => [w.userId, w]))

    // Build candidate list with their current loads
    const candidates = assignedWaiters.map(w => {
      const load = workloadMap.get(w.userId)
      return {
        userId: w.userId,
        name: w.name,
        totalLoad: load?.totalLoad ?? Infinity,
        assignedTableCount: load?.assignedTableIds.length ?? 0,
        activeOrderCount: load?.activeOrderCount ?? 0,
        selected: false,
      }
    })

    // Sort ascending by totalLoad (least busy first)
    candidates.sort((a, b) => a.totalLoad - b.totalLoad)

    // Mark the winner (first after sort)
    if (candidates.length > 0) {
      candidates[0].selected = true
      return {
        waiter: {
          userId: candidates[0].userId,
          name: candidates[0].name,
          phone: assignedWaiters.find(w => w.userId === candidates[0].userId)?.phone || null,
          assignmentId: assignedWaiters.find(w => w.userId === candidates[0].userId)?.assignmentId || '',
          branchId: assignedWaiters[0].branchId,
        },
        reason: 'least_busy_among_assigned',
        candidates,
      }
    }
  }

  // ── Case 2: No assigned waiters → least busy in the whole branch ──
  const table = await db.table.findUnique({
    where: { id: tableId },
    select: { branchId: true },
  })

  if (!table) {
    return { waiter: null, reason: 'no_waiters_available', candidates: [] }
  }

  const workloads = await getWaiterWorkloads(restaurantId, table.branchId)

  if (workloads.length === 0) {
    return { waiter: null, reason: 'no_waiters_available', candidates: [] }
  }

  // Sort ascending by totalLoad
  const sortedWorkloads = [...workloads].sort((a, b) => a.totalLoad - b.totalLoad)
  const leastBusy = sortedWorkloads[0]

  const candidates = sortedWorkloads.map((w, idx) => ({
    userId: w.userId,
    name: w.name,
    totalLoad: w.totalLoad,
    assignedTableCount: w.assignedTableIds.length,
    activeOrderCount: w.activeOrderCount,
    selected: idx === 0,
  }))

  return {
    waiter: {
      userId: leastBusy.userId,
      name: leastBusy.name,
      phone: leastBusy.phone,
      assignmentId: leastBusy.entryId || '',
      branchId: leastBusy.branchId,
    },
    reason: 'least_busy_in_branch',
    candidates,
  }
}

// ============================================================
// New: Auto-Assignment (assign unassigned tables to least-busy waiters)
// ============================================================

/**
 * Auto-assign all unassigned tables in a branch to the least-busy waiters.
 * 
 * Algorithm:
 * 1. Get all tables in the branch
 * 2. Get all active waiters with workloads
 * 3. Identify unassigned tables (no waiter assigned in shift or StaffAssignment)
 * 4. For each unassigned table, assign it to the waiter with the lowest totalLoad
 * 5. Update the assignment in the appropriate system (shift entry or StaffAssignment)
 * 
 * Returns the list of assignments made.
 */
export async function autoAssignTables(
  restaurantId: string,
  branchId: string
): Promise<RebalanceResult[]> {
  try {
    // Get all tables in the branch
    const tables = await db.table.findMany({
      where: { branchId, status: { not: 'disabled' } },
      select: { id: true, number: true },
    })

    if (tables.length === 0) return []

    // Get current waiter workloads
    const workloads = await getWaiterWorkloads(restaurantId, branchId)
    if (workloads.length === 0) return []

    // Determine which source to use for assignments
    const useShiftData = workloads.some(w => w.entryId)

    // Get currently assigned tables (all tables that already have a waiter)
    const allAssignedTableIds = new Set<string>()
    for (const w of workloads) {
      for (const tableId of w.assignedTableIds) {
        allAssignedTableIds.add(tableId)
      }
    }

    // Find unassigned tables
    const unassignedTables = tables.filter(t => !allAssignedTableIds.has(t.id))
    if (unassignedTables.length === 0) return []

    const results: RebalanceResult[] = []

    // Make a mutable copy of workloads for tracking live load
    const liveWorkloads = workloads.map(w => ({ ...w }))

    // Assign each unassigned table to the least-busy waiter
    for (const table of unassignedTables) {
      // Sort by current load (which updates as we assign)
      liveWorkloads.sort((a, b) => a.totalLoad - b.totalLoad)
      const leastBusy = liveWorkloads[0]

      const previousTableIds = [...leastBusy.assignedTableIds]
      const newTableIds = [...previousTableIds, table.id]

      // Update the assignment in the database
      if (useShiftData && leastBusy.entryId) {
        // Update shift entry's assignedTables
        await db.shiftEntry.update({
          where: { id: leastBusy.entryId },
          data: { assignedTables: JSON.stringify(newTableIds) },
        })
      } else {
        // Update or create StaffAssignment
        const existing = await db.staffAssignment.findFirst({
          where: {
            userId: leastBusy.userId,
            branchId,
            role: 'waiter',
            isActive: true,
          },
        })

        if (existing) {
          await db.staffAssignment.update({
            where: { id: existing.id },
            data: { assignedTables: JSON.stringify(newTableIds) },
          })
        } else {
          await db.staffAssignment.create({
            data: {
              userId: leastBusy.userId,
              branchId,
              restaurantId,
              role: 'waiter',
              assignedTables: JSON.stringify(newTableIds),
              isActive: true,
            },
          })
        }
      }

      // Update live workload tracking
      leastBusy.assignedTableIds = newTableIds
      leastBusy.totalLoad += 1

      results.push({
        waiterId: leastBusy.userId,
        waiterName: leastBusy.name,
        previousTableIds,
        newTableIds,
        source: useShiftData ? 'shift' : 'staff_assignment',
      })
    }

    return results
  } catch (err) {
    console.error('[AUTO_ASSIGN_TABLES_ERROR]', err)
    return []
  }
}

// ============================================================
// New: Rebalance Tables (redistribute for even workload)
// ============================================================

/**
 * Rebalance table assignments across all active waiters in a branch.
 * 
 * Algorithm:
 * 1. Get all tables and all active waiters with current workloads
 * 2. Flatten all assigned table IDs
 * 3. Redistribute tables evenly using round-robin (sorted by table number)
 * 4. Update assignments in the database
 * 
 * Returns the list of rebalance changes made.
 */
export async function rebalanceTables(
  restaurantId: string,
  branchId: string
): Promise<RebalanceResult[]> {
  try {
    // Get all tables in the branch
    const tables = await db.table.findMany({
      where: { branchId, status: { not: 'disabled' } },
      select: { id: true, number: true },
      orderBy: { number: 'asc' },
    })

    if (tables.length === 0) return []

    // Get current waiter workloads
    const workloads = await getWaiterWorkloads(restaurantId, branchId)
    if (workloads.length === 0) return []

    const waiterCount = workloads.length
    const tableCount = tables.length
    const baseTablesPerWaiter = Math.floor(tableCount / waiterCount)
    const extraTables = tableCount % waiterCount

    // Build new assignment map: waiter → tableIds
    // Distribute evenly: each waiter gets baseTablesPerWaiter, 
    // first 'extraTables' waiters get one extra
    const newAssignments = new Map<string, string[]>()
    for (const w of workloads) {
      newAssignments.set(w.userId, [])
    }

    let tableIndex = 0
    for (const w of workloads) {
      const count = baseTablesPerWaiter + (newAssignments.get(w.userId)!.length < extraTables ? 1 : 0)
      for (let i = 0; i < count && tableIndex < tableCount; i++) {
        newAssignments.get(w.userId)!.push(tables[tableIndex].id)
        tableIndex++
      }
    }

    // Distribute remaining tables (if any rounding issues)
    while (tableIndex < tableCount) {
      // Find waiter with fewest tables
      let minWaiter = workloads[0]
      let minCount = Infinity
      for (const w of workloads) {
        const count = newAssignments.get(w.userId)!.length
        if (count < minCount) {
          minCount = count
          minWaiter = w
        }
      }
      newAssignments.get(minWaiter.userId)!.push(tables[tableIndex].id)
      tableIndex++
    }

    // Determine which source to use for assignments
    const useShiftData = workloads.some(w => w.entryId)

    // Update assignments in the database and track changes
    const results: RebalanceResult[] = []

    for (const w of workloads) {
      const previousTableIds = w.assignedTableIds
      const newTableIds = newAssignments.get(w.userId) || []

      // Skip if no change
      if (JSON.stringify(previousTableIds.sort()) === JSON.stringify([...newTableIds].sort())) {
        continue
      }

      // Update in database
      if (useShiftData && w.entryId) {
        await db.shiftEntry.update({
          where: { id: w.entryId },
          data: { assignedTables: JSON.stringify(newTableIds) },
        })
      } else {
        const existing = await db.staffAssignment.findFirst({
          where: {
            userId: w.userId,
            branchId,
            role: 'waiter',
            isActive: true,
          },
        })

        if (existing) {
          await db.staffAssignment.update({
            where: { id: existing.id },
            data: { assignedTables: JSON.stringify(newTableIds) },
          })
        } else {
          await db.staffAssignment.create({
            data: {
              userId: w.userId,
              branchId,
              restaurantId,
              role: 'waiter',
              assignedTables: JSON.stringify(newTableIds),
              isActive: true,
            },
          })
        }
      }

      results.push({
        waiterId: w.userId,
        waiterName: w.name,
        previousTableIds,
        newTableIds,
        source: useShiftData ? 'shift' : 'staff_assignment',
      })
    }

    return results
  } catch (err) {
    console.error('[REBALANCE_TABLES_ERROR]', err)
    return []
  }
}
