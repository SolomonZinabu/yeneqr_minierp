// ============================================================
// Yene QR — Shift Utilities
// ============================================================
// Centralized logic for looking up active shifts and currently
// clocked-in staff. Used by: waiter assignment, notifications,
// dashboard, and session API.

import { db } from '@/lib/db'

export interface ActiveStaffMember {
  userId: string
  name: string
  role: string
  avatar: string | null
  phone: string | null
  entryId: string
  shiftId: string
  shiftName: string
  shiftColor: string
  branchId: string
  stationId: string | null
  stationName: string | null
  assignedTableIds: string[]
  clockInTime: Date | null
  status: string
}

/**
 * Get all currently clocked-in staff for a restaurant (or specific branch).
 * A staff member is "active" if their ShiftEntry status is 'clocked_in' or 'on_break'
 * and today falls within their entry's date.
 */
export async function getActiveStaff(
  restaurantId: string,
  branchId?: string
): Promise<ActiveStaffMember[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const where: any = {
    restaurantId,
    status: { in: ['clocked_in', 'on_break'] },
    date: { gte: today, lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
  }
  if (branchId) where.branchId = branchId

  const entries = await db.shiftEntry.findMany({
    where,
    include: {
      shift: { select: { id: true, name: true, startTime: true, endTime: true, color: true } },
      user: { select: { id: true, name: true, role: true, avatar: true, phone: true } },
      kitchenStation: { select: { id: true, name: true } },
    },
  })

  return entries.map((entry) => {
    let assignedTableIds: string[] = []
    if (entry.assignedTables) {
      try {
        assignedTableIds = JSON.parse(entry.assignedTables)
      } catch {
        // Invalid JSON — skip
      }
    }

    return {
      userId: entry.user.id,
      name: entry.user.name,
      role: entry.user.role,
      avatar: entry.user.avatar,
      phone: entry.user.phone,
      entryId: entry.id,
      shiftId: entry.shift.id,
      shiftName: entry.shift.name,
      shiftColor: entry.shift.color,
      branchId: entry.branchId,
      stationId: entry.stationId,
      stationName: entry.kitchenStation?.name || null,
      assignedTableIds,
      clockInTime: entry.clockInTime,
      status: entry.status,
    }
  })
}

/**
 * Get all waiters currently clocked in for a branch.
 * Returns their assigned tables.
 */
export async function getActiveWaiters(
  restaurantId: string,
  branchId: string
): Promise<ActiveStaffMember[]> {
  const staff = await getActiveStaff(restaurantId, branchId)
  return staff.filter((s) => s.role === 'waiter')
}

/**
 * Get the current shift for a branch (based on current time).
 * Returns the shift whose startTime/endTime range covers the current time.
 */
export async function getCurrentShift(
  restaurantId: string,
  branchId: string
): Promise<{ id: string; name: string; startTime: string; endTime: string; color: string } | null> {
  const now = new Date()
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  // Find shifts where current time falls within startTime-endTime
  const shifts = await db.shift.findMany({
    where: {
      restaurantId,
      branchId,
      isActive: true,
    },
  })

  // Check each shift's time range
  for (const shift of shifts) {
    // Handle overnight shifts (e.g., 22:00 - 06:00)
    if (shift.startTime <= shift.endTime) {
      // Normal shift: start <= now < end
      if (currentTime >= shift.startTime && currentTime < shift.endTime) {
        return shift
      }
    } else {
      // Overnight shift: now >= start OR now < end
      if (currentTime >= shift.startTime || currentTime < shift.endTime) {
        return shift
      }
    }
  }

  return null
}

/**
 * Get the waiter count for each table in a branch based on
 * currently clocked-in staff's assignedTables.
 */
export async function getTableWaiterCounts(
  restaurantId: string,
  branchId: string
): Promise<Map<string, number>> {
  const waiters = await getActiveWaiters(restaurantId, branchId)
  const counts = new Map<string, number>()

  for (const waiter of waiters) {
    for (const tableId of waiter.assignedTableIds) {
      counts.set(tableId, (counts.get(tableId) || 0) + 1)
    }
  }

  return counts
}
