'use client';

// ============================================================
// Yene QR — Invoices View
// ============================================================
// Lists subscription invoices for the restaurant, with summary
// cards, status filtering, and a detail dialog. Owners can mark
// pending invoices as paid or cancel them.
//
// BRANCH SCOPING NOTE (Phase 4.5 of multi-branch audit):
// Invoices are restaurant-level subscription billing records — they
// are NOT branch-scoped. A restaurant subscribes to a plan (Basic,
// Pro, Premium) and all branches share that subscription. This view
// intentionally does NOT use `useBranchChange` or pass `?branchId=`.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { formatCents } from '@/lib/money';
import {
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Download,
  Search,
  Plus,
  RefreshCw,
  Wallet,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================
// Types
// ============================================================

type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

interface PlanInfo {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  yearlyPriceCents: number | null;
}

interface InvoiceData {
  id: string;
  invoiceNumber: string;
  amountCents: number;
  taxCents: number;
  totalCents: number;
  status: InvoiceStatus;
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  subscription: {
    id: string;
    plan: PlanInfo;
  };
}

interface InvoiceSummary {
  count: number;
  totalCents: number;
  paidCents: number;
  pendingCents: number;
  overdueCents: number;
}

interface InvoicesResponse {
  data: InvoiceData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: InvoiceSummary;
}

// ============================================================
// Config
// ============================================================

const STATUS_CONFIG: Record<
  InvoiceStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType; color: string }
> = {
  pending: { label: 'Pending', variant: 'secondary', icon: Clock, color: 'text-amber-600' },
  paid: { label: 'Paid', variant: 'default', icon: CheckCircle2, color: 'text-emerald-600' },
  overdue: { label: 'Overdue', variant: 'destructive', icon: AlertTriangle, color: 'text-red-600' },
  cancelled: { label: 'Cancelled', variant: 'outline', icon: XCircle, color: 'text-muted-foreground' },
};

function isOverdue(invoice: InvoiceData): boolean {
  return invoice.status === 'pending' && new Date(invoice.dueDate) < new Date();
}

