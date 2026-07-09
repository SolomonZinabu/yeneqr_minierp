'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';
import { useBranchChange } from '@/hooks/use-branch-change';
import { api, getTimeAgo } from '@/lib/api-client';
import { formatCents } from '@/lib/money';
import { useRouter } from '@/lib/router';
import {
  DollarSign,
  ShoppingCart,
  Armchair,
  Clock,
  TrendingUp,
  ArrowRight,
  Plus,
  UtensilsCrossed,
  ChefHat,
  QrCode,
  Loader2,
  FileText,
} from 'lucide-react';

type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled';

interface OrderData {
  id: string;
  orderNumber: string;
  type: string;
  status: OrderStatus;
  tableId: string;
  totalAmountCents: number;
  createdAt: string;
  items: { id: string; name: string }[];
  customer?: { id: string; name: string } | null;
  table?: { id: string; number: number } | null;
}

interface TableData {
  id: string;
  number: number;
  status: string;
  capacity: number;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  accepted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  preparing: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  ready: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  served: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export function DashboardView() {
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const setSelectedOrderId = useAppStore((s) => s.setSelectedOrderId);
  const user = useAppStore((s) => s.user);
  const selectedBranchId = useAppStore((s) => s.selectedBranchId);
  const branchChangeVersion = useAppStore((s) => s.branchChangeVersion);
  const { navigate: routerNavigate } = useRouter();
  const { t } = useI18n(user?.restaurantId);
  const restaurantId = user?.restaurantId || '';

  // Navigation helper — uses the router's navigate function for reliable routing
  const navigateTo = useCallback((tab: string) => {
    const slug = user?.restaurantSlug || user?.restaurantId || '';
    const tabToPath: Record<string, string> = {
      orders: `/dashboard/orders`,
      menu: `/dashboard/menu`,
      kitchen: `/dashboard/kitchen`,
      qrcodes: `/dashboard/qr-codes`,
      tables: `/dashboard/tables`,
      staff: `/dashboard/staff`,
      analytics: `/dashboard/analytics`,
      settings: `/dashboard/settings`,
      invoices: `/dashboard/invoices`,
    };
    const path = tabToPath[tab] || '/dashboard';
    const fullSlugPath = slug ? `/${slug}${path}` : path;
    // Also set activeTab immediately for responsive feel
    setActiveTab(tab as import('@/lib/store').TabId);
    // Use router navigate for proper hash routing
    routerNavigate(fullSlugPath);
  }, [user?.restaurantSlug, user?.restaurantId, routerNavigate, setActiveTab]);

  const [orders, setOrders] = useState<OrderData[]>([]);
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDataRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const handleBranchChange = useCallback((newBranchId: string) => {
    console.log('[DashboardView] handleBranchChange called with:', newBranchId);
    setLoading(true);
    setOrders([]);
    setTables([]);
    fetchDataRef.current?.();
  }, []);

  useBranchChange(handleBranchChange);

  // Reset loading state when branch changes
  useEffect(() => {
    if (selectedBranchId) {
      setLoading(true);
      setOrders([]);
      setTables([]);
    }
  }, [selectedBranchId]);

  const fetchData = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const branchId = useAppStore.getState().selectedBranchId;
      console.log('[DashboardView] fetchData called, branchId:', branchId);
      const ordersParams = branchId ? `?branchId=${branchId}` : '';
      const tablesParams = branchId ? `?branchId=${branchId}` : '';
      const [ordersRes, tablesRes] = await Promise.all([
        api.get<{ data: OrderData[] }>(`/api/restaurants/${restaurantId}/orders${ordersParams}`),
        api.get<{ data: TableData[] }>(`/api/restaurants/${restaurantId}/tables${tablesParams}`),
      ]);

      if (ordersRes?.data) setOrders(ordersRes.data);
      if (tablesRes?.data) setTables(tablesRes.data);
    } catch (err) {
      // Silently handle — show empty state
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchDataRef.current = fetchData; }, [fetchData]);

  useEffect(() => {
    fetchData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData, selectedBranchId, branchChangeVersion]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <span className="ml-2 text-muted-foreground">{t('dashboard.loading_dashboard')}</span>
      </div>
    );
  }

  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const preparingOrders = orders.filter((o) => o.status === 'preparing');
  const readyOrders = orders.filter((o) => o.status === 'ready');
  const occupiedTables = tables.filter((t) => t.status === 'occupied');
  const completedOrders = orders.filter((o) => o.status === 'completed');
  const todayRevenueCents = completedOrders.reduce((sum, o) => sum + o.totalAmountCents, 0);

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.today_orders')}</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <ShoppingCart className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders.length}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span>{t('dashboard.live_data')}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.revenue')}</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCents(todayRevenueCents)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {completedOrders.length} {t('dashboard.completed_orders')}
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.active_tables')}</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
              <Armchair className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {occupiedTables.length}
              <span className="text-lg text-muted-foreground">/{tables.length}</span>
            </div>
            <Progress value={tables.length > 0 ? (occupiedTables.length / tables.length) * 100 : 0} className="h-1.5 mt-2" />
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/5 rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.pending_orders')}</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10">
              <Clock className="h-4 w-4 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOrders.length}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span>{preparingOrders.length} {t('dashboard.preparing')}</span>
              <span>·</span>
              <span>{readyOrders.length} {t('dashboard.ready_count')}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{t('dashboard.quick_actions')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4 hover:bg-primary/5 hover:border-primary/30 hover:text-primary"
              onClick={() => navigateTo('orders')}
            >
              <Plus className="h-5 w-5" />
              <span className="text-xs">{t('dashboard.new_order')}</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4 hover:bg-primary/5 hover:border-primary/30 hover:text-primary"
              onClick={() => navigateTo('menu')}
            >
              <UtensilsCrossed className="h-5 w-5" />
              <span className="text-xs">{t('dashboard.manage_menu')}</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4 hover:bg-primary/5 hover:border-primary/30 hover:text-primary"
              onClick={() => navigateTo('kitchen')}
            >
              <ChefHat className="h-5 w-5" />
              <span className="text-xs">{t('common.kitchen')}</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4 hover:bg-primary/5 hover:border-primary/30 hover:text-primary"
              onClick={() => navigateTo('qrcodes')}
            >
              <QrCode className="h-5 w-5" />
              <span className="text-xs">{t('common.qr_codes')}</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4 hover:bg-primary/5 hover:border-primary/30 hover:text-primary"
              onClick={() => navigateTo('invoices')}
            >
              <FileText className="h-5 w-5" />
              <span className="text-xs">Invoices</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Orders + Order Status Summary */}
      <div className="grid gap-4 lg:grid-cols-7 grid-cols-1">
        <Card className="lg:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-medium">{t('dashboard.recent_orders')}</CardTitle>
              <CardDescription className="text-xs">{t('dashboard.latest_orders_desc', 'Latest orders for selected branch')}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigateTo('orders')}>
              {t('dashboard.view_all')} <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{t('dashboard.no_orders')}</p>
                </div>
              ) : (
                recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => {
                      setSelectedOrderId(order.id);
                      navigateTo('orders');
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-sm font-semibold">
                        {order.table ? `T${order.table.number}` : '—'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{order.orderNumber}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColors[order.status] || ''}`}>
                            {order.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {order.items?.length || 0} {t('dashboard.items_count')} · {order.customer?.name || t('dashboard.walk_in')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatCents(order.totalAmountCents)}</p>
                      <p className="text-[11px] text-muted-foreground">{getTimeAgo(order.createdAt)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('dashboard.order_status')}</CardTitle>
            <CardDescription className="text-xs">{t('dashboard.order_distribution_desc', 'Current order distribution')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(['pending', 'accepted', 'preparing', 'ready', 'served', 'completed', 'cancelled'] as const).map((status) => {
              const count = orders.filter((o) => o.status === status).length;
              const percentage = orders.length > 0 ? (count / orders.length) * 100 : 0;
              return (
                <div key={status} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${
                        status === 'pending' ? 'bg-yellow-500' :
                        status === 'accepted' ? 'bg-blue-500' :
                        status === 'preparing' ? 'bg-orange-500' :
                        status === 'ready' ? 'bg-green-500' :
                        status === 'served' ? 'bg-purple-500' :
                        status === 'completed' ? 'bg-emerald-500' :
                        'bg-red-500'
                      }`} />
                      <span className="text-xs capitalize">{t(`order.status.${status}`)}</span>
                    </div>
                    <span className="text-xs font-medium">{count}</span>
                  </div>
                  <Progress value={percentage} className="h-1.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
