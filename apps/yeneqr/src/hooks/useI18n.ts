'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useLanguageStore } from './useLanguage'

// In-memory cache of UI string bundles
const bundleCache = new Map<string, Record<string, string>>()

/**
 * Built-in English fallback map for all known i18n keys.
 * This ensures the dashboard always shows readable text even when
 * the API bundle is empty or fails to load.
 */
const ENGLISH_FALLBACKS: Record<string, string> = {
  // ─── Common ───
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.close': 'Close',
  'common.confirm': 'Confirm',
  'common.loading': 'Loading...',
  'common.error': 'Error',
  'common.success': 'Success',
  'common.search': 'Search',
  'common.add': 'Add',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.status': 'Status',
  'common.name': 'Name',
  'common.email': 'Email',
  'common.phone': 'Phone',
  'common.actions': 'Actions',
  'common.active': 'Active',
  'common.inactive': 'Inactive',
  'common.kitchen': 'Kitchen Display',
  'common.qr_codes': 'QR Codes',
  'common.notifications': 'Notifications',
  'common.reservations': 'Reservations',
  'common.off': 'off',

  // ─── Dashboard ───
  'dashboard.title': 'Dashboard',
  'dashboard.restaurant_manager': 'Restaurant Manager',
  'dashboard.order': 'Order',
  'dashboard.table_label': 'Table',
  'dashboard.customer': 'Customer',
  'dashboard.walk_in': 'Walk-in',
  'dashboard.type': 'Type',
  'dashboard.time': 'Time',
  'dashboard.notes': 'Notes',
  'dashboard.items_count': 'items',
  'dashboard.mark_as': 'Mark as',
  'dashboard.all': 'All',
  'dashboard.subtotal': 'Subtotal',
  'dashboard.tax': 'Tax',
  'dashboard.service_charge': 'Service Charge',
  'dashboard.total': 'Total',
  'dashboard.discount': 'Discount',
  'dashboard.completed_orders': 'Completed',
  'dashboard.preparing': 'Preparing',
  'dashboard.ready_count': 'Ready',
  'dashboard.no_orders': 'No orders yet',
  'dashboard.no_orders_found': 'No orders found',
  'dashboard.refresh': 'Refresh',
  'dashboard.today_orders': "Today's Orders",
  'dashboard.live_data': 'Live Data',
  'dashboard.revenue': 'Revenue',
  'dashboard.active_tables': 'Active Tables',
  'dashboard.pending_orders': 'Pending Orders',
  'dashboard.quick_actions': 'Quick Actions',
  'dashboard.new_order': 'New Order',
  'dashboard.manage_menu': 'Manage Menu',
  'dashboard.recent_orders': 'Recent Orders',
  'dashboard.view_all': 'View All',
  'dashboard.order_status': 'Order Status',
  'dashboard.analytics': 'Analytics',
  'dashboard.localization': 'Localization',
  'dashboard.split_bill': 'Split Bill',
  'dashboard.select_branch': 'Select Branch',
  'dashboard.branch': 'Branch',
  'dashboard.main': 'Main',
  'dashboard.loading_menu': 'Loading menu...',
  'dashboard.loading_orders': 'Loading orders...',
  'dashboard.loading_settings': 'Loading settings...',
  'dashboard.loading_dashboard': 'Loading dashboard...',
  'dashboard.orders': 'Orders',
  'dashboard.menu': 'Menu',
  'dashboard.tables': 'Tables',
  'dashboard.staff': 'Staff',
  'dashboard.promotions': 'Promotions',
  'dashboard.reviews': 'Reviews',
  'dashboard.refunds': 'Refunds',
  'dashboard.inventory': 'Inventory',
  'dashboard.settings': 'Settings',
  'dashboard.latest_orders_desc': 'Latest orders across all branches',
  'dashboard.order_distribution_desc': 'Current order distribution',

  // ─── Order Status ───
  'order.status.pending': 'Pending',
  'order.status.accepted': 'Confirmed',
  'order.status.preparing': 'Preparing',
  'order.status.ready': 'Ready',
  'order.status.picked_up': 'Picked Up',
  'order.status.served': 'Served',
  'order.status.paid': 'Paid',
  'order.status.completed': 'Completed',
  'order.status.cancelled': 'Cancelled',
  'order.accept_order': 'Confirm Order',
  'order.reject_order': 'Reject Order',
  'order.start_preparing': 'Start Preparing',
  'order.mark_ready': 'Mark Ready',
  'order.pick_up': 'Pick Up',
  'order.mark_served': 'Mark Served',
  'order.cancel_title': 'Cancel Order',
  'order.cancel_reason': 'Reason for cancellation',
  'order.cancel_reason_placeholder': 'Enter reason...',
  'order.confirm_cancel': 'Confirm Cancel',
  'order.print_receipt': 'Print Receipt',
  'order.order_number': 'Order',
  'order.table': 'Table',
  'order.customer': 'Customer',
  'order.walk_in': 'Walk-in',
  'order.type': 'Type',
  'order.time': 'Time',
  'order.items_count': 'items',
  'order.subtotal': 'Subtotal',
  'order.tax': 'Tax',
  'order.service_charge': 'Service Charge',
  'order.total': 'Total',
  'order.discount': 'Discount',
  'order.notes': 'Notes',
  'order.mark_as': 'Mark as',
  'order.all': 'All',
  'order.dine_in': 'Dine In',
  'order.takeaway': 'Takeaway',
  'order.new_order': 'New Order',
  'order.no_orders': 'No orders found',
  'order.pending_orders': 'Pending Orders',
  'order.split_bill': 'Split Bill',
  'order.complete_order': 'Complete Order',
  'order.order_details': 'Order Details',

  // ─── Kitchen ───
  'kitchen.title': 'Kitchen Display',
  'kitchen.all_stations': 'All Stations',
  'kitchen.loading': 'Loading kitchen...',
  'kitchen.no_orders': 'No active kitchen orders',
  'kitchen.no_station_orders': 'No orders for this station',
  'kitchen.mark_all_ready': 'Mark All Ready',
  'kitchen.start': 'Start',
  'kitchen.ready': 'Ready',
  'kitchen.picked_up': 'Picked Up',
  'kitchen.overdue': 'OVERDUE',
  'kitchen.slow': 'SLOW',
  'kitchen.item': 'item',
  'kitchen.items': 'items',
  'kitchen.unassigned': 'Unassigned',
  'kitchen.cancel_item': 'Cancel Item?',
  'kitchen.keep_item': 'Keep Item',
  'kitchen.cancel_item_btn': 'Cancel Item',
  'kitchen.sound_on': 'Sound On',
  'kitchen.sound_off': 'Sound Off',
  'kitchen.shortcuts': 'Shortcuts',
  'kitchen.live': 'Live',
  'kitchen.polling': 'Polling',
  'kitchen.pending_count': 'Pending',
  'kitchen.preparing_count': 'Preparing',
  'kitchen.ready_count': 'Ready',

  // ─── Waiter ───
  'waiter.title': 'Waiter Dashboard',
  'waiter.in_progress': 'In Progress',
  'waiter.ready_for_pickup': 'Ready for Pickup',
  'waiter.on_its_way': 'On Its Way',
  'waiter.served': 'Served',
  'waiter.table_calls': 'Table Calls',
  'waiter.pick_up_deliver': 'Pick Up & Deliver',
  'waiter.mark_delivered': 'Mark Delivered',
  'waiter.call_waiter': 'Call Waiter',
  'waiter.request_bill': 'Request Bill',
  'waiter.request_menu': 'Request Menu',
  'waiter.custom_request': 'Custom Request',
  'waiter.on_my_way': 'On My Way',
  'waiter.resolved': 'Resolved',
  'waiter.done': 'Done',
  'waiter.loading': 'Loading waiter dashboard...',
  'waiter.live': 'Live',
  'waiter.polling': 'Polling',
  'waiter.sound_on': 'Sound On',
  'waiter.sound_off': 'Sound Off',
  'waiter.calls_pending': 'Calls Pending',
  'waiter.acknowledged': 'Acknowledged',
  'waiter.no_ready_orders': 'No orders ready for pickup',
  'waiter.no_calls': 'No active table calls',
  'waiter.your_tables': 'Your tables: {n} assigned',
  'waiter.all_tables': 'All tables (no assignments set up)',
  'waiter.ready_sound_hint': "You'll hear a sound when an order is ready",
  'waiter.accepted': 'Confirmed',
  'waiter.new_order_alert': 'New Order!',
  'waiter.accept_and_send': 'Confirm & Send to Kitchen',

  // ─── Staff ───
  'staff.title': 'Staff Management',
  'staff.add_staff': 'Add Staff',
  'staff.role': 'Role',
  'staff.permissions': 'Permissions',
  'staff.additional_permissions': 'Additional Permissions',
  'staff.revoked_permissions': 'Revoked Permissions',
  'staff.role_permissions': 'Role Default Permissions',
  'staff.effective_permissions': 'Effective Permissions',
  'staff.save_permissions': 'Save Permissions',

  // ─── Settings ───
  'settings.save_changes': 'Save Changes',
  'settings.to': 'to',
  'settings.closed': 'Closed',
  'settings.save_hours': 'Save Hours',
  'settings.tax_rate': 'Tax Rate',
  'settings.service_charge_pct': 'Service Charge %',
  'settings.currency': 'Currency',
  'settings.default_language': 'Default Language',
  'settings.save_settings': 'Save Settings',
  'settings.save_payment': 'Save Payment',
  'settings.restaurant_profile': 'Restaurant Profile',
  'settings.working_hours': 'Working Hours',
  'settings.tax_service': 'Tax & Service',
  'settings.payment_methods': 'Payment Methods',
  'settings.security': 'Security',

  // ─── Landing — Navigation ───
  'landing.nav.restaurant_login': 'Restaurant Login',
  'landing.nav.login': 'Login',
  'landing.nav.admin': 'Admin',
  'landing.nav.get_started': 'Get Started',

  // ─── Landing — Hero ───
  'landing.hero.badge': "Ethiopia's #1 QR Restaurant Platform",
  'landing.hero.title_scan': 'Scan.',
  'landing.hero.title_order': 'Order.',
  'landing.hero.title_enjoy': 'Enjoy.',
  'landing.hero.description': 'Transform your restaurant with QR-powered digital menus, seamless ordering, kitchen management, and Ethiopian payment integrations. Built for restaurants that want to deliver exceptional dining experiences.',
  'landing.hero.free_trial': '14-day free trial',
  'landing.hero.no_card': 'No credit card required',
  'landing.hero.multilingual': '13 languages supported',

  // ─── Landing — Demo ───
  'landing.demo.table_guests': 'Table {number} · {count} guests',
  'landing.demo.total': 'Total',
  'landing.demo.pay_telebirr': 'Pay with Telebirr',

  // ─── Landing — Entry Points ───
  'landing.entry_points.title': 'How Would You Like to Get Started?',
  'landing.entry_points.subtitle': 'Whether you manage restaurants, serve customers, or oversee the platform — we\'ve got you covered.',
  'landing.entry_points.restaurant_title': 'Restaurant Owner',
  'landing.entry_points.restaurant_desc': 'Register your restaurant, create menus, generate QR codes, manage orders, and track analytics from your dashboard.',
  'landing.entry_points.restaurant_cta': 'Register Your Restaurant',
  'landing.entry_points.restaurant_existing': 'Already registered?',
  'landing.entry_points.login_here': 'Log in here',
  'landing.entry_points.admin_title': 'Platform Admin',
  'landing.entry_points.admin_desc': 'Manage all restaurants, subscriptions, feature flags, support tickets, and platform-wide analytics from the admin panel.',
  'landing.entry_points.admin_cta': 'Admin Login',
  'landing.entry_points.admin_note': 'Super admin & support staff only',

  // ─── Landing — Features ───
  'landing.features.title': 'Everything Your Restaurant Needs',
  'landing.features.description': 'From QR code generation to kitchen management, Yene QR covers every aspect of modern restaurant operations.',
  'landing.feature.qr_ordering.title': 'QR-Powered Ordering',
  'landing.feature.qr_ordering.desc': 'Generate unique QR codes per table. Customers scan, browse your menu, and order instantly — no app download needed.',
  'landing.feature.multilingual.title': 'Multilingual Menus',
  'landing.feature.multilingual.desc': '13 languages supported with automatic detection. Your customers see the menu in their preferred language automatically.',
  'landing.feature.kitchen.title': 'Kitchen Display System',
  'landing.feature.kitchen.desc': 'Real-time kitchen display with station filtering, preparation timers, and automatic order routing to the right station.',
  'landing.feature.payments.title': 'Ethiopian Payments',
  'landing.feature.payments.desc': 'Accept Telebirr, Chapa, CBE Birr, and cash. Provider-agnostic architecture means adding new payment methods is seamless.',
  'landing.feature.analytics.title': 'Smart Analytics',
  'landing.feature.analytics.desc': 'Track sales, popular items, peak hours, table turnover, and average order value. Make data-driven decisions for your restaurant.',
  'landing.feature.engagement.title': 'Customer Engagement',
  'landing.feature.engagement.desc': 'Loyalty points, promotions, happy hour deals, and post-order feedback. Keep your customers coming back.',

  // ─── Landing — Pricing ───
  'landing.pricing.title': 'Simple, Transparent Pricing',
  'landing.pricing.subtitle': 'Start free. Upgrade when you\'re ready.',
  'landing.pricing.most_popular': 'Most Popular',
  'landing.pricing.free': 'Free',
  'landing.pricing.per_month': 'ETB/mo',
  'landing.pricing.basic': 'Basic',
  'landing.pricing.basic_desc': 'Perfect for getting started',
  'landing.pricing.pro': 'Professional',
  'landing.pricing.pro_desc': 'For growing restaurants',
  'landing.pricing.premium': 'Premium',
  'landing.pricing.premium_desc': 'For restaurant chains',
  'landing.pricing.start_free': 'Start Free',
  'landing.pricing.start_trial': 'Start Trial',
  'landing.pricing.contact_sales': 'Contact Sales',

  // ─── Landing — Dropdown ───
  'landing.dropdown.loading': 'Loading restaurants...',
  'landing.dropdown.placeholder': 'Select a restaurant...',
  'landing.dropdown.no_restaurants': 'No restaurants available yet.',
  'landing.dropdown.staff_hint': 'Select your restaurant to log in to the dashboard.',
  'landing.dropdown.admin_login': 'Log in here',

  // ─── Landing — UAT ───
  'landing.uat.customer_title': 'Customer Testing (UAT)',
  'landing.uat.customer_desc': 'Simulate the customer experience by scanning QR codes for any restaurant. Test the full ordering flow end-to-end.',
  'landing.uat.collapse': 'Collapse UAT Environment',
  'landing.uat.expand': 'Open UAT Environment',

  // ─── Auth ───
  'auth.login': 'Staff Login',
  'auth.logout': 'Logout',
  'auth.sign_in': 'Sign In',
  'auth.welcome_back': 'Welcome back!',
  'auth.invalid_credentials': 'Invalid email or password',
  'auth.forgot_password': 'Forgot password?',
  'auth.enter_password': 'Enter your password',
  'auth.restaurant_dashboard': 'Restaurant Dashboard',
  'auth.platform_admin': 'Platform Admin',
  'auth.admin_login': 'Admin Login',
  'auth.restaurant_inactive': 'This restaurant is currently inactive. Please contact the restaurant owner.',
  'auth.restaurant_suspended': 'This restaurant has been suspended. Please contact support.',
  'auth.restaurant_not_found': 'Restaurant not found. Please check the link and try again.',
  'auth.go_to_home': 'Go to Home',
  'auth.quick_demo_fill': 'Quick Demo Fill',
  'auth.min_8_chars': 'Minimum 8 characters',
  'auth.password_mismatch': 'Passwords do not match',
  'auth.password_reset': 'Password Reset',
  'auth.invalid_link': 'Invalid Link',
  'auth.link_expired': 'This password reset link has expired or is invalid.',
  'auth.request_new_link': 'Please request a new one.',
  'auth.request_new': 'Request New Link',
  'auth.back_to_login': 'Back to Login',
  'auth.reset_your_password': 'Reset Your Password',
  'auth.reset_success': 'Your password has been reset successfully!',
  'auth.enter_new_password': 'Enter your new password below.',
  'auth.sign_in_new_password': 'Sign in with your new password',
  'auth.new_password': 'New Password',
  'auth.confirm_password': 'Confirm Password',
  'auth.re_enter_password': 'Re-enter password',
  'auth.reset_password': 'Reset Password',
  'auth.cuisine_type': 'Cuisine Type',
  'auth.phone': 'Phone',
  'auth.email': 'Email',
  'auth.address': 'Address',

  // ─── Restaurant Landing ───
  'restaurant.not_found': 'Restaurant Not Found',
  'restaurant.not_found_desc': 'The restaurant you are looking for could not be found.',
  'restaurant.loading': 'Loading...',
  'restaurant.go_home': 'Go Home',
  'restaurant.scanned_qr': 'You scanned the QR code',
  'restaurant.all_rights': 'All rights reserved.',
  'restaurant.powered_by': 'Powered by Yene QR',

  // ─── Welcome ───
  'welcome.view_menu': 'View Menu',

  // ─── Dashboard Tabs ───
  'dashboard.orders': 'Orders',
  'dashboard.menu': 'Menu',
  'dashboard.tables': 'Tables',
  'dashboard.staff': 'Staff',
  'dashboard.promotions': 'Promotions',
  'dashboard.reviews': 'Reviews',
  'dashboard.refunds': 'Refunds',
  'dashboard.inventory': 'Inventory',
  'dashboard.settings': 'Settings',
}

