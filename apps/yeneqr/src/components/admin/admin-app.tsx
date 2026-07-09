'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  formatETB,
  getPlanLabel,
  getStatusColor,
  getTicketStatusColor,
  getPriorityColor,
  type RestaurantStatus,
  type TicketStatus,
  type FeatureFlag,
  type SupportTicket,
  type AdminRestaurant,
  type SubscriptionPlan,
  type MonthlyRevenue,
  type CuisineStat,
  type GeoStat,
} from '@/lib/types';
import { toCents, fromCents } from '@/lib/money';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  HeadphonesIcon,
  Flag,
  BarChart3,
  Bot,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Ticket,
  Globe,
  ShieldCheck,
  ChevronRight,
  ArrowUpRight,
  CalendarDays,
  Activity,
  Zap,
  ShoppingCart,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';

// ===== Types =====
type AdminView = 'overview' | 'restaurants' | 'subscriptions' | 'tickets' | 'flags' | 'analytics' | 'ai';

interface NavItem {
  id: AdminView;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'restaurants', label: 'Restaurants', icon: Building2 },
  { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
  { id: 'tickets', label: 'Support Tickets', icon: HeadphonesIcon },
  { id: 'flags', label: 'Feature Flags', icon: Flag },
  { id: 'ai', label: 'AI Management', icon: Bot },
  { id: 'analytics', label: 'Platform Analytics', icon: BarChart3 },
];

// Support staff constant (used for ticket assignment dialog)
const supportStaff = [
  { id: 'sup-001', name: 'Abel T.', role: 'Technical Lead' },
  { id: 'sup-002', name: 'Meron K.', role: 'Customer Success' },
];

// ===== Loading / Error Skeletons =====
function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

