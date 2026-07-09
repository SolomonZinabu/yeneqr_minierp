'use client';

// ============================================================
// Z-Report (Daily Sales Report) — Gebioch/Tax Compliance
// ============================================================
// Generates a daily summary of all sales, taxes, and payments
// for tax filing purposes. Can be printed at end of day.
//
// Includes:
//   - Total sales (per payment method)
//   - VAT collected (15%)
//   - Tax-exempt sales
//   - Service charges
//   - Discounts given
//   - Tips received
//   - Refunds processed
//   - Receipt count (sequential for audit)
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FileText, Printer, Download, Calendar, TrendingUp, DollarSign, Percent, Receipt } from 'lucide-react';
import { toast } from 'sonner';

interface ZReportData {
  date: string;
  restaurant: {
    name: string;
    tin?: string;
    vat?: string;
  };
  summary: {
    totalSalesCents: number;
    totalVatCents: number;
    totalServiceChargeCents: number;
    totalDiscountsCents: number;
    totalTipsCents: number;
    totalRefundsCents: number;
    taxExemptSalesCents: number;
    netSalesCents: number;
  };
  byPaymentMethod: Array<{
    method: string;
    count: number;
    amountCents: number;
  }>;
  orderCount: number;
  receiptCount: number;
  firstReceiptNumber: string;
  lastReceiptNumber: string;
  orders: Array<{
    orderNumber: string;
    receiptNumber?: string;
    totalAmountCents: number;
    taxAmountCents: number;
    paymentMethod: string;
    status: string;
    createdAt: string;
  }>;
}

