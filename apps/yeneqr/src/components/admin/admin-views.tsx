'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import { Progress } from '@/components/ui/progress';
import { ConfigureBillingDialog } from '@/components/admin/configure-billing-dialog';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  HeadphonesIcon,
  Flag,
  BarChart3,
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
  LogIn,
  Settings2,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { slugPath } from '@/lib/router';
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

// Support staff constant (used for ticket assignment dialog)
const supportStaff = [
  { id: 'sup-001', name: 'Abel T.', role: 'Technical Lead' },
  { id: 'sup-002', name: 'Meron K.', role: 'Customer Success' },
];

// ===== Shared loading/error components =====
function ViewLoading() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
    </div>
  );
}

function ViewError({ message, onRetry }: { message: string; onRetry?: () => void }) {
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
export function AdminOverviewView() {
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

  if (loading) return <ViewLoading />;
  if (error || !overviewData) return <ViewError message={error || 'No data available'} onRetry={fetchData} />;

  const { restaurants, mrr, tickets, recentSignups, health } = overviewData;

  return (
    <div className="space-y-6">
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

      <div className="grid gap-4 lg:grid-cols-2">
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
                    <Tooltip formatter={(value: number) => [formatETB(value), 'Revenue']} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="revenueCents" stroke="#039D55" fillOpacity={1} fill="url(#adminRevenueGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No revenue data available</div>
              )}
            </div>
          </CardContent>
        </Card>
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
export function AdminRestaurantsView() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [restaurants, setRestaurants] = useState<AdminRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [enteringRestaurant, setEnteringRestaurant] = useState<string | null>(null);
  const { switchRestaurant } = useAppStore();
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    restaurant: AdminRestaurant | null;
    action: 'approve' | 'suspend' | 'reactivate' | null;
  }>({ open: false, restaurant: null, action: null });
  const [configureDialog, setConfigureDialog] = useState<{
    open: boolean;
    restaurant: AdminRestaurant | null;
  }>({ open: false, restaurant: null });

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
      const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) || r.ownerName.toLowerCase().includes(search.toLowerCase()) || r.ownerEmail.toLowerCase().includes(search.toLowerCase());
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
      await api.put('/api/admin/restaurants', { restaurantId: restaurant.id, action });
      const actionLabels = { approve: 'approved', suspend: 'suspended', reactivate: 'reactivated' };
      toast.success(`${restaurant.name} has been ${actionLabels[action]}`);
      setActionDialog({ open: false, restaurant: null, action: null });
      await fetchRestaurants();
    } catch (err: any) {
      toast.error(err.message || `Failed to ${action} restaurant`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnterRestaurant = async (restaurant: AdminRestaurant) => {
    setEnteringRestaurant(restaurant.id);
    try {
      const res = await api.post<{
        message: string;
        token: string;
        user: {
          id: string;
          name: string;
          email: string;
          role: string;
          twoFactorEnabled: boolean;
          restaurant: { id: string; name: string; nameAm?: string; slug: string; cuisineType?: string; logo?: string; };
          branch: { id: string; name: string } | null;
        };
        isAdminImpersonation?: boolean;
        originalRole?: string;
      }>('/api/auth/switch-restaurant', { restaurantId: restaurant.id });

      const userData = {
        id: res.user.id,
        name: res.user.name,
        email: res.user.email,
        role: res.user.role,
        restaurantId: res.user.restaurant?.id,
        restaurantName: res.user.restaurant?.name,
        restaurantSlug: res.user.restaurant?.slug,
        branchId: res.user.branch?.id,
        isAdminImpersonation: res.isAdminImpersonation || false,
        originalRole: res.originalRole,
      };

      switchRestaurant(res.token, userData);
      toast.success(`Entered ${restaurant.name} dashboard`);
      // Navigate to the slug-prefixed dashboard
      const slug = res.user.restaurant?.slug || res.user.restaurant?.id;
      window.location.hash = slugPath(slug, '/dashboard');
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Failed to enter restaurant');
    } finally {
      setEnteringRestaurant(null);
    }
  };

  if (loading) return <ViewLoading />;
  if (error) return <ViewError message={error} onRetry={fetchRestaurants} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search restaurants, owners..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Plan" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            <SelectItem value="basic">Basic</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
          </SelectContent>
        </Select>
      </div>
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
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No restaurants found.</TableCell>
                  </TableRow>
                ) : filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{(r.name || '').split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback></Avatar>
                        <div><p className="text-sm font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.ownerName}</p></div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{getPlanLabel(r.plan as any)}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={`text-xs ${getStatusColor(r.status)}`}>{r.status}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{r.city}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{r.tables}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{r.monthlyRevenue > 0 ? formatETB(r.monthlyRevenue) : '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => handleEnterRestaurant(r)}
                          disabled={enteringRestaurant === r.id}
                        >
                          {enteringRestaurant === r.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <LogIn className="h-3 w-3" />
                          )}
                          Enter
                        </Button>
                        {r.status === 'pending' && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setActionDialog({ open: true, restaurant: r, action: 'approve' })}><CheckCircle2 className="h-3 w-3 mr-1" />Approve</Button>}
                        {r.status === 'active' && <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setActionDialog({ open: true, restaurant: r, action: 'suspend' })}><XCircle className="h-3 w-3 mr-1" />Suspend</Button>}
                        {r.status === 'suspended' && <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => setActionDialog({ open: true, restaurant: r, action: 'reactivate' })}><CheckCircle2 className="h-3 w-3 mr-1" />Reactivate</Button>}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => setConfigureDialog({ open: true, restaurant: r })}
                          title="Configure subscription (custom fee rate, price, plan)"
                        >
                          <Settings2 className="h-3 w-3" />
                          Configure
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
      <Dialog open={actionDialog.open} onOpenChange={(open) => setActionDialog(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionDialog.action === 'approve' ? 'Approve' : actionDialog.action === 'suspend' ? 'Suspend' : 'Reactivate'} Restaurant</DialogTitle>
            <DialogDescription>Are you sure you want to {actionDialog.action} &quot;{actionDialog.restaurant?.name}&quot;?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, restaurant: null, action: null })} disabled={actionLoading}>Cancel</Button>
            <Button onClick={handleAction} variant={actionDialog.action === 'suspend' ? 'destructive' : 'default'} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Configure Billing Dialog (fee rate + subscription) */}
      <ConfigureBillingDialog
        open={configureDialog.open}
        onOpenChange={(open) => setConfigureDialog(prev => ({ ...prev, open }))}
        restaurantId={configureDialog.restaurant?.id || null}
        restaurantName={configureDialog.restaurant?.name}
        onSaved={fetchRestaurants}
      />
    </div>
  );
}