// ===== Overview View =====
function OverviewView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overviewData, setOverviewData] = useState<{
    restaurants: { total: number; active: number; suspended: number; pending: number };
    mrr: number;
    tickets: { open: number; byStatus: Record<string, number> };
    recentSignups: Array<{
      id: string; name: string; slug: string; ownerName: string; ownerEmail: string;
      cuisine: string; city: string; plan: string; status: RestaurantStatus; joinedAt: string;
    }>;
    health: { uptime: number; activeSessions: number; ordersToday: number; orderGrowth: number; averageResponseTime: number };
  } | null>(null);
  const [revenueData, setRevenueData] = useState<MonthlyRevenue[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, analyticsRes] = await Promise.all([
        api.get<{ data: typeof overviewData }>('/api/admin/overview'),
        api.get<{ data: { monthlyRevenue: MonthlyRevenue[] } }>('/api/admin/analytics'),
      ]);
      setOverviewData(overviewRes.data);
      setRevenueData(analyticsRes.data.monthlyRevenue || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load overview data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <LoadingSkeleton />;
  if (error || !overviewData) return <ErrorState message={error || 'No data available'} onRetry={fetchData} />;

  const { restaurants, mrr, tickets, recentSignups, health } = overviewData;

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Restaurants</CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
              <Building2 className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{restaurants.total}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <ArrowUpRight className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-600">{restaurants.active}</span> active
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Subscriptions</CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{restaurants.active}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <ArrowUpRight className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-600">{restaurants.pending}</span> pending
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Recurring Revenue</CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
              <DollarSign className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatETB(mrr)}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-600">{health.orderGrowth >= 0 ? '+' : ''}{health.orderGrowth}%</span> order growth
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Tickets</CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
              <Ticket className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{tickets.open}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <Clock className="h-3 w-3 text-amber-500" />
              <span className="text-amber-600">{health.ordersToday}</span> orders today
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Revenue Trend</CardTitle>
            <CardDescription className="text-xs">Monthly recurring revenue over the past year</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {revenueData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="adminRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#039D55" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#039D55" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => [formatETB(value), 'Revenue']}
                      contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenueCents"
                      stroke="#039D55"
                      fillOpacity={1}
                      fill="url(#adminRevenueGrad)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No revenue data available</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Signups */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Signups</CardTitle>
            <CardDescription className="text-xs">Newest restaurants on the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSignups.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No recent signups</p>
              ) : (
                recentSignups.map((r) => (
                  <div key={r.id} className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {(r.name || '').split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.city} · {r.cuisine}</p>
                    </div>
                    <Badge variant="outline" className={getStatusColor(r.status)}>
                      {r.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform Health */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Platform Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-200/50">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-medium">System Status</p>
                <p className="text-xs text-emerald-600">All systems operational</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-200/50">
              <Activity className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Uptime (30d)</p>
                <p className="text-xs text-blue-600">{health.uptime}%</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-200/50">
              <Zap className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-sm font-medium">Avg Response Time</p>
                <p className="text-xs text-amber-600">{health.averageResponseTime}ms</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Restaurants View =====
function RestaurantsView() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [restaurants, setRestaurants] = useState<AdminRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    restaurant: AdminRestaurant | null;
    action: 'approve' | 'suspend' | 'reactivate' | null;
  }>({
    open: false,
    restaurant: null,
    action: null,
  });

  const fetchRestaurants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: AdminRestaurant[] }>('/api/admin/restaurants');
      setRestaurants(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load restaurants');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRestaurants(); }, [fetchRestaurants]);

  const filtered = useMemo(() => {
    return restaurants.filter(r => {
      const matchesSearch =
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.ownerName.toLowerCase().includes(search.toLowerCase()) ||
        r.ownerEmail.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchesPlan = planFilter === 'all' || r.plan === planFilter;
      return matchesSearch && matchesStatus && matchesPlan;
    });
  }, [restaurants, search, statusFilter, planFilter]);

  const handleAction = async () => {
    const { restaurant, action } = actionDialog;
    if (!restaurant || !action) return;

    setActionLoading(true);
    try {
      await api.put('/api/admin/restaurants', {
        restaurantId: restaurant.id,
        action,
      });
      const actionLabels = { approve: 'approved', suspend: 'suspended', reactivate: 'reactivated' };
      toast.success(`${restaurant.name} has been ${actionLabels[action]}`);
      setActionDialog({ open: false, restaurant: null, action: null });
      // Refresh the list after mutation
      await fetchRestaurants();
    } catch (err: any) {
      toast.error(err.message || `Failed to ${action} restaurant`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchRestaurants} />;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search restaurants, owners..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            <SelectItem value="basic">Basic</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">City</TableHead>
                  <TableHead className="hidden lg:table-cell">Tables</TableHead>
                  <TableHead className="hidden lg:table-cell">Monthly Revenue</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No restaurants found matching your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                              {(r.name || '').split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{r.name}</p>
                            <p className="text-xs text-muted-foreground">{r.ownerName}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {getPlanLabel(r.plan as any)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${getStatusColor(r.status)}`}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {r.city}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {r.tables}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {r.monthlyRevenue > 0 ? formatETB(r.monthlyRevenue) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setActionDialog({ open: true, restaurant: r, action: 'approve' })}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                        )}
                        {r.status === 'active' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setActionDialog({ open: true, restaurant: r, action: 'suspend' })}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Suspend
                          </Button>
                        )}
                        {r.status === 'suspended' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={() => setActionDialog({ open: true, restaurant: r, action: 'reactivate' })}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Reactivate
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => setActionDialog(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.action === 'approve' && 'Approve Restaurant'}
              {actionDialog.action === 'suspend' && 'Suspend Restaurant'}
              {actionDialog.action === 'reactivate' && 'Reactivate Restaurant'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.action === 'approve' && `Are you sure you want to approve "${actionDialog.restaurant?.name}"? This will activate their account and make their QR menu live.`}
              {actionDialog.action === 'suspend' && `Are you sure you want to suspend "${actionDialog.restaurant?.name}"? This will immediately disable their QR menu and dashboard access.`}
              {actionDialog.action === 'reactivate' && `Are you sure you want to reactivate "${actionDialog.restaurant?.name}"? This will restore their dashboard access and QR menu.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, restaurant: null, action: null })} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              variant={actionDialog.action === 'suspend' ? 'destructive' : 'default'}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Subscriptions View =====
function SubscriptionsView() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editDialog, setEditDialog] = useState<{ open: boolean; plan: SubscriptionPlan | null }>({ open: false, plan: null });
  const [createDialog, setCreateDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; plan: SubscriptionPlan | null }>({ open: false, plan: null });

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    price: 0,
    yearlyPrice: 0,
    features: [] as string[],
    maxBranches: 1,
    maxTables: 20,
    maxStaff: 5,
    maxMenuItems: 50,
    maxQRCodes: 20,
    sortOrder: 0,
    isActive: true,
  });
  const [newFeature, setNewFeature] = useState('');

  const resetForm = useCallback(() => {
    setFormData({
      name: '', slug: '', description: '', price: 0, yearlyPrice: 0,
      features: [], maxBranches: 1, maxTables: 20, maxStaff: 5, maxMenuItems: 50, maxQRCodes: 20, sortOrder: 0, isActive: true,
    });
    setNewFeature('');
  }, []);

  const populateForm = useCallback((plan: SubscriptionPlan) => {
    setFormData({
      name: plan.name,
      slug: plan.slug || plan.id,
      description: plan.description || '',
      price: fromCents(plan.priceCents),
      yearlyPrice: fromCents(plan.yearlyPriceCents ?? 0),
      features: Array.isArray(plan.features) ? [...plan.features] : [],
      maxBranches: plan.limits?.maxBranches ?? plan.maxBranches ?? 1,
      maxTables: plan.limits?.maxTables ?? plan.maxTables ?? 20,
      maxStaff: plan.limits?.maxStaff ?? plan.maxStaff ?? 5,
      maxMenuItems: plan.limits?.maxMenuItems ?? 50,
      maxQRCodes: plan.limits?.maxQRCodes ?? 20,
      sortOrder: plan.sortOrder ?? 0,
      isActive: plan.isActive ?? true,
    });
    setNewFeature('');
  }, []);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: any[]; meta: { totalMRR: number } }>('/api/admin/subscriptions');
      const mapped: SubscriptionPlan[] = (Array.isArray(res.data) ? res.data : []).map(p => ({
        id: p.id || p.slug,
        slug: p.slug,
        name: p.name,
        description: p.description,
        priceCents: p.priceCents,
        yearlyPriceCents: p.yearlyPriceCents,
        features: (() => {
          const f = p.features;
          if (Array.isArray(f)) return f;
          if (typeof f === 'string') { try { const parsed = JSON.parse(f); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
          if (f && typeof f === 'object') return Object.keys(f).filter(k => f[k] === true).map(k => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
          return [];
        })(),
        limits: p.limits || {},
        maxTables: p.limits?.maxTables || p.maxTables || 20,
        maxBranches: p.limits?.maxBranches || p.maxBranches || 1,
        maxStaff: p.limits?.maxStaff || p.maxStaff || 5,
        restaurants: p.activeSubscriptions || 0,
        revenueCents: p.revenueCents || 0,
        isActive: p.isActive,
        sortOrder: p.sortOrder,
      }));
      setPlans(mapped);
    } catch (err: any) {
      setError(err.message || 'Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const handleCreate = async () => {
    if (!formData.name || !formData.slug) {
      toast.error('Name and slug are required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/admin/subscriptions', {
        name: formData.name,
        slug: formData.slug,
        description: formData.description || null,
        price: formData.price,
        yearlyPrice: formData.yearlyPrice ? formData.yearlyPrice : null,
        features: formData.features,
        limits: {
          maxBranches: formData.maxBranches,
          maxTables: formData.maxTables,
          maxStaff: formData.maxStaff,
          maxMenuItems: formData.maxMenuItems,
          maxQRCodes: formData.maxQRCodes,
        },
        sortOrder: formData.sortOrder,
      });
      toast.success('Plan created successfully');
      setCreateDialog(false);
      resetForm();
      fetchPlans();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create plan');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editDialog.plan) return;
    setSaving(true);
    try {
      await api.put('/api/admin/subscriptions', {
        planId: editDialog.plan.id,
        name: formData.name,
        description: formData.description || null,
        price: formData.price,
        yearlyPrice: formData.yearlyPrice ? formData.yearlyPrice : null,
        features: formData.features,
        limits: {
          maxBranches: formData.maxBranches,
          maxTables: formData.maxTables,
          maxStaff: formData.maxStaff,
          maxMenuItems: formData.maxMenuItems,
          maxQRCodes: formData.maxQRCodes,
        },
        sortOrder: formData.sortOrder,
        isActive: formData.isActive,
      });
      toast.success('Plan updated successfully');
      setEditDialog({ open: false, plan: null });
      resetForm();
      fetchPlans();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.plan) return;
    setSaving(true);
    try {
      await api.delete(`/api/admin/subscriptions?planId=${deleteConfirm.plan.id}`);
      toast.success('Plan deactivated successfully');
      setDeleteConfirm({ open: false, plan: null });
      fetchPlans();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete plan');
    } finally {
      setSaving(false);
    }
  };

  const addFeature = () => {
    const f = newFeature.trim();
    if (f && !formData.features.includes(f)) {
      setFormData(prev => ({ ...prev, features: [...prev.features, f] }));
      setNewFeature('');
    }
  };

  const removeFeature = (index: number) => {
    setFormData(prev => ({ ...prev, features: prev.features.filter((_, i) => i !== index) }));
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchPlans} />;

  const revenueByPlan = plans.map(plan => ({
    name: plan.name,
    revenueCents: plan.revenueCents,
    restaurants: plan.restaurants,
  }));

  const planColors: Record<string, string> = {
    Basic: '#94a3b8',
    Pro: '#039D55',
    Premium: '#d97706',
  };

  return (
    <div className="space-y-6">
      {/* Header with Create button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Subscription Plans</h3>
          <p className="text-sm text-muted-foreground">Manage pricing, features, and limits for each plan</p>
        </div>
        <Button onClick={() => { resetForm(); setCreateDialog(true); }} className="gap-2">
          <CreditCard className="w-4 h-4" />
          Create Plan
        </Button>
      </div>

      {/* Plan Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map(plan => (
          <Card key={plan.id} className={`relative overflow-hidden ${!plan.isActive ? 'opacity-60' : ''} ${plan.slug === 'pro' ? 'ring-2 ring-primary' : ''}`}>
            {plan.slug === 'pro' && (
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-bl-lg">
                Popular
              </div>
            )}
            {!plan.isActive && (
              <div className="absolute top-0 left-0 bg-muted text-muted-foreground text-xs font-medium px-3 py-1 rounded-br-lg">
                Inactive
              </div>
            )}
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{plan.name}</CardTitle>
              <CardDescription>
                <span className="text-3xl font-bold text-foreground">
                  {plan.priceCents === 0 ? 'Free' : formatETB(plan.priceCents)}
                </span>
                {plan.priceCents > 0 && (
                  <span className="text-sm text-muted-foreground">/mo</span>
                )}
                {plan.yearlyPriceCents != null && plan.yearlyPriceCents > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({formatETB(plan.yearlyPriceCents)}/yr)
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground">Tables</p>
                  <p className="text-sm font-semibold">{plan.maxTables === -1 ? '∞' : plan.maxTables}</p>
                </div>
                <div className="p-2 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground">Branches</p>
                  <p className="text-sm font-semibold">{plan.maxBranches === -1 ? '∞' : plan.maxBranches}</p>
                </div>
                <div className="p-2 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground">Staff</p>
                  <p className="text-sm font-semibold">{plan.maxStaff === -1 ? '∞' : plan.maxStaff}</p>
                </div>
                <div className="p-2 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground">Items</p>
                  <p className="text-sm font-semibold">{(plan.limits?.maxMenuItems ?? 50) === -1 ? '∞' : (plan.limits?.maxMenuItems ?? 50)}</p>
                </div>
              </div>
              <Separator />
              <ul className="space-y-2">
                {Array.isArray(plan.features) && plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Active: <strong>{plan.restaurants}</strong> restaurants</span>
                <span className="text-muted-foreground">Revenue: <strong>{formatETB(plan.revenueCents)}</strong></span>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    populateForm(plan);
                    setEditDialog({ open: true, plan });
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteConfirm({ open: true, plan })}
                  disabled={plan.restaurants > 0}
                >
                  Deactivate
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue by Plan Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Revenue by Plan</CardTitle>
          <CardDescription className="text-xs">Monthly recurring revenue per subscription tier</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {revenueByPlan.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByPlan}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => [formatETB(value), 'Revenue']}
                    contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="revenueCents" radius={[6, 6, 0, 0]}>
                    {revenueByPlan.map((entry) => (
                      <Cell key={entry.name} fill={planColors[entry.name] || '#039D55'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No plan data available</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create Plan Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Subscription Plan</DialogTitle>
            <DialogDescription>Add a new pricing tier for restaurants</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Plan Name *</label>
                <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Enterprise" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">URL Slug *</label>
                <Input value={formData.slug} onChange={e => setFormData(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-') }))} placeholder="e.g. enterprise" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Brief description of the plan" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Monthly Price (ETB) *</label>
                <Input type="number" min={0} value={formData.price} onChange={e => setFormData(p => ({ ...p, price: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Yearly Price (ETB)</label>
                <Input type="number" min={0} value={formData.yearlyPrice} onChange={e => setFormData(p => ({ ...p, yearlyPrice: Number(e.target.value) }))} />
              </div>
            </div>

            <Separator />
            <h4 className="text-sm font-semibold">Plan Limits</h4>
            <p className="text-xs text-muted-foreground">Use -1 for unlimited</p>
            <div className="grid grid-cols-5 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Branches</label>
                <Input type="number" value={formData.maxBranches} onChange={e => setFormData(p => ({ ...p, maxBranches: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Tables</label>
                <Input type="number" value={formData.maxTables} onChange={e => setFormData(p => ({ ...p, maxTables: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Staff</label>
                <Input type="number" value={formData.maxStaff} onChange={e => setFormData(p => ({ ...p, maxStaff: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Menu Items</label>
                <Input type="number" value={formData.maxMenuItems} onChange={e => setFormData(p => ({ ...p, maxMenuItems: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">QR Codes</label>
                <Input type="number" value={formData.maxQRCodes} onChange={e => setFormData(p => ({ ...p, maxQRCodes: Number(e.target.value) }))} />
              </div>
            </div>

            <Separator />
            <h4 className="text-sm font-semibold">Features</h4>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input value={newFeature} onChange={e => setNewFeature(e.target.value)} placeholder="Add a feature..." onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }} />
                <Button type="button" variant="outline" onClick={addFeature}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.features.map((f, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 pr-1">
                    {f}
                    <button onClick={() => removeFeature(i)} className="ml-1 hover:text-destructive">
                      <XCircle className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Sort Order</label>
              <Input type="number" value={formData.sortOrder} onChange={e => setFormData(p => ({ ...p, sortOrder: Number(e.target.value) }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !formData.name || !formData.slug}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Plan Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => { setEditDialog(prev => ({ ...prev, open })); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Plan — {editDialog.plan?.name}</DialogTitle>
            <DialogDescription>Update pricing, features, and limits</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Plan Name</label>
                <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Monthly Price (ETB)</label>
                <Input type="number" min={0} value={formData.price} onChange={e => setFormData(p => ({ ...p, price: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Yearly Price (ETB)</label>
                <Input type="number" min={0} value={formData.yearlyPrice} onChange={e => setFormData(p => ({ ...p, yearlyPrice: Number(e.target.value) }))} />
              </div>
            </div>

            <Separator />
            <h4 className="text-sm font-semibold">Plan Limits</h4>
            <p className="text-xs text-muted-foreground">Use -1 for unlimited</p>
            <div className="grid grid-cols-5 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Branches</label>
                <Input type="number" value={formData.maxBranches} onChange={e => setFormData(p => ({ ...p, maxBranches: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Tables</label>
                <Input type="number" value={formData.maxTables} onChange={e => setFormData(p => ({ ...p, maxTables: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Staff</label>
                <Input type="number" value={formData.maxStaff} onChange={e => setFormData(p => ({ ...p, maxStaff: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Menu Items</label>
                <Input type="number" value={formData.maxMenuItems} onChange={e => setFormData(p => ({ ...p, maxMenuItems: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">QR Codes</label>
                <Input type="number" value={formData.maxQRCodes} onChange={e => setFormData(p => ({ ...p, maxQRCodes: Number(e.target.value) }))} />
              </div>
            </div>

            <Separator />
            <h4 className="text-sm font-semibold">Features</h4>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input value={newFeature} onChange={e => setNewFeature(e.target.value)} placeholder="Add a feature..." onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }} />
                <Button type="button" variant="outline" onClick={addFeature}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.features.map((f, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 pr-1">
                    {f}
                    <button onClick={() => removeFeature(i)} className="ml-1 hover:text-destructive">
                      <XCircle className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Sort Order</label>
                <Input type="number" value={formData.sortOrder} onChange={e => setFormData(p => ({ ...p, sortOrder: Number(e.target.value) }))} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={formData.isActive} onCheckedChange={v => setFormData(p => ({ ...p, isActive: v }))} />
                <span className="text-sm font-medium">{formData.isActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditDialog({ open: false, plan: null }); resetForm(); }}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete/Deactivate Confirm Dialog */}
      <Dialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm({ open, plan: null })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deactivate Plan</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate the <strong>{deleteConfirm.plan?.name}</strong> plan?
              {deleteConfirm.plan?.restaurants && deleteConfirm.plan.restaurants > 0
                ? ` It has ${deleteConfirm.plan.restaurants} active restaurant(s) — it will be deactivated but existing subscriptions remain active.`
                : ' It will no longer be available for new sign-ups.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm({ open: false, plan: null })}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Support Tickets View =====
function TicketsView() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; ticket: SupportTicket | null }>({
    open: false,
    ticket: null,
  });

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: any[] }>('/api/admin/tickets');
      // Map API response to match SupportTicket shape
      const mapped: SupportTicket[] = (Array.isArray(res.data) ? res.data : []).map(t => ({
        id: t.id,
        subject: t.subject,
        description: t.description,
        restaurantName: t.restaurantName || 'Unknown',
        restaurantId: t.restaurantId || '',
        status: t.status,
        priority: t.priority === 'critical' ? 'urgent' : t.priority,
        category: t.category || 'General',
        assignedTo: t.assignedTo || null,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }));
      setTickets(mapped);
    } catch (err: any) {
      setError(err.message || 'Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const filtered = useMemo(() => {
    return tickets.filter(t => statusFilter === 'all' || t.status === statusFilter);
  }, [tickets, statusFilter]);

  const ticketCounts = useMemo(() => ({
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  }), [tickets]);

  const handleAssign = async (staffId: string, staffName: string) => {
    const { ticket } = assignDialog;
    if (!ticket) return;

    setActionLoading(true);
    try {
      await api.put('/api/admin/tickets', {
        ticketId: ticket.id,
        assignedTo: staffId,
        status: 'in_progress',
      });
      toast.success(`Ticket assigned to ${staffName}`);
      setAssignDialog({ open: false, ticket: null });
      await fetchTickets();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign ticket');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async (ticket: SupportTicket) => {
    setActionLoading(true);
    try {
      await api.put('/api/admin/tickets', {
        ticketId: ticket.id,
        status: 'resolved',
      });
      toast.success('Ticket resolved successfully');
      setSelectedTicket(null);
      await fetchTickets();
    } catch (err: any) {
      toast.error(err.message || 'Failed to resolve ticket');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchTickets} />;

  return (
    <div className="space-y-4">
      {/* Status Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'All', count: tickets.length },
          { key: 'open', label: 'Open', count: ticketCounts.open },
          { key: 'in_progress', label: 'In Progress', count: ticketCounts.in_progress },
          { key: 'resolved', label: 'Resolved', count: ticketCounts.resolved },
          { key: 'closed', label: 'Closed', count: ticketCounts.closed },
        ].map(tab => (
          <Button
            key={tab.key}
            size="sm"
            variant={statusFilter === tab.key ? 'default' : 'outline'}
            onClick={() => setStatusFilter(tab.key)}
            className="h-8 text-xs"
          >
            {tab.label}
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
              {tab.count}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Ticket List */}
      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No tickets found.
            </CardContent>
          </Card>
        ) : (
          filtered.map(ticket => (
            <Card
              key={ticket.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedTicket(ticket)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium truncate">{ticket.subject}</h4>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{ticket.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {ticket.restaurantName}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(ticket.createdAt)}
                      </span>
                      {ticket.assignedTo && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {ticket.assignedTo}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-xs shrink-0 ${getTicketStatusColor(ticket.status)}`}>
                    {ticket.status.replace('_', ' ')}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => { if (!open) setSelectedTicket(null); }}>
        <DialogContent className="max-w-lg">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">{selectedTicket.subject}</DialogTitle>
                <DialogDescription className="text-xs">
                  {selectedTicket.restaurantName} · {selectedTicket.category} · {formatDate(selectedTicket.createdAt)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${getTicketStatusColor(selectedTicket.status)}`}>
                    {selectedTicket.status.replace('_', ' ')}
                  </Badge>
                  <Badge variant="outline" className={`text-xs ${getPriorityColor(selectedTicket.priority)}`}>
                    {selectedTicket.priority} priority
                  </Badge>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                  {selectedTicket.description}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Assigned to: {selectedTicket.assignedTo || <span className="text-amber-600">Unassigned</span>}
                  </span>
                </div>
              </div>
              <DialogFooter className="gap-2">
                {!selectedTicket.assignedTo && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAssignDialog({ open: true, ticket: selectedTicket })}
                    disabled={actionLoading}
                  >
                    <Users className="h-3.5 w-3.5 mr-1" />
                    Assign
                  </Button>
                )}
                {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && (
                  <Button size="sm" onClick={() => handleResolve(selectedTicket)} disabled={actionLoading}>
                    {actionLoading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                    Resolve
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={assignDialog.open} onOpenChange={(open) => setAssignDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Ticket</DialogTitle>
            <DialogDescription>Choose a support staff member to assign this ticket to.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {supportStaff.map(staff => (
              <Button
                key={staff.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleAssign(staff.id, staff.name)}
                disabled={actionLoading}
              >
                <Avatar className="h-7 w-7 mr-2">
                  <AvatarFallback className="text-xs">{(staff.name || '').split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="text-sm font-medium">{staff.name}</p>
                  <p className="text-xs text-muted-foreground">{staff.role}</p>
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Feature Flags View =====
function FlagsView() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // flag id being toggled

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: any[] }>('/api/admin/flags');
      const mapped: FeatureFlag[] = (Array.isArray(res.data) ? res.data : []).map(f => ({
        id: f.id,
        name: f.name,
        key: f.key,
        description: f.description || '',
        enabled: f.enabled,
        rolloutPercentage: f.rolloutPercentage ?? (f.enabled ? 100 : 0),
        updatedAt: f.updatedAt,
      }));
      setFlags(mapped);
    } catch (err: any) {
      setError(err.message || 'Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFlags(); }, [fetchFlags]);

  const handleToggle = async (id: string) => {
    const flag = flags.find(f => f.id === id);
    if (!flag) return;

    const newEnabled = !flag.enabled;
    setActionLoading(id);
    try {
      await api.put('/api/admin/flags', {
        flagId: id,
        enabled: newEnabled,
        rolloutPercentage: newEnabled ? 100 : 0,
      });
      toast.success(`${flag.name} ${newEnabled ? 'enabled' : 'disabled'}`);
      await fetchFlags();
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle flag');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRolloutChange = async (id: string, percentage: number) => {
    setActionLoading(id);
    try {
      await api.put('/api/admin/flags', {
        flagId: id,
        rolloutPercentage: percentage,
      });
      toast.success(`Rollout updated to ${percentage}%`);
      await fetchFlags();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update rollout');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchFlags} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Feature Flags</h3>
          <p className="text-xs text-muted-foreground">Control feature availability across the platform</p>
        </div>
        <Badge variant="outline" className="text-xs">
          {flags.filter(f => f.enabled).length} / {flags.length} enabled
        </Badge>
      </div>

      <div className="space-y-3">
        {flags.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No feature flags configured.
            </CardContent>
          </Card>
        ) : (
          flags.map(flag => (
            <Card key={flag.id} className={flag.enabled ? 'border-primary/30' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium">{flag.name}</h4>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {flag.key}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{flag.description}</p>
                    {flag.enabled && (
                      <div className="pt-2 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Rollout: {flag.rolloutPercentage}%</span>
                          <span className="text-muted-foreground">
                            Updated {new Date(flag.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <Progress value={flag.rolloutPercentage} className="h-1.5" />
                        <div className="flex gap-1">
                          {[0, 25, 50, 75, 100].map(pct => (
                            <Button
                              key={pct}
                              size="sm"
                              variant={flag.rolloutPercentage === pct ? 'default' : 'outline'}
                              className="h-6 text-[10px] px-2"
                              onClick={() => handleRolloutChange(flag.id, pct)}
                              disabled={actionLoading === flag.id}
                            >
                              {pct}%
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <Switch
                    checked={flag.enabled}
                    onCheckedChange={() => handleToggle(flag.id)}
                    disabled={actionLoading === flag.id}
                  />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ===== Platform Analytics View =====
function AnalyticsView() {
  const cuisineColors = ['#039D55', '#d97706', '#6366f1', '#ef4444', '#8b5cf6', '#06b6d4'];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<{
    restaurants: { total: number; active: number; suspended: number; pending: number };
    mrr: number;
    ordersLast30Days: number;
    revenueLast30Days: number;
    revenueByPlan: Array<{ name: string; slug: string; priceCents: number; count: number; revenueCents: number }>;
    cuisineDistribution: CuisineStat[];
    geographicDistribution: GeoStat[];
    monthlyGrowth: Array<{ month: string; signups: number; monthLabel: string }>;
    monthlyRevenue: MonthlyRevenue[];
  } | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: typeof analyticsData }>('/api/admin/analytics');
      setAnalyticsData(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  if (loading) return <LoadingSkeleton />;
  if (error || !analyticsData) return <ErrorState message={error || 'No data available'} onRetry={fetchAnalytics} />;

  const { restaurants, mrr, ordersLast30Days, revenueLast30Days, cuisineDistribution, geographicDistribution, monthlyRevenue } = analyticsData;
  const avgRevenuePerRestaurant = restaurants.active > 0 ? Math.round(revenueLast30Days / restaurants.active) : 0;

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Platform Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatETB(revenueLast30Days)}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-600">Last 30 days</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders (Platform)</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ordersLast30Days.toLocaleString()}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-600">Last 30 days</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">MRR</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatETB(mrr)}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-600">{restaurants.active} active</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Revenue / Restaurant</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatETB(avgRevenuePerRestaurant)}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <TrendingDown className="h-3 w-3 text-red-500" />
              <span className="text-red-600">30d avg</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Restaurant Growth */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Restaurant Growth</CardTitle>
            <CardDescription className="text-xs">New signups and active subscriptions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {monthlyRevenue.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                      formatter={(value: number, name: string) => [
                        value,
                        name === 'newRestaurants' ? 'New Restaurants' : 'Total Subscriptions'
                      ]}
                    />
                    <Bar yAxisId="left" dataKey="newRestaurants" fill="#039D55" radius={[4, 4, 0, 0]} name="newRestaurants" />
                    <Line yAxisId="right" type="monotone" dataKey="subscriptions" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} name="subscriptions" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No growth data available</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Revenue Trend</CardTitle>
            <CardDescription className="text-xs">Monthly platform revenue over the past year</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {monthlyRevenue.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => [formatETB(value), 'Revenue']}
                      contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Line type="monotone" dataKey="revenueCents" stroke="#039D55" strokeWidth={2.5} dot={{ r: 3, fill: '#039D55' }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No revenue data available</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Popular Cuisines */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Popular Cuisines</CardTitle>
            <CardDescription className="text-xs">Distribution of restaurant cuisines</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center">
              {cuisineDistribution.length > 0 ? (
                <>
                  <div className="w-1/2 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={cuisineDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          dataKey="count"
                          nameKey="cuisine"
                          paddingAngle={2}
                        >
                          {cuisineDistribution.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={cuisineColors[index % cuisineColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number, name: string) => [`${value} restaurants`, name]}
                          contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-1/2 space-y-2 pl-4">
                    {cuisineDistribution.map((c, i) => (
                      <div key={c.cuisine} className="flex items-center gap-2 text-sm">
                        <div
                          className="h-3 w-3 rounded-sm shrink-0"
                          style={{ backgroundColor: cuisineColors[i % cuisineColors.length] }}
                        />
                        <span className="truncate">{c.cuisine}</span>
                        <span className="text-muted-foreground ml-auto">{c.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center w-full h-full text-sm text-muted-foreground">No cuisine data available</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Geographic Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Geographic Distribution</CardTitle>
            <CardDescription className="text-xs">Restaurants and revenue by city</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {geographicDistribution.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No geographic data available</p>
              ) : (
                geographicDistribution.map((geo) => (
                  <div key={geo.city} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{geo.city}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {geo.restaurants} restaurant{geo.restaurants !== 1 ? 's' : ''} · {formatETB(geo.revenueCents)}
                      </div>
                    </div>
                    <Progress
                      value={(geo.restaurants / restaurants.total) * 100}
                      className="h-2"
                    />
                  </div>
                ))
              )}
            </div>
            <Separator className="my-4" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Coverage</span>
              <span className="font-medium">{geographicDistribution.length} cities</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ===== AI Management View =====
function AiManagementView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<{
    flags: Record<string, { enabled: boolean; config: string | null }>;
    stats: {
      totalConversations: number;
      totalMessages: number;
      totalActionLogs: number;
      totalSuggestions: number;
      totalRestaurants: number;
      restaurantsUsingAI: number;
      agentStats: Array<{ agentType: string; conversations: number; messages: number; suggestions: number }>;
      topRestaurants: Array<{ restaurantId: string; name: string; slug: string; configCount: number }>;
    };
    recentActionLogs: Array<any>;
    globalDefaults: {
      temperature: number;
      maxTokens: number;
      maxToolIterations: number;
      disabledTools: string[];
    };
  } | null>(null);

  const [localFlags, setLocalFlags] = useState<Record<string, boolean>>({});
  const [localDefaults, setLocalDefaults] = useState({
    temperature: 0.6,
    maxTokens: 2048,
    maxToolIterations: 5,
    disabledTools: [] as string[],
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<typeof data>('/api/admin/ai');
      setData(res);
      // Initialize local state
      setLocalFlags({
        ai_enabled: res.flags?.ai_enabled?.enabled ?? true,
        ai_owner_enabled: res.flags?.ai_owner_enabled?.enabled ?? true,
        ai_kitchen_enabled: res.flags?.ai_kitchen_enabled?.enabled ?? true,
        ai_waiter_enabled: res.flags?.ai_waiter_enabled?.enabled ?? true,
        ai_customer_enabled: res.flags?.ai_customer_enabled?.enabled ?? true,
      });
      if (res.globalDefaults) {
        setLocalDefaults({
          temperature: res.globalDefaults.temperature ?? 0.6,
          maxTokens: res.globalDefaults.maxTokens ?? 2048,
          maxToolIterations: res.globalDefaults.maxToolIterations ?? 5,
          disabledTools: res.globalDefaults.disabledTools ?? [],
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load AI data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/api/admin/ai', {
        flags: localFlags,
        globalDefaults: localDefaults,
      });
      toast.success('AI settings saved successfully');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save AI settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSkeleton />;
  if (error || !data) return <ErrorState message={error || 'No data available'} onRetry={fetchData} />;

  const agentInfo: Record<string, { name: string; icon: string; color: string }> = {
    owner: { name: 'Business AI', icon: '🧠', color: '#6366f1' },
    kitchen: { name: 'Kitchen AI', icon: '👨\u200D🍳', color: '#f59e0b' },
    waiter: { name: 'Service AI', icon: '🍽️', color: '#10b981' },
    customer: { name: 'Menu AI', icon: '✨', color: '#8b5cf6' },
  };

  const allTools = [
    'get_analytics', 'get_menu_performance', 'get_inventory_status', 'suggest_promotion',
    'get_review_insights', 'get_demand_forecast', 'get_order_queue', 'get_prep_suggestion',
    'get_batch_suggestions', 'check_ingredient_availability', 'get_allergen_info',
    'get_table_status', 'get_order_details', 'get_upsell_suggestions', 'get_menu_item_details',
    'get_waiter_calls', 'get_menu_items', 'get_item_details', 'get_pairing_suggestions',
    'check_allergen_safety', 'get_active_promotions', 'get_recommendation',
  ];

  const toggleTool = (tool: string) => {
    setLocalDefaults(prev => ({
      ...prev,
      disabledTools: prev.disabledTools.includes(tool)
        ? prev.disabledTools.filter(t => t !== tool)
        : [...prev.disabledTools, tool],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Master AI Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Bot className="h-4 w-4" />
            AI Platform Control
          </CardTitle>
          <CardDescription className="text-xs">Master switch and per-agent-type feature toggles for the entire platform</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm font-medium">AI Enabled (Platform-Wide)</p>
              <p className="text-xs text-muted-foreground">When disabled, all AI agents are shut off for every restaurant</p>
            </div>
            <Switch
              checked={localFlags.ai_enabled}
              onCheckedChange={(checked) => setLocalFlags(prev => ({ ...prev, ai_enabled: checked }))}
            />
          </div>
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(['owner', 'kitchen', 'waiter', 'customer'] as const).map(type => {
              const info = agentInfo[type];
              const flagKey = `ai_${type}_enabled` as keyof typeof localFlags;
              return (
                <div
                  key={type}
                  className={`p-3 rounded-lg border transition-colors ${
                    localFlags[flagKey] ? 'border-primary/30 bg-primary/5' : 'border-muted bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{info.icon}</span>
                      <span className="text-sm font-medium">{info.name}</span>
                    </div>
                    <Switch
                      checked={localFlags[flagKey]}
                      onCheckedChange={(checked) => setLocalFlags(prev => ({ ...prev, [flagKey]: checked }))}
                      disabled={!localFlags.ai_enabled}
                    />
                  </div>
                  {data.stats.agentStats.find(a => a.agentType === type) && (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>{data.stats.agentStats.find(a => a.agentType === type)!.conversations} conversations</p>
                      <p>{data.stats.agentStats.find(a => a.agentType === type)!.messages} messages</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Global Defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Global Default Configuration</CardTitle>
          <CardDescription className="text-xs">Default settings applied to new restaurants. Existing restaurants keep their own configs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Default Temperature</Label>
                <span className="text-xs text-muted-foreground font-mono">{localDefaults.temperature.toFixed(1)}</span>
              </div>
              <Input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={localDefaults.temperature}
                onChange={(e) => setLocalDefaults(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Precise</span><span>Creative</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Max Tokens</Label>
              <Input
                type="number"
                min={256}
                max={4096}
                step={256}
                value={localDefaults.maxTokens}
                onChange={(e) => setLocalDefaults(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || 2048 }))}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Max Tool Iterations</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={localDefaults.maxToolIterations}
                onChange={(e) => setLocalDefaults(prev => ({ ...prev, maxToolIterations: parseInt(e.target.value) || 5 }))}
                className="text-sm"
              />
            </div>
          </div>
          <Separator />
          <div>
            <h4 className="text-xs font-semibold text-gray-700 mb-2">Globally Disabled Tools</h4>
            <p className="text-[10px] text-muted-foreground mb-2">Tools disabled here cannot be used by any restaurant&apos;s AI agents</p>
            <div className="flex flex-wrap gap-1.5">
              {allTools.map(tool => {
                const isDisabled = localDefaults.disabledTools.includes(tool);
                return (
                  <button
                    key={tool}
                    onClick={() => toggleTool(tool)}
                    className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                      isDisabled
                        ? 'border-red-300 bg-red-50 text-red-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {tool.replace(/_/g, ' ')}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Conversations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.totalConversations}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.totalMessages}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">AI Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.totalActionLogs}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.totalSuggestions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Restaurants Using AI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.restaurantsUsingAI}</div>
            <p className="text-xs text-muted-foreground">of {data.stats.totalRestaurants}</p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Per-Agent Usage Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead className="text-right">Conversations</TableHead>
                <TableHead className="text-right">Messages</TableHead>
                <TableHead className="text-right">Suggestions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.stats.agentStats.map(stat => {
                const info = agentInfo[stat.agentType] || { name: stat.agentType, icon: '?', color: '#888' };
                return (
                  <TableRow key={stat.agentType}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{info.icon}</span>
                        <span className="text-sm font-medium">{info.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">{stat.conversations}</TableCell>
                    <TableCell className="text-right text-sm">{stat.messages}</TableCell>
                    <TableCell className="text-right text-sm">{stat.suggestions}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Top Restaurants */}
      {data.stats.topRestaurants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top AI-Using Restaurants</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead className="text-right">Agent Configs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.stats.topRestaurants.map(r => (
                  <TableRow key={r.restaurantId}>
                    <TableCell className="text-sm font-medium">{r.name}</TableCell>
                    <TableCell className="text-right text-sm">{r.configCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Actions */}
      {data.recentActionLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent AI Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {data.recentActionLogs.map((log: any) => (
                  <div key={log.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 text-xs">
                    <Badge variant="outline" className="text-[10px] shrink-0">{log.action}</Badge>
                    <span className="text-muted-foreground truncate">{log.restaurant?.name || 'Unknown'}</span>
                    <Badge variant={log.status === 'success' ? 'default' : 'secondary'} className="text-[10px] ml-auto shrink-0">{log.status}</Badge>
                    <span className="text-muted-foreground shrink-0">{new Date(log.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Save Platform AI Settings
        </Button>
      </div>
    </div>
  );
}

// ===== Main Admin App =====
export default function AdminApp() {
  const [activeView, setActiveView] = useState<AdminView>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const renderView = () => {
    switch (activeView) {
      case 'overview':
        return <OverviewView />;
      case 'restaurants':
        return <RestaurantsView />;
      case 'subscriptions':
        return <SubscriptionsView />;
      case 'tickets':
        return <TicketsView />;
      case 'flags':
        return <FlagsView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'ai':
        return <AiManagementView />;
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar - Desktop */}
      <aside
        className={`hidden md:flex flex-col bg-slate-900 text-white transition-all duration-200 ${
          sidebarCollapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 h-14 border-b border-slate-700/50">
          <img src="/logo.png" alt="Yene QR" className="h-8 w-8 rounded-lg object-contain shrink-0" />
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <h1 className="text-sm font-semibold truncate">Yene QR</h1>
              <p className="text-[10px] text-slate-400 truncate">Super Admin</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                } ${sidebarCollapsed ? 'justify-center' : ''}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="p-2 border-t border-slate-700/50">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
        </div>

        {/* User */}
        {!sidebarCollapsed && (
          <div className="p-3 border-t border-slate-700/50">
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-emerald-600 text-white text-xs">SA</AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
                <p className="text-xs font-medium truncate">Super Admin</p>
                <p className="text-[10px] text-slate-400 truncate">admin@yeneqr.com</p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile Nav */}
        <div className="md:hidden flex items-center gap-2 p-3 border-b bg-white overflow-x-auto">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white font-bold text-xs shrink-0">
            YQ
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-emerald-500 text-white'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">
              {navItems.find(n => n.id === activeView)?.label}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {activeView === 'overview' && 'Platform-wide metrics and health status'}
              {activeView === 'restaurants' && 'Manage restaurant accounts and approvals'}
              {activeView === 'subscriptions' && 'Subscription plans and revenue breakdown'}
              {activeView === 'tickets' && 'Customer support ticket management'}
              {activeView === 'flags' && 'Toggle and configure platform features'}
              {activeView === 'analytics' && 'Platform-wide analytics and trends'}
              {activeView === 'ai' && 'Configure AI agents, monitor usage, and manage platform-wide AI settings'}
            </p>
          </div>
          {renderView()}
        </main>
      </div>
    </div>
  );
}

// Named export for easy integration as a view option
export { AdminApp };