export function ZReportPanel({ restaurantId }: { restaurantId: string }) {
  const [report, setReport] = useState<ZReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/restaurants/${restaurantId}/analytics/daily-sales?date=${selectedDate}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setReport(data.data || data);
      } else {
        toast.error('Failed to fetch Z-report');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  }, [restaurantId, selectedDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const formatAmt = (cents: number) => `ETB ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handlePrint = async () => {
    if (!report) return;
    // Generate a printable HTML version
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups to print.');
      return;
    }

    const html = generateZReportHTML(report);
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  const handleDownloadCSV = () => {
    if (!report) return;
    const csv = generateCSV(report);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `z-report-${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Z-report downloaded');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-brand border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!report) {
    return <div className="text-center py-12 text-muted-foreground">No data available</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Z-Report (Daily Sales)
          </h2>
          <p className="text-sm text-muted-foreground">Gebioch tax compliance — daily sales summary</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border bg-background"
          />
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-brand text-white hover:bg-brand-dark"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border hover:bg-accent"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
        </div>
      </div>

      {/* Restaurant info */}
      <div className="rounded-xl bg-muted/50 p-4">
        <p className="font-bold text-sm">{report.restaurant.name}</p>
        {report.restaurant.tin && <p className="text-xs text-muted-foreground">TIN: {report.restaurant.tin}</p>}
        {report.restaurant.vat && <p className="text-xs text-muted-foreground">VAT: {report.restaurant.vat}</p>}
        <p className="text-xs text-muted-foreground mt-1">Date: {new Date(selectedDate).toLocaleDateString('en-GB')}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Gross Sales"
          value={formatAmt(report.summary.totalSalesCents)}
          color="text-blue-600"
        />
        <StatCard
          icon={<Percent className="w-4 h-4" />}
          label="VAT Collected"
          value={formatAmt(report.summary.totalVatCents)}
          color="text-purple-600"
        />
        <StatCard
          icon={<Receipt className="w-4 h-4" />}
          label="Net Sales"
          value={formatAmt(report.summary.netSalesCents)}
          color="text-green-600"
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Orders"
          value={String(report.orderCount)}
          color="text-amber-600"
        />
      </div>

      {/* Detailed breakdown */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Sales breakdown */}
        <div className="rounded-xl border p-4 space-y-2">
          <h3 className="text-sm font-bold mb-2">Sales Breakdown</h3>
          <ReportRow label="Gross Sales" value={formatAmt(report.summary.totalSalesCents)} />
          <ReportRow label="Tax-Exempt Sales" value={formatAmt(report.summary.taxExemptSalesCents)} />
          <ReportRow label="VAT (15%)" value={formatAmt(report.summary.totalVatCents)} />
          <ReportRow label="Service Charges" value={formatAmt(report.summary.totalServiceChargeCents)} />
          <ReportRow label="Discounts" value={`-${formatAmt(report.summary.totalDiscountsCents)}`} negative />
          <ReportRow label="Refunds" value={`-${formatAmt(report.summary.totalRefundsCents)}`} negative />
          <ReportRow label="Tips" value={formatAmt(report.summary.totalTipsCents)} />
          <div className="border-t pt-2 mt-2">
            <ReportRow label="NET SALES" value={formatAmt(report.summary.netSalesCents)} bold />
          </div>
        </div>

        {/* Payment methods */}
        <div className="rounded-xl border p-4 space-y-2">
          <h3 className="text-sm font-bold mb-2">Payments by Method</h3>
          {report.byPaymentMethod.length === 0 ? (
            <p className="text-xs text-muted-foreground">No payments recorded</p>
          ) : (
            report.byPaymentMethod.map((pm) => (
              <ReportRow
                key={pm.method}
                label={`${pm.method.toUpperCase()} (${pm.count} ${pm.count === 1 ? 'payment' : 'payments'})`}
                value={formatAmt(pm.amountCents)}
              />
            ))
          )}
          <div className="border-t pt-2 mt-2">
            <ReportRow
              label="TOTAL"
              value={formatAmt(report.byPaymentMethod.reduce((sum, p) => sum + p.amountCents, 0))}
              bold
            />
          </div>
        </div>
      </div>

      {/* Receipt audit info */}
      <div className="rounded-xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4">
        <h3 className="text-sm font-bold mb-2 flex items-center gap-1">
          <Receipt className="w-4 h-4" />
          Receipt Audit Trail
        </h3>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Total Receipts</p>
            <p className="font-bold">{report.receiptCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground">First Receipt #</p>
            <p className="font-bold">{report.firstReceiptNumber || 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Last Receipt #</p>
            <p className="font-bold">{report.lastReceiptNumber || 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className={`flex items-center gap-1 mb-1 ${color}`}>
        {icon}
        <span className="text-[10px] uppercase font-bold">{label}</span>
      </div>
      <p className={`font-bold text-lg ${color}`}>{value}</p>
    </div>
  );
}

function ReportRow({ label, value, bold, negative }: { label: string; value: string; bold?: boolean; negative?: boolean }) {
  return (
    <div className={`flex justify-between text-xs ${bold ? 'font-bold' : ''}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={negative ? 'text-red-600' : ''}>{value}</span>
    </div>
  );
}

function generateZReportHTML(report: ZReportData): string {
  const formatAmt = (cents: number) => `ETB ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Z-Report ${report.date}</title>
      <style>
        body { font-family: monospace; width: 80mm; margin: 0 auto; padding: 10px; font-size: 11px; }
        h1 { font-size: 14px; text-align: center; margin: 5px 0; }
        h2 { font-size: 12px; text-align: center; margin: 5px 0; }
        .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
        .section { border-bottom: 1px dashed #000; padding: 5px 0; }
        .row { display: flex; justify-content: space-between; }
        .total { font-weight: bold; font-size: 13px; }
        .label { color: #555; }
        @media print { body { width: 80mm; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${report.restaurant.name}</h1>
        ${report.restaurant.tin ? `<p>TIN: ${report.restaurant.tin}</p>` : ''}
        ${report.restaurant.vat ? `<p>VAT: ${report.restaurant.vat}</p>` : ''}
        <h2>Z-REPORT (DAILY SALES)</h2>
        <p>${new Date(report.date).toLocaleDateString('en-GB')}</p>
      </div>

      <div class="section">
        <div class="row"><span class="label">Gross Sales:</span><span>${formatAmt(report.summary.totalSalesCents)}</span></div>
        <div class="row"><span class="label">Tax-Exempt:</span><span>${formatAmt(report.summary.taxExemptSalesCents)}</span></div>
        <div class="row"><span class="label">VAT (15%):</span><span>${formatAmt(report.summary.totalVatCents)}</span></div>
        <div class="row"><span class="label">Service Charges:</span><span>${formatAmt(report.summary.totalServiceChargeCents)}</span></div>
        <div class="row"><span class="label">Discounts:</span><span>-${formatAmt(report.summary.totalDiscountsCents)}</span></div>
        <div class="row"><span class="label">Refunds:</span><span>-${formatAmt(report.summary.totalRefundsCents)}</span></div>
        <div class="row"><span class="label">Tips:</span><span>${formatAmt(report.summary.totalTipsCents)}</span></div>
      </div>

      <div class="section total">
        <div class="row"><span>NET SALES:</span><span>${formatAmt(report.summary.netSalesCents)}</span></div>
      </div>

      <div class="section">
        <p style="font-weight:bold; margin:5px 0;">Payments by Method</p>
        ${report.byPaymentMethod.map(pm => `
          <div class="row"><span>${pm.method.toUpperCase()} (${pm.count}):</span><span>${formatAmt(pm.amountCents)}</span></div>
        `).join('')}
      </div>

      <div class="section">
        <p style="font-weight:bold; margin:5px 0;">Receipt Audit</p>
        <div class="row"><span class="label">Total Receipts:</span><span>${report.receiptCount}</span></div>
        <div class="row"><span class="label">First Receipt:</span><span>${report.firstReceiptNumber || 'N/A'}</span></div>
        <div class="row"><span class="label">Last Receipt:</span><span>${report.lastReceiptNumber || 'N/A'}</span></div>
        <div class="row"><span class="label">Total Orders:</span><span>${report.orderCount}</span></div>
      </div>

      <p style="text-align:center; margin-top:10px; font-size:10px;">
        This is a computer-generated report for tax purposes.<br/>
        Generated: ${new Date().toLocaleString('en-GB')}
      </p>
    </body>
    </html>
  `;
}

function generateCSV(report: ZReportData): string {
  const rows = [
    ['Z-Report', report.date],
    ['Restaurant', report.restaurant.name],
    ['TIN', report.restaurant.tin || ''],
    ['VAT', report.restaurant.vat || ''],
    [],
    ['Summary', ''],
    ['Gross Sales', report.summary.totalSalesCents / 100],
    ['Tax-Exempt Sales', report.summary.taxExemptSalesCents / 100],
    ['VAT (15%)', report.summary.totalVatCents / 100],
    ['Service Charges', report.summary.totalServiceChargeCents / 100],
    ['Discounts', -report.summary.totalDiscountsCents / 100],
    ['Refunds', -report.summary.totalRefundsCents / 100],
    ['Tips', report.summary.totalTipsCents / 100],
    ['Net Sales', report.summary.netSalesCents / 100],
    [],
    ['Payments by Method', ''],
    ...report.byPaymentMethod.map(pm => [`${pm.method} (${pm.count})`, pm.amountCents / 100]),
    [],
    ['Receipt Audit', ''],
    ['Total Receipts', report.receiptCount],
    ['First Receipt #', report.firstReceiptNumber || ''],
    ['Last Receipt #', report.lastReceiptNumber || ''],
    ['Total Orders', report.orderCount],
  ];
  return rows.map(r => r.join(',')).join('\n');
}
