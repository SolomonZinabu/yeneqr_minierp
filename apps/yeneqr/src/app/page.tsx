'use client';

import { useRouter, RouterProvider } from '@/lib/router';
import { Toaster } from '@/components/ui/sonner';
import { ErrorBoundary } from '@/components/error-boundary';

// Landing page
import { LandingPage } from '@/components/landing/landing-page';

// Auth pages
import { RestaurantLoginPage } from '@/components/auth/login-page';
import { RegisterPage } from '@/components/auth/register-page';
import { ForgotPasswordPage } from '@/components/auth/forgot-password-page';
import { ResetPasswordPage } from '@/components/auth/reset-password-page';
import { TwoFactorPage } from '@/components/auth/two-factor-page';

// Customer app
import CustomerApp from '@/components/customer/customer-app';

// Dashboard layout + views
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { OrdersView } from '@/components/dashboard/orders-view';
import { MenuView } from '@/components/dashboard/menu-view';
import { TablesView } from '@/components/dashboard/floor-plan';
import { QRCodesView } from '@/components/dashboard/qr-codes-view';
import { KitchenView } from '@/components/dashboard/kitchen-view';
import { KitchenDisplay } from '@/components/dashboard/kitchen-display';
import { WaiterView } from '@/components/dashboard/waiter-view';
import { StaffView } from '@/components/dashboard/staff-view';
import { AnalyticsView } from '@/components/dashboard/analytics-view';
import { CRMView } from '@/components/dashboard/crm-view';
import { WaitlistView } from '@/components/dashboard/waitlist-view';
import { MenuEngineeringView } from '@/components/dashboard/menu-engineering-view';
import { PromotionsView } from '@/components/dashboard/promotions-view';
import { SettingsView } from '@/components/dashboard/settings-view';
import { NotificationsView } from '@/components/dashboard/notifications-view';
import { ReservationsView } from '@/components/dashboard/reservations-view';
import { LocalizationView } from '@/components/dashboard/localization-view';
import { ReviewsView } from '@/components/dashboard/reviews-view';
import { RefundsView } from '@/components/dashboard/refunds-view';
import { RewardsRedemptionDashboard } from '@/components/dashboard/rewards-redemption-dashboard';
import { PrinterSettingsPanel } from '@/components/dashboard/printer-settings-panel';
import { ZReportPanel } from '@/components/dashboard/z-report-panel';
import { InventoryView } from '@/components/dashboard/inventory-view';
import { AuditLogsView } from '@/components/dashboard/audit-logs-view';
import { AIDashboard } from '@/components/dashboard/ai-dashboard';
import { BranchesView } from '@/components/dashboard/branches-view';
import { InvoicesView } from '@/components/dashboard/invoices-view';
import { PlatformFeeBillingView } from '@/components/dashboard/platform-fee-billing-view';
import ShiftsView from '@/components/dashboard/shifts-view';
import { useAppStore } from '@/lib/store';

// Admin layout + views
import { AdminLayout } from '@/components/admin/admin-layout';
import {
  AdminOverviewView,
  AdminRestaurantsView,
  AdminSubscriptionsView,
  AdminSupportView,
  AdminFlagsView,
  AdminAnalyticsView,
} from '@/components/admin/admin-views';
import { AdminInvoicesView } from '@/components/admin/admin-invoices-view';

// Restaurant landing page (restaurant-specific home/login)
import { RestaurantLandingPage } from '@/components/landing/restaurant-landing';

// ============================================================
// Route Renderer — maps route names to components
// ============================================================

/** Wrapper that provides store-derived props to AIDashboard */
function AIDashboardWrapper() {
  const user = useAppStore((s) => s.user);
  const restaurantId = user?.restaurantId || '';
  const branchId = user?.branchId || undefined;
  return <AIDashboard restaurantId={restaurantId} branchId={branchId} />;
}

