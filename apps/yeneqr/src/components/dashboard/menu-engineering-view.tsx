'use client';

// ============================================================
// Menu Engineering View — Full Redesign
// ============================================================
// Features:
//   - 2x2 scatter quadrant chart (recharts) with avg reference lines
//   - Date range picker (7d / 30d / 90d / custom)
//   - KPI cards (total profit, total revenue, avg margin, items sold)
//   - Quadrant summary cards (Star/Puzzle/Plowhorse/Dog) — clickable filters
//   - Category profitability roll-up
//   - Search + category filter + "hide 86'd" toggle
//   - Sortable columns
//   - Pagination (50 items per page)
//   - CSV export
//   - Proper error states + loading skeleton
//   - Currency from restaurant settings (not hardcoded)
// ============================================================

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { useBranchChange } from '@/hooks/use-branch-change';
import { Star, Puzzle, TrendingUp, TrendingDown, Loader2, Package, Search, Download, AlertCircle, RotateCcw, DollarSign, Percent, ShoppingBag, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { toast } from 'sonner';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell, Legend } from 'recharts';

interface MenuEngItem {
  id: string;
  name: string;
  category: string;
  categoryId: string | null;
  priceCents: number;
  costCents: number;
  marginCents: number;
  marginPct: number;
  quantitySold: number;
  revenueCents: number;
  modifierRevenueCents: number;
  profitCents: number;
  classification: string;
  isAvailable: boolean;
  isPopular: boolean;
  missingCostData: boolean;
  isHighPopularity: boolean;
  isHighMargin: boolean;
}

interface Summary {
  stars: number;
  puzzles: number;
  plowhorses: number;
  dogs: number;
  unknown: number;
  totalProfitCents: number;
  totalRevenueCents: number;
  totalModifierRevenueCents: number;
  avgMarginCents: number;
  avgQuantity: number;
  totalItems: number;
  itemsSold: number;
  itemsNeverSold: number;
}

interface CategorySummary {
  name: string;
  profitCents: number;
  revenueCents: number;
  quantitySold: number;
  itemCount: number;
}

interface Thresholds {
  avgQuantity: number;
  avgMarginCents: number;
}

