'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { useBranchChange } from '@/hooks/use-branch-change';
import { formatCents, toCents, fromCents } from '@/lib/money';
import {
  RotateCcw,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Filter,
  Search,
  CreditCard,
  Calendar,
  Clock,
  Receipt,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================
// Types
// ============================================================

type RefundStatus = 'pending' | 'approved' | 'rejected' | 'processed';

interface PaymentData {
  id: string;
  amountCents: number;
  method: string;
  provider: string;
  status: string;
  reference: string | null;
  orderId: string;
  paidAt: string | null;
  order: {
    id: string;
    orderNumber: string;
    totalAmountCents: number;
    status: string;
  } | null;
}

interface RefundData {
  id: string;
  paymentId: string;
  restaurantId: string;
  amountCents: number;
  reason: string;
  status: RefundStatus;
  processedBy: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
  payment: PaymentData;
}

// ============================================================
// Config
// ============================================================

const statusConfig: Record<RefundStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: {
    label: 'Pending',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: Clock,
  },
  approved: {
    label: 'Approved',
    color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    icon: XCircle,
  },
  processed: {
    label: 'Processed',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    icon: RotateCcw,
  },
};

const methodLabels: Record<string, string> = {
  telebirr: 'Telebirr',
  chapa: 'Chapa',
  cbe_birr: 'CBE Birr',
  cash: 'Cash',
};

// ============================================================
// Component
// ============================================================