/**
 * Convert a dot-notation i18n key to a human-readable fallback string.
 * Example: 'dashboard.today_orders' → "Today Orders"
 * Example: 'order.status.pending' → "Pending"
 */
function keyToHumanReadable(key: string): string {
  // Take the last segment of the key (most specific part)
  const parts = key.split('.')
  const lastPart = parts[parts.length - 1]
  // Replace underscores with spaces and title-case
  return lastPart
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

interface I18nStrings {
  strings: Record<string, string>
  loading: boolean
  t: (key: string, fallbackOrParams?: string | Record<string, string | number>, params?: Record<string, string | number>) => string
}

/**
 * Hook for UI string translations (labels, buttons, messages).
 * Loads the full bundle for the current language on mount and caches it.
 *
 * Fallback chain: loaded bundle → explicit fallback → English fallback map → human-readable key
 *
 * Usage:
 *   const { t } = useI18n(restaurantId)
 *   <button>{t('cart.empty')}</button>
 *   <p>{t('order.items_count', { count: 3 })}</p>
 */
export function useI18n(restaurantId?: string): I18nStrings {
  const language = useLanguageStore((s) => s.language)
  const [strings, setStrings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  // Use a ref to hold the latest strings so the `t` callback doesn't need
  // `strings` in its dependency array. This prevents `t` from being recreated
  // on every bundle load, which would cascade re-renders through all consumers.
  const stringsRef = useRef<Record<string, string>>({})
  stringsRef.current = strings

  // Stabilize restaurantId with a ref to prevent unnecessary effect re-runs
  // when the parent re-renders with the same restaurantId value.
  // Also track the previous language+rid combo to skip redundant fetches.
  const restaurantIdRef = useRef(restaurantId)
  const prevDepsRef = useRef<string | null>(null)
  restaurantIdRef.current = restaurantId

  useEffect(() => {
    const rid = restaurantIdRef.current
    const cacheKey = `${language}:${rid || 'platform'}`

    // Skip if the dependency combo hasn't actually changed and bundle was already loaded
    if (cacheKey === prevDepsRef.current) {
      return
    }
    prevDepsRef.current = cacheKey

    let cancelled = false

    async function loadBundle() {
      // Check in-memory cache
      if (bundleCache.has(cacheKey)) {
        const cached = bundleCache.get(cacheKey)!
        setStrings(prev => prev === cached ? prev : cached)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const params = new URLSearchParams({ lang: language })
        if (rid) params.set('restaurantId', rid)

        const res = await fetch(`/api/i18n/ui-strings/bundle?${params}`)
        if (res.ok) {
          const data = await res.json()
          const bundle = data.strings || {}
          bundleCache.set(cacheKey, bundle)
          if (!cancelled) setStrings(bundle)
        } else {
          // Fallback: use built-in English fallbacks
          if (!cancelled) setStrings({})
        }
      } catch {
        if (!cancelled) setStrings({})
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadBundle()
    return () => {
      cancelled = true
      // NOTE: We intentionally do NOT reset prevDepsRef here.
      // Resetting it caused an infinite re-render loop: cleanup runs →
      // prevDepsRef = null → effect re-runs → sets state → re-render →
      // cleanup runs again → prevDepsRef = null → loop.
      // The cacheKey check inside loadBundle() is sufficient to skip
      // redundant fetches when language/restaurantId haven't changed.
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, restaurantId])

  // Stable `t` function — uses a ref to read the latest strings so the
  // callback identity never changes. This prevents downstream useCallback /
  // useEffect dependencies from being invalidated on every i18n bundle load.
  const t = useCallback(
    (key: string, fallbackOrParams?: string | Record<string, string | number>, params?: Record<string, string | number>): string => {
      // Support two calling conventions:
      //   t('key', 'Fallback text')           — with fallback string
      //   t('key', { count: 3 })              — with interpolation params (legacy)
      //   t('key', 'Fallback', { count: 3 })   — with both fallback and params
      let fallback: string | undefined
      let interpolationParams: Record<string, string | number> | undefined

      if (typeof fallbackOrParams === 'string') {
        fallback = fallbackOrParams
        interpolationParams = params
      } else {
        interpolationParams = fallbackOrParams
      }

      // Fallback chain: loaded bundle → explicit fallback → English fallback map → human-readable key
      const currentStrings = stringsRef.current
      let value = currentStrings[key]
        || (fallback !== undefined ? fallback : undefined)
        || ENGLISH_FALLBACKS[key]
        || keyToHumanReadable(key)
      if (interpolationParams) {
        Object.entries(interpolationParams).forEach(([k, v]) => {
          value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
        })
      }
      return value
    },
    [] // stable — reads strings via ref
  )

  return { strings, loading, t }
}

/**
 * Clear the in-memory bundle cache (useful after updating translations).
 */
export function clearI18nCache() {
  bundleCache.clear()
}