function AppContent() {
  const { route } = useRouter();
  const user = useAppStore((s) => s.user);

  switch (route.name) {
    // ── Public Platform Routes ───────────────────────────────
    case 'landing':
      return <LandingPage />;

    case 'register':
      return <RegisterPage />;

    case 'forgot-password':
      return <ForgotPasswordPage />;

    case 'reset-password':
      return <ResetPasswordPage />;

    case 'two-factor':
      return <TwoFactorPage />;

    // ── Restaurant-Scoped Public Routes ──────────────────────
    case 'restaurant-landing':
      return <RestaurantLandingPage />;

    case 'restaurant-login':
      return <RestaurantLoginPage />;

    case 'customer-menu':
      return <CustomerApp />;

    // ── Dashboard Routes (staff auth required) ──────────────
    case 'dashboard':
      return (
        <DashboardLayout>
          <DashboardView />
        </DashboardLayout>
      );

    case 'dashboard-orders':
      return (
        <DashboardLayout>
          <OrdersView />
        </DashboardLayout>
      );

    case 'dashboard-menu':
      return (
        <DashboardLayout>
          <MenuView />
        </DashboardLayout>
      );

    case 'dashboard-tables':
      return (
        <DashboardLayout>
          <TablesView />
        </DashboardLayout>
      );

    case 'dashboard-reservations':
      return (
        <DashboardLayout>
          <ReservationsView />
        </DashboardLayout>
      );

    case 'dashboard-qr-codes':
      return (
        <DashboardLayout>
          <QRCodesView />
        </DashboardLayout>
      );

    case 'dashboard-kitchen':
      return (
        <DashboardLayout>
          <KitchenDisplay />
        </DashboardLayout>
      );

    case 'dashboard-staff':
      return (
        <DashboardLayout>
          <StaffView />
        </DashboardLayout>
      );

    case 'dashboard-waiter':
      return (
        <DashboardLayout>
          <WaiterView />
        </DashboardLayout>
      );

    case 'dashboard-analytics':
      return (
        <DashboardLayout>
          <AnalyticsView />
        </DashboardLayout>
      );

    case 'dashboard-crm':
      return (
        <DashboardLayout>
          <CRMView />
        </DashboardLayout>
      );

    case 'dashboard-waitlist':
      return (
        <DashboardLayout>
          <WaitlistView />
        </DashboardLayout>
      );

    case 'dashboard-menu-engineering':
      return (
        <DashboardLayout>
          <MenuEngineeringView />
        </DashboardLayout>
      );

    case 'dashboard-promotions':
      return (
        <DashboardLayout>
          <PromotionsView />
        </DashboardLayout>
      );

    case 'dashboard-settings':
      return (
        <DashboardLayout>
          <SettingsView />
        </DashboardLayout>
      );

    case 'dashboard-notifications':
      return (
        <DashboardLayout>
          <NotificationsView />
        </DashboardLayout>
      );

    case 'dashboard-localization':
      return (
        <DashboardLayout>
          <LocalizationView />
        </DashboardLayout>
      );

    case 'dashboard-reviews':
      return (
        <DashboardLayout>
          <ReviewsView />
        </DashboardLayout>
      );

    case 'dashboard-refunds':
      return (
        <DashboardLayout>
          <RefundsView />
        </DashboardLayout>
      );

    case 'dashboard-rewards':
      return (
        <DashboardLayout>
          <RewardsRedemptionDashboard restaurantId={user?.restaurantId || ''} />
        </DashboardLayout>
      );

    case 'dashboard-printers':
      return (
        <DashboardLayout>
          <div className="max-w-2xl mx-auto p-4">
            <PrinterSettingsPanel restaurantId={user?.restaurantId || ''} />
          </div>
        </DashboardLayout>
      );

    case 'dashboard-z-report':
      return (
        <DashboardLayout>
          <div className="max-w-4xl mx-auto p-4">
            <ZReportPanel restaurantId={user?.restaurantId || ''} />
          </div>
        </DashboardLayout>
      );

    case 'dashboard-branches':
      return (
        <DashboardLayout>
          <BranchesView />
        </DashboardLayout>
      );

    case 'dashboard-inventory':
      return (
        <DashboardLayout>
          <InventoryView />
        </DashboardLayout>
      );

    case 'dashboard-audit-logs':
      return (
        <DashboardLayout>
          <AuditLogsView />
        </DashboardLayout>
      );
    case 'dashboard-shifts':
      return (
        <DashboardLayout>
          <ShiftsView />
        </DashboardLayout>
      );

    case 'dashboard-invoices':
      return (
        <DashboardLayout>
          <InvoicesView />
        </DashboardLayout>
      );

    case 'dashboard-platform-billing':
      return (
        <DashboardLayout>
          <PlatformFeeBillingView />
        </DashboardLayout>
      );

    case 'dashboard-ai':
      return (
        <DashboardLayout>
          <AIDashboardWrapper />
        </DashboardLayout>
      );

    // ── Admin Routes (super_admin auth required) ────────────
    case 'admin':
      return (
        <AdminLayout>
          <AdminOverviewView />
        </AdminLayout>
      );

    case 'admin-restaurants':
      return (
        <AdminLayout>
          <AdminRestaurantsView />
        </AdminLayout>
      );

    case 'admin-subscriptions':
      return (
        <AdminLayout>
          <AdminSubscriptionsView />
        </AdminLayout>
      );

    case 'admin-invoices':
      return (
        <AdminLayout>
          <AdminInvoicesView />
        </AdminLayout>
      );

    case 'admin-support':
      return (
        <AdminLayout>
          <AdminSupportView />
        </AdminLayout>
      );

    case 'admin-flags':
      return (
        <AdminLayout>
          <AdminFlagsView />
        </AdminLayout>
      );

    case 'admin-analytics':
      return (
        <AdminLayout>
          <AdminAnalyticsView />
        </AdminLayout>
      );

    // ── Fallback ────────────────────────────────────────────
    default:
      return <LandingPage />;
  }
}

// ============================================================
// Root App — wraps everything with the Router Provider
// ============================================================

export default function Home() {
  return (
    <ErrorBoundary>
      <RouterProvider>
        <AppContent />
        <Toaster position="top-right" />
      </RouterProvider>
    </ErrorBoundary>
  );
}
