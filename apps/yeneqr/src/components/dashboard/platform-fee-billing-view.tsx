'use client';

// ============================================================
// Yene QR — Platform Fee Billing View
// ============================================================
// Shows restaurant owners their per-transaction platform fee
// ledger, invoices, and summary. Owners can:
//   - View unbilled transactions (each payment's fee)
//   - Generate an invoice from unbilled entries
//   - Mark an invoice as paid / cancel it
//   - View invoice details (period, total, transaction count)
//   - See a summary: unbilled, total fees, paid, outstanding
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { formatCents } from '@/lib/money';
import {
  ReceiptText, Loader2, TrendingUp, Wallet, Clock, CheckCircle2,
  FileText, Plus, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────

interface LedgerEntry {
  id: string;
  paymentId: string;
  orderId: string;
  branchId: string | null;
  transactionAmountCents: number;
  feeRate: number;
  feeAmountCents: number;
  status: string;
  createdAt: string;
}

interface PlatformFeeInvoice {
  id: string;
  invoiceNumber: string;
  restaurantId: string;
  periodStart: string;
  periodEnd: string;
  totalFeeCents: number;
  totalFeeAmount: number;
  transactionCount: number;
  entryCount?: number;
  status: string;
  dueDate: string;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
}

interface BillingSummary {
  unbilledCents: number;
  unbilledAmount: number;
  unbilledCount: number;
  totalFeesAllTimeCents: number;
  totalPaidCents: number;
  outstandingCents: number;
}

interface BillingData {
  summary: BillingSummary;
  unbilledEntries: LedgerEntry[];
  invoices: PlatformFeeInvoice[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ─── Status helpers ─────────────────────────────────────────

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  paid: { label: 'Paid', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400', icon: AlertCircle },
  unbilled: { label: 'Unbilled', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock },
  invoiced: { label: 'Invoiced', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: FileText },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Component ──────────────────────────────────────────────

export function PlatformFeeBillingView() {
  const { user } = useAppStore();
  const restaurantId = user?.restaurantId || '';

  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [markPaidTarget, setMarkPaidTarget] = useState<PlatformFeeInvoice | null>(null);
  const [detailTarget, setDetailTarget] = useState<PlatformFeeInvoice | null>(null);
  const [generating, setGenerating] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  // Restaurant fee rate for the "contact us" banner
  const [currentFeeRate, setCurrentFeeRate] = useState<number>(3.0);

  // Generate invoice form state
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [dueInDays, setDueInDays] = useState('30');

  const fetchBilling = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const res = await api.get<{ data: BillingData }>(`/api/restaurants/${restaurantId}/billing`);
      setData(res.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch billing data';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  // Fetch the restaurant's fee rate for the banner
  useEffect(() => {
    if (!restaurantId) return;
    (async () => {
      try {
        const res = await api.get<{ data: { feeRatePercent: number } }>(`/api/restaurants/${restaurantId}/settings/starpay`);
        setCurrentFeeRate(res.data?.feeRatePercent ?? 3.0);
      } catch {
        // Non-critical — banner just won't show
      }
    })();
  }, [restaurantId]);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.post(`/api/restaurants/${restaurantId}/billing`, {
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
        dueInDays: parseInt(dueInDays, 10) || 30,
      });
      toast.success('Invoice generated from unbilled transactions');
      setGenerateOpen(false);
      setPeriodStart('');
      setPeriodEnd('');
      setDueInDays('30');
      fetchBilling();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate invoice';
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!markPaidTarget) return;
    setMarkingPaid(true);
    try {
      await api.patch(`/api/restaurants/${restaurantId}/billing/${markPaidTarget.id}`, {
        status: 'paid',
      });
      toast.success(`Invoice ${markPaidTarget.invoiceNumber} marked as paid`);
      setMarkPaidTarget(null);
      fetchBilling();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to mark invoice as paid';
      toast.error(msg);
    } finally {
      setMarkingPaid(false);
    }
  };

  const handleCancelInvoice = async (invoice: PlatformFeeInvoice) => {
    try {
      await api.patch(`/api/restaurants/${restaurantId}/billing/${invoice.id}`, {
        status: 'cancelled',
      });
      toast.success(`Invoice ${invoice.invoiceNumber} cancelled`);
      fetchBilling();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel invoice';
      toast.error(msg);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <span className="ml-2 text-muted-foreground">Loading billing data...</span>
      </div>
    );
  }

  const summary = data?.summary;
  const unbilledEntries = data?.unbilledEntries || [];
  const invoices = data?.invoices || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ReceiptText className="h-6 w-6 text-primary" />
            Platform Billing
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Per-transaction platform fees, billed monthly via invoice
          </p>
        </div>
        {unbilledEntries.length > 0 && (
          <Button onClick={() => setGenerateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Generate Invoice
          </Button>
        )}
      </div>

      {/* Fee Rate Info Banner — shows the restaurant's current fee rate */}
      <div className="rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-300 dark:border-blue-800 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 shrink-0">
            <TrendingUp className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              Your transaction fee rate: {currentFeeRate.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              You pay <strong>{currentFeeRate.toFixed(1)} ETB per 100 ETB</strong> of transactions,
              billed monthly via invoice. Contact us to negotiate a lower rate based on your volume.
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Clock className="h-5 w-5 text-blue-500" />
                <Badge className="text-[10px] bg-blue-100 text-blue-800">{summary.unbilledCount} txns</Badge>
              </div>
              <p className="text-2xl font-bold">{formatCents(summary.unbilledCents)}</p>
              <p className="text-xs text-muted-foreground mt-1">Unbilled Fees</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </div>
              <p className="text-2xl font-bold">{formatCents(summary.totalFeesAllTimeCents)}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Fees (All Time)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-emerald-600">{formatCents(summary.totalPaidCents)}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Paid</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Wallet className="h-5 w-5 text-orange-500" />
              </div>
              <p className="text-2xl font-bold text-orange-600">{formatCents(summary.outstandingCents)}</p>
              <p className="text-xs text-muted-foreground mt-1">Outstanding</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Unbilled Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Unbilled Transactions
            {unbilledEntries.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">{unbilledEntries.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {unbilledEntries.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              No unbilled transactions. New payments will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Order ID</th>
                    <th className="pb-2 pr-4 text-right">Transaction</th>
                    <th className="pb-2 pr-4 text-right">Fee Rate</th>
                    <th className="pb-2 text-right">Fee Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {unbilledEntries.slice(0, 50).map((entry) => (
                    <tr key={entry.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{entry.orderId.slice(-8)}</td>
                      <td className="py-2 pr-4 text-right">{formatCents(entry.transactionAmountCents)}</td>
                      <td className="py-2 pr-4 text-right text-xs">{(entry.feeRate * 100).toFixed(1)}%</td>
                      <td className="py-2 text-right font-semibold text-orange-600">{formatCents(entry.feeAmountCents)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2">
                    <td colSpan={4} className="pt-2 text-right text-xs text-muted-foreground">Total unbilled:</td>
                    <td className="pt-2 text-right font-bold text-orange-600">{formatCents(summary?.unbilledCents || 0)}</td>
                  </tr>
                </tfoot>
              </table>
              {unbilledEntries.length > 50 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Showing 50 of {unbilledEntries.length} transactions. Generate an invoice to bill them all.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Platform Fee Invoices
            {invoices.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">{invoices.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              No invoices yet. Click &ldquo;Generate Invoice&rdquo; to bill your unbilled transactions.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4">Invoice #</th>
                    <th className="pb-2 pr-4">Period</th>
                    <th className="pb-2 pr-4 text-right">Transactions</th>
                    <th className="pb-2 pr-4 text-right">Total Fee</th>
                    <th className="pb-2 pr-4">Due Date</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const sConfig = statusConfig[inv.status] || statusConfig.pending;
                    const SIcon = sConfig.icon;
                    return (
                      <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 pr-4 font-mono text-xs">
                          <button
                            onClick={() => setDetailTarget(inv)}
                            className="text-primary hover:underline"
                          >
                            {inv.invoiceNumber}
                          </button>
                        </td>
                        <td className="py-2 pr-4 text-xs">
                          {formatDate(inv.periodStart)} — {formatDate(inv.periodEnd)}
                        </td>
                        <td className="py-2 pr-4 text-right">{inv.transactionCount || inv.entryCount || 0}</td>
                        <td className="py-2 pr-4 text-right font-semibold">{formatCents(inv.totalFeeCents)}</td>
                        <td className="py-2 pr-4 text-xs">{formatDate(inv.dueDate)}</td>
                        <td className="py-2 pr-4">
                          <Badge className={`text-[10px] ${sConfig.color}`}>
                            <SIcon className="h-2.5 w-2.5 mr-1" />
                            {sConfig.label}
                          </Badge>
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {inv.status === 'pending' || inv.status === 'overdue' ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() => setMarkPaidTarget(inv)}
                                title="Mark as paid"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                Mark Paid
                              </Button>
                            ) : null}
                            {inv.status === 'pending' || inv.status === 'overdue' ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-muted-foreground hover:text-destructive"
                                onClick={() => handleCancelInvoice(inv)}
                                title="Cancel invoice"
                              >
                                Cancel
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Invoice Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Platform Fee Invoice</DialogTitle>
            <DialogDescription>
              This will create an invoice from all {unbilledEntries.length} unbilled transaction(s),
              totaling {formatCents(summary?.unbilledCents || 0)} in platform fees.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="period-start">Period Start (optional)</Label>
                <Input
                  id="period-start"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="period-end">Period End (optional)</Label>
                <Input
                  id="period-end"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="due-in-days">Payment Due (days)</Label>
              <Input
                id="due-in-days"
                type="number"
                value={dueInDays}
                onChange={(e) => setDueInDays(e.target.value)}
                min="1"
                max="90"
              />
              <p className="text-[11px] text-muted-foreground">
                Invoice will be due {dueInDays} days from today
              </p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transactions:</span>
                <span className="font-medium">{unbilledEntries.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Fee:</span>
                <span className="font-bold text-orange-600">{formatCents(summary?.unbilledCents || 0)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Generate Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Paid Confirmation */}
      <AlertDialog open={!!markPaidTarget} onOpenChange={(open) => !open && setMarkPaidTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Invoice as Paid?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark invoice <strong>{markPaidTarget?.invoiceNumber}</strong> as paid
              ({formatCents(markPaidTarget?.totalFeeCents || 0)}). All linked transaction fees
              will be marked as paid. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMarkPaid}
              disabled={markingPaid}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {markingPaid ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Mark as Paid
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invoice Detail Dialog */}
      <Dialog open={!!detailTarget} onOpenChange={(open) => !open && setDetailTarget(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Invoice {detailTarget?.invoiceNumber}
            </DialogTitle>
          </DialogHeader>
          {detailTarget && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Period</p>
                  <p className="font-medium">{formatDate(detailTarget.periodStart)} — {formatDate(detailTarget.periodEnd)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className={`text-[10px] ${(statusConfig[detailTarget.status] || statusConfig.pending).color}`}>
                    {(statusConfig[detailTarget.status] || statusConfig.pending).label}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <p className="font-medium">{formatDate(detailTarget.dueDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Transactions</p>
                  <p className="font-medium">{detailTarget.transactionCount || detailTarget.entryCount || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="font-medium">{formatDate(detailTarget.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Paid At</p>
                  <p className="font-medium">{detailTarget.paidAt ? formatDate(detailTarget.paidAt) : '—'}</p>
                </div>
              </div>
              <div className="rounded-lg bg-muted/30 p-4 flex items-center justify-between">
                <span className="text-sm font-medium">Total Fee Amount</span>
                <span className="text-2xl font-bold text-orange-600">{formatCents(detailTarget.totalFeeCents)}</span>
              </div>
              {detailTarget.notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{detailTarget.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailTarget(null)}>Close</Button>
            {(detailTarget?.status === 'pending' || detailTarget?.status === 'overdue') && (
              <Button
                onClick={() => { setMarkPaidTarget(detailTarget); setDetailTarget(null); }}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark as Paid
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
