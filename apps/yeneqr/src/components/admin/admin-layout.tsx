'use client';

import React from 'react';
import { useRouter, hashUrl } from '@/lib/router';
import { useAppStore } from '@/lib/store';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  HeadphonesIcon,
  Flag,
  BarChart3,
  Bot,
  X,
  Menu,
  QrCode,
  LogOut,
  Shield,
  FileText,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

const adminNavItems = [
  { hash: '/admin',              label: 'Overview',          icon: LayoutDashboard, tab: 'overview' },
  { hash: '/admin/restaurants',  label: 'Restaurants',       icon: Building2,       tab: 'restaurants' },
  { hash: '/admin/subscriptions', label: 'Subscriptions',    icon: CreditCard,      tab: 'subscriptions' },
  { hash: '/admin/invoices',     label: 'Invoices',          icon: FileText,        tab: 'invoices' },
  { hash: '/admin/support',      label: 'Support Tickets',   icon: HeadphonesIcon,  tab: 'support' },
  { hash: '/admin/flags',        label: 'Feature Flags',     icon: Flag,            tab: 'flags' },
  { hash: '/admin/ai',           label: 'AI Management',     icon: Bot,            tab: 'ai' },
  { hash: '/admin/analytics',    label: 'Platform Analytics', icon: BarChart3,      tab: 'analytics' },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { route, navigate } = useRouter();
  const { user, logout: storeLogout, sidebarOpen, setSidebarOpen } = useAppStore();
  const isMobile = useIsMobile();

  const handleLogout = () => {
    storeLogout();
    navigate('/login');
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100">
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-4 py-5">
        <img src="/logo.png" alt="Yene QR" className="h-9 w-9 rounded-lg object-contain" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight text-white">Yene QR</span>
          <span className="text-[11px] text-slate-400">Platform Admin</span>
        </div>
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-8 w-8 text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Separator className="bg-slate-700" />

      {/* Admin badge */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
          <Shield className="h-4 w-4 text-amber-400" />
          <div>
            <p className="text-xs font-medium text-amber-300">Super Admin</p>
            <p className="text-[11px] text-slate-400">Full platform access</p>
          </div>
        </div>
      </div>

      <Separator className="bg-slate-700" />

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-2">
        <nav className="flex flex-col gap-1">
          {adminNavItems.map((item) => {
            const isActive = route.name === item.tab || route.name === `admin-${item.tab}` ||
              (route.name === 'admin' && item.tab === 'overview');
            return (
              <a
                key={item.hash}
                href={hashUrl(item.hash)}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(item.hash);
                  if (isMobile) setSidebarOpen(false);
                }}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-normal transition-colors',
                  isActive
                    ? 'bg-amber-500/20 text-amber-300 font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </a>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Bottom */}
      <div className="border-t border-slate-700 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-amber-950 text-xs font-semibold">
            {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'A'}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-medium truncate text-white">{user?.name || 'Admin'}</span>
            <span className="text-[11px] text-slate-400">{user?.email || 'admin@yeneqr.com'}</span>
          </div>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-red-400"
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
      {isMobile ? (
        sidebarOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setSidebarOpen(false)} />
            <aside className="fixed inset-y-0 left-0 z-50 w-64 shadow-xl">
              {sidebarContent}
            </aside>
          </>
        )
      ) : (
        <aside className="sticky top-0 h-screen w-64 shrink-0">
          {sidebarContent}
        </aside>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur px-4 lg:px-6">
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}

          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-500" />
            <h1 className="text-lg font-semibold">{route.title}</h1>
          </div>

          <div className="flex-1" />

          <ThemeToggle />

          <a
            href={hashUrl('/dashboard')}
            onClick={(e) => { e.preventDefault(); navigate('/dashboard'); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Dashboard
          </a>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
