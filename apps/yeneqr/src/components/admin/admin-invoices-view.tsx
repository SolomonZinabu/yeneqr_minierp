'use client';

// ============================================================
// Yene QR — Admin Invoices View (Platform-wide)
// ============================================================
// Super-admin view for tracking all subscription invoices across
// every restaurant. Shows summary cards, status filter, search,
// and a detailed table.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api-client';
import { formatCents } from '@/lib/money';
import {
  Loader2,
  Search,
  RefreshCw,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Wallet,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================
// Types
// ============================================================

type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

interface RestaurantInfo {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  cuisineType: string | null;
  isSuspended: boolean;
}

interface AdminInvoice {
  id: string;
  invoiceNumber: string;
  amountCents: number;
  taxCents: number;
  totalCents: number;
  status: InvoiceStatus;
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
  subscription: {
    id: string;
    status: string;
    plan: { id: string; name: string; slug: string; priceCents: number };
    restaurant: RestaurantInfo;
  };
}

interface AdminSummary {
  count: number;
  totalBilledCents: number;
  totalTaxCents: number;
  paidCents: number;
  pendingCents: number;
  overdueCents: number;
  cancelledCents: number;
}

interface AdminInvoicesResponse {
  data: AdminInvoice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: AdminSummary;
  byStatus: Array<{ status: string; count: number; totalCents: number }>;
}

const STATUS_BADGE: Record<InvoiceStatus, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  pending: { variant: 'secondary', icon: Clock },
  paid: { variant: 'default', icon: CheckCircle2 },
  overdue: { variant: 'destructive', icon: AlertTriangle },
  cancelled: { variant: 'outline', icon: XCircle },
};

function isOverdue(inv: AdminInvoice): boolean {
  return inv.status === 'pending' && new Date(inv.dueDate) < new Date();
}
function effectiveStatus(inv: AdminInvoice): InvoiceStatus {
  return isOverdue(inv) ? 'overdue' : inv.status;
}
function formatDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ============================================================
// Component
// ============================================================

export function AdminInvoicesView() {
  const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [byStatus, setByStatus] = useState<Array<{ status: string; count: number; totalCents: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await api.get<AdminInvoicesResponse>('/api/admin/invoices', params);
      setInvoices(res.data || []);
      setSummary(res.summary || null);
      setByStatus(res.byStatus || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load invoices';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const filteredInvoices = search
    ? invoices.filter(
        (i) =>
          i.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
          i.subscription.restaurant.name.toLowerCase().includes(search.toLowerCase()) ||
          i.subscription.plan.name.toLowerCase().includes(search.toLowerCase())
      )
    : invoices;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Invoices</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All subscription invoices across every restaurant
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchInvoices} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Billed</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{formatCents(summary.totalBilledCents)}</div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {summary.count} invoice{summary.count !== 1 ? 's' : ''} • VAT {formatCents(summary.totalTaxCents)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Collected</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-emerald-600">{formatCents(summary.paidCents)}</div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {summary.totalBilledCents > 0
                  ? `${Math.round((summary.paidCents / summary.totalBilledCents) * 100)}% of billed`
                  : 'No revenue yet'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Outstanding</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-amber-600">{formatCents(summary.pendingCents)}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Awaiting payment</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Overdue</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-red-600">{formatCents(summary.overdueCents)}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Past due date</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status Breakdown */}
      {byStatus.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Revenue Breakdown by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {byStatus.map((row) => (
                <div key={row.status} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground capitalize">{row.status}</p>
                  <p className="text-lg font-semibold mt-1">{formatCents(row.totalCents)}</p>
                  <p className="text-[11px] text-muted-foreground">{row.count} invoice{row.count !== 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters + Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoice #, restaurant, or plan..."
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
                Invoices are generated automatically when subscriptions renew or plans change.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => {
                    const st = effectiveStatus(invoice);
                    const cfg = STATUS_BADGE[st];
                    return (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-mono text-xs">{invoice.invoiceNumber}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{invoice.subscription.restaurant.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {invoice.subscription.restaurant.city || '—'}
                              {invoice.subscription.restaurant.isSuspended && (
                                <span className="ml-2 text-red-600 font-medium">Suspended</span>
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{invoice.subscription.plan.name}</TableCell>
                        <TableCell className="text-right">{formatCents(invoice.amountCents)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCents(invoice.totalCents)}</TableCell>
                        <TableCell className="text-xs">{formatDate(invoice.dueDate)}</TableCell>
                        <TableCell>
                          <Badge variant={cfg.variant} className="gap-1">
                            <cfg.icon className="h-3 w-3" />
                            {st}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
