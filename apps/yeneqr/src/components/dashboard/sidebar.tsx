'use client';

import { cn } from '@/lib/utils';
import { useAppStore, type TabId } from '@/lib/store';
import { useLanguageStore } from '@/hooks/useLanguage';
import { useI18n } from '@/hooks/useI18n';
import { useIsMobile } from '@/hooks/use-mobile';
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
  Globe,
  Tag,
  Star,
  RotateCcw,
  Package,
  Shield,
  Clock,
  FileText,
  ReceiptText,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

const navItems: { id: TabId; labelKey: string; defaultLabel: string; icon: React.ElementType }[] = [
  { id: 'dashboard', labelKey: 'dashboard.title', defaultLabel: 'Dashboard', icon: LayoutDashboard },
  { id: 'orders', labelKey: 'dashboard.orders', defaultLabel: 'Orders', icon: ShoppingCart },
  { id: 'menu', labelKey: 'dashboard.menu', defaultLabel: 'Menu', icon: UtensilsCrossed },
  { id: 'tables', labelKey: 'dashboard.tables', defaultLabel: 'Tables', icon: Grid3X3 },
  { id: 'qrcodes', labelKey: 'common.qr_codes', defaultLabel: 'QR Codes', icon: QrCode },
  { id: 'kitchen', labelKey: 'common.kitchen', defaultLabel: 'Kitchen', icon: ChefHat },
  { id: 'staff', labelKey: 'dashboard.staff', defaultLabel: 'Staff', icon: Users },
  { id: 'analytics', labelKey: 'dashboard.analytics', defaultLabel: 'Analytics', icon: BarChart3 },
  { id: 'promotions', labelKey: 'dashboard.promotions', defaultLabel: 'Promotions', icon: Tag },
  { id: 'reviews', labelKey: 'dashboard.reviews', defaultLabel: 'Reviews', icon: Star },
  { id: 'refunds', labelKey: 'dashboard.refunds', defaultLabel: 'Refunds', icon: RotateCcw },
  { id: 'invoices', labelKey: 'dashboard.invoices', defaultLabel: 'Invoices', icon: FileText },
  { id: 'platform-billing', labelKey: 'dashboard.platform_billing', defaultLabel: 'Platform Billing', icon: ReceiptText },
  { id: 'inventory', labelKey: 'dashboard.inventory', defaultLabel: 'Inventory', icon: Package },
  { id: 'shifts', labelKey: 'dashboard.shifts', defaultLabel: 'Shifts', icon: Clock },
  { id: 'audit-logs', labelKey: 'dashboard.audit_logs', defaultLabel: 'Audit Logs', icon: Shield },
  { id: 'settings', labelKey: 'dashboard.settings', defaultLabel: 'Settings', icon: Settings },
  { id: 'localization', labelKey: 'dashboard.localization', defaultLabel: 'Localization', icon: Globe },
  { id: 'notifications', labelKey: 'common.notifications', defaultLabel: 'Notifications', icon: Bell },
];

export function Sidebar() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const unreadNotificationCount = useAppStore((s) => s.unreadNotificationCount);
  const user = useAppStore((s) => s.user);
  const isMobile = useIsMobile();
  const { t } = useI18n(user?.restaurantId);

  // Map tab IDs to their hash route paths
  const tabToPath: Record<string, string> = {
    dashboard: '/dashboard',
    orders: '/dashboard/orders',
    menu: '/dashboard/menu',
    tables: '/dashboard/tables',
    qrcodes: '/dashboard/qr-codes',
    kitchen: '/dashboard/kitchen',
    staff: '/dashboard/staff',
    analytics: '/dashboard/analytics',
    promotions: '/dashboard/promotions',
    reviews: '/dashboard/reviews',
    refunds: '/dashboard/refunds',
    invoices: '/dashboard/invoices',
    'platform-billing': '/dashboard/platform-billing',
    inventory: '/dashboard/inventory',
    shifts: '/dashboard/shifts',
    'audit-logs': '/dashboard/audit-logs',
    settings: '/dashboard/settings',
    localization: '/dashboard/localization',
    notifications: '/dashboard/notifications',
    waiter: '/dashboard/waiter',
    branches: '/dashboard/branches',
    reservations: '/dashboard/reservations',
    ai: '/dashboard/ai',
  };

  const handleNavClick = (tab: TabId) => {
    const slug = user?.restaurantSlug || user?.restaurantId || '';
    const path = tabToPath[tab] || '/dashboard';
    const fullSlugPath = slug ? `/${slug}${path}` : path;
    window.location.hash = fullSlugPath;
    if (isMobile) setSidebarOpen(false);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-4 py-5">
        <img src="/logo.png" alt="Yene QR" className="h-9 w-9 rounded-lg object-contain" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight">Yene QR</span>
          <span className="text-[11px] text-muted-foreground">{t('dashboard.restaurant_manager')}</span>
        </div>
        {isMobile && (
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

      {/* Restaurant Selector */}
      <div className="px-4 py-3">
        <div className="rounded-lg bg-accent/50 px-3 py-2">
          <p className="text-xs font-medium truncate">{user?.restaurantName || 'Restaurant'}</p>
          <p className="text-[11px] text-muted-foreground truncate">{t('dashboard.title')}</p>
        </div>
      </div>

      <Separator />

      {/* Navigation */}
      <ScrollArea className="flex-1 min-h-0 px-3 py-2">
        <nav className="flex flex-col gap-1 pb-2">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant={activeTab === item.id ? 'secondary' : 'ghost'}
              className={cn(
                'h-9 w-full justify-start gap-3 px-3 text-sm font-normal',
                activeTab === item.id && 'bg-primary/10 text-primary font-medium hover:bg-primary/15 hover:text-primary'
              )}
              onClick={() => handleNavClick(item.id)}
            >
              <item.icon className="h-4 w-4" />
              {t(item.labelKey) !== item.labelKey ? t(item.labelKey) : item.defaultLabel}
              {item.id === 'notifications' && unreadNotificationCount > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                  {unreadNotificationCount}
                </span>
              )}
            </Button>
          ))}
        </nav>
      </ScrollArea>

      {/* Bottom */}
      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
            {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium">{user?.name || 'User'}</span>
            <span className="text-[11px] text-muted-foreground capitalize">{user?.role || 'Owner'}</span>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );

  // Mobile: overlay
  if (isMobile) {
    if (!sidebarOpen) return null;
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setSidebarOpen(false)} />
        <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground shadow-xl">
          {sidebarContent}
        </aside>
      </>
    );
  }

  // Desktop: persistent sidebar
  return (
    <aside className="sticky top-0 h-screen w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground">
      {sidebarContent}
    </aside>
  );
}