// ===== Subscriptions View (Full CRUD) =====
export function AdminSubscriptionsView() {
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
        priceCents: toCents(formData.price),
        yearlyPriceCents: formData.yearlyPrice ? toCents(formData.yearlyPrice) : null,
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
        priceCents: toCents(formData.price),
        yearlyPriceCents: formData.yearlyPrice ? toCents(formData.yearlyPrice) : null,
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

  if (loading) return <ViewLoading />;
  if (error) return <ViewError message={error} onRetry={fetchPlans} />;

  const revenueByPlan = plans.map(plan => ({ name: plan.name, revenueCents: plan.revenueCents, restaurants: plan.restaurants }));
  const planColors: Record<string, string> = { Basic: '#94a3b8', Pro: '#039D55', Premium: '#d97706' };

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
export function AdminSupportView() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; ticket: SupportTicket | null }>({ open: false, ticket: null });

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: any[] }>('/api/admin/tickets');
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

  const filtered = useMemo(() => tickets.filter(t => statusFilter === 'all' || t.status === statusFilter), [tickets, statusFilter]);
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
      await api.put('/api/admin/tickets', { ticketId: ticket.id, assignedTo: staffId, status: 'in_progress' });
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
      await api.put('/api/admin/tickets', { ticketId: ticket.id, status: 'resolved' });
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

  if (loading) return <ViewLoading />;
  if (error) return <ViewError message={error} onRetry={fetchTickets} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'All', count: tickets.length },
          { key: 'open', label: 'Open', count: ticketCounts.open },
          { key: 'in_progress', label: 'In Progress', count: ticketCounts.in_progress },
          { key: 'resolved', label: 'Resolved', count: ticketCounts.resolved },
          { key: 'closed', label: 'Closed', count: ticketCounts.closed },
        ].map(tab => (
          <Button key={tab.key} size="sm" variant={statusFilter === tab.key ? 'default' : 'outline'} onClick={() => setStatusFilter(tab.key)} className="h-8 text-xs">
            {tab.label}
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{tab.count}</Badge>
          </Button>
        ))}
      </div>
      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No tickets found.</CardContent></Card>
        ) : filtered.map(ticket => (
          <Card key={ticket.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedTicket(ticket)}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-medium truncate">{ticket.subject}</h4>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{ticket.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{ticket.restaurantName}</span>
                    <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{formatDate(ticket.createdAt)}</span>
                    {ticket.assignedTo && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{ticket.assignedTo}</span>}
                  </div>
                </div>
                <Badge variant="outline" className={`text-xs shrink-0 ${getTicketStatusColor(ticket.status)}`}>{ticket.status.replace('_', ' ')}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={!!selectedTicket} onOpenChange={(open) => { if (!open) setSelectedTicket(null); }}>
        <DialogContent className="max-w-lg">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">{selectedTicket.subject}</DialogTitle>
                <DialogDescription className="text-xs">{selectedTicket.restaurantName} · {selectedTicket.category} · {formatDate(selectedTicket.createdAt)}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${getTicketStatusColor(selectedTicket.status)}`}>{selectedTicket.status.replace('_', ' ')}</Badge>
                  <Badge variant="outline" className={`text-xs ${getPriorityColor(selectedTicket.priority)}`}>{selectedTicket.priority} priority</Badge>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-sm">{selectedTicket.description}</div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Assigned to: {selectedTicket.assignedTo || <span className="text-amber-600">Unassigned</span>}</span>
                </div>
              </div>
              <DialogFooter className="gap-2">
                {!selectedTicket.assignedTo && <Button variant="outline" size="sm" onClick={() => setAssignDialog({ open: true, ticket: selectedTicket })} disabled={actionLoading}><Users className="h-3.5 w-3.5 mr-1" />Assign</Button>}
                {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && <Button size="sm" onClick={() => handleResolve(selectedTicket)} disabled={actionLoading}>
                  {actionLoading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                  Resolve
                </Button>}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={assignDialog.open} onOpenChange={(open) => setAssignDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Ticket</DialogTitle>
            <DialogDescription>Choose a support staff member to assign this ticket to.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {supportStaff.map(staff => (
              <Button key={staff.id} variant="outline" className="w-full justify-start" onClick={() => handleAssign(staff.id, staff.name)} disabled={actionLoading}>
                <Avatar className="h-7 w-7 mr-2"><AvatarFallback className="text-xs">{(staff.name || '').split(' ').map(n => n[0]).join('')}</AvatarFallback></Avatar>
                <div className="text-left"><p className="text-sm font-medium">{staff.name}</p><p className="text-xs text-muted-foreground">{staff.role}</p></div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Feature Flags View =====
export function AdminFlagsView() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
      await api.put('/api/admin/flags', { flagId: id, enabled: newEnabled, rolloutPercentage: newEnabled ? 100 : 0 });
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
      await api.put('/api/admin/flags', { flagId: id, rolloutPercentage: percentage });
      toast.success(`Rollout updated to ${percentage}%`);
      await fetchFlags();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update rollout');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <ViewLoading />;
  if (error) return <ViewError message={error} onRetry={fetchFlags} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Feature Flags</h3>
          <p className="text-xs text-muted-foreground">Control feature availability across the platform</p>
        </div>
        <Badge variant="outline" className="text-xs">{flags.filter(f => f.enabled).length} / {flags.length} enabled</Badge>
      </div>
      <div className="space-y-3">
        {flags.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No feature flags configured.</CardContent></Card>
        ) : flags.map(flag => (
          <Card key={flag.id} className={flag.enabled ? 'border-primary/30' : ''}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium">{flag.name}</h4>
                    <Badge variant="outline" className="text-[10px] font-mono">{flag.key}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{flag.description}</p>
                  {flag.enabled && (
                    <div className="pt-2 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Rollout: {flag.rolloutPercentage}%</span>
                        <span className="text-muted-foreground">Updated {new Date(flag.updatedAt).toLocaleDateString()}</span>
                      </div>
                      <Progress value={flag.rolloutPercentage} className="h-1.5" />
                      <div className="flex gap-1">
                        {[0, 25, 50, 75, 100].map(pct => (
                          <Button key={pct} size="sm" variant={flag.rolloutPercentage === pct ? 'default' : 'outline'} className="h-6 text-[10px] px-2" onClick={() => handleRolloutChange(flag.id, pct)} disabled={actionLoading === flag.id}>{pct}%</Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <Switch checked={flag.enabled} onCheckedChange={() => handleToggle(flag.id)} disabled={actionLoading === flag.id} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ===== Platform Analytics View =====
export function AdminAnalyticsView() {
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

  if (loading) return <ViewLoading />;
  if (error || !analyticsData) return <ViewError message={error || 'No data available'} onRetry={fetchAnalytics} />;

  const { restaurants, mrr, ordersLast30Days, revenueLast30Days, cuisineDistribution, geographicDistribution, monthlyRevenue } = analyticsData;
  const avgRevenuePerRestaurant = restaurants.active > 0 ? Math.round(revenueLast30Days / restaurants.active) : 0;

  return (
    <div className="space-y-6">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Cuisine Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {cuisineDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={cuisineDistribution} dataKey="count" nameKey="cuisine" cx="50%" cy="50%" outerRadius={80} label={({ cuisine, percent }) => `${cuisine} ${(percent * 100).toFixed(0)}%`}>
                      {cuisineDistribution.map((_, index) => (<Cell key={`cell-${index}`} fill={cuisineColors[index % cuisineColors.length]} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No cuisine data available</div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Geographic Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {geographicDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={geographicDistribution}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="city" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                    <Bar dataKey="restaurants" fill="#039D55" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No geographic data available</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ===== Default export: full admin app with internal routing (kept for backward compat) =====
export { AdminLayout } from './admin-layout';
