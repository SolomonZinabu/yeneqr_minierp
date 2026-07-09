'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAppStore } from '@/lib/store';
import { api, formatCurrency } from '@/lib/api-client';
import { useBranchChange } from '@/hooks/use-branch-change';
import {
  CalendarDays,
  List,
  Plus,
  Clock,
  User,
  Phone,
  Mail,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Calendar,
  MoreHorizontal,
  StickyNote,
  TableProperties,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ─── Types ──────────────────────────────────────────────────

type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

interface ReservationData {
  id: string;
  restaurantId: string;
  branchId: string;
  tableId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  partySize: number;
  reservedDate: string;
  reservedTime: string;
  duration: number;
  status: ReservationStatus;
  specialRequests: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  table?: { id: string; number: string; capacity: number; status: string } | null;
  branch?: { id: string; name: string } | null;
}

const statusConfig: Record<ReservationStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', icon: Clock },
  confirmed: { label: 'Confirmed', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', icon: XCircle },
  completed: { label: 'Completed', color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', icon: CheckCircle2 },
  no_show: { label: 'No Show', color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', icon: AlertTriangle },
};

// ─── Create Reservation Dialog ──────────────────────────────

function CreateReservationDialog({
  open,
  onClose,
  restaurantId,
  branchId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  branchId: string;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    partySize: 2,
    reservedDate: new Date().toISOString().split('T')[0],
    reservedTime: '18:00',
    duration: 120,
    tableId: '',
    specialRequests: '',
    notes: '',
  });

  useEffect(() => {
    if (open) {
      setForm({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        partySize: 2,
        reservedDate: new Date().toISOString().split('T')[0],
        reservedTime: '18:00',
        duration: 120,
        tableId: '',
        specialRequests: '',
        notes: '',
      });
    }
  }, [open]);

  // Get tables for current branch from API
  const [tables, setTables] = useState<{id: string; number: string; capacity: number; status: string}[]>([]);
  useEffect(() => {
    if (!branchId || !restaurantId) return;
    api.get<{data: {id: string; number: string; capacity: number; status: string; floor?: {tables: {id: string; number: string; capacity: number; status: string}[]}[]}[]}>(`/api/restaurants/${restaurantId}/tables`, { branchId })
      .then(res => {
        const tableList = Array.isArray(res) ? res : (res.data || []);
        setTables(Array.isArray(tableList) ? tableList : []);
      })
      .catch(() => setTables([]));
  }, [branchId, restaurantId]);
  const availableTables = tables.filter(t => t.status === 'available' || t.status === 'reserved');

  const handleSubmit = async () => {
    if (!form.customerName.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (!form.customerPhone.trim()) {
      toast.error('Customer phone is required');
      return;
    }
    if (form.partySize < 1) {
      toast.error('Party size must be at least 1');
      return;
    }

    try {
      setSaving(true);
      const res = await api.post(`/api/restaurants/${restaurantId}/reservations`, {
        branchId,
        tableId: form.tableId || undefined,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail || undefined,
        partySize: form.partySize,
        reservedDate: form.reservedDate,
        reservedTime: form.reservedTime,
        duration: form.duration,
        specialRequests: form.specialRequests || undefined,
        notes: form.notes || undefined,
      });
      if (res) {
        toast.success('Reservation created successfully');
        onCreated();
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create reservation';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            New Reservation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer Info */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Customer Information</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Name *</Label>
                <Input
                  value={form.customerName}
                  onChange={(e) => setForm(f => ({ ...f, customerName: e.target.value }))}
                  placeholder="Customer name"
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Phone *</Label>
                <Input
                  value={form.customerPhone}
                  onChange={(e) => setForm(f => ({ ...f, customerPhone: e.target.value }))}
                  placeholder="+251-..."
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input
                  type="email"
                  value={form.customerEmail}
                  onChange={(e) => setForm(f => ({ ...f, customerEmail: e.target.value }))}
                  placeholder="email@example.com"
                  className="h-9"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Reservation Details */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Reservation Details</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Party Size *</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.partySize}
                  onChange={(e) => setForm(f => ({ ...f, partySize: parseInt(e.target.value) || 1 }))}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Duration (min)</Label>
                <Select value={String(form.duration)} onValueChange={(v) => setForm(f => ({ ...f, duration: parseInt(v) }))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="180">3 hours</SelectItem>
                    <SelectItem value="240">4 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Date *</Label>
                <Input
                  type="date"
                  value={form.reservedDate}
                  onChange={(e) => setForm(f => ({ ...f, reservedDate: e.target.value }))}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Time *</Label>
                <Input
                  type="time"
                  value={form.reservedTime}
                  onChange={(e) => setForm(f => ({ ...f, reservedTime: e.target.value }))}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Table Assignment */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Table Assignment</Label>
            <Select value={form.tableId} onValueChange={(v) => setForm(f => ({ ...f, tableId: v === 'none' ? '' : v }))}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Assign a table (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No table assigned</SelectItem>
                {availableTables.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    Table {t.number} (Capacity: {t.capacity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Notes */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Additional</Label>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Special Requests</Label>
                <Textarea
                  value={form.specialRequests}
                  onChange={(e) => setForm(f => ({ ...f, specialRequests: e.target.value }))}
                  placeholder="e.g., High chair needed, window seat..."
                  className="h-16 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Internal Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Staff-only notes..."
                  className="h-16 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarDays className="h-4 w-4 mr-2" />}
            Create Reservation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reservation Detail Sheet ───────────────────────────────

function ReservationDetailSheet({
  reservation,
  open,
  onClose,
  restaurantId,
  onUpdated,
}: {
  reservation: ReservationData | null;
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  onUpdated: () => void;
}) {
  const [updating, setUpdating] = useState(false);
  const [assignTableId, setAssignTableId] = useState('');
  // Fetch tables for the reservation's branch — hooks must be before any early return
  const [tables, setTables] = useState<{id: string; number: string; capacity: number; status: string}[]>([]);
  useEffect(() => {
    if (!reservation?.branchId || !restaurantId) return;
    api.get<{data: {id: string; number: string; capacity: number; status: string}[]}>(`/api/restaurants/${restaurantId}/tables`, { branchId: reservation.branchId })
      .then(res => {
        const tableList = Array.isArray(res) ? res : (res.data || []);
        setTables(Array.isArray(tableList) ? tableList : []);
      })
      .catch(() => setTables([]));
  }, [reservation?.branchId, restaurantId]);

  if (!reservation) return null;

  const config = statusConfig[reservation.status];

  const handleStatusUpdate = async (newStatus: ReservationStatus) => {
    try {
      setUpdating(true);
      await api.put(`/api/restaurants/${restaurantId}/reservations/${reservation.id}`, {
        status: newStatus,
      });
      toast.success(`Reservation ${config.label} → ${statusConfig[newStatus].label}`);
      onUpdated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update';
      toast.error(msg);
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignTable = async () => {
    if (!assignTableId) return;
    try {
      setUpdating(true);
      await api.put(`/api/restaurants/${restaurantId}/reservations/${reservation.id}`, {
        tableId: assignTableId,
        status: 'confirmed',
      });
      toast.success('Table assigned and reservation confirmed');
      onUpdated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to assign table';
      toast.error(msg);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span>Reservation — {reservation.customerName}</span>
            <Badge className={`${config.bgColor} ${config.color} border-0`}>
              <config.icon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Customer Details */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Customer</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{reservation.customerName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{reservation.customerPhone}</span>
              </div>
              {reservation.customerEmail && (
                <div className="col-span-2 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{reservation.customerEmail}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Reservation Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Details</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="text-sm font-medium">
                  {new Date(reservation.reservedDate).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Time</p>
                <p className="text-sm font-medium">{reservation.reservedTime}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Party Size</p>
                <p className="text-sm font-medium flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {reservation.partySize} {reservation.partySize === 1 ? 'guest' : 'guests'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="text-sm font-medium">{reservation.duration} min</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Table</p>
                <p className="text-sm font-medium">
                  {reservation.table ? `Table ${reservation.table.number}` : 'Not assigned'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Branch</p>
                <p className="text-sm font-medium">{reservation.branch?.name || '—'}</p>
              </div>
            </div>
          </div>

          {reservation.specialRequests && (
            <>
              <Separator />
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-3">
                <p className="text-xs font-medium text-yellow-800 dark:text-yellow-400">Special Requests</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">{reservation.specialRequests}</p>
              </div>
            </>
          )}

          {reservation.notes && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <StickyNote className="h-3 w-3" />
                Internal Notes
              </p>
              <p className="text-sm mt-1">{reservation.notes}</p>
            </div>
          )}

          <Separator />

          {/* Table Assignment (if no table assigned) */}
          {!reservation.tableId && (reservation.status === 'pending' || reservation.status === 'confirmed') && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <TableProperties className="h-4 w-4" />
                Assign Table
              </h4>
              <div className="flex gap-2">
                <Select value={assignTableId} onValueChange={setAssignTableId}>
                  <SelectTrigger className="h-9 flex-1">
                    <SelectValue placeholder="Select a table" />
                  </SelectTrigger>
                  <SelectContent>
                    {tables
                      .filter(t => t.capacity >= reservation.partySize)
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          Table {t.number} (Cap: {t.capacity})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleAssignTable} disabled={!assignTableId || updating}>
                  {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Assign'}
                </Button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            {reservation.status === 'pending' && (
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => handleStatusUpdate('confirmed')}
                  disabled={updating}
                >
                  {updating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Confirm
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleStatusUpdate('cancelled')}
                  disabled={updating}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            )}
            {reservation.status === 'confirmed' && (
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => handleStatusUpdate('completed')}
                  disabled={updating}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Complete
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleStatusUpdate('no_show')}
                  disabled={updating}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  No Show
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleStatusUpdate('cancelled')}
                  disabled={updating}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Calendar Day Cell ──────────────────────────────────────

function CalendarDay({
  date,
  reservations,
  isSelected,
  onClick,
}: {
  date: Date | null;
  reservations: ReservationData[];
  isSelected: boolean;
  onClick: () => void;
}) {
  if (!date) {
    return <div className="h-20 lg:h-24" />;
  }

  const isToday = new Date().toDateString() === date.toDateString();
  const dayReservations = reservations;

  return (
    <button
      onClick={onClick}
      className={`h-20 lg:h-24 rounded-lg border p-1.5 text-left transition-all relative ${
        isSelected
          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
          : 'border-border hover:border-primary/30 hover:bg-muted/50'
      } ${isToday ? 'ring-1 ring-primary/40' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
          {date.getDate()}
        </span>
        {dayReservations.length > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
            {dayReservations.length}
          </span>
        )}
      </div>
      <div className="mt-1 space-y-0.5 overflow-hidden">
        {dayReservations.slice(0, 2).map((r) => {
          const config = statusConfig[r.status];
          return (
            <div
              key={r.id}
              className={`truncate rounded px-1 py-0.5 text-[9px] ${config.bgColor} ${config.color}`}
            >
              {r.reservedTime} {r.customerName}
            </div>
          );
        })}
        {dayReservations.length > 2 && (
          <p className="text-[9px] text-muted-foreground">+{dayReservations.length - 2} more</p>
        )}
      </div>
    </button>
  );
}

// ─── Main Reservations View ─────────────────────────────────

export function ReservationsView() {
  const { user, selectedBranchId, branchChangeVersion } = useAppStore();
  const restaurantId = user?.restaurantId || '';

  const [reservations, setReservations] = useState<ReservationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [pagination, setPagination] = useState<{ page: number; totalPages: number; total: number }>({ page: 1, totalPages: 1, total: 0 });
  const [currentPage, setCurrentPage] = useState(1);

  const fetchReservationsRef = useRef<((page?: number) => Promise<void>) | undefined>(undefined);

  const handleBranchChange = useCallback((newBranchId: string) => {
    console.log('[ReservationsView] handleBranchChange called with:', newBranchId);
    setLoading(true);
    setReservations([]);
    fetchReservationsRef.current?.(1);
  }, []);

  useBranchChange(handleBranchChange);

  const fetchReservations = useCallback(async (page: number = 1) => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    try {
      const branchId = useAppStore.getState().selectedBranchId;
      const params: Record<string, string> = { page: String(page), limit: '50' };
      if (branchId) params.branchId = branchId;
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await api.get<{ data: ReservationData[]; pagination: { page: number; totalPages: number; total: number } }>(`/api/restaurants/${restaurantId}/reservations`, params);
      const newReservations = res.data || [];
      if (page > 1) {
        // Append for "load more"
        setReservations(prev => [...prev, ...newReservations]);
      } else {
        setReservations(newReservations);
      }
      setPagination(res.pagination || { page, totalPages: 1, total: 0 });
      setCurrentPage(page);
    } catch (err) {
      // Silently handle — show empty state instead of crashing
      setReservations([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, statusFilter]);

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchReservationsRef.current = fetchReservations; }, [fetchReservations]);

  useEffect(() => {
    fetchReservations(1);
  }, [restaurantId, selectedBranchId, statusFilter, branchChangeVersion]);

  const selectedReservation = reservations.find(r => r.id === selectedReservationId) || null;

  // Filtered reservations
  const filteredReservations = statusFilter === 'all'
    ? reservations
    : reservations.filter(r => r.status === statusFilter);

  // Get reservations for a specific date
  const getReservationsForDate = (date: Date) => {
    const dateStr = date.toDateString();
    return reservations.filter(r => new Date(r.reservedDate).toDateString() === dateStr);
  };

  // Calendar helpers
  const getCalendarDays = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay(); // 0=Sun
    const totalDays = lastDay.getDate();

    const days: (Date | null)[] = [];
    // Padding for days before the first
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }
    // Actual days
    for (let d = 1; d <= totalDays; d++) {
      days.push(new Date(year, month, d));
    }
    // Padding to fill the last week
    while (days.length % 7 !== 0) {
      days.push(null);
    }
    return days;
  };

  const calendarDays = getCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const statusTabs = [
    { value: 'all', label: 'All', count: reservations.length },
    { value: 'pending', label: 'Pending', count: reservations.filter(r => r.status === 'pending').length },
    { value: 'confirmed', label: 'Confirmed', count: reservations.filter(r => r.status === 'confirmed').length },
    { value: 'completed', label: 'Completed', count: reservations.filter(r => r.status === 'completed').length },
    { value: 'cancelled', label: 'Cancelled', count: reservations.filter(r => r.status === 'cancelled').length },
    { value: 'no_show', label: 'No Show', count: reservations.filter(r => r.status === 'no_show').length },
  ] as const;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <span className="ml-2 text-muted-foreground">Loading reservations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border bg-muted/50 p-0.5">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setViewMode('list')}
            >
              <List className="h-3.5 w-3.5" />
              List
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setViewMode('calendar')}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Calendar
            </Button>
          </div>

          <Button variant="outline" size="sm" className="gap-1" onClick={() => fetchReservations(1)}>
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
        </div>

        <Button size="sm" className="gap-1" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-3.5 w-3.5" />
          New Reservation
        </Button>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <Card>
          <CardContent className="p-4">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="text-sm font-semibold">
                {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Week Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {weekDays.map(day => (
                <div key={day} className="text-center text-[11px] font-medium text-muted-foreground py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date, idx) => (
                <CalendarDay
                  key={date ? date.toISOString() : `pad-${idx}`}
                  date={date}
                  reservations={date ? getReservationsForDate(date) : []}
                  isSelected={date ? date.toDateString() === selectedDate.toDateString() : false}
                  onClick={() => {
                    if (date) {
                      setSelectedDate(date);
                      setViewMode('list');
                      // Show all reservations for this date
                    }
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as ReservationStatus | 'all')}>
          <TabsList className="h-9 w-full sm:w-auto flex-wrap">
            {statusTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs h-7 gap-1.5">
                {tab.label}
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">{tab.count}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={statusFilter} className="mt-4">
            <div className="space-y-3">
              {filteredReservations.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <CalendarDays className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-sm text-muted-foreground">No reservations found</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 gap-1"
                      onClick={() => setShowCreateDialog(true)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create Reservation
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                filteredReservations.map((reservation) => {
                  const config = statusConfig[reservation.status];
                  return (
                    <Card
                      key={reservation.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedReservationId(reservation.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.bgColor}`}>
                              <config.icon className={`h-5 w-5 ${config.color}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">{reservation.customerName}</span>
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-0 ${config.bgColor} ${config.color}`}>
                                  {config.label}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {new Date(reservation.reservedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {reservation.reservedTime} · {reservation.partySize} guests
                                {reservation.table ? ` · Table ${reservation.table.number}` : ' · No table'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right hidden sm:block">
                              <p className="text-xs text-muted-foreground">{reservation.customerPhone}</p>
                              {reservation.specialRequests && (
                                <p className="text-[10px] text-muted-foreground truncate max-w-32">{reservation.specialRequests}</p>
                              )}
                            </div>
                            {/* Quick Actions */}
                            {(reservation.status === 'pending' || reservation.status === 'confirmed') && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {reservation.status === 'pending' && (
                                    <DropdownMenuItem
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                          await api.put(`/api/restaurants/${restaurantId}/reservations/${reservation.id}`, { status: 'confirmed' });
                                          toast.success('Reservation confirmed');
                                          fetchReservations();
                                        } catch { toast.error('Failed to confirm'); }
                                      }}
                                    >
                                      <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                                      Confirm
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        await api.put(`/api/restaurants/${restaurantId}/reservations/${reservation.id}`, { status: 'cancelled' });
                                        toast.success('Reservation cancelled');
                                        fetchReservations(1);
                                      } catch { toast.error('Failed to cancel'); }
                                    }}
                                    className="text-destructive"
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Cancel
                                  </DropdownMenuItem>
                                  {reservation.status === 'confirmed' && (
                                    <DropdownMenuItem
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                          await api.put(`/api/restaurants/${restaurantId}/reservations/${reservation.id}`, { status: 'no_show' });
                                          toast.success('Marked as no-show');
                                          fetchReservations(1);
                                        } catch { toast.error('Failed to update'); }
                                      }}
                                    >
                                      <AlertTriangle className="mr-2 h-4 w-4 text-orange-600" />
                                      No Show
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            {/* Load More Button */}
            {currentPage < pagination.totalPages && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => fetchReservations(currentPage + 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                  Load More ({pagination.total - reservations.length} remaining)
                </Button>
              </div>
            )}

            {/* Total Count */}
            {pagination.total > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                Showing {reservations.length} of {pagination.total} reservations
              </p>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Reservation Detail Sheet */}
      <ReservationDetailSheet
        reservation={selectedReservation}
        open={!!selectedReservationId}
        onClose={() => setSelectedReservationId(null)}
        restaurantId={restaurantId}
        onUpdated={() => fetchReservations(1)}
      />

      {/* Create Reservation Dialog */}
      <CreateReservationDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        restaurantId={restaurantId}
        branchId={selectedBranchId}
        onCreated={() => fetchReservations(1)}
      />
    </div>
  );
}
