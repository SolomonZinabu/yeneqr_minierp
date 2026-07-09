'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, hashUrl, slugPath } from '@/lib/router';
import { useAppStore } from '@/lib/store';
import { useIsMobile } from '@/hooks/use-mobile';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { PERMISSIONS, hasUserAnyPermission } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  ShoppingCart,
  UtensilsCrossed,
  Grid3X3,
  QrCode,
  ChefHat,
  Users,
  BarChart3,
  Settings,
  Bell,
  X,
  Menu,
  Globe,
  LogOut,
  ChevronDown,
  CalendarDays,
  Shield,
  ArrowLeft,
  Tag,
  Star,
  RotateCcw,
  Sparkles,
  Truck,
  Building2,
  Clock,
  FileText,
  Contact,
  ClipboardList,
  BarChart,
  Gift,
  Printer,
  FileBarChart,
  ReceiptText,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { RestaurantSwitcher } from '@/components/dashboard/restaurant-switcher';
import { LanguageSwitcher } from '@/components/dashboard/language-switcher';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { route, navigate } = useRouter();
  // Use individual selectors to prevent re-renders from unrelated state changes
  const user = useAppStore((s) => s.user);
  const token = useAppStore((s) => s.token);
  const setAuth = useAppStore((s) => s.setAuth);
  const storeLogout = useAppStore((s) => s.logout);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const selectedBranchId = useAppStore((s) => s.selectedBranchId);
  const setSelectedBranchId = useAppStore((s) => s.setSelectedBranchId);
  const unreadNotificationCount = useAppStore((s) => s.unreadNotificationCount);
  const isMobile = useIsMobile();

  // Track if we've mounted on client to avoid hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Before mount, render desktop layout to match SSR output
  const effectiveIsMobile = mounted ? isMobile : false;

  const restaurantId = user?.restaurantId || '';
  const currentSlug = route.slug || user?.restaurantSlug || user?.restaurantId || '';

  // ============================================================
  // Role-Based Navigation — each item requires specific permissions
  // ============================================================
  const userRole = user?.role || 'waiter';

  // Define ALL nav items with their required permissions
  const allNavItems = [
    { hash: slugPath(currentSlug, '/dashboard'),              label: 'Dashboard',     icon: LayoutDashboard, tab: 'dashboard',      requiredPermissions: [PERMISSIONS.RESTAURANT_VIEW.key] },
    { hash: slugPath(currentSlug, '/dashboard/orders'),       label: 'Orders',        icon: ShoppingCart,    tab: 'orders',         requiredPermissions: [PERMISSIONS.ORDER_VIEW.key] },
    { hash: slugPath(currentSlug, '/dashboard/menu'),         label: 'Menu',          icon: UtensilsCrossed, tab: 'menu',           requiredPermissions: [PERMISSIONS.MENU_VIEW.key] },
    { hash: slugPath(currentSlug, '/dashboard/tables'),       label: 'Tables',        icon: Grid3X3,         tab: 'tables',         requiredPermissions: [PERMISSIONS.TABLE_VIEW.key] },
    { hash: slugPath(currentSlug, '/dashboard/reservations'), label: 'Reservations',  icon: CalendarDays,    tab: 'reservations',   requiredPermissions: [PERMISSIONS.TABLE_VIEW.key] },
    { hash: slugPath(currentSlug, '/dashboard/qr-codes'),     label: 'QR Codes',      icon: QrCode,          tab: 'qrcodes',        requiredPermissions: [PERMISSIONS.QR_VIEW.key] },
    { hash: slugPath(currentSlug, '/dashboard/kitchen'),      label: 'Kitchen',       icon: ChefHat,         tab: 'kitchen',        requiredPermissions: [PERMISSIONS.KITCHEN_MANAGE.key, PERMISSIONS.ORDER_VIEW.key] },
    { hash: slugPath(currentSlug, '/dashboard/waiter'),       label: 'Waiter',        icon: Truck,           tab: 'waiter',         requiredPermissions: [PERMISSIONS.TABLE_VIEW.key, PERMISSIONS.ORDER_VIEW.key] },
    { hash: slugPath(currentSlug, '/dashboard/staff'),        label: 'Staff',         icon: Users,           tab: 'staff',          requiredPermissions: [PERMISSIONS.STAFF_VIEW.key] },
    { hash: slugPath(currentSlug, '/dashboard/branches'),    label: 'Branches',      icon: Building2,       tab: 'branches',       requiredPermissions: [PERMISSIONS.BRANCH_VIEW.key] },
    { hash: slugPath(currentSlug, '/dashboard/analytics'),    label: 'Analytics',     icon: BarChart3,       tab: 'analytics',      requiredPermissions: [PERMISSIONS.ANALYTICS_VIEW.key] },
    { hash: slugPath(currentSlug, '/dashboard/crm'),          label: 'CRM',           icon: Contact,          tab: 'crm',            requiredPermissions: [PERMISSIONS.ANALYTICS_VIEW.key] },
    { hash: slugPath(currentSlug, '/dashboard/waitlist'),     label: 'Waitlist',      icon: ClipboardList,    tab: 'waitlist',       requiredPermissions: [PERMISSIONS.RESTAURANT_VIEW.key] },
    { hash: slugPath(currentSlug, '/dashboard/menu-engineering'), label: 'Menu Eng.',  icon: BarChart,         tab: 'menu-engineering', requiredPermissions: [PERMISSIONS.ANALYTICS_VIEW.key] },
    { hash: slugPath(currentSlug, '/dashboard/promotions'),   label: 'Promotions',    icon: Tag,             tab: 'promotions',     requiredPermissions: [PERMISSIONS.MENU_MANAGE.key] },
    { hash: slugPath(currentSlug, '/dashboard/reviews'),      label: 'Reviews',       icon: Star,            tab: 'reviews',        requiredPermissions: [PERMISSIONS.ANALYTICS_VIEW.key] },
    { hash: slugPath(currentSlug, '/dashboard/refunds'),      label: 'Refunds',       icon: RotateCcw,       tab: 'refunds',        requiredPermissions: [PERMISSIONS.PAYMENT_VIEW.key] },
    { hash: slugPath(currentSlug, '/dashboard/rewards'),     label: 'Rewards',       icon: Gift,            tab: 'rewards',        requiredPermissions: [PERMISSIONS.PAYMENT_VIEW.key] },
    { hash: slugPath(currentSlug, '/dashboard/printers'),    label: 'Printers',      icon: Printer,         tab: 'printers',       requiredPermissions: [PERMISSIONS.PAYMENT_VIEW.key] },
    { hash: slugPath(currentSlug, '/dashboard/z-report'),   label: 'Z-Report',      icon: FileBarChart,    tab: 'z-report',       requiredPermissions: [PERMISSIONS.ANALYTICS_VIEW.key] },
    { hash: slugPath(currentSlug, '/dashboard/invoices'),     label: 'Invoices',       icon: FileText,        tab: 'invoices',       requiredPermissions: [PERMISSIONS.SUBSCRIPTION_MANAGE.key] },
    { hash: slugPath(currentSlug, '/dashboard/platform-billing'), label: 'Platform Billing', icon: ReceiptText, tab: 'platform-billing', requiredPermissions: [PERMISSIONS.PAYMENT_VIEW.key] },
    { hash: slugPath(currentSlug, '/dashboard/audit-logs'),   label: 'Audit Logs',    icon: Shield,          tab: 'audit-logs',     requiredPermissions: [PERMISSIONS.RESTAURANT_MANAGE.key] },
    { hash: slugPath(currentSlug, '/dashboard/shifts'),      label: 'Shifts',        icon: Clock,           tab: 'shifts',         requiredPermissions: [PERMISSIONS.STAFF_VIEW.key] },
    { hash: slugPath(currentSlug, '/dashboard/settings'),     label: 'Settings',      icon: Settings,        tab: 'settings',       requiredPermissions: [PERMISSIONS.STAFF_VIEW.key] },
    { hash: slugPath(currentSlug, '/dashboard/localization'),  label: 'Localization',   icon: Globe,           tab: 'localization',  requiredPermissions: [PERMISSIONS.BRANCH_MANAGE.key] },
    { hash: slugPath(currentSlug, '/dashboard/notifications'), label: 'Notifications',  icon: Bell,            tab: 'notifications', requiredPermissions: [PERMISSIONS.RESTAURANT_VIEW.key] },
    { hash: slugPath(currentSlug, '/dashboard/ai'),            label: 'AI Assistant',   icon: Sparkles,        tab: 'ai',            requiredPermissions: [PERMISSIONS.RESTAURANT_VIEW.key] },
  ];

  // Filter nav items based on the user's permissions (role + any per-user overrides)
  // Prefer resolvedPermissions (computed at login) for best accuracy
  const userOverrides = user ? {
    permissions: user.permissions,
    additionalPermissions: user.additionalPermissions,
    revokedPermissions: user.revokedPermissions,
  } : null;
  const navItems = useMemo(() =>
    user?.resolvedPermissions && Array.isArray(user.resolvedPermissions)
      ? allNavItems.filter(item => item.requiredPermissions.some(key => user.resolvedPermissions.includes(key)))
      : allNavItems.filter(item => hasUserAnyPermission(userRole, item.requiredPermissions, userOverrides)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userRole, currentSlug, user?.permissions, user?.additionalPermissions, user?.revokedPermissions, user?.resolvedPermissions]
  );

  const [branches, setBranches] = useState<{id: string; name: string; isMainBranch?: boolean}[]>([]);
  const [restaurantLogo, setRestaurantLogo] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  // Fetch restaurant logo
  useEffect(() => {
    if (!restaurantId) return;
    api.get<{data: {logo?: string | null}}>(`/api/restaurants/${restaurantId}`)
      .then(res => {
        setRestaurantLogo(res.data?.logo || null);
      })
      .catch(() => {});
  }, [restaurantId]);

  // Fetch user avatar
  useEffect(() => {
    if (!user?.id) return;
    // Get avatar from user object if available, or fetch
    setUserAvatar(user.avatar || null);
  }, [user]);

  // Fetch real branches from API
  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    api.get<{data: {id: string; name: string; isMainBranch: boolean}[]}>(`/api/restaurants/${restaurantId}/branches`)
      .then(res => {
        if (cancelled) return;
        const branchList = Array.isArray(res) ? res : (res.data || []);
        setBranches(branchList);
        // Auto-select main branch if none selected
        // Use getState() to read the latest selectedBranchId (avoids stale closure / re-render loop)
        const currentBranchId = useAppStore.getState().selectedBranchId;
        if (!currentBranchId && branchList.length > 0) {
          const mainBranch = branchList.find((b: {isMainBranch: boolean}) => b.isMainBranch);
          setSelectedBranchId(mainBranch?.id || branchList[0]?.id);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const activeHash = '/' + route.name.replace(/^dashboard-?/, route.name === 'dashboard' ? '' : '').replace('dashboard-', '/dashboard/');

  const handleLogout = () => {
    const slug = currentSlug;
    storeLogout();
    // Redirect to restaurant-specific login
    if (slug) {
      navigate(`/${slug}/login`);
    } else {
      navigate('/');
    }
  };

  // Phase 7.4: Switch branch — calls /api/auth/switch-branch to re-issue the JWT
  // with the new branchId, then updates the store + local state.
  // This is critical because resolveBranchScope (Phase 2.3) enforces auth.branchId
  // server-side, so the frontend MUST get a new token for the switch to take effect
  // on API calls. Falls back gracefully if the API call fails (keeps the old branch).
  const [switchingBranch, setSwitchingBranch] = useState<string | null>(null);
  const handleBranchSwitch = async (branchId: string, branchName: string) => {
    if (branchId === selectedBranchId || switchingBranch) return;
    setSwitchingBranch(branchId);
    try {
      const res = await api.post<{ message: string; token: string; branch: { id: string; name: string; isMainBranch: boolean } }>(
        '/api/auth/switch-branch',
        { branchId }
      );

      if (user) {
        setAuth(res.token, { ...user, branchId: res.branch.id });
      }
      setSelectedBranchId(res.branch.id);
      console.log('[DashboardLayout] Branch switched to:', res.branch.name);
    } catch (err: any) {
      console.warn('[DashboardLayout] switch-branch API failed, falling back to local-only switch:', err?.message);
      setSelectedBranchId(branchId);
    } finally {
      setSwitchingBranch(null);
    }
  };

  const sidebarContent = (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-4 py-5">
        {restaurantLogo ? (
          <img src={restaurantLogo} alt="Restaurant Logo" className="h-9 w-9 rounded-lg object-cover" />
        ) : (
          <img src="/logo.png" alt="Yene QR" className="h-9 w-9 rounded-lg object-contain" />
        )}
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight">{user?.restaurantName || 'Yene QR'}</span>
          <span className="text-[11px] text-muted-foreground capitalize">{userRole === 'kitchen_staff' ? 'Kitchen Staff' : userRole === 'owner' ? 'Owner' : userRole === 'manager' ? 'Manager' : userRole === 'cashier' ? 'Cashier' : userRole === 'waiter' ? 'Waiter' : userRole}</span>
        </div>
        {effectiveIsMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-8 w-8"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Separator />

      {/* Restaurant Switcher */}
      <RestaurantSwitcher />

      <Separator />

      {/* Navigation */}
      <ScrollArea className="flex-1 min-h-0 px-3 py-2">
        <nav className="flex flex-col gap-1 pb-2">
          {navItems.map((item) => {
            const isActive = route.name === item.tab || (route.name === 'dashboard' && item.tab === 'dashboard') ||
              (route.name === `dashboard-${item.tab}` && item.tab !== 'dashboard');
            return (
              <a
                key={item.hash}
                href={hashUrl(item.hash)}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(item.hash);
                  if (effectiveIsMobile) setSidebarOpen(false);
                }}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-normal transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {item.tab === 'notifications' && unreadNotificationCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                    {unreadNotificationCount}
                  </span>
                )}
              </a>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Bottom */}
      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            {userAvatar && <AvatarImage src={userAvatar} alt={user?.name || 'User'} />}
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {user?.name?.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-medium truncate">{user?.name || 'User'}</span>
            <span className="text-[11px] text-muted-foreground capitalize">{user?.role || 'staff'}</span>
          </div>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
            title="Logout"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      {effectiveIsMobile ? (
        sidebarOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setSidebarOpen(false)} />
            <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground shadow-xl">
              {sidebarContent}
            </aside>
          </>
        )
      ) : (
        <aside className="sticky top-0 h-screen w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground">
          {sidebarContent}
        </aside>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Admin Impersonation Banner */}
        {user?.isAdminImpersonation && (
          <div className="flex items-center justify-between gap-3 bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5">
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-amber-600" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Viewing as {user?.restaurantName || 'Restaurant'}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] text-amber-600 hover:text-amber-800 hover:bg-amber-500/10 dark:text-amber-400"
              onClick={() => {
                // Logout and redirect to admin
                storeLogout();
                navigate('/admin');
              }}
            >
              <ArrowLeft className="h-3 w-3 mr-1" />
              Exit to Admin
            </Button>
          </div>
        )}
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-8 w-8"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Title */}
          <h1 className="text-lg font-semibold">{route.title}</h1>

          {/* Branch Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-2 gap-1 h-8">
                <span className="text-xs">
                  {branches.find(b => b.id === selectedBranchId)?.name || 'Select Branch'}
                </span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Branch</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {branches.map((branch) => (
                <DropdownMenuItem
                  key={branch.id}
                  disabled={switchingBranch === branch.id}
                  onClick={() => handleBranchSwitch(branch.id, branch.name)}
                  className={selectedBranchId === branch.id ? 'bg-accent' : ''}
                >
                  {branch.name}
                  {branch.isMainBranch && (
                    <Badge variant="secondary" className="ml-2 text-[10px] px-1 py-0">Main</Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex-1" />

          <ThemeToggle />

          {/* Language Switcher — shows all enabled languages */}
          <LanguageSwitcher restaurantId={restaurantId} />

          {/* Notifications */}
          <a
            href={hashUrl(slugPath(currentSlug, '/dashboard/notifications'))}
            onClick={(e) => { e.preventDefault(); navigate(slugPath(currentSlug, '/dashboard/notifications')); }}
            className="relative"
          >
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Bell className="h-4 w-4" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-destructive-foreground">
                  {unreadNotificationCount}
                </span>
              )}
            </Button>
          </a>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 gap-2 px-2">
                <Avatar className="h-7 w-7">
                  {userAvatar && <AvatarImage src={userAvatar} alt={user?.name || 'User'} />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
                    {user?.name?.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-xs font-medium">{user?.name?.split(' ')[0] || 'User'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user?.name || 'User'}</p>
                  <p className="text-xs text-muted-foreground">{user?.email || ''}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate(slugPath(currentSlug, '/dashboard/settings'))}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