export function RefundsView() {
  const { user, selectedBranchId, branchChangeVersion } = useAppStore();
  const restaurantId = user?.restaurantId || '';

  const [refunds, setRefunds] = useState<RefundData[]>([]);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [actionTarget, setActionTarget] = useState<RefundData | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'process' | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchDataRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const handleBranchChange = useCallback((newBranchId: string) => {
    console.log('[RefundsView] handleBranchChange called with:', newBranchId);
    setLoading(true);
    setRefunds([]);
    setPayments([]);
    fetchDataRef.current?.();
  }, []);

  useBranchChange(handleBranchChange);

  // Filters
  const [filterStatus, setFilterStatus] = useState<RefundStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formPaymentId, setFormPaymentId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formReason, setFormReason] = useState('');

  const resetForm = useCallback(() => {
    setFormPaymentId('');
    setFormAmount('');
    setFormReason('');
  }, []);

  const fetchData = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const branchId = useAppStore.getState().selectedBranchId;
      const refundsParams: Record<string, string> = {};
      const paymentsParams: Record<string, string> = { status: 'completed' };
      if (branchId) {
        refundsParams.branchId = branchId;
        paymentsParams.branchId = branchId;
      }

      const [refundsRes, paymentsRes] = await Promise.all([
        api.get<{ data: RefundData[]; pagination?: { total: number } }>(
          `/api/restaurants/${restaurantId}/refunds`,
          refundsParams
        ),
        api.get<{ data: PaymentData[] }>(
          `/api/restaurants/${restaurantId}/payments`,
          paymentsParams
        ),
      ]);

      setRefunds(refundsRes.data || []);
      setPayments(paymentsRes.data || []);
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchDataRef.current = fetchData; }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData, selectedBranchId, branchChangeVersion]);

  // Reset loading state when branch changes
  useEffect(() => {
    if (selectedBranchId !== undefined) {
      setLoading(true);
    }
  }, [selectedBranchId]);

  // Filtered payments that don't already have a refund
  const refundPaymentIds = new Set(refunds.map((r) => r.paymentId));
  const availablePayments = payments.filter((p) => !refundPaymentIds.has(p.id));

  // Filtered refunds
  const filtered = refunds.filter((r) => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.reason.toLowerCase().includes(q) ||
        r.payment?.order?.orderNumber?.toLowerCase().includes(q) ||
        r.payment?.reference?.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Stats
  const pendingCount = refunds.filter((r) => r.status === 'pending').length;
  const approvedCount = refunds.filter((r) => r.status === 'approved').length;
  const processedCount = refunds.filter((r) => r.status === 'processed').length;
  const totalRefundAmountCents = refunds
    .filter((r) => r.status === 'processed')
    .reduce((sum, r) => sum + r.amountCents, 0);

  // Create refund
  const handleCreate = async () => {
    if (!formPaymentId) {
      toast.error('Please select a payment');
      return;
    }
    if (!formAmount || parseFloat(formAmount) <= 0) {
      toast.error('Refund amount must be greater than 0');
      return;
    }
    if (!formReason.trim()) {
      toast.error('Reason is required');
      return;
    }

    const selectedPayment = payments.find((p) => p.id === formPaymentId);
    if (selectedPayment && toCents(parseFloat(formAmount)) > selectedPayment.amountCents) {
      toast.error('Refund amount cannot exceed payment amount');
      return;
    }

    try {
      setCreating(true);
      await api.post(`/api/restaurants/${restaurantId}/refunds`, {
        paymentId: formPaymentId,
        amountCents: toCents(parseFloat(formAmount)),
        reason: formReason.trim(),
        ...(useAppStore.getState().selectedBranchId ? { branchId: useAppStore.getState().selectedBranchId } : {}),
      });
      toast.success('Refund request created successfully');
      setIsCreateOpen(false);
      resetForm();
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create refund';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  // Approve/reject/process refund
  const handleAction = async () => {
    if (!actionTarget || !actionType) return;

    try {
      setProcessingId(actionTarget.id);

      if (actionType === 'approve' || actionType === 'reject') {
        await api.put(`/api/restaurants/${restaurantId}/refunds/${actionTarget.id}`, {
          status: actionType === 'approve' ? 'approved' : 'rejected',
        });
        toast.success(
          actionType === 'approve'
            ? 'Refund approved successfully'
            : 'Refund rejected'
        );
      } else if (actionType === 'process') {
        await api.post(`/api/restaurants/${restaurantId}/refunds/${actionTarget.id}`);
        toast.success('Refund processed successfully');
      }

      setActionTarget(null);
      setActionType(null);
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      toast.error(msg);
    } finally {
      setProcessingId(null);
    }
  };

  // When selecting a payment, auto-fill the amount
  const handlePaymentSelect = (paymentId: string) => {
    setFormPaymentId(paymentId);
    const selectedPayment = payments.find((p) => p.id === paymentId);
    if (selectedPayment) {
      setFormAmount(fromCents(selectedPayment.amountCents).toString());
    }
  };

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <span className="ml-2 text-muted-foreground">Loading refunds...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
            <p className="text-[11px] text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-sky-600">{approvedCount}</p>
            <p className="text-[11px] text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{processedCount}</p>
            <p className="text-[11px] text-muted-foreground">Processed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{formatCents(totalRefundAmountCents)}</p>
            <p className="text-[11px] text-muted-foreground">Total Refunded</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:flex-none sm:w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search refunds..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
          {/* Status filter */}
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as RefundStatus | 'all')}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <Filter className="h-3.5 w-3.5 mr-1" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {(Object.entries(statusConfig) as [RefundStatus, typeof statusConfig[RefundStatus]][]).map(
                ([status, config]) => (
                  <SelectItem key={status} value={status}>
                    {config.label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
        <Button className="gap-1.5 shrink-0" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New Refund
        </Button>
      </div>

      {/* Refunds List */}
      {filtered.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((refund) => {
            const sConfig = statusConfig[refund.status];
            const StatusIcon = sConfig.icon;
            const isProcessing = processingId === refund.id;

            return (
              <Card key={refund.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  {/* Top Row: Icon + Order Info + Status */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${
                        refund.status === 'processed'
                          ? 'bg-emerald-500/10'
                          : refund.status === 'approved'
                          ? 'bg-sky-500/10'
                          : refund.status === 'pending'
                          ? 'bg-yellow-500/10'
                          : 'bg-red-500/10'
                      }`}
                    >
                      <StatusIcon
                        className={`h-5 w-5 ${
                          refund.status === 'processed'
                            ? 'text-emerald-600'
                            : refund.status === 'approved'
                            ? 'text-sky-600'
                            : refund.status === 'pending'
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {refund.payment?.order?.orderNumber || '—'}
                        </span>
                        <Badge className={`text-[10px] border-0 ${sConfig.color}`}>
                          {sConfig.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <CreditCard className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {methodLabels[refund.payment?.method] || refund.payment?.method || '—'}
                        </span>
                        {refund.payment?.reference && (
                          <>
                            <span className="text-[10px] text-muted-foreground">·</span>
                            <code className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">
                              {refund.payment.reference}
                            </code>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Refund Amount */}
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-xl font-bold text-primary">
                      {formatCents(refund.amountCents)}
                    </span>
                    <span className="text-xs text-muted-foreground">refund</span>
                    <span className="text-[10px] text-muted-foreground ml-1">
                      (of {formatCents(refund.payment?.amountCents || 0)})
                    </span>
                  </div>

                  {/* Reason */}
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                    {refund.reason}
                  </p>

                  {/* Dates */}
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>Requested: {formatDate(refund.createdAt)}</span>
                    </div>
                    {refund.processedAt && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {refund.status === 'rejected' ? 'Rejected' : refund.status === 'processed' ? 'Processed' : 'Reviewed'}: {formatDate(refund.processedAt)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex items-center justify-between border-t pt-3">
                    {refund.status === 'pending' && (
                      <div className="flex items-center gap-2 w-full">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] gap-1 flex-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                          onClick={() => {
                            setActionTarget(refund);
                            setActionType('approve');
                          }}
                          disabled={isProcessing}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] gap-1 flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
                          onClick={() => {
                            setActionTarget(refund);
                            setActionType('reject');
                          }}
                          disabled={isProcessing}
                        >
                          <XCircle className="h-3 w-3" />
                          Reject
                        </Button>
                      </div>
                    )}
                    {refund.status === 'approved' && (
                      <Button
                        size="sm"
                        className="h-7 text-[11px] gap-1 w-full bg-sky-600 hover:bg-sky-700 text-white"
                        onClick={() => {
                          setActionTarget(refund);
                          setActionType('process');
                        }}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ArrowRight className="h-3 w-3" />
                        )}
                        Process Refund
                      </Button>
                    )}
                    {refund.status === 'processed' && (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Refund Complete
                      </div>
                    )}
                    {refund.status === 'rejected' && (
                      <div className="flex items-center gap-1.5 text-[11px] text-red-600">
                        <XCircle className="h-3 w-3" />
                        Refund Rejected
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : refunds.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <RotateCcw className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No refunds yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Initiate a refund for a completed payment
            </p>
            <Button className="mt-4" size="sm" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Refund
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Filter className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No refunds match your filters</p>
            <Button
              variant="outline"
              className="mt-4"
              size="sm"
              onClick={() => {
                setFilterStatus('all');
                setSearchQuery('');
              }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Refund Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" />
              Initiate Refund
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Payment Select */}
            <div className="space-y-2">
              <Label>Select Payment *</Label>
              {availablePayments.length > 0 ? (
                <Select value={formPaymentId} onValueChange={handlePaymentSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a completed payment..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePayments.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{p.order?.orderNumber || '—'}</span>
                          <span className="text-muted-foreground">·</span>
                          <span>{formatCents(p.amountCents)}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">
                            {methodLabels[p.method] || p.method}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-center">
                  <AlertTriangle className="h-5 w-5 text-muted-foreground/40 mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">
                    No completed payments available for refund
                  </p>
                </div>
              )}
            </div>

            {/* Selected Payment Info */}
            {formPaymentId && (() => {
              const selectedPayment = payments.find((p) => p.id === formPaymentId);
              if (!selectedPayment) return null;
              return (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Payment Amount</span>
                    <span className="font-medium">{formatCents(selectedPayment.amountCents)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Method</span>
                    <span className="font-medium">{methodLabels[selectedPayment.method] || selectedPayment.method}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Order</span>
                    <span className="font-medium">{selectedPayment.order?.orderNumber || '—'}</span>
                  </div>
                  {selectedPayment.reference && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Reference</span>
                      <code className="font-mono text-[10px]">{selectedPayment.reference}</code>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Refund Amount */}
            <div className="space-y-2">
              <Label htmlFor="refundAmount">Refund Amount (ETB) *</Label>
              <Input
                id="refundAmount"
                type="number"
                min="0.01"
                step="0.01"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="Enter refund amount"
              />
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="refundReason">Reason *</Label>
              <Textarea
                id="refundReason"
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                placeholder="Describe the reason for this refund..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating || !formPaymentId || availablePayments.length === 0}>
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              Initiate Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <AlertDialog
        open={!!actionTarget && !!actionType}
        onOpenChange={(open) => {
          if (!open) {
            setActionTarget(null);
            setActionType(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'approve' && 'Approve Refund'}
              {actionType === 'reject' && 'Reject Refund'}
              {actionType === 'process' && 'Process Refund'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'approve' && (
                <>
                  Are you sure you want to approve the refund of{' '}
                  <strong>{actionTarget ? formatCents(actionTarget.amountCents) : ''}</strong> for order{' '}
                  <strong>{actionTarget?.payment?.order?.orderNumber || '—'}</strong>?
                  This will allow the refund to be processed.
                </>
              )}
              {actionType === 'reject' && (
                <>
                  Are you sure you want to reject the refund of{' '}
                  <strong>{actionTarget ? formatCents(actionTarget.amountCents) : ''}</strong> for order{' '}
                  <strong>{actionTarget?.payment?.order?.orderNumber || '—'}</strong>?
                  This action cannot be undone.
                </>
              )}
              {actionType === 'process' && (
                <>
                  Are you sure you want to process the refund of{' '}
                  <strong>{actionTarget ? formatCents(actionTarget.amountCents) : ''}</strong> for order{' '}
                  <strong>{actionTarget?.payment?.order?.orderNumber || '—'}</strong>?
                  This will initiate the refund with the payment provider{' '}
                  <strong>{methodLabels[actionTarget?.payment?.method || ''] || '—'}</strong> and cannot be reversed.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              className={
                actionType === 'reject'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : actionType === 'process'
                  ? 'bg-sky-600 text-white hover:bg-sky-700'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }
            >
              {actionType === 'approve' && 'Approve'}
              {actionType === 'reject' && 'Reject'}
              {actionType === 'process' && 'Process Refund'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
