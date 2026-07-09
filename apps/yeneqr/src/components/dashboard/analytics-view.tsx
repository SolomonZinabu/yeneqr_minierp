'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { useBranchChange } from '@/hooks/use-branch-change';
import { formatCents } from '@/lib/money';
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Users,
  Loader2,
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  TrendingDown,
  AlertTriangle,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  ChefHat,
  Clock,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { toast } from 'sonner';

// ── Types ──

interface PopularItem {
  itemId: string;
  name: string;
  quantity: number;
  revenue: number;
  costCents: number;
  profitMargin: number;
}

interface AnalyticsPeriod {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  topItems: PopularItem[];
  ordersByHour: { hour: number; orderCount: number }[];
  salesTrend: { date: string; revenue: number; orders: number }[];
  totalTax?: number;
  totalTips?: number;
  uniqueCustomers?: number;
  repeatCustomers?: number;
  cancelledOrders?: number;
  avgPrepTime?: number;
  totalCOGS?: number;
  grossProfit?: number;
  grossMargin?: number;
  voidAmountCents?: number;
  refundAmountCents?: number;
  complimentAmountCents?: number;
  totalLossCents?: number;
}

interface HeatmapCell {
  day: string;
  dayIndex: number;
  hours: { hour: number; orders: number }[];
}

interface ReviewData {
  avgRating: number;
  totalReviews: number;
  recentReviews: {
    id: string;
    rating: number;
    comment: string | null;
    customerName: string;
    createdAt: string;
  }[];
  ratingDistribution: { rating: number; count: number }[];
}

interface BranchData {
  branchId: string;
  branchName: string;
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  uniqueCustomers: number;
}

interface AnalyticsResponse {
  today: AnalyticsPeriod;
  thisWeek: AnalyticsPeriod;
  thisMonth: AnalyticsPeriod;
  period: AnalyticsPeriod;
  liveStats: { pendingOrders: number; activeTables: number };
  branches: { id: string; name: string }[];
  heatmap?: HeatmapCell[];
  reviews?: ReviewData;
  branchComparison?: BranchData[];
}

type DateRange = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'custom';

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This Week',
  lastWeek: 'Last Week',
  thisMonth: 'This Month',
  custom: 'Custom Range',
};