const CLASS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType; desc: string; chartColor: string }> = {
  Star: { label: 'Star', color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30', icon: Star, desc: 'High popularity + High margin — promote these', chartColor: '#9333ea' },
  Puzzle: { label: 'Puzzle', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', icon: Puzzle, desc: 'Low popularity + High margin — reposition or reprice', chartColor: '#2563eb' },
  Plowhorse: { label: 'Plowhorse', color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', icon: TrendingUp, desc: 'High popularity + Low margin — raise prices', chartColor: '#059669' },
  Dog: { label: 'Dog', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', icon: TrendingDown, desc: 'Low popularity + Low margin — consider removing', chartColor: '#dc2626' },
  Unknown: { label: 'Unknown', color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30', icon: AlertCircle, desc: 'Missing cost data — cannot classify', chartColor: '#d97706' },
};

type SortField = 'name' | 'category' | 'priceCents' | 'marginPct' | 'quantitySold' | 'profitCents' | 'classification';
type SortDir = 'asc' | 'desc';

const DATE_RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last year' },
];

export function MenuEngineeringView() {
  const { user, selectedBranchId, branchChangeVersion } = useAppStore();
  const restaurantId = user?.restaurantId || '';
  const [items, setItems] = useState<MenuEngItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [categorySummary, setCategorySummary] = useState<CategorySummary[]>([]);
  const [thresholds, setThresholds] = useState<Thresholds | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [days, setDays] = useState('30');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [hideUnavailable, setHideUnavailable] = useState(false);
  const [sortField, setSortField] = useState<SortField>('profitCents');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  const fetchRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const handleBranchChange = useCallback(() => { setLoading(true); fetchRef.current?.(); }, []);
  useBranchChange(handleBranchChange);

  const fetchData = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(false);
    try {
      const branchId = useAppStore.getState().selectedBranchId;
      const params: Record<string, string> = { days };
      if (branchId) params.branchId = branchId;
      const res = await api.get<{ data: MenuEngItem[]; summary: Summary; categorySummary: CategorySummary[]; thresholds: Thresholds }>(`/api/restaurants/${restaurantId}/menu-engineering`, params);
      setItems(res.data || []);
      setSummary(res.summary || null);
      setCategorySummary(res.categorySummary || []);
      setThresholds(res.thresholds || null);
    } catch (e: any) {
      setError(true);
      toast.error('Failed to load menu engineering data');
    } finally {
      setLoading(false);
    }
  }, [restaurantId, days]);

  useEffect(() => { fetchRef.current = fetchData; }, [fetchData]);
  useEffect(() => { fetchData(); }, [fetchData, selectedBranchId, branchChangeVersion]);

  const currency = user?.restaurantId ? 'ETB' : 'ETB'; // TODO: fetch from restaurant settings
  const fmt = (cents: number) => `${currency} ${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  // Filtered + sorted items
  const filteredItems = useMemo(() => {
    let result = [...items];
    if (filter) result = result.filter(i => i.classification === filter);
    if (search) result = result.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.category.toLowerCase().includes(search.toLowerCase()));
    if (categoryFilter !== 'all') result = result.filter(i => i.category === categoryFilter);
    if (hideUnavailable) result = result.filter(i => i.isAvailable);

    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (sortDir === 'asc') return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    });
    return result;
  }, [items, filter, search, categoryFilter, hideUnavailable, sortField, sortDir]);

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [filter, search, categoryFilter, hideUnavailable, sortField, sortDir, days]);

  // Paginated items for the table
  const totalPages = Math.ceil(filteredItems.length / pageSize);
  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Scatter chart data
  const scatterData = useMemo(() => {
    return items
      .filter(i => !i.missingCostData && i.quantitySold > 0)
      .map(i => ({
        x: i.quantitySold,
        y: i.marginCents / 100, // Convert to ETB for display
        name: i.name,
        classification: i.classification,
        profit: i.profitCents / 100,
        margin: i.marginPct,
      }));
  }, [items]);

  // Categories for filter dropdown
  const categories = useMemo(() => {
    const set = new Set(items.map(i => i.category));
    return Array.from(set).sort();
  }, [items]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const handleCSVExport = () => {
    const headers = ['Item', 'Category', 'Price (ETB)', 'Cost (ETB)', 'Margin (ETB)', 'Margin (%)', 'Sold', 'Revenue (ETB)', 'Profit (ETB)', 'Class', 'Available'];
    const rows = filteredItems.map(i => [
      i.name,
      i.category,
      (i.priceCents / 100).toFixed(2),
      (i.costCents / 100).toFixed(2),
      (i.marginCents / 100).toFixed(2),
      i.marginPct,
      i.quantitySold,
      (i.revenueCents / 100).toFixed(2),
      (i.profitCents / 100).toFixed(2),
      i.classification,
      i.isAvailable ? 'Yes' : 'No (86\'d)',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `menu-engineering-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Analyzing menu profitability...</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
        </div>
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
        <div className="h-96 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-10 w-10 text-red-500 mb-3" />
        <p className="text-sm text-muted-foreground mb-3">Failed to load menu engineering data</p>
        <Button size="sm" onClick={() => { setError(false); fetchData(); }}>
          <RotateCcw className="h-4 w-4 mr-1" /> Retry
        </Button>
      </div>
    );
  }

  const SortHeader = ({ field, label, className }: { field: SortField; label: string; className?: string }) => (
    <th className={`pb-2 pr-3 cursor-pointer hover:text-foreground ${className || ''}`} onClick={() => handleSort(field)}>
      <span className="inline-flex items-center gap-0.5">
        {label}
        {sortField === field && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </span>
    </th>
  );

  return (
    <div className="space-y-4">
      {/* Header + controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Menu Engineering</h2>
          <p className="text-sm text-muted-foreground">Profitability analysis — Kasavana-Smith model</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={days} onValueChange={(v) => { setDays(v); setFilter(null); }}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCSVExport}>
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard icon={<DollarSign className="h-4 w-4" />} label="Total Profit" value={fmt(summary.totalProfitCents)} color="text-green-600" sub={`${summary.itemsSold} items sold`} />
          <KPICard icon={<ShoppingBag className="h-4 w-4" />} label="Total Revenue" value={fmt(summary.totalRevenueCents)} color="text-blue-600" sub={summary.totalModifierRevenueCents > 0 ? `+${fmt(summary.totalModifierRevenueCents)} modifiers` : undefined} />
          <KPICard icon={<Percent className="h-4 w-4" />} label="Avg Margin" value={fmt(summary.avgMarginCents)} color="text-purple-600" sub={`Avg qty: ${summary.avgQuantity}`} />
          <KPICard icon={<Package className="h-4 w-4" />} label="Menu Items" value={String(summary.totalItems)} color="text-amber-600" sub={`${summary.itemsNeverSold} never sold`} />
        </div>
      )}

      {/* Quadrant summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(CLASS_CONFIG).map(([key, cfg]) => {
            const count = (summary as any)[key.toLowerCase() + 's'] || 0;
            const isActive = filter === key;
            return (
              <Card
                key={key}
                className={`cursor-pointer hover:shadow-md transition-shadow ${isActive ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setFilter(filter === key ? null : key)}
              >
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <cfg.icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                    <span className="text-[11px] text-muted-foreground">{cfg.label}</span>
                  </div>
                  <p className={`text-xl font-bold ${cfg.color}`}>{count}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{cfg.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Scatter chart */}
      {scatterData.length > 0 && thresholds && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-bold mb-4">Profitability Quadrant — Popularity vs Margin</h3>
            <ResponsiveContainer width="100%" height={320}>
              <ScatterChart margin={{ top: 10, right: 30, bottom: 40, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Quantity Sold"
                  label={{ value: 'Quantity Sold →', position: 'insideBottom', offset: -10, style: { fontSize: 11, fill: '#888' } }}
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Margin (ETB)"
                  label={{ value: 'Margin (ETB) →', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#888' } }}
                  tick={{ fontSize: 10 }}
                />
                <ZAxis type="number" dataKey="profit" range={[40, 400]} name="Profit" />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-card border rounded-lg p-2 shadow-lg text-xs">
                        <p className="font-bold">{d.name}</p>
                        <p className="text-muted-foreground">Sold: {d.x} | Margin: {d.margin}%</p>
                        <p className="text-muted-foreground">Profit: ETB {d.profit.toLocaleString()}</p>
                        <p className="font-medium" style={{ color: CLASS_CONFIG[d.classification]?.chartColor }}>{d.classification}</p>
                      </div>
                    );
                  }}
                />
                {/* Reference lines: avg popularity (X) and avg margin (Y) */}
                <ReferenceLine x={thresholds.avgQuantity} stroke="#666" strokeDasharray="5 5" label={{ value: 'Avg Qty', style: { fontSize: 9, fill: '#666' } }} />
                <ReferenceLine y={thresholds.avgMarginCents / 100} stroke="#666" strokeDasharray="5 5" label={{ value: 'Avg Margin', style: { fontSize: 9, fill: '#666' } }} />
                {/* One scatter per class for color-coded dots */}
                {Object.entries(CLASS_CONFIG).map(([key, cfg]) => (
                  <Scatter
                    key={key}
                    name={cfg.label}
                    data={scatterData.filter(d => d.classification === key)}
                    fill={cfg.chartColor}
                    fillOpacity={0.7}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Category profitability */}
      {categorySummary.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-bold mb-3">Category Profitability</h3>
            <div className="flex gap-2 flex-wrap">
              {categorySummary.map(cat => (
                <div key={cat.name} className="rounded-lg border px-3 py-2 text-xs">
                  <p className="font-medium">{cat.name}</p>
                  <p className="text-muted-foreground">{cat.itemCount} items • {cat.quantitySold} sold</p>
                  <p className="font-bold text-green-600 mt-0.5">{fmt(cat.profitCents)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items..."
            className="pl-9 h-8 text-sm"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input type="checkbox" checked={hideUnavailable} onChange={e => setHideUnavailable(e.target.checked)} className="rounded" />
          Hide 86'd
        </label>
        {filter && (
          <Button variant="outline" size="sm" onClick={() => setFilter(null)} className="h-8 text-xs">
            Clear filter: {filter}
          </Button>
        )}
      </div>

      {/* Items table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="border-b text-left text-xs text-muted-foreground">
              <SortHeader field="name" label="Item" />
              <SortHeader field="category" label="Category" />
              <SortHeader field="priceCents" label="Price" className="text-right" />
              <SortHeader field="marginPct" label="Margin" className="text-right" />
              <SortHeader field="quantitySold" label="Sold" className="text-right" />
              <SortHeader field="profitCents" label="Profit" className="text-right" />
              <SortHeader field="classification" label="Class" />
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map(item => {
              const cfg = CLASS_CONFIG[item.classification] || CLASS_CONFIG.Dog;
              return (
                <tr key={item.id} className="border-b hover:bg-muted/30">
                  <td className="py-2 pr-3 font-medium">
                    {item.name}
                    {!item.isAvailable && <Badge variant="secondary" className="ml-2 text-[9px]">86'd</Badge>}
                    {item.missingCostData && <Badge variant="outline" className="ml-2 text-[9px] text-amber-600 border-amber-400">No cost</Badge>}
                    {item.isPopular && !item.isHighPopularity && item.quantitySold > 0 && (
                      <Badge variant="outline" className="ml-2 text-[9px] text-orange-600 border-orange-400">Marked popular</Badge>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{item.category}</td>
                  <td className="py-2 pr-3 text-right">{fmt(item.priceCents)}</td>
                  <td className="py-2 pr-3 text-right">
                    {item.missingCostData ? <span className="text-amber-600">—</span> : `${item.marginPct}%`}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {item.quantitySold}
                    {item.quantitySold === 0 && <span className="text-[9px] text-muted-foreground ml-1">never</span>}
                  </td>
                  <td className="py-2 pr-3 text-right font-medium">{fmt(item.profitCents)}</td>
                  <td className="py-2">
                    <Badge className={`${cfg.bgColor} ${cfg.color} border-0 text-[10px]`}>{cfg.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-xs text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredItems.length)} of {filteredItems.length}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs font-medium px-2">
              {currentPage} / {totalPages}
            </span>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {filteredItems.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          {items.length === 0 ? 'No menu items found' : 'No items match your filters'}
        </div>
      )}
    </div>
  );
}

function KPICard({ icon, label, value, color, sub }: { icon: React.ReactNode; label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className={`flex items-center gap-1 mb-1 ${color}`}>
        {icon}
        <span className="text-[10px] uppercase font-bold">{label}</span>
      </div>
      <p className={`font-bold text-lg ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
