'use client'

// ============================================================
// Yene QR — Shift Management Dashboard View
// ============================================================
// Allows restaurant managers to create shifts, schedule staff,
// clock in/out, and view the shift calendar.

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { useBranchChange } from '@/hooks/use-branch-change'
import {
  Clock,
  Plus,
  Users,
  Calendar,
  Play,
  Square,
  Coffee,
  XCircle,
  ChevronLeft,
  ChevronRight,
  UserCheck,
} from 'lucide-react'

interface ShiftData {
  id: string
  name: string
  startTime: string
  endTime: string
  color: string
  branchId: string
  branch: { id: string; name: string }
  _count?: { shiftEntries: number }
}

interface ShiftEntryData {
  id: string
  shiftId: string
  userId: string
  branchId: string
  date: string
  status: string
  clockInTime: string | null
  clockOutTime: string | null
  breakStart: string | null
  breakEnd: string | null
  notes: string | null
  stationId: string | null
  assignedTables: string | null
  shift: { id: string; name: string; startTime: string; endTime: string; color: string }
  user: { id: string; name: string; role: string; avatar: string | null }
  branch: { id: string; name: string }
  kitchenStation: { id: string; name: string } | null
}

interface StaffMember {
  id: string
  name: string
  role: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  scheduled: { label: 'Scheduled', color: 'bg-gray-100 text-gray-700', icon: <Calendar className="w-3 h-3" /> },
  clocked_in: { label: 'Clocked In', color: 'bg-green-100 text-green-700', icon: <Play className="w-3 h-3" /> },
  on_break: { label: 'On Break', color: 'bg-amber-100 text-amber-700', icon: <Coffee className="w-3 h-3" /> },
  clocked_out: { label: 'Clocked Out', color: 'bg-blue-100 text-blue-700', icon: <Square className="w-3 h-3" /> },
  absent: { label: 'Absent', color: 'bg-red-100 text-red-700', icon: <XCircle className="w-3 h-3" /> },
}