const CHART_COLORS = ['#039D55', '#0EA5E9', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

// ── Heatmap Color ──
function getHeatmapColor(value: number, max: number): string {
  if (max === 0) return 'hsl(0, 0%, 96%)';
  const intensity = value / max;
  if (intensity === 0) return 'hsl(0, 0%, 96%)';
  if (intensity < 0.25) return 'hsl(152, 76%, 92%)';
  if (intensity < 0.5) return 'hsl(152, 76%, 75%)';
  if (intensity < 0.75) return 'hsl(152, 76%, 55%)';
  return 'hsl(152, 76%, 35%)';
}

// ── Component ──

export function AnalyticsView() {
  const { user, selectedBranchId, branchChangeVersion } = useAppStore();
  const restaurantId = user?.restaurantId || '';
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>('thisWeek');
  const [showBranchComparison, setShowBranchComparison] = useState(false);
  const [data, setData] = useState<AnalyticsResponse | null>(null);

  const fetchAnalyticsRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const handleBranchChange = useCallback((newBranchId: string) => {
    console.log('[AnalyticsView] handleBranchChange called with:', newBranchId);
    setLoading(true);
    setData(null);
    fetchAnalyticsRef.current?.();
  }, []);

  useBranchChange(handleBranchChange);

  // ── Fetch analytics with all params ──
  const fetchAnalytics = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const branchId = useAppStore.getState().selectedBranchId;
      const params = new URLSearchParams({
        period: dateRange,
        ...(branchId ? { branchId } : {}),
        ...(showBranchComparison ? { compare: 'branches' } : {}),
        includeReviews: 'true',
        includeHeatmap: 'true',
      });

      const res = await api.get<{ data: AnalyticsResponse }>(
        `/api/restaurants/${restaurantId}/analytics?${params.toString()}`
      );

      if (res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('[ANALYTICS_FETCH]', err);
      // Fallback: use today/week/month from basic endpoint
      try {
        const res = await api.get<{ data: { today: AnalyticsPeriod; thisWeek: AnalyticsPeriod; thisMonth: AnalyticsPeriod; liveStats: { pendingOrders: number; activeTables: number } } }>(
          `/api/restaurants/${restaurantId}/analytics`
        );
        if (res.data) {
          setData({
            ...res.data,
            period: res.data.thisWeek || res.data.today,
            branches: [],
          });
        }
      } catch {
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }, [restaurantId, dateRange, showBranchComparison]);

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchAnalyticsRef.current = fetchAnalytics; }, [fetchAnalytics]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics, selectedBranchId, branchChangeVersion]);

  // ── Current period data ──
  const current = useMemo(() => {
    if (!data) return null;
    if (dateRange === 'today') return data.today;
    if (dateRange === 'thisWeek') return data.thisWeek;
    if (dateRange === 'thisMonth') return data.thisMonth;
    return data.period || data.thisWeek || data.today;
  }, [data, dateRange]);

  // ── Heatmap max (must be before early return to avoid hooks mismatch) ──
  const heatmapMax = useMemo(() => {
    let max = 0;
    const heatmap = data?.heatmap || [];
    for (const day of heatmap) {
      for (const h of day.hours) {
        if (h.orders > max) max = h.orders;
      }
    }
    return max;
  }, [data?.heatmap]);

  // ── Export handler ──
  const handleExport = async (type: string, format: string) => {
    if (!restaurantId) return;
    try {
      setExporting(true);
      const url = `/api/restaurants/${restaurantId}/export?type=${type}&format=${format}`;
      const token = localStorage.getItem('yeneqr_token');
      const response = await fetch(url, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Export failed' }));
        toast.error(errData.error || 'Export failed');
        return;
      }
      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `${type}-export.${format === 'pdf' ? 'html' : 'csv'}`;
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} report exported successfully`);
    } catch (err) {
      console.error('[EXPORT_ERROR]', err);
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  // ── Loading state ──
  if (loading || !data || !current) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <span className="ml-2 text-muted-foreground">Loading analytics...</span>
      </div>
    );
  }

  // ── Computed values ──
  const periodLabel = DATE_RANGE_LABELS[dateRange];
  const totalRevenueCents = current.totalRevenue || 0;
  const totalOrders = current.totalOrders || 0;
  const avgOrderValueCents = current.avgOrderValue || 0;
  const uniqueCustomers = current.uniqueCustomers || 0;
  const repeatCustomers = current.repeatCustomers || 0;
  const newCustomers = uniqueCustomers - repeatCustomers;
  const grossProfit = current.grossProfit || 0;
  const grossMargin = current.grossMargin || 0;
  const totalLoss = current.totalLossCents || 0;
  const voidLoss = current.voidAmountCents || 0;
  const refundLoss = current.refundAmountCents || 0;
  const complimentLoss = current.complimentAmountCents || 0;

  // ── Sales trend chart data ──
  const salesTrendData = (current.salesTrend || []).map(s => ({
    date: s.date,
    revenueCents: s.revenue,
    orders: s.orders,
  }));

  // ── Orders by hour data ──
  const ordersByHourData = (current.ordersByHour || []).map(h => {
    const hourNum = typeof h.hour === 'number' ? h.hour : parseInt(String(h.hour));
    const label = hourNum === 0 ? '12AM' : hourNum < 12 ? `${hourNum}AM` : hourNum === 12 ? '12PM' : `${hourNum - 12}PM`;
    return { hour: label, orders: h.orderCount || 0 };
  });

  // ── Popular items with profit ──
  const popularItems = (current.topItems || []).slice(0, 7);

  // ── Customer ratio pie chart ──
  const customerRatioData = [
    { name: 'New Customers', value: Math.max(newCustomers, 0), color: '#0EA5E9' },
    { name: 'Returning', value: repeatCustomers, color: '#039D55' },
  ].filter(d => d.value > 0);

  // ── Loss tracking data ──
  const lossData = [
    { name: 'Cancelled/Refunds', value: refundLoss, color: '#EF4444' },
    { name: 'Voided Items', value: voidLoss, color: '#F59E0B' },
    { name: 'Compliments', value: complimentLoss, color: '#8B5CF6' },
  ].filter(d => d.value > 0);

  // ── Heatmap ──
  const heatmap = data.heatmap || [];

  // ── Reviews ──
  const reviews = data.reviews;

  // ── Branch comparison ──
  const branchComparison = data.branchComparison || [];

  return (
    <div className="space-y-6">
      {/* ══════════ Header: Date Range + Branch + Export ══════════ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-semibold">Analytics</h2>

          {/* Date Range Tabs */}
          <Tabs value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <TabsList className="h-8">
              <TabsTrigger value="today" className="text-xs px-2 h-6">Today</TabsTrigger>
              <TabsTrigger value="yesterday" className="text-xs px-2 h-6">Yesterday</TabsTrigger>
              <TabsTrigger value="thisWeek" className="text-xs px-2 h-6">Week</TabsTrigger>
              <TabsTrigger value="lastWeek" className="text-xs px-2 h-6">Last Wk</TabsTrigger>
              <TabsTrigger value="thisMonth" className="text-xs px-2 h-6">Month</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Branch indicator — uses global branch selector in header */}
          {selectedBranchId && (
            <Badge variant="outline" className="h-7 text-xs gap-1">
              <Building2 className="w-3 h-3" />
              {data.branches?.find(b => b.id === selectedBranchId)?.name || 'Selected Branch'}
            </Badge>
          )}

          {/* Branch Comparison Toggle */}
          {data.branches && data.branches.length > 1 && (
            <Button
              variant={showBranchComparison ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => setShowBranchComparison(!showBranchComparison)}
            >
              <Building2 className="w-3 h-3" />
              Compare
            </Button>
          )}
        </div>

        {/* Export */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2" disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Export Reports</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleExport('orders', 'csv')} className="gap-2 cursor-pointer">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <div><p className="text-sm font-medium">Orders CSV</p></div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('revenue', 'csv')} className="gap-2 cursor-pointer">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <div><p className="text-sm font-medium">Revenue CSV</p></div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('items', 'csv')} className="gap-2 cursor-pointer">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <div><p className="text-sm font-medium">Menu Items CSV</p></div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleExport('revenue', 'pdf')} className="gap-2 cursor-pointer">
              <FileText className="h-4 w-4 text-orange-600" />
              <div><p className="text-sm font-medium">Revenue Report (HTML)</p></div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ══════════ Row 1: KPI Summary Cards ══════════ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Revenue</CardTitle>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
              <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCents(totalRevenueCents)}</div>
            <p className="text-[10px] text-muted-foreground">{periodLabel}</p>
          </CardContent>
        </Card>

        {/* Gross Profit */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Gross Profit</CardTitle>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
              <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCents(grossProfit)}</div>
            <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              {grossMargin >= 0 ? <ArrowUpRight className="w-3 h-3 text-emerald-500" /> : <ArrowDownRight className="w-3 h-3 text-red-500" />}
              {grossMargin}% margin
            </p>
          </CardContent>
        </Card>

        {/* Total Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Orders</CardTitle>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <ShoppingCart className="h-3.5 w-3.5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{totalOrders}</div>
            <p className="text-[10px] text-muted-foreground">{formatCents(avgOrderValueCents)} avg</p>
          </CardContent>
        </Card>

        {/* Unique Customers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Customers</CardTitle>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10">
              <Users className="h-3.5 w-3.5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{uniqueCustomers}</div>
            <p className="text-[10px] text-muted-foreground">{repeatCustomers} returning</p>
          </CardContent>
        </Card>

        {/* Loss Tracking */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Losses</CardTitle>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-600">{formatCents(totalLoss)}</div>
            <p className="text-[10px] text-muted-foreground">{current.cancelledOrders || 0} cancelled</p>
          </CardContent>
        </Card>

        {/* Avg Prep Time */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Avg Prep</CardTitle>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
              <ChefHat className="h-3.5 w-3.5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{current.avgPrepTime || 0}m</div>
            <p className="text-[10px] text-muted-foreground">prep time</p>
          </CardContent>
        </Card>
      </div>

      {/* ══════════ Row 2: Sales Trend + Customer Ratio + Loss Pie ══════════ */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Sales Trend */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sales Trend</CardTitle>
            <CardDescription className="text-xs">{periodLabel} revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              {salesTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesTrendData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#039D55" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#039D55" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip
                      formatter={(value: number) => [formatCents(value), 'Revenue']}
                      contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Area type="monotone" dataKey="revenueCents" stroke="#039D55" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  No sales data for this period
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* New vs Returning Customers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Customer Loyalty</CardTitle>
            <CardDescription className="text-xs">New vs returning customers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              {customerRatioData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={customerRatioData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {customerRatioData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [value, 'Customers']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  No customer data yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Loss Tracking Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-red-500" />
              Loss Breakdown
            </CardTitle>
            <CardDescription className="text-xs">Financial leakage — {periodLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              {lossData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={lossData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {lossData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [formatCents(value), 'Loss']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
                  <TrendingDown className="w-8 h-8 mb-2 opacity-30" />
                  No losses recorded
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ══════════ Row 3: 7-Day Peak Hours Heatmap ══════════ */}
      {heatmap.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-500" />
              7-Day Peak Hours Heatmap
            </CardTitle>
            <CardDescription className="text-xs">Orders by day of week and hour — darker = busier</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                {/* Hour labels */}
                <div className="flex items-center mb-1">
                  <div className="w-10 shrink-0" />
                  {heatmap[0]?.hours.filter(h => h.hour >= 6 && h.hour <= 23).map(h => (
                    <div key={h.hour} className="flex-1 text-center text-[9px] text-muted-foreground">
                      {h.hour === 0 ? '12a' : h.hour < 12 ? `${h.hour}a` : h.hour === 12 ? '12p' : `${h.hour - 12}p`}
                    </div>
                  ))}
                </div>
                {/* Heatmap rows */}
                {heatmap.map((day) => (
                  <div key={day.day} className="flex items-center mb-0.5">
                    <div className="w-10 shrink-0 text-[10px] font-medium text-muted-foreground text-right pr-2">{day.day}</div>
                    {day.hours.filter(h => h.hour >= 6 && h.hour <= 23).map(h => (
                      <div
                        key={h.hour}
                        className="flex-1 h-6 mx-0.5 rounded-sm flex items-center justify-center text-[8px] font-medium transition-colors cursor-default"
                        style={{ backgroundColor: getHeatmapColor(h.orders, heatmapMax) }}
                        title={`${day.day} ${h.hour}:00 — ${h.orders} orders`}
                      >
                        {h.orders > 0 && h.orders}
                      </div>
                    ))}
                  </div>
                ))}
                {/* Legend */}
                <div className="flex items-center gap-2 mt-3 justify-end">
                  <span className="text-[9px] text-muted-foreground">Less</span>
                  <div className="flex gap-0.5">
                    <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: 'hsl(0, 0%, 96%)' }} />
                    <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: 'hsl(152, 76%, 92%)' }} />
                    <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: 'hsl(152, 76%, 75%)' }} />
                    <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: 'hsl(152, 76%, 55%)' }} />
                    <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: 'hsl(152, 76%, 35%)' }} />
                  </div>
                  <span className="text-[9px] text-muted-foreground">More</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══════════ Row 4: Popular Items with Profit Margins + Orders by Hour ══════════ */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Popular Items with Profit Margins */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Popular Items & Margins</CardTitle>
            <CardDescription className="text-xs">Top items with profit margin % — {periodLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {popularItems.length > 0 ? popularItems.map((item, i) => (
                <div key={item.itemId || i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-brand font-bold text-xs shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {item.quantity} orders · {formatCents(item.revenue)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge
                      variant={item.profitMargin >= 60 ? 'default' : item.profitMargin >= 30 ? 'secondary' : 'destructive'}
                      className="text-[10px] px-1.5"
                    >
                      {item.profitMargin}%
                    </Badge>
                    <p className="text-[9px] text-muted-foreground mt-0.5">margin</p>
                  </div>
                </div>
              )) : (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  No popular items data
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Orders by Hour */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Orders by Hour</CardTitle>
            <CardDescription className="text-xs">Order distribution — {periodLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {ordersByHourData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ordersByHourData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="hour" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value: number) => [value, 'Orders']} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                    <Bar dataKey="orders" fill="#039D55" radius={[4, 4, 0, 0]} fillOpacity={0.8} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  No hourly data
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ══════════ Row 5: Branch Comparison ══════════ */}
      {showBranchComparison && branchComparison.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-primary" />
              Cross-Branch Comparison
            </CardTitle>
            <CardDescription className="text-xs">Branch performance — {periodLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-3 font-medium text-xs">Branch</th>
                    <th className="text-right py-2 px-3 font-medium text-xs">Revenue</th>
                    <th className="text-right py-2 px-3 font-medium text-xs">Orders</th>
                    <th className="text-right py-2 px-3 font-medium text-xs">Avg Value</th>
                    <th className="text-right py-2 px-3 font-medium text-xs">Customers</th>
                    <th className="text-left py-2 px-3 font-medium text-xs w-32">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {branchComparison.map((branch, i) => {
                    const totalAllRevenue = branchComparison.reduce((s, b) => s + b.totalRevenue, 0);
                    const share = totalAllRevenue > 0 ? (branch.totalRevenue / totalAllRevenue) * 100 : 0;
                    return (
                      <tr key={branch.branchId} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 px-3 font-medium flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          {branch.branchName}
                        </td>
                        <td className="text-right py-2 px-3">{formatCents(branch.totalRevenue)}</td>
                        <td className="text-right py-2 px-3">{branch.totalOrders}</td>
                        <td className="text-right py-2 px-3">{formatCents(branch.avgOrderValue)}</td>
                        <td className="text-right py-2 px-3">{branch.uniqueCustomers}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${share}%`,
                                  backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                                }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground w-8 text-right">{share.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══════════ Row 6: Reviews & Sentiment Widget ══════════ */}
      {reviews && reviews.totalReviews > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber-500" />
              Reviews & Sentiment
            </CardTitle>
            <CardDescription className="text-xs">Customer feedback overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Average Rating */}
              <div className="flex flex-col items-center justify-center">
                <div className="text-4xl font-bold">{reviews.avgRating}</div>
                <div className="flex items-center gap-0.5 mt-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${star <= Math.round(reviews.avgRating) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{reviews.totalReviews} reviews</p>
                {/* Rating Distribution */}
                <div className="w-full mt-3 space-y-1">
                  {reviews.ratingDistribution.reverse().map(rd => (
                    <div key={rd.rating} className="flex items-center gap-2">
                      <span className="text-[10px] w-3 text-right">{rd.rating}</span>
                      <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full"
                          style={{ width: `${reviews.totalReviews > 0 ? (rd.count / reviews.totalReviews) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-5">{rd.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Reviews */}
              <div className="lg:col-span-2 space-y-2">
                {reviews.recentReviews.map(review => (
                  <div key={review.id} className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star
                          key={star}
                          className={`w-3 h-3 ${star <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
                        />
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      {review.comment && (
                        <p className="text-xs text-foreground/80 line-clamp-2">&ldquo;{review.comment}&rdquo;</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {review.customerName} · {new Date(review.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
                {reviews.recentReviews.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No reviews yet</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══════════ Empty State ══════════ */}
      {salesTrendData.length === 0 && popularItems.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No analytics data yet</p>
            <p className="text-xs text-muted-foreground mt-1">Data will appear as orders come in</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