function effectiveStatus(invoice: InvoiceData): InvoiceStatus {
  return isOverdue(invoice) ? 'overdue' : invoice.status;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ============================================================
// Component
// ============================================================

export function InvoicesView() {
  const user = useAppStore((s) => s.user);
  const restaurantId = user?.restaurantId || '';

  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [markPaidLoading, setMarkPaidLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // New invoice form
  const [newAmount, setNewAmount] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDueDays, setNewDueDays] = useState('7');
  const [creating, setCreating] = useState(false);

  const fetchInvoices = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await api.get<InvoicesResponse>(
        `/api/restaurants/${restaurantId}/invoices`,
        params
      );
      setInvoices(res.data || []);
      setSummary(res.summary || null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load invoices';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const filteredInvoices = search
    ? invoices.filter(
        (i) =>
          i.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
          i.subscription.plan.name.toLowerCase().includes(search.toLowerCase())
      )
    : invoices;

  const handleViewDetail = (invoice: InvoiceData) => {
    setSelectedInvoice(invoice);
    setDetailOpen(true);
  };

  const handleMarkPaid = async (invoiceId: string) => {
    setMarkPaidLoading(true);
    try {
      await api.patch(`/api/restaurants/${restaurantId}/invoices/${invoiceId}`, {
        status: 'paid',
      });
      toast.success('Invoice marked as paid');
      setDetailOpen(false);
      fetchInvoices();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update invoice';
      toast.error(msg);
    } finally {
      setMarkPaidLoading(false);
    }
  };

  const handleCancel = async (invoiceId: string) => {
    try {
      await api.patch(`/api/restaurants/${restaurantId}/invoices/${invoiceId}`, {
        status: 'cancelled',
      });
      toast.success('Invoice cancelled');
      setDetailOpen(false);
      fetchInvoices();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel invoice';
      toast.error(msg);
    }
  };

  const handleCreateInvoice = async () => {
    const amount = parseFloat(newAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    setCreating(true);
    try {
      // Convert ETB → cents
      const amountCents = Math.round(amount * 100);
      await api.post(`/api/restaurants/${restaurantId}/invoices`, {
        amountCents,
        description: newDescription,
        dueInDays: parseInt(newDueDays, 10) || 7,
      });
      toast.success('Invoice created');
      setCreateOpen(false);
      setNewAmount('');
      setNewDescription('');
      setNewDueDays('7');
      fetchInvoices();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create invoice';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = (invoice: InvoiceData) => {
    // Browser print as PDF — opens the print dialog with a printable layout
    const plan = invoice.subscription.plan;
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      toast.error('Please allow popups to download invoices');
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${invoice.invoiceNumber}</title>
        <style>
          body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #1a1a1a; max-width: 720px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f59e0b; padding-bottom: 20px; margin-bottom: 30px; }
          .brand { font-size: 28px; font-weight: 700; color: #f59e0b; }
          .invoice-meta { text-align: right; font-size: 14px; color: #555; }
          .invoice-number { font-size: 18px; font-weight: 600; }
          .section { margin-bottom: 24px; }
          .section h3 { font-size: 13px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; margin: 0 0 8px 0; }
          .section p { margin: 4px 0; font-size: 14px; }
          .table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          .table th { background: #f8f8f8; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666; border-bottom: 1px solid #ddd; }
          .table td { padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; }
          .totals { margin-top: 20px; margin-left: auto; width: 280px; }
          .totals .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
          .totals .total { font-weight: 700; font-size: 17px; border-top: 2px solid #1a1a1a; padding-top: 10px; margin-top: 6px; }
          .status-badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
          .status-pending { background: #fef3c7; color: #92400e; }
          .status-paid { background: #d1fae5; color: #065f46; }
          .status-overdue { background: #fee2e2; color: #991b1b; }
          .status-cancelled { background: #f3f4f6; color: #6b7280; }
          .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #eee; font-size: 11px; color: #888; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">Yene QR</div>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">Subscription Billing</p>
          </div>
          <div class="invoice-meta">
            <div class="invoice-number">Invoice ${invoice.invoiceNumber}</div>
            <p>Issued: ${formatDate(invoice.createdAt)}</p>
            <p>Due: ${formatDate(invoice.dueDate)}</p>
            <span class="status-badge status-${invoice.status}">${invoice.status}</span>
          </div>
        </div>

        <div class="section">
          <h3>Billed To</h3>
          <p style="font-weight: 600;">${user?.restaurantName || 'Restaurant'}</p>
          <p>${plan.name} Plan</p>
        </div>

        <div class="section">
          <h3>Charge Details</h3>
          <table class="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Plan</th>
                <th style="text-align:right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Subscription — monthly</td>
                <td>${plan.name}</td>
                <td style="text-align:right;">${formatCents(invoice.amountCents)}</td>
              </tr>
            </tbody>
          </table>

          <div class="totals">
            <div class="row"><span>Subtotal</span><span>${formatCents(invoice.amountCents)}</span></div>
            <div class="row"><span>VAT (15%)</span><span>${formatCents(invoice.taxCents)}</span></div>
            <div class="row total"><span>Total</span><span>${formatCents(invoice.totalCents)}</span></div>
          </div>
        </div>

        ${invoice.paidAt ? `<div class="section"><h3>Payment</h3><p>Paid on ${formatDate(invoice.paidAt)}</p></div>` : ''}

        <div class="footer">
          This is a system-generated invoice from Yene QR. For questions, contact support@yeneqr.com.
        </div>

        <script>
          window.onload = function() { setTimeout(function() { window.print(); }, 300); };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage subscription invoices and billing history
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchInvoices} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Total Billed
              </CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{formatCents(summary.totalCents)}</div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {summary.count} invoice{summary.count !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Paid</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-emerald-600">
                {formatCents(summary.paidCents)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Collected revenue</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Pending</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-amber-600">
                {formatCents(summary.pendingCents)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Awaiting payment</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Overdue</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-red-600">
                {formatCents(summary.overdueCents)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Past due date</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters + Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoice number or plan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No invoices found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Invoices are generated automatically when you change your subscription plan,
                or you can create one manually.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 px-2 font-medium">Invoice #</th>
                    <th className="py-2 px-2 font-medium">Plan</th>
                    <th className="py-2 px-2 font-medium text-right">Amount</th>
                    <th className="py-2 px-2 font-medium text-right">VAT</th>
                    <th className="py-2 px-2 font-medium text-right">Total</th>
                    <th className="py-2 px-2 font-medium">Due Date</th>
                    <th className="py-2 px-2 font-medium">Status</th>
                    <th className="py-2 px-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice) => {
                    const st = effectiveStatus(invoice);
                    const cfg = STATUS_CONFIG[st];
                    return (
                      <tr
                        key={invoice.id}
                        className="border-b last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                        onClick={() => handleViewDetail(invoice)}
                      >
                        <td className="py-3 px-2 font-mono text-xs">
                          {invoice.invoiceNumber}
                        </td>
                        <td className="py-3 px-2">{invoice.subscription.plan.name}</td>
                        <td className="py-3 px-2 text-right">
                          {formatCents(invoice.amountCents)}
                        </td>
                        <td className="py-3 px-2 text-right text-muted-foreground">
                          {formatCents(invoice.taxCents)}
                        </td>
                        <td className="py-3 px-2 text-right font-semibold">
                          {formatCents(invoice.totalCents)}
                        </td>
                        <td className="py-3 px-2 text-xs">{formatDate(invoice.dueDate)}</td>
                        <td className="py-3 px-2">
                          <Badge variant={cfg.variant} className="gap-1">
                            <cfg.icon className="h-3 w-3" />
                            {cfg.label}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(invoice);
                            }}
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
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

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[560px]">
          {selectedInvoice && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>Invoice {selectedInvoice.invoiceNumber}</span>
                  {(() => {
                    const st = effectiveStatus(selectedInvoice);
                    const cfg = STATUS_CONFIG[st];
                    return (
                      <Badge variant={cfg.variant} className="gap-1">
                        <cfg.icon className="h-3 w-3" />
                        {cfg.label}
                      </Badge>
                    );
                  })()}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Plan</p>
                    <p className="font-medium">{selectedInvoice.subscription.plan.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Billing Cycle</p>
                    <p className="font-medium">Monthly</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Issued On</p>
                    <p className="font-medium">{formatDate(selectedInvoice.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Due Date</p>
                    <p className="font-medium">{formatDate(selectedInvoice.dueDate)}</p>
                  </div>
                  {selectedInvoice.paidAt && (
                    <div>
                      <p className="text-xs text-muted-foreground">Paid On</p>
                      <p className="font-medium text-emerald-600">
                        {formatDate(selectedInvoice.paidAt)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCents(selectedInvoice.amountCents)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">VAT (15%)</span>
                    <span>{formatCents(selectedInvoice.taxCents)}</span>
                  </div>
                  <div className="flex justify-between text-base font-semibold border-t pt-2">
                    <span>Total</span>
                    <span>{formatCents(selectedInvoice.totalCents)}</span>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(selectedInvoice)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                {selectedInvoice.status === 'pending' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleCancel(selectedInvoice.id)}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleMarkPaid(selectedInvoice.id)}
                      disabled={markPaidLoading}
                    >
                      {markPaidLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      )}
                      Mark as Paid
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Invoice Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Create Manual Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (ETB)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="e.g. 1500.00"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">VAT of 15% will be added automatically.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="due-days">Due in (days)</Label>
              <Input
                id="due-days"
                type="number"
                min="1"
                placeholder="7"
                value={newDueDays}
                onChange={(e) => setNewDueDays(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="What is this invoice for?"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateInvoice} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