export default function ShiftsView() {
  const { user, selectedBranchId, branchChangeVersion } = useAppStore()
  const restaurantId = user?.restaurantId

  const [shifts, setShifts] = useState<ShiftData[]>([])
  const [entries, setEntries] = useState<ShiftEntryData[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date()
    return d.toISOString().split('T')[0]
  })

  const fetchShiftsRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const fetchEntriesRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const fetchStaffRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const handleBranchChange = useCallback((newBranchId: string) => {
    console.log('[ShiftsView] handleBranchChange called with:', newBranchId)
    setLoading(true)
    setShifts([])
    setEntries([])
    setStaff([])
    fetchShiftsRef.current?.()
    fetchEntriesRef.current?.()
    fetchStaffRef.current?.()
  }, [])

  useBranchChange(handleBranchChange)

  // Dialogs
  const [showCreateShift, setShowCreateShift] = useState(false)
  const [showAssignStaff, setShowAssignStaff] = useState(false)
  const [selectedShiftForAssign, setSelectedShiftForAssign] = useState<ShiftData | null>(null)

  // New shift form
  const [newShift, setNewShift] = useState({
    name: '',
    startTime: '08:00',
    endTime: '16:00',
    color: '#3B82F6',
    branchId: '',
  })

  // New entry form
  const [newEntry, setNewEntry] = useState({
    userId: '',
    notes: '',
  })

  const branchId = selectedBranchId || ''

  const fetchShifts = useCallback(async () => {
    if (!restaurantId) return
    try {
      const branchId = useAppStore.getState().selectedBranchId || ''
      const res = await fetch(`/api/restaurants/${restaurantId}/shifts${branchId ? `?branchId=${branchId}` : ''}`)
      if (res.ok) {
        const data = await res.json()
        setShifts(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch shifts:', err)
    }
  }, [restaurantId])

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchShiftsRef.current = fetchShifts; }, [fetchShifts]);

  const fetchEntries = useCallback(async () => {
    if (!restaurantId) return
    try {
      const branchId = useAppStore.getState().selectedBranchId || ''
      const res = await fetch(
        `/api/restaurants/${restaurantId}/shifts/entries?date=${selectedDate}${branchId ? `&branchId=${branchId}` : ''}`
      )
      if (res.ok) {
        const data = await res.json()
        setEntries(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch entries:', err)
    }
  }, [restaurantId, selectedDate])

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchEntriesRef.current = fetchEntries; }, [fetchEntries]);

  const fetchStaff = useCallback(async () => {
    if (!restaurantId) return
    try {
      const branchId = useAppStore.getState().selectedBranchId || ''
      const res = await fetch(`/api/restaurants/${restaurantId}/staff${branchId ? `?branchId=${branchId}` : ''}`)
      if (res.ok) {
        const data = await res.json()
        setStaff((data.data || data.staff || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          role: s.role,
        })))
      }
    } catch (err) {
      console.error('Failed to fetch staff:', err)
    }
  }, [restaurantId])

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchStaffRef.current = fetchStaff; }, [fetchStaff]);

  useEffect(() => {
    Promise.all([fetchShifts(), fetchEntries(), fetchStaff()]).finally(() => setLoading(false))
  }, [fetchShifts, fetchEntries, fetchStaff, selectedBranchId, branchChangeVersion])

  const handleCreateShift = async () => {
    if (!newShift.name || !newShift.branchId) {
      toast.error('Please fill in all required fields')
      return
    }
    try {
      const res = await fetch(`/api/restaurants/${restaurantId}/shifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShift),
      })
      if (res.ok) {
        toast.success(`Shift "${newShift.name}" created`)
        setShowCreateShift(false)
        setNewShift({ name: '', startTime: '08:00', endTime: '16:00', color: '#3B82F6', branchId: '' })
        fetchShifts()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to create shift')
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleAssignStaff = async () => {
    if (!selectedShiftForAssign || !newEntry.userId) {
      toast.error('Please select a staff member')
      return
    }
    try {
      const res = await fetch(`/api/restaurants/${restaurantId}/shifts/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: selectedShiftForAssign.id,
          userId: newEntry.userId,
          branchId: selectedShiftForAssign.branchId,
          date: selectedDate,
          notes: newEntry.notes || null,
        }),
      })
      if (res.ok) {
        toast.success('Staff assigned to shift')
        setShowAssignStaff(false)
        setNewEntry({ userId: '', notes: '' })
        fetchEntries()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to assign staff')
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleClockAction = async (entryId: string, action: string) => {
    try {
      const res = await fetch(`/api/restaurants/${restaurantId}/shifts/entries`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId, action }),
      })
      if (res.ok) {
        toast.success(`Action "${action}" completed`)
        fetchEntries()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Action failed')
      }
    } catch {
      toast.error('Network error')
    }
  }

  const navigateDate = (direction: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + direction)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const todayStr = new Date().toISOString().split('T')[0]
  const isToday = selectedDate === todayStr

  // Group entries by shift
  const entriesByShift = entries.reduce((acc, entry) => {
    const key = entry.shiftId
    if (!acc[key]) acc[key] = { shift: entry.shift, entries: [] }
    acc[key].entries.push(entry)
    return acc
  }, {} as Record<string, { shift: ShiftEntryData['shift']; entries: ShiftEntryData[] }>)

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Shift Management</h2>
          <p className="text-muted-foreground">Manage shifts, schedule staff, and track clock-in/out</p>
        </div>
        <Button onClick={() => setShowCreateShift(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Shift
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Shifts</p>
                <p className="text-2xl font-bold">{shifts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <UserCheck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Clocked In</p>
                <p className="text-2xl font-bold">
                  {entries.filter((e) => e.status === 'clocked_in').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Coffee className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">On Break</p>
                <p className="text-2xl font-bold">
                  {entries.filter((e) => e.status === 'on_break').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Calendar className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Scheduled Today</p>
                <p className="text-2xl font-bold">
                  {entries.filter((e) => e.status === 'scheduled').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shift Definitions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Shift Definitions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {shifts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No shifts defined yet</p>
              <p className="text-sm">Create your first shift to start scheduling staff</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {shifts.map((shift) => (
                <div
                  key={shift.id}
                  className="border rounded-lg p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: shift.color }}
                    />
                    <h3 className="font-semibold">{shift.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {shift.startTime} — {shift.endTime}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {shift.branch.name}
                  </p>
                  <div className="flex items-center justify-between mt-3">
                    <Badge variant="outline" className="text-xs">
                      <Users className="w-3 h-3 mr-1" />
                      {shift._count?.shiftEntries || 0} entries
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedShiftForAssign(shift)
                        setShowAssignStaff(true)
                      }}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Assign
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Date Navigation + Schedule */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Schedule
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigateDate(-1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-40"
              />
              <Button variant="outline" size="sm" onClick={() => navigateDate(1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              {!isToday && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedDate(todayStr)}>
                  Today
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {Object.keys(entriesByShift).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No staff scheduled for {selectedDate}</p>
              <p className="text-sm">Assign staff to shifts above</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.values(entriesByShift).map(({ shift, entries: shiftEntries }) => (
                <div key={shift.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: shift.color }}
                    />
                    <h4 className="font-semibold text-sm">{shift.name}</h4>
                    <span className="text-xs text-muted-foreground">
                      {shift.startTime} — {shift.endTime}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {shiftEntries.length} staff
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {shiftEntries.map((entry) => {
                      const statusConfig = STATUS_CONFIG[entry.status] || STATUS_CONFIG.scheduled
                      return (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between border rounded-lg p-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                              {entry.user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{entry.user.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {entry.user.role.replace('_', ' ')}
                                {entry.kitchenStation && ` — ${entry.kitchenStation.name}`}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge className={`text-xs ${statusConfig.color}`}>
                              {statusConfig.icon}
                              <span className="ml-1">{statusConfig.label}</span>
                            </Badge>

                            {isToday && (
                              <div className="flex gap-1">
                                {entry.status === 'scheduled' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs"
                                      onClick={() => handleClockAction(entry.id, 'clock_in')}
                                    >
                                      <Play className="w-3 h-3 mr-1" />
                                      Clock In
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs text-red-500"
                                      onClick={() => handleClockAction(entry.id, 'mark_absent')}
                                    >
                                      Absent
                                    </Button>
                                  </>
                                )}
                                {entry.status === 'clocked_in' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs"
                                      onClick={() => handleClockAction(entry.id, 'start_break')}
                                    >
                                      <Coffee className="w-3 h-3 mr-1" />
                                      Break
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs"
                                      onClick={() => handleClockAction(entry.id, 'clock_out')}
                                    >
                                      <Square className="w-3 h-3 mr-1" />
                                      Out
                                    </Button>
                                  </>
                                )}
                                {entry.status === 'on_break' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => handleClockAction(entry.id, 'end_break')}
                                  >
                                    <Play className="w-3 h-3 mr-1" />
                                    Back
                                  </Button>
                                )}
                              </div>
                            )}

                            {entry.clockInTime && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(entry.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Shift Dialog */}
      <Dialog open={showCreateShift} onOpenChange={setShowCreateShift}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Shift Name</label>
              <Input
                placeholder="e.g., Morning, Lunch Rush, Evening"
                value={newShift.name}
                onChange={(e) => setNewShift({ ...newShift, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Start Time</label>
                <Input
                  type="time"
                  value={newShift.startTime}
                  onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Time</label>
                <Input
                  type="time"
                  value={newShift.endTime}
                  onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Color</label>
              <div className="flex gap-2">
                {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'].map(
                  (color) => (
                    <button
                      key={color}
                      className={`w-8 h-8 rounded-full border-2 ${
                        newShift.color === color ? 'border-gray-900' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewShift({ ...newShift, color })}
                    />
                  )
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Branch</label>
              <Select
                value={newShift.branchId}
                onValueChange={(value) => setNewShift({ ...newShift, branchId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {/* Branches will be loaded dynamically in production */}
                  <SelectItem value={branchId || 'default'}>Current Branch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateShift(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateShift}>Create Shift</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Staff Dialog */}
      <Dialog open={showAssignStaff} onOpenChange={setShowAssignStaff}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Assign Staff — {selectedShiftForAssign?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Staff Member</label>
              <Select
                value={newEntry.userId}
                onValueChange={(value) => setNewEntry({ ...newEntry, userId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.role.replace('_', ' ')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Handoff Notes (optional)</label>
              <Textarea
                placeholder="Notes for the next shift..."
                value={newEntry.notes}
                onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignStaff(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignStaff}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
