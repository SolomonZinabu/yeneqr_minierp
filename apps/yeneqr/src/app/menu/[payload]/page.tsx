'use client'

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UtensilsCrossed,
  Globe,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  X,
  CheckCircle2,
  Clock,
  Loader2,
  Leaf,
  Flame,
  Coffee,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  CreditCard,
  Receipt,
  Phone,
  Send,
  AlertCircle,
  MessageSquare,
  ClipboardList,
  Star,
  Bell,
  Wallet,
  Smartphone,
  Landmark,
  Banknote,
  Gift,
  Tag,
  Sparkles,
  Sun,
  Moon,
  LayoutGrid,
  ImageIcon,
  List,
  ArrowUpDown,
  Search,
  Filter,
  CalendarDays,
  Users,
  Heart,
  Share2,
  XCircle,
  ArrowLeft,
  Home,
  Trophy,
  User,
  Menu,
  SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer'
import { Switch } from '@/components/ui/switch'
import ReservationWidget from '@/components/customer/reservation-widget'
import MyReservations from '@/components/customer/my-reservations'
import { useCustomerRealtime } from '@/lib/use-realtime'
import {
  resolveI18nString,
  getLanguageDirection,
  getLanguageFontCSS,
  type LanguageConfig,
  type I18nJson,
  parseI18nJson,
} from '@/lib/i18n'
import { useTheme } from 'next-themes'
import ShareSheet from '@/components/customer/share-sheet'
import { toast } from 'sonner'
import { GameArena } from '@/components/customer/game-arena'
import { CustomerProfileDrawer } from '@/components/customer/customer-profile-drawer'

// ─── Types ────────────────────────────────────────────────────
interface QRPayload {
  rid: string
  bid: string
  tid: string
  type: 'static' | 'dynamic' | 'temporary'
  iat: number
  exp: number | null
}

interface RestaurantInfo {
  id: string
  name: string
  nameAm: string | null
  nameI18n?: string | null
  slug: string
  logo: string | null
  cuisineType: string | null
  defaultLanguage: string
  currency: string
  taxRate: number
  serviceCharge: number
  settings?: Record<string, unknown> | null
  banner?: string | null
  description?: string | null
  workingHours?: string | null
  starPayEnabled?: boolean
}

interface BranchInfo {
  id: string
  name: string
  nameAm: string | null
  nameI18n?: string | null
  address: string | null
}

interface TableInfo {
  id: string
  number: string
  capacity: number
}

interface WaiterInfo {
  name: string
  phone: string | null
}

interface MenuCategory {
  id: string
  name: string
  nameAm: string | null
  nameI18n?: string | null
  icon: string | null
  isActive: boolean
  sortOrder: number
}

interface ModifierOption {
  id: string
  name: string
  nameAm: string | null
  nameI18n?: string | null
  priceCents: number
  isDefault: boolean
}

interface ModifierGroup {
  id: string
  name: string
  nameAm: string | null
  nameI18n?: string | null
  isRequired: boolean
  selectionType: string
  minSelection: number
  maxSelection: number
  options: ModifierOption[]
}

interface ComboItemInfo {
  id: string
  includedItemId: string
  quantity: number
  includedItem?: {
    id: string
    name: string
    nameAm: string | null
    nameI18n?: string | null
    priceCents: number
    image: string | null
  }
}

interface IngredientLink {
  id: string
  ingredient: {
    id: string
    name: string
    nameAm: string | null
    nameI18n?: string | null
    isAvailable: boolean
  }
  isRemovable: boolean
  isDefault: boolean
}

interface MenuItem {
  id: string
  name: string
  nameAm: string | null
  nameI18n?: string | null
  description: string | null
  descriptionAm: string | null
  descriptionI18n?: string | null
  ingredients?: string | null
  ingredientsI18n?: string | null
  image: string | null
  priceCents: number
  preparationTime: number
  isAvailable: boolean
  currentAvailable?: boolean  // Computed from schedule — overrides isAvailable for display/cart
  availabilityType?: string   // 'always' | 'scheduled' | 'manual'
  isPopular: boolean
  isVegetarian: boolean
  isSpicy: boolean
  showServingSize?: boolean | null  // null = inherit from restaurant settings, true/false = override
  categoryId: string
  modifierGroups: ModifierGroup[]
  comboItems?: ComboItemInfo[]
  // Structured ingredient links from MenuItemIngredient table.
  // Only includes ingredients where isRemovable=true (customer can toggle off).
  menuItemIngredients?: IngredientLink[]
  _passesFilter?: boolean
}

interface RemovedIngredient {
  id: string
  name: string
  nameAm?: string | null
}

interface CartItem {
  menuItem: MenuItem
  quantity: number
  selectedModifiers: { group: ModifierGroup; option: ModifierOption }[]
  removedIngredients: RemovedIngredient[]
  specialInstructions: string
  totalPriceCents: number
}

type Screen = 'welcome' | 'menu' | 'order' | 'payment'
type Language = string
type OrderType = 'dine-in' | 'takeaway'
type ViewMode = 'card' | 'grid' | 'list'
type SortOrder = 'default' | 'price-low' | 'price-high' | 'popular' | 'fastest'

// ─── i18n Translation Context ────────────────────────────────
interface TranslationContext {
  lang: Language
  defaultLang: string
  uiStrings: Record<string, string>
}

/**
 * Resolve a translatable name for an entity that has nameI18n.
 * Fallback chain: i18n[lang] → i18n[defaultLang] → i18n['en'] → nameAm (if lang==='am') → name
 */
function resolveName(
  name: string,
  nameAm: string | null,
  nameI18n: string | null | undefined,
  lang: Language,
  defaultLang: string = 'en'
): string {
  const i18nResolved = resolveI18nString(nameI18n, name, lang, defaultLang)
  // If i18n resolved to something other than the fallback, use it
  if (i18nResolved !== name) return i18nResolved
  // Fall back to old nameAm pattern for backward compatibility
  if (lang === 'am' && nameAm) return nameAm
  return name
}

/**
 * Resolve a translatable description for an entity that has descriptionI18n.
 */
function resolveDescription(
  description: string | null,
  descriptionAm: string | null,
  descriptionI18n: string | null | undefined,
  lang: Language,
  defaultLang: string = 'en'
): string {
  const fallback = description || ''
  const i18nResolved = resolveI18nString(descriptionI18n, fallback, lang, defaultLang)
  if (i18nResolved !== fallback) return i18nResolved
  if (lang === 'am' && descriptionAm) return descriptionAm
  return fallback
}

/**
 * Translate a UI string. Looks up the key in the uiStrings bundle,
 * falls back to the provided English default.
 */
function tui(key: string, fallback: string, ctx: TranslationContext): string {
  if (ctx.lang === 'en') return fallback
  return ctx.uiStrings[key] || fallback
}

/**
 * Combined t() function that handles both UI strings and data fields.
 * - For data fields: t(name, nameAm, nameI18n, language, defaultLang) → resolves i18n
 * - For UI strings with context: uses tui() directly
 * - Backward compatible with old t(en, am, lang) calls
 */
function t(en: string, am: string | null, lang: Language): string {
  // Backward compatible old format: t('English', 'አማርኛ', 'am')
  if (lang === 'am' && am) return am
  return en
}

// Global translation context accessible by sub-components
// Updated synchronously during render — NOT in useEffect — to ensure
// language changes apply immediately without requiring a second render.
let _tCtx: TranslationContext = { lang: 'en', defaultLang: 'en', uiStrings: {} }

/**
 * Translate a UI string using the global context.
 */
function tuiGlobal(key: string, fallback: string): string {
  return tui(key, fallback, _tCtx)
}

/**
 * Get resolved name for an entity using global context.
 */
function tName(name: string, nameAm: string | null, nameI18n?: string | null): string {
  return resolveName(name, nameAm, nameI18n ?? null, _tCtx.lang, _tCtx.defaultLang)
}

/**
 * Get resolved description for an entity using global context.
 */
function tDesc(description: string | null, descriptionAm: string | null, descriptionI18n?: string | null): string {
  return resolveDescription(description, descriptionAm, descriptionI18n ?? null, _tCtx.lang, _tCtx.defaultLang)
}

function formatPrice(cents: number | undefined | null, currency: string = 'ETB'): string {
  return `${((cents ?? 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

// ─── Helper: Check if modifier group name matches cooking/doneness ─────────
function isDonenessGroup(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.includes('doneness') || lower.includes('cook') && (lower.includes('level') || lower.includes('preference') || lower.includes('how'))
}
function isSpiceLevelGroup(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.includes('spice level') || lower.includes('spiciness')
}
function isCookingPreferenceGroup(name: string): boolean {
  return isDonenessGroup(name) || isSpiceLevelGroup(name)
}
function isRemovalGroup(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.includes('remove') || lower.includes('without') || lower.includes('no ') || lower.includes('exclude')
}
function isServingSizeGroup(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.includes('serving size') || lower.includes('portion') || (lower.includes('size') && !lower.includes('spice'))
}

// ─── Language Picker Component ────────────────────────────────
function LanguagePicker({
  language,
  languages,
  onChange,
  compact,
}: {
  language: Language
  languages: LanguageConfig[]
  onChange: (lang: string) => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const currentLang = languages.find(l => l.code === language)
  const displayLabel = currentLang?.flagEmoji || language.toUpperCase()

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 rounded-full text-sm font-medium active:scale-95 transition-transform ${
          compact ? 'px-2 py-1 bg-muted text-xs' : 'px-3 py-1.5 bg-secondary'
        }`}
        title={currentLang?.name || language.toUpperCase()}
      >
        <span className={`${compact ? 'text-sm' : 'text-base'}`}>{displayLabel}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1 z-50 min-w-[180px] max-h-[300px] overflow-y-auto bg-card border border-border rounded-xl shadow-lg py-1"
          >
            {languages.map(lang => {
              const isSelected = lang.code === language
              return (
                <button
                  key={lang.code}
                  onClick={() => { onChange(lang.code); setOpen(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                    isSelected ? 'bg-brand/10 text-brand font-medium' : 'hover:bg-muted'
                  }`}
                >
                  {lang.flagEmoji && <span className="text-base">{lang.flagEmoji}</span>}
                  <span>{lang.nameLocal}</span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 ml-auto" />}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Auto-scrolling Promotions Banner ────────────────────────
// For a SINGLE promotion: render ONE copy and animate it smoothly across the
// screen using a CSS keyframe marquee (translateX from off-screen right to
// off-screen left, then loop). No duplication — the promo slides across, exits
// the left edge, then re-enters from the right. Pauses on hover/touch.
//
// For 2+ promotions: existing scroll-left row with 2x duplication for a
// seamless horizontal loop.
function PromoBanner({ promotions, language }: { promotions: any[]; language: Language }) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const itemRef = React.useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  // Measured widths for the single-promo marquee
  const [containerWidth, setContainerWidth] = useState(0)
  const [itemWidth, setItemWidth] = useState(0)

  const isSingle = promotions.length === 1
  // 2+ promos: duplicate once for seamless loop
  const loopPromos = promotions.length > 1 ? [...promotions, ...promotions] : promotions

  // ── Single-promo: measure container + item width so we can animate the
  //    element from "off-screen right" to "off-screen left" precisely.
  useEffect(() => {
    if (!isSingle) return
    const measure = () => {
      if (scrollRef.current) setContainerWidth(scrollRef.current.offsetWidth)
      if (itemRef.current) setItemWidth(itemRef.current.offsetWidth)
    }
    measure()
    // Re-measure on next frame (after layout settles) + on resize
    const raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
    }
  }, [isSingle])

  // ── Multi-promo: existing rAF scroll-left loop (unchanged)
  useEffect(() => {
    if (isSingle) return
    const el = scrollRef.current
    if (!el || loopPromos.length === 0) return

    let animFrame: number
    let lastTime = 0
    const speed = 0.5 // pixels per frame at 60fps

    const step = (time: number) => {
      if (!lastTime) lastTime = time
      if (!paused) {
        const delta = time - lastTime
        el.scrollLeft += speed * (delta / 16)
        // Seamless loop: reset when reaching the halfway point
        // (the second half is a duplicate of the first half)
        const halfWidth = el.scrollWidth / 2
        if (halfWidth > 0 && el.scrollLeft >= halfWidth) {
          el.scrollLeft = 0
        }
      }
      lastTime = time
      animFrame = requestAnimationFrame(step)
    }

    animFrame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animFrame)
  }, [loopPromos.length, paused, isSingle])

  // ── Single promotion: smooth marquee with NO duplication ──
  if (isSingle) {
    const promo = promotions[0]
    const startX = containerWidth   // element's left edge at container's right edge → off-screen right
    const endX = -itemWidth         // element's left edge at -itemWidth → just off-screen left
    const totalDistance = startX + Math.abs(endX)
    const pxPerSec = 55             // comfortable reading speed
    const duration = totalDistance > 0 ? totalDistance / pxPerSec : 8

    return (
      <div className="px-4 pb-2">
        {/* Keyframes for the single-promo marquee. CSS vars let us pass the
            measured pixel offsets in from React. */}
        <style>{`
          @keyframes promo-marquee-single {
            0%   { transform: translateX(var(--start-x, 100%)); }
            100% { transform: translateX(var(--end-x, -100%)); }
          }
        `}</style>
        <div
          ref={scrollRef}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
          className="relative overflow-hidden h-8 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div
            ref={itemRef}
            className="absolute top-0 left-0 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand/10 to-brand/5 border border-brand/20 whitespace-nowrap"
            style={{
              ...(startX > 0 ? { '--start-x': `${startX}px` } : {}),
              ...(endX < 0 ? { '--end-x': `${endX}px` } : {}),
              animation: startX > 0 ? `promo-marquee-single ${duration}s linear infinite` : 'none',
              animationPlayState: paused ? 'paused' : 'running',
            } as React.CSSProperties}
          >
            <Tag className="w-3.5 h-3.5 text-brand shrink-0" />
            <span className="text-xs font-medium text-brand whitespace-nowrap">
              {tName(promo.name, promo.nameAm, promo.nameI18n)}
            </span>
            <span className="text-[10px] text-brand/70 whitespace-nowrap">
              {promo.discountType === 'percentage'
                ? `${(promo.discountValueCents / 100).toFixed(promo.discountValueCents % 100 === 0 ? 0 : 1)}% ${tuiGlobal('common.off', 'off')}`
                : `${formatPrice(promo.discountValueCents)} ${tuiGlobal('common.off', 'off')}`}
            </span>
            {promo.code && (
              <span className="text-[10px] bg-brand text-white px-1.5 py-0.5 rounded font-mono">
                {promo.code}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Multiple promotions: existing scroll-left row ──
  return (
    <div className="px-4 pb-2">
      <div
        ref={scrollRef}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
        className="flex gap-2 overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {loopPromos.map((promo: any, idx: number) => (
          <motion.div
            key={`${promo.id}-${idx}`}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand/10 to-brand/5 border border-brand/20 shrink-0"
          >
            <Tag className="w-3.5 h-3.5 text-brand shrink-0" />
            <span className="text-xs font-medium text-brand whitespace-nowrap">
              {tName(promo.name, promo.nameAm, promo.nameI18n)}
            </span>
            <span className="text-[10px] text-brand/70 whitespace-nowrap">
              {promo.discountType === 'percentage'
                ? `${(promo.discountValueCents / 100).toFixed(promo.discountValueCents % 100 === 0 ? 0 : 1)}% ${tuiGlobal('common.off', 'off')}`
                : `${formatPrice(promo.discountValueCents)} ${tuiGlobal('common.off', 'off')}`}
            </span>
            {promo.code && (
              <span className="text-[10px] bg-brand text-white px-1.5 py-0.5 rounded font-mono">
                {promo.code}
              </span>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page Component ──────────────────────────────────────
export default function CustomerMenuPage() {
  const params = useParams()
  const payloadStr = params.payload as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [language, setLanguage] = useState<Language>(() => {
    // Restore language preference from localStorage
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('yeneqr_language')
        if (saved) return saved as Language
      } catch { /* ignore */ }
    }
    return 'en'
  })
  const [screen, setScreen] = useState<Screen>('welcome')
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  // Track whether this is a resumed session (vs. first-time)
  const [isResumedSession, setIsResumedSession] = useState(false)

  // Restaurant switch confirmation dialog
  const [showRestaurantSwitchDialog, setShowRestaurantSwitchDialog] = useState(false)
  const [pendingQRPayload, setPendingQRPayload] = useState<QRPayload | null>(null)
  const [pendingSignature, setPendingSignature] = useState<string | null>(null)

  // i18n state
  const [enabledLanguages, setEnabledLanguages] = useState<LanguageConfig[]>([])
  const [uiStrings, setUiStrings] = useState<Record<string, string>>({})

  // Restaurant data
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null)
  const [branch, setBranch] = useState<BranchInfo | null>(null)
  const [table, setTable] = useState<TableInfo | null>(null)
  const [waiter, setWaiter] = useState<WaiterInfo | null>(null)

  // Menu data
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // ── Feature 1: Order Type & Guest Count ──
  const [orderType, setOrderType] = useState<OrderType>('dine-in')
  const [guestCount, setGuestCount] = useState(2)

  // ── Feature 2: Filtering, Sort, View ──
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())
  const [sortOrder, setSortOrder] = useState<SortOrder>('default')
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false)
  const sortDropdownRef = useRef<HTMLDivElement>(null)
  const menuContentRef = useRef<HTMLDivElement>(null)
  const itemsStartRef = useRef<HTMLDivElement>(null)

  // Ref to track previous restaurant ID for change detection
  const prevRestaurantIdRef = useRef<string | null>(null)

  // Refs for retry capability — store the initial QR payload & signature
  const initialQRPayloadRef = useRef<QRPayload | null>(null)
  const initialSignatureRef = useRef<string | null>(null)

  // Cart
  const [cart, setCart] = useState<CartItem[]>(() => {
    // Cart is not loaded eagerly — we restore it in initSession after we know
    // the restaurant + table, so we can use the correct scoped localStorage key.
    return []
  })
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isItemDetailOpen, setIsItemDetailOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)

  // Order
  const [currentOrder, setCurrentOrder] = useState<{
    id: string
    orderNumber: string
    status: string
    totalAmountCents: number
    items: { name: string; nameAm: string | null; quantity: number; priceCents: number; kitchenStatus: string }[]
    estimatedReadyAt: Date | null
    createdAt: Date
    roundNumber?: number
    cancellationReason?: string | null
  } | null>(null)

  // Track order round number for multi-round ordering
  const [orderRound, setOrderRound] = useState(1)

  // Refs to track current cart/order for change detection (avoids useEffect dependency loops)
  const cartRef = useRef(cart)
  cartRef.current = cart
  const currentOrderRef = useRef(currentOrder)
  currentOrderRef.current = currentOrder

  // ── Payment State ──
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'telebirr' | 'chapa' | 'cbe_birr' | 'starpay'>('cash')
  const [showPayment, setShowPayment] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'select' | 'processing' | 'success' | 'failed' | 'timeout'>('select')
  const [orderAlreadyPaid, setOrderAlreadyPaid] = useState(false)
  const [remainingBalanceCents, setRemainingBalanceCents] = useState(0)
  const [hasPendingCashPayment, setHasPendingCashPayment] = useState(false)

  // ── Waiter Call State ──
  const [isWaiterCallOpen, setIsWaiterCallOpen] = useState(false)
  const [waiterCallSent, setWaiterCallSent] = useState(false)
  const [waiterCustomMessage, setWaiterCustomMessage] = useState('')

  // ── Reservation State ──
  const [isReservationOpen, setIsReservationOpen] = useState(false)
  const [isMyReservationsOpen, setIsMyReservationsOpen] = useState(false)

  // ── Review State ──
  const [showReview, setShowReview] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitted, setReviewSubmitted] = useState(false)

  // ── Real-time Connection State ──
  const [realtimeConnected, setRealtimeConnected] = useState(false)

  // ── Placing order loading ──
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)

  // ── Promotions State ──
  const [promotions, setPromotions] = useState<any[]>([])
  const [couponCode, setCouponCode] = useState('')
  const [appliedPromotion, setAppliedPromotion] = useState<any>(null)
  const [discount, setDiscount] = useState(0)
  const [couponError, setCouponError] = useState('')

  // ── Loyalty State ──
  const [loyaltyPoints, setLoyaltyPoints] = useState(0)
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false)
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0)
  const [pointsEarned, setPointsEarned] = useState(0)

  // ── Favorites State ──
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [favoriteToggling, setFavoriteToggling] = useState<string | null>(null)

  // ── Theme ──
  const { theme, setTheme } = useTheme()

  // ── Feature 4: Entertainment Hub State ──
  const [entertainmentTab, setEntertainmentTab] = useState<'games' | 'facts' | 'stories' | 'reads'>('games')
  const [showEntertainment, setShowEntertainment] = useState(false)

  // Dynamic entertainment content — initialized from hardcoded fallbacks,
  // overridden by API data when available. This makes content manageable
  // via the admin/restaurant entertainment API without breaking if the API
  // is unavailable.
  const [triviaQuestions, setTriviaQuestions] = useState(FALLBACK_TRIVIA)
  const [factsList, setFactsList] = useState(FALLBACK_FACTS)
  const [storiesList, setStoriesList] = useState(FALLBACK_STORIES)
  const [readsList, setReadsList] = useState(FALLBACK_READS)
  const [scrambleWords, setScrambleWords] = useState(FALLBACK_SCRAMBLE)
  const [entertainmentSettings, setEntertainmentSettings] = useState<{
    hubEnabled: boolean; games: Record<string, boolean>; contentTypes: Record<string, boolean>
  } | null>(null)

  // Customer profile drawer + identified player name (replaces hardcoded 'Guest')
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [playerName, setPlayerName] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)

  // Trivia
  const [triviaIndex, setTriviaIndex] = useState(0)
  const [triviaScore, setTriviaScore] = useState(0)
  const [triviaAnswered, setTriviaAnswered] = useState(false)
  const [triviaSelected, setTriviaSelected] = useState<number | null>(null)
  // Word Scramble
  const [scrambleWordIndex, setScrambleWordIndex] = useState(0)
  const [scrambleSelected, setScrambleSelected] = useState<number[]>([])
  const [scrambleAttempts, setScrambleAttempts] = useState(0)
  const [scrambleResult, setScrambleResult] = useState<'correct' | 'wrong' | null>(null)
  // Tic Tac Toe
  const [tttBoard, setTttBoard] = useState<(string | null)[]>(Array(9).fill(null))
  const [tttIsPlayerTurn, setTttIsPlayerTurn] = useState(true)
  const [tttScore, setTttScore] = useState({ player: 0, ai: 0 })
  const [tttGameOver, setTttGameOver] = useState(false)
  const [tttWinner, setTttWinner] = useState<string | null>(null)
  // Reads expandable
  const [expandedRead, setExpandedRead] = useState<number | null>(null)

  // ── Feature 5: Enhanced Waiter Call State ──
  const [waiterCooldown, setWaiterCooldown] = useState(0)
  const [waiterToast, setWaiterToast] = useState<string | null>(null)

  // ── Social Sharing State ──
  const [shareToast, setShareToast] = useState<string | null>(null)
  const [shareSheetOpen, setShareSheetOpen] = useState(false)
  const [shareContext, setShareContext] = useState<{ title: string; text: string; url: string }>({ title: '', text: '', url: '' })

  // Persist cart to localStorage (survives tab close)
  // Key is scoped per restaurant + table so different tables don't share carts
  const [cartRid, setCartRid] = useState<string>('')
  const [cartTid, setCartTid] = useState<string>('')

  const cartStorageKey = (cartRid && cartTid) ? `yeneqr_cart_${cartRid}_${cartTid}` : (cartRid ? `yeneqr_cart_${cartRid}` : 'yeneqr_cart')

  useEffect(() => {
    if (typeof window !== 'undefined' && (cartRid || cart.length > 0)) {
      try {
        localStorage.setItem(cartStorageKey, JSON.stringify(cart))
      } catch { /* ignore */ }
    }
  }, [cart, cartStorageKey, cartRid])

  // Persist language preference to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && language) {
      try {
        localStorage.setItem('yeneqr_language', language)
      } catch { /* ignore */ }
    }
  }, [language])

  // ── Debounced search (300ms) ──
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // ── Close sort dropdown on outside click ──
  useEffect(() => {
    if (!sortDropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setSortDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [sortDropdownOpen])

  // ── Update translation context SYNCHRONOUSLY during render ──
  // CRITICAL: Must update _tCtx during render, NOT in useEffect.
  // useEffect runs AFTER render, so _tCtx would be stale during the render
  // that follows a language change — causing the UI to not update.
  _tCtx = {
    lang: language,
    defaultLang: restaurant?.defaultLanguage || 'en',
    uiStrings,
  }

  // ── Load UI strings when language or restaurant changes ──
  useEffect(() => {
    if (!restaurant || language === 'en') {
      // English doesn't need a bundle — fallback is always English
      setUiStrings({})
      return
    }
    const loadStrings = async () => {
      try {
        const res = await fetch(`/api/i18n/ui-strings/bundle?lang=${language}&restaurantId=${restaurant.id}`)
        if (res.ok) {
          const data = await res.json()
          setUiStrings(data.strings || {})
        }
      } catch (e) {
        console.error('[UI_STRINGS_FETCH]', e)
      }
    }
    loadStrings()
  }, [language, restaurant?.id])

  // ── Real-time Order Tracking via SSE ──
  const { connected: sseConnected } = useCustomerRealtime({
    restaurantId: restaurant?.id || '',
    orderId: currentOrder?.id || null,
    token: sessionToken || undefined,
    onOrderUpdate: (updatedOrder: Record<string, unknown>) => {
      const order = (updatedOrder as Record<string, unknown>) || {}
      const newStatus = (order.status as string) || ''
      setCurrentOrder((prev) => {
        if (!prev) return prev
        // Show toast notification when status changes
        if (newStatus && newStatus !== prev.status) {
          const statusMessages: Record<string, string> = {
            accepted: tuiGlobal('menu.toast_accepted', '✅ Your order has been confirmed!'),
            preparing: tuiGlobal('menu.toast_preparing', '👨‍🍳 Kitchen is preparing your order'),
            ready: tuiGlobal('menu.toast_ready', '🍽️ Your food is ready for pickup!'),
            picked_up: tuiGlobal('menu.toast_picked_up', '🚀 Your waiter is on the way with your food!'),
            served: tuiGlobal('menu.toast_served', '🎉 Your order has been served! Enjoy!'),
            completed: tuiGlobal('menu.toast_completed', '✨ Order completed. Thank you!'),
          }
          const msg = statusMessages[newStatus]
          if (msg) {
            // Use a timeout to avoid setState during render
            setTimeout(() => setShareToast(msg), 0)
          }
        }
        return {
          ...prev,
          status: newStatus || prev.status,
          items: Array.isArray(order.items)
            ? (order.items as { name: string; nameAm: string | null; quantity: number; priceCents: number; kitchenStatus: string }[]).map((i) => ({
                name: i.name,
                nameAm: i.nameAm,
                quantity: i.quantity,
                priceCents: i.priceCents,
                kitchenStatus: i.kitchenStatus || 'pending',
              }))
            : prev.items,
          estimatedReadyAt: order.status === 'accepted'
            ? new Date(Date.now() + 20 * 60 * 1000)
            : prev.estimatedReadyAt,
        }
      })
    },
    enabled: !!currentOrder,
  })

  // Sync SSE connected state
  useEffect(() => {
    setRealtimeConnected(sseConnected)
  }, [sseConnected])

  // ── Check if order is FULLY paid (total paid >= order total) ──
  // This handles multi-round ordering: customer pays for round 1, adds
  // round 2, total increases → orderAlreadyPaid becomes false → payment
  // section shows again so customer can pay the difference.
  useEffect(() => {
    if (!currentOrder || !restaurant || !sessionToken) return
    const checkPayment = async () => {
      try {
        const res = await fetch(`/api/restaurants/${restaurant.id}/orders/${currentOrder.id}`, {
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        })
        if (res.ok) {
          const data = await res.json()
          const order = data.data || data.order || data
          const payments = order.payments || []
          const totalPaidCents = payments
            .filter((p: any) => p.status === 'completed')
            .reduce((sum: number, p: any) => sum + (p.amountCents || 0), 0)
          const orderTotalCents = order.totalAmountCents || currentOrder.totalAmountCents || 0
          // Fully paid only if total paid >= order total AND order total > 0
          const fullyPaid = orderTotalCents > 0 && totalPaidCents >= orderTotalCents
          setOrderAlreadyPaid(fullyPaid)
          // Also track the remaining balance for display
          setRemainingBalanceCents(Math.max(0, orderTotalCents - totalPaidCents))
          // Check for pending cash payments (customer tapped "Confirm Cash" but staff hasn't confirmed yet)
          const hasPending = payments.some((p: any) => p.status === 'pending' && p.method === 'cash')
          setHasPendingCashPayment(hasPending && !fullyPaid)
        }
      } catch (e) {
        console.error('[CHECK_PAYMENT]', e)
      }
    }
    checkPayment()
  }, [currentOrder?.id, currentOrder?.status, currentOrder?.totalAmountCents, restaurant?.id, sessionToken])

  // ── Show review prompt when order is served/completed ──
  useEffect(() => {
    if (currentOrder && (currentOrder.status === 'served' || currentOrder.status === 'completed') && !showReview && !reviewSubmitted) {
      setShowReview(true)
    }
  }, [currentOrder?.status, showReview, reviewSubmitted, currentOrder])

  // ── Feature 5: Waiter call cooldown timer ──
  useEffect(() => {
    if (waiterCooldown <= 0) return
    const timer = setTimeout(() => setWaiterCooldown((prev) => prev - 1), 1000)
    return () => clearTimeout(timer)
  }, [waiterCooldown])

  // ── Feature 5: Waiter toast auto-dismiss ──
  useEffect(() => {
    if (!waiterToast) return
    const timer = setTimeout(() => setWaiterToast(null), 3000)
    return () => clearTimeout(timer)
  }, [waiterToast])

  // ── Social Sharing toast auto-dismiss ──
  useEffect(() => {
    if (!shareToast) return
    const timer = setTimeout(() => setShareToast(null), 5000)
    return () => clearTimeout(timer)
  }, [shareToast])

  // ── Helper: full state reset when switching restaurants ──
  const performRestaurantSwitch = useCallback(async (qrPayload: QRPayload, signature: string) => {
    // Clear old cart from localStorage
    if (typeof window !== 'undefined') {
      try {
        const oldCartKey = (cartRid && cartTid) ? `yeneqr_cart_${cartRid}_${cartTid}` : (cartRid ? `yeneqr_cart_${cartRid}` : 'yeneqr_cart')
        localStorage.removeItem(oldCartKey)
      } catch { /* ignore */ }
    }

    // Try to end the old session on the server
    if (sessionToken && restaurant?.id) {
      try {
        await fetch(`/api/auth/session/end`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
        })
      } catch { /* ignore — best effort */ }
    }

    // Full state reset
    setCart([])
    setCurrentOrder(null)
    setScreen('welcome')
    setIsResumedSession(false)
    setPaymentStatus('select')
    setPaymentMethod('cash')
    setDiscount(0)
    setAppliedPromotion(null)
    setLoyaltyDiscount(0)
    setUseLoyaltyPoints(false)
    setMenuItems([])
    setCategories([])
    setActiveCategory('')
    setActiveFilters(new Set())
    setSearchQuery('')
    setDebouncedSearch('')
    setSortOrder('default')
    setIsCartOpen(false)

    // Continue with the new restaurant
    await continueSessionInit(qrPayload, signature)
  }, [cartRid, cartTid, sessionToken, restaurant?.id])

  // ── Core session initialization (shared by new & switch flows) ──
  const continueSessionInit = useCallback(async (qrPayload: QRPayload, signature: string) => {
        // Call session API to validate and create session
        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload: qrPayload, signature }),
        })

        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Failed to create session')
          setLoading(false)
          return
        }

        const data = await res.json()
        const isResume = data.message === 'Session resumed'
        setSessionToken(data.token)
        setRestaurant(data.restaurant)
        setCartRid(data.restaurant?.id || qrPayload.rid)
        setCartTid(qrPayload.tid)
        setBranch(data.branch)
        setTable(data.table)
        setWaiter(data.waiter || null)

        // Track this restaurant as current (for change detection on re-scan)
        prevRestaurantIdRef.current = data.restaurant?.id || qrPayload.rid

        // Language: prefer user's saved preference, fallback to English
        // Never override user's choice — restaurant defaultLanguage is only a suggestion
        const savedLang = (typeof window !== 'undefined') ? localStorage.getItem('yeneqr_language') : null
        const resolvedLang = savedLang || 'en'
        setLanguage(resolvedLang)

        // Fetch enabled languages for this restaurant
        try {
          const langRes = await fetch(`/api/restaurants/${qrPayload.rid}/i18n/languages`)
          if (langRes.ok) {
            const langData = await langRes.json()
            const enabled = (langData.enabledLanguages || []).filter((l: LanguageConfig) => l.isActive)
            setEnabledLanguages(enabled)
          }
        } catch (e) {
          console.error('[LANG_FETCH]', e)
        }

        // Fetch initial UI strings bundle
        const initialLang = resolvedLang
        if (initialLang !== 'en') {
          try {
            const strRes = await fetch(`/api/i18n/ui-strings/bundle?lang=${initialLang}&restaurantId=${qrPayload.rid}`)
            if (strRes.ok) {
              const strData = await strRes.json()
              setUiStrings(strData.strings || {})
            }
          } catch (e) {
            console.error('[UI_STRINGS_INIT]', e)
          }
        }

        // Fetch menu data (send JWT token for customer auth)
        const menuRes = await fetch(`/api/restaurants/${qrPayload.rid}/menus`, {
          headers: { 'Authorization': `Bearer ${data.token}` },
        })
        if (menuRes.ok) {
          const menuData = await menuRes.json()
          const menus = menuData.menus || menuData.data || (Array.isArray(menuData) ? menuData : [])

          if (menus.length > 0) {
            // Use the menu assigned to this QR code, or fall back to the first active menu
            let mainMenu = menus[0]
            if (data.menuId) {
              const assignedMenu = menus.find((m: { id: string }) => m.id === data.menuId)
              if (assignedMenu) {
                mainMenu = assignedMenu
              }
            }

            // Fetch categories
            const catRes = await fetch(`/api/restaurants/${qrPayload.rid}/menus/${mainMenu.id}/categories`, {
              headers: { 'Authorization': `Bearer ${data.token}` },
            })
            if (catRes.ok) {
              const catData = await catRes.json()
              const catsRaw = catData.categories || catData.data || (Array.isArray(catData) ? catData : [])
              const cats = catsRaw.filter((c: MenuCategory) => c.isActive)
              cats.sort((a: MenuCategory, b: MenuCategory) => a.sortOrder - b.sortOrder)
              setCategories(cats)
            }

            // Fetch menu items
            const itemsRes = await fetch(`/api/restaurants/${qrPayload.rid}/menus/${mainMenu.id}/items`, {
              headers: { 'Authorization': `Bearer ${data.token}` },
            })
            if (itemsRes.ok) {
              const itemsData = await itemsRes.json()
              const rawItems = itemsData.items || itemsData.data || (Array.isArray(itemsData) ? itemsData : [])
              // The items API already includes modifierGroups and comboItems — map them directly
              const enrichedItems = rawItems.map((item: any) => ({
                ...item,
                // Preserve the currentAvailable field from the API (schedule-enforced availability)
                currentAvailable: item.currentAvailable !== undefined ? item.currentAvailable : item.isAvailable,
                availabilityType: item.availabilityType || 'always',
                modifierGroups: (item.modifierGroups || []).map((g: any) => ({
                  id: g.id,
                  name: g.name,
                  nameAm: g.nameAm,
                  nameI18n: g.nameI18n,
                  isRequired: g.isRequired,
                  selectionType: g.selectionType,
                  minSelection: g.minSelection,
                  maxSelection: g.maxSelection,
                  options: (g.options || []).map((o: any) => ({
                    id: o.id,
                    name: o.name,
                    nameAm: o.nameAm,
                    nameI18n: o.nameI18n,
                    priceCents: o.priceDeltaCents ?? o.priceCents ?? 0,
                    isDefault: o.isDefault ?? false,
                  })),
                })),
                comboItems: item.comboItems || [],
              }))
              setMenuItems(enrichedItems)
            }
          }
        }

        // Fetch active promotions for customer display
        try {
          const promoRes = await fetch(`/api/restaurants/${qrPayload.rid}/promotions?isActive=true`)
          if (promoRes.ok) {
            const promoData = await promoRes.json()
            const promos = promoData.data || promoData.promotions || (Array.isArray(promoData) ? promoData : [])
            const now = new Date()
            const activePromos = promos.filter((p: any) => {
              if (!p.isActive) return false
              const from = new Date(p.validFrom)
              const until = new Date(p.validUntil)
              return from <= now && until >= now
            })
            setPromotions(activePromos)
          }
        } catch (e) {
          console.error('[PROMO_FETCH]', e)
        }

        // Fetch loyalty points for customer
        try {
          const loyaltyRes = await fetch(`/api/restaurants/${qrPayload.rid}/loyalty`, {
            headers: { 'Authorization': `Bearer ${data.token}` },
          })
          if (loyaltyRes.ok) {
            const loyaltyData = await loyaltyRes.json()
            setLoyaltyPoints(loyaltyData.data?.loyaltyPoints || 0)
          }
        } catch (e) {
          console.error('[LOYALTY_FETCH]', e)
        }

        // Fetch customer favorites
        try {
          const favRes = await fetch(`/api/restaurants/${qrPayload.rid}/favorites`, {
            headers: { 'Authorization': `Bearer ${data.token}` },
          })
          if (favRes.ok) {
            const favData = await favRes.json()
            const favs = favData.data?.favorites || []
            setFavoriteIds(new Set(favs.map((f: { menuItemId: string }) => f.menuItemId)))
          }
        } catch (e) {
          console.error('[FAVORITES_FETCH]', e)
        }

        // ── Fetch entertainment content + feature settings ──
        try {
          const entRes = await fetch(`/api/restaurants/${qrPayload.rid}/entertainment`)
          if (entRes.ok) {
            const entData = await entRes.json()
            const items = entData.data || []
            const trivia = items.filter((i: any) => i.type === 'trivia_question' && i.isActive).map((i: any) => {
              try { const p = JSON.parse(i.content); return { q: p.question, opts: p.options, correct: p.correctIndex, explain: p.explanation || '' } } catch { return null }
            }).filter(Boolean)
            if (trivia.length > 0) setTriviaQuestions(trivia)
            const facts = items.filter((i: any) => i.type === 'fact' && i.isActive).map((i: any) => i.content)
            if (facts.length > 0) setFactsList(facts)
            const stories = items.filter((i: any) => i.type === 'story' && i.isActive).map((i: any) => ({ title: i.title, paragraphs: i.content.split('\n\n') }))
            if (stories.length > 0) setStoriesList(stories)
            const reads = items.filter((i: any) => i.type === 'read' && i.isActive).map((i: any) => ({ title: i.title, subtitle: '', paragraphs: i.content.split('\n\n') }))
            if (reads.length > 0) setReadsList(reads)
            const gameCfg = items.find((i: any) => i.type === 'game_config' && i.title === 'Word Scramble')
            if (gameCfg) { try { const p = JSON.parse(gameCfg.content); if (p.words) setScrambleWords(p.words.map((w: string) => w.toUpperCase())) } catch {} }
          }
        } catch (e) { console.error('[ENTERTAINMENT_FETCH]', e) }

        // Fetch feature settings (entertainment toggles)
        try {
          const settingsRes = await fetch(`/api/restaurants/${qrPayload.rid}/settings`)
          if (settingsRes.ok) {
            const sd = await settingsRes.json()
            const ent = sd.data?.settings?.entertainment
            if (ent) setEntertainmentSettings({ hubEnabled: ent.hubEnabled !== false, games: ent.games || {}, contentTypes: ent.contentTypes || {} })
          }
        } catch (e) { console.error('[SETTINGS_FETCH]', e) }

        // ── Recover active order for this table ──
        // Only recover orders that are actively being prepared (not served/paid/completed)
        // This prevents customers from seeing other people's stale orders
        let recoveredOrder = false
        try {
          const activeOrderRes = await fetch(
            `/api/restaurants/${qrPayload.rid}/orders?tableId=${qrPayload.tid}&status=active`,
            { headers: { 'Authorization': `Bearer ${data.token}` } }
          )
          if (activeOrderRes.ok) {
            const activeOrderData = await activeOrderRes.json()
            const activeOrders = activeOrderData.data || activeOrderData.orders || []
            // Only consider orders that are actively being prepared
            const preparingOrders = activeOrders.filter((o: any) =>
              ['pending', 'accepted', 'preparing', 'ready', 'picked_up'].includes(o.status)
            )
            if (preparingOrders.length > 0) {
              // Take the most recent active preparing order
              const latestOrder = preparingOrders[0]
              setCurrentOrder({
                id: latestOrder.id,
                orderNumber: latestOrder.orderNumber || `#${latestOrder.id.slice(-4)}`,
                status: latestOrder.status,
                totalAmountCents: latestOrder.totalAmountCents || 0,
                items: (latestOrder.items || []).map((oi: any) => ({
                  name: oi.name || oi.menuItem?.name || '',
                  nameAm: oi.nameAm || oi.menuItem?.nameAm || null,
                  quantity: oi.quantity,
                  priceCents: (oi.priceCents || 0) * oi.quantity,
                  kitchenStatus: oi.kitchenStatus || 'pending',
                })),
                estimatedReadyAt: latestOrder.estimatedReadyAt ? new Date(latestOrder.estimatedReadyAt) : null,
                createdAt: new Date(latestOrder.createdAt),
              })
              recoveredOrder = true
            }
          }
        } catch (e) {
          console.error('[ACTIVE_ORDER_RECOVERY]', e)
        }

        // ── Smart Resume: Restore cart from localStorage & skip welcome ──
        if (isResume) {
          setIsResumedSession(true)

          // Restore cart from localStorage (keyed by restaurantId + tableId)
          try {
            const cartKey = `yeneqr_cart_${data.restaurant?.id || qrPayload.rid}_${qrPayload.tid}`
            const savedCart = localStorage.getItem(cartKey)
            if (savedCart) {
              const parsed = JSON.parse(savedCart)
              if (Array.isArray(parsed) && parsed.length > 0) {
                setCart(parsed)
              }
            }
          } catch (e) {
            console.error('[CART_RESTORE]', e)
          }

          // Smart navigation: skip welcome screen on resume
          if (recoveredOrder) {
            // Active order exists → go to order tracking
            setScreen('order')
            setTimeout(() => {
              toast.success(tuiGlobal('menu.welcome_back_order', `Welcome back! Your order is being prepared.`))
            }, 500)
          } else {
            // No active order → go straight to menu (skip language picker + welcome)
            setScreen('menu')
            setTimeout(() => {
              const savedCartCount = cart.length || 0
              if (savedCartCount > 0) {
                toast.success(tuiGlobal('menu.welcome_back_cart', `Welcome back! You have ${savedCartCount} items in your cart.`))
              } else {
                toast.success(tuiGlobal('menu.welcome_back', 'Welcome back!'))
              }
            }, 500)
          }
        }

        setLoading(false)
  }, [cart, cartRid])

  // ── Parse QR payload and create session ──
  useEffect(() => {
    const controller = new AbortController()
    async function initSession() {
      try {
        // Parse the payload: format is <base64payload>--<signature>
        // Legacy format: <base64payload>.<signature> (also supported for backwards compat)
        let encodedPayload: string
        let signature: string

        const dashSepIndex = payloadStr.lastIndexOf('--')
        if (dashSepIndex !== -1) {
          // New format: <base64payload>--<signature>
          encodedPayload = payloadStr.slice(0, dashSepIndex)
          signature = payloadStr.slice(dashSepIndex + 2)
        } else {
          // Legacy format: <base64payload>.<signature>
          const dotIndex = payloadStr.lastIndexOf('.')
          if (dotIndex === -1) {
            setError('Invalid QR code format')
            setLoading(false)
            return
          }
          encodedPayload = payloadStr.slice(0, dotIndex)
          signature = payloadStr.slice(dotIndex + 1)
        }

        let qrPayload: QRPayload
        try {
          const decoded = atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/'))
          qrPayload = JSON.parse(decoded)
        } catch {
          setError('Invalid QR code data')
          setLoading(false)
          return
        }

        // ── Detect restaurant change using ref ──
        const prevRid = prevRestaurantIdRef.current
        if (prevRid && prevRid !== qrPayload.rid) {
          // Different restaurant — check if there's something to lose
          const hasActiveCart = cartRef.current.length > 0
          const hasActiveOrder = currentOrderRef.current !== null
          if (hasActiveCart || hasActiveOrder) {
            // Show confirmation dialog
            setPendingQRPayload(qrPayload)
            setPendingSignature(signature)
            setShowRestaurantSwitchDialog(true)
            setLoading(false)
            return
          }
          // Nothing to lose — silent switch with cleanup
          await performRestaurantSwitch(qrPayload, signature)
          return
        }

        // Store for retry capability
        initialQRPayloadRef.current = qrPayload
        initialSignatureRef.current = signature

        await continueSessionInit(qrPayload, signature)
      } catch (err) {
        console.error('[QR_SESSION_INIT]', err)
        setError('Something went wrong. Please try scanning the QR code again.')
        setLoading(false)
      }
    }

    if (payloadStr) {
      initSession()
    }

    return () => {
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadStr])

  // ── Retry handler for error state ──
  const handleRetry = useCallback(async () => {
    if (!initialQRPayloadRef.current || !initialSignatureRef.current) return
    setError(null)
    setLoading(true)
    try {
      await continueSessionInit(initialQRPayloadRef.current, initialSignatureRef.current)
    } catch {
      setError('Something went wrong. Please try scanning the QR code again.')
      setLoading(false)
    }
  }, [continueSessionInit])

  // ── Feature 2: Advanced filtering & sorting ──
  const popularItems = useMemo(() => menuItems.filter(i => i.isPopular && (i.currentAvailable ?? i.isAvailable)), [menuItems])

  const filteredItems = useMemo(() => {
    let items = menuItems.filter((item) => {
      const matchesCategory = !activeCategory || item.categoryId === activeCategory
      // Search across all i18n names using debounced search
      const resolvedName = tName(item.name, item.nameAm, item.nameI18n)
      const matchesSearch =
        !debouncedSearch ||
        resolvedName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        item.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (item.nameAm && item.nameAm.includes(debouncedSearch)) ||
        (item.nameI18n && Object.values(parseI18nJson(item.nameI18n) || {}).some(v => v.toLowerCase().includes(debouncedSearch.toLowerCase())))
      return matchesCategory && matchesSearch
    })

    // Apply single active filter pill (exclusive selection — only one filter at a time)
    const activeFilter = activeFilters.size > 0 ? Array.from(activeFilters)[0] : null
    if (activeFilter) {
      items = items.map(item => {
        let passes = true
        if (activeFilter === 'veg' && !item.isVegetarian) passes = false
        if (activeFilter === 'spicy' && !item.isSpicy) passes = false
        if (activeFilter === 'popular' && !item.isPopular) passes = false
        if (activeFilter === 'new' && item.preparationTime >= 10) passes = false
        if (activeFilter === 'favorites' && !favoriteIds.has(item.id)) passes = false
        return { ...item, _passesFilter: passes }
      })
      // When a specific filter is active, only show matching items (hide non-matching)
      items = items.filter(item => item._passesFilter)
    } else {
      items = items.map(item => ({ ...item, _passesFilter: true }))
    }

    // Apply sort
    switch (sortOrder) {
      case 'price-low':
        items.sort((a, b) => a.priceCents - b.priceCents)
        break
      case 'price-high':
        items.sort((a, b) => b.priceCents - a.priceCents)
        break
      case 'popular':
        items.sort((a, b) => (b.isPopular ? 1 : 0) - (a.isPopular ? 1 : 0))
        break
      case 'fastest':
        items.sort((a, b) => a.preparationTime - b.preparationTime)
        break
      default:
        // Default sort: when viewing "All", group items by their parent
        // category's sortOrder (admin-controlled) so items from the first
        // category appear first, then the second category, etc. Within
        // each category, preserve the original item order from the API
        // (which is item sortOrder). When viewing a single category,
        // the category grouping is irrelevant — just keep item order.
        if (!activeCategory) {
          // Build a lookup: categoryId → category sortOrder
          const catOrderMap = new Map<string, number>()
          categories.forEach(c => catOrderMap.set(c.id, c.sortOrder || 0))
          items.sort((a, b) => {
            const aCatOrder = catOrderMap.get(a.categoryId) ?? 9999
            const bCatOrder = catOrderMap.get(b.categoryId) ?? 9999
            if (aCatOrder !== bCatOrder) return aCatOrder - bCatOrder
            // Same category — preserve original item order (stable sort)
            return 0
          })
        }
        break
    }

    return items
  }, [menuItems, activeCategory, debouncedSearch, activeFilters, sortOrder, favoriteIds, language, categories])

  // ── Payment timing from restaurant settings ──
  const paymentTiming = useMemo(() => {
    const settings = restaurant?.settings as Record<string, unknown> | null | undefined
    const pm = settings?.paymentMethods as Record<string, unknown> | undefined
    return (pm?.paymentTiming as string) || 'after_served'
  }, [restaurant?.settings])

  // ── Order type settings from restaurant settings ──
  const orderTypeSettings = useMemo<{ dineIn: boolean; takeaway: boolean }>(() => {
    const settings = restaurant?.settings as Record<string, unknown> | null | undefined
    const ot = settings?.orderTypes as Record<string, unknown> | undefined
    return {
      dineIn: ot?.dineIn !== undefined ? !!ot.dineIn : true,
      takeaway: ot?.takeaway !== undefined ? !!ot.takeaway : true,
    }
  }, [restaurant?.settings])

  // ── Packaging config from restaurant settings ──
  const packagingConfig = useMemo<{ enabled: boolean; feeType: string; feeCents: number }>(() => {
    const settings = restaurant?.settings as Record<string, unknown> | null | undefined
    const pkg = settings?.packaging as Record<string, unknown> | undefined
    return {
      enabled: pkg?.enabled !== undefined ? !!pkg.enabled : true,
      feeType: (pkg?.feeType as string) || 'per_order',
      feeCents: (pkg?.feeCents as number) || 0,
    }
  }, [restaurant?.settings])

  // ── Calculate packaging fee for takeaway orders ──
  const packagingFeeCents = useMemo(() => {
    if (orderType !== 'takeaway' || !packagingConfig.enabled || packagingConfig.feeCents <= 0) return 0
    if (packagingConfig.feeType === 'per_item') {
      const totalItemCount = cart.reduce((sum, ci) => sum + ci.quantity, 0)
      return packagingConfig.feeCents * totalItemCount
    }
    return packagingConfig.feeCents
  }, [orderType, packagingConfig, cart])

  // ── Auto-switch orderType when settings change ──
  useEffect(() => {
    if (orderType === 'dine-in' && !orderTypeSettings.dineIn) {
      setOrderType('takeaway')
    } else if (orderType === 'takeaway' && !orderTypeSettings.takeaway) {
      setOrderType('dine-in')
    }
  }, [orderTypeSettings, orderType])

  const getCartTotal = useCallback(() => cart.reduce((sum, ci) => sum + ci.totalPriceCents * ci.quantity, 0), [cart])
  const getCartItemCount = useCallback(() => cart.reduce((sum, ci) => sum + ci.quantity, 0), [cart])

  // ── Add to cart ──
  const addToCart = useCallback((item: MenuItem, quantity: number, selectedModifiers: { group: ModifierGroup; option: ModifierOption }[], specialInstructions: string, removedIngredients: RemovedIngredient[] = []) => {
    // Prevent adding items that are currently unavailable (schedule enforcement)
    const itemAvailable = item.currentAvailable ?? item.isAvailable
    if (!itemAvailable) return

    let totalPriceCents = item.priceCents
    selectedModifiers.forEach(({ option }) => { totalPriceCents += option.priceCents })
    totalPriceCents *= quantity

    setCart((prev) => [...prev, { menuItem: item, quantity, selectedModifiers, removedIngredients, specialInstructions, totalPriceCents: totalPriceCents / quantity }])
  }, [])

  const removeFromCart = useCallback((index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateQuantity = useCallback((index: number, qty: number) => {
    if (qty <= 0) {
      // Remove item entirely when quantity drops to 0
      setCart((prev) => prev.filter((_, i) => i !== index))
    } else {
      setCart((prev) => prev.map((ci, i) => (i === index ? { ...ci, quantity: qty } : ci)))
    }
  }, [])

  const clearCart = useCallback(() => setCart([]), [])

  // ── Apply coupon code ──
  const applyCoupon = useCallback(async () => {
    if (!couponCode.trim() || !restaurant) return
    setCouponError('')

    // Find a matching promotion by code
    const matchingPromo = promotions.find(
      (p: any) => p.code && p.code.toLowerCase() === couponCode.trim().toLowerCase() && p.isActive
    )

    if (!matchingPromo) {
      setCouponError(tuiGlobal('menu.invalid_coupon', 'Invalid coupon code'))
      return
    }

    const subtotal = getCartTotal()

    // Check minimum order
    if (matchingPromo.minimumOrderCents && subtotal < matchingPromo.minimumOrderCents) {
      setCouponError(tuiGlobal('menu.minimum_order', `Minimum order ${formatPrice(matchingPromo.minimumOrderCents)}`))
      return
    }

    // Calculate discount
    let discountAmt = 0
    if (matchingPromo.discountType === 'percentage') {
      // discountValueCents is in basis points (1050 = 10.50%)
      discountAmt = Math.round(subtotal * matchingPromo.discountValueCents / 10000)
      if (matchingPromo.maxDiscountCents && discountAmt > matchingPromo.maxDiscountCents) {
        discountAmt = matchingPromo.maxDiscountCents
      }
    } else {
      // Fixed discount, already in cents
      discountAmt = matchingPromo.discountValueCents
    }

    setDiscount(discountAmt)
    setAppliedPromotion(matchingPromo)
    setCouponCode('')
  }, [couponCode, promotions, restaurant, getCartTotal, language])

  const removeCoupon = useCallback(() => {
    setDiscount(0)
    setAppliedPromotion(null)
    setCouponCode('')
    setCouponError('')
  }, [])

  // ── Loyalty points toggle ──
  const toggleLoyaltyPoints = useCallback(() => {
    if (!useLoyaltyPoints && loyaltyPoints >= 10) {
      const subtotal = getCartTotal()
      const maxRedeemable = Math.min(loyaltyPoints, Math.floor(subtotal / 5))
      const ptsToUse = Math.floor(maxRedeemable / 10) * 10 // Round to minimum redemption
      const disc = ptsToUse * 5
      setLoyaltyDiscount(disc)
      setUseLoyaltyPoints(true)
    } else {
      setLoyaltyDiscount(0)
      setUseLoyaltyPoints(false)
    }
  }, [useLoyaltyPoints, loyaltyPoints, getCartTotal])

  // ── Place order ──
  const placeOrder = useCallback(async () => {
    if (isPlacingOrder) return
    if (!sessionToken || !restaurant || cart.length === 0) return

    setIsPlacingOrder(true)
    const subtotal = getCartTotal()
    const totalDiscount = discount + loyaltyDiscount
    const discountedSubtotal = Math.max(0, subtotal - totalDiscount)
    const tax = Math.round(discountedSubtotal * (restaurant.taxRate || 0.15))
    const serviceCharge = Math.round(discountedSubtotal * (restaurant.serviceCharge || 0))

    const orderItems = cart.map((ci) => {
      // Build special instructions — keep removed ingredients as a structured
      // field (removedIngredients) instead of stuffing them into specialInstructions.
      // The kitchen view renders removedIngredients as 🚫 badges.
      let instructions = ci.specialInstructions || ''
      return {
        menuItemId: ci.menuItem.id,
        name: ci.menuItem.name,
        nameAm: ci.menuItem.nameAm,
        priceCents: ci.totalPriceCents,
        quantity: ci.quantity,
        specialInstructions: instructions || null,
        // Send structured removed ingredients so the kitchen can render 🚫 badges
        removedIngredients: ci.removedIngredients && ci.removedIngredients.length > 0
          ? ci.removedIngredients
          : undefined,
        modifiers: ci.selectedModifiers.map(({ group, option }) => ({
          modifierGroupId: group.id,
          modifierOptionId: option.id,
          name: option.name,
          priceDeltaCents: option.priceCents,
          quantity: 1,
        })),
      }
    })

    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          branchId: branch?.id || null,
          tableId: table?.id || null,
          type: orderType === 'dine-in' ? 'dine_in' : 'takeaway',
          guestCount,
          items: orderItems,
          specialInstructions: '',
          discountAmount: totalDiscount,
          promotionId: appliedPromotion?.id || null,
          loyaltyPointsUsed: useLoyaltyPoints ? Math.floor(loyaltyDiscount / 5) : 0,
          packagingChargeCents: packagingFeeCents,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const order = data.data || data

        setCurrentOrder({
          id: order.id,
          orderNumber: order.orderNumber || `#${Date.now().toString().slice(-4)}`,
          status: order.status || 'pending',
          totalAmountCents: order.totalAmountCents || discountedSubtotal + tax + serviceCharge + packagingFeeCents,
          items: orderItems.map((oi) => ({
            name: oi.name,
            nameAm: oi.nameAm || null,
            quantity: oi.quantity,
            priceCents: oi.priceCents * oi.quantity,
            kitchenStatus: 'pending',
          })),
          estimatedReadyAt: null,
          createdAt: new Date(),
          roundNumber: orderRound,
        })

        // Persist order ID to localStorage so customer can recover it on return
        if (typeof window !== 'undefined' && order.id) {
          try {
            const orderKey = `yeneqr_order_${restaurant?.id || ''}_${table?.id || ''}`
            localStorage.setItem(orderKey, JSON.stringify({
              orderId: order.id,
              orderNumber: order.orderNumber || '',
              placedAt: new Date().toISOString(),
            }))
            // Also add to a list of all order IDs for this restaurant
            const ordersKey = `yeneqr_orders_${restaurant?.id || ''}`
            const existingOrders = JSON.parse(localStorage.getItem(ordersKey) || '[]')
            existingOrders.unshift({ orderId: order.id, orderNumber: order.orderNumber || '', placedAt: new Date().toISOString() })
            // Keep only last 20 orders
            localStorage.setItem(ordersKey, JSON.stringify(existingOrders.slice(0, 20)))
          } catch { /* ignore */ }
        }

        // Increment round for next order (multi-round ordering)
        setOrderRound((prev) => prev + 1)

        // Use server-calculated loyalty points (includes tier bonus + welcome bonus)
        const serverPointsEarned = data.meta?.loyaltyPointsEarned || 0
        const earned = serverPointsEarned > 0 ? serverPointsEarned : Math.floor(discountedSubtotal / 100)
        setPointsEarned(earned)
        // Update local loyalty points
        if (useLoyaltyPoints) {
          setLoyaltyPoints((prev) => Math.max(0, prev - Math.floor(loyaltyDiscount / 5)) + earned)
        } else {
          setLoyaltyPoints((prev) => prev + earned)
        }

        clearCart()
        if (typeof window !== 'undefined') {
          try { localStorage.removeItem(cartStorageKey) } catch { /* ignore */ }
        }
        setIsCartOpen(false)
        setDiscount(0)
        setAppliedPromotion(null)
        setLoyaltyDiscount(0)
        setUseLoyaltyPoints(false)

        // If payment timing is 'before_order', process payment now
        // Otherwise (after_served), just go to order tracking — payment happens later
        if (paymentTiming === 'before_order') {
          await processPayment(order.id, discountedSubtotal, tax, serviceCharge)
        } else {
          // Default Ethiopian flow: order first, pay after being served
          setPaymentStatus('success')
          setScreen('order')
          toast.success(tuiGlobal('menu.order_placed', 'Order Placed!'))
        }
      } else {
        const data = await res.json()
        // Handle 409 "duplicate order" — recover the existing order instead of failing
        if (res.status === 409 && data.orderId) {
          // Fetch the existing order and set it as currentOrder so the UI switches
          // to "Add to Order" mode. Then automatically add the cart items as a new round.
          try {
            const existingRes = await fetch(`/api/restaurants/${restaurant.id}/orders/${data.orderId}`, {
              headers: { 'Authorization': `Bearer ${sessionToken}` },
            })
            if (existingRes.ok) {
              const existingData = await existingRes.json()
              const existingOrder = existingData.data || existingData
              setCurrentOrder({
                id: existingOrder.id,
                orderNumber: existingOrder.orderNumber || `#${existingOrder.id.slice(-4)}`,
                status: existingOrder.status,
                totalAmountCents: existingOrder.totalAmountCents || 0,
                items: (existingOrder.items || []).map((oi: any) => ({
                  name: oi.name || oi.menuItem?.name || '',
                  nameAm: oi.nameAm || oi.menuItem?.nameAm || null,
                  quantity: oi.quantity,
                  priceCents: (oi.priceCents || 0) * oi.quantity,
                  kitchenStatus: oi.kitchenStatus || 'pending',
                })),
                estimatedReadyAt: existingOrder.estimatedReadyAt ? new Date(existingOrder.estimatedReadyAt) : null,
                createdAt: new Date(existingOrder.createdAt),
                roundNumber: existingOrder.roundNumber || 1,
              })
              // Now add the current cart as a new round (use ref to avoid circular dependency)
              toast.info(tuiGlobal('menu.adding_to_existing', 'Adding to your existing order...'))
              addRoundToOrderRef.current?.()
              return
            }
          } catch {
            // Fall through to error toast
          }
        }
        toast.error(data.error || 'Failed to place order')
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setIsPlacingOrder(false)
    }
  }, [sessionToken, restaurant, table, cart, getCartTotal, clearCart, paymentMethod, discount, loyaltyDiscount, appliedPromotion, useLoyaltyPoints, orderType, guestCount, cartRid, packagingFeeCents])

  // ── Add Round to Existing Order ──
  // Ref allows placeOrder() to call addRoundToOrder() without a circular useCallback dependency
  const addRoundToOrderRef = useRef<(() => Promise<void>) | null>(null)
  const addRoundToOrder = useCallback(async () => {
    if (isPlacingOrder) {
      toast.info(tuiGlobal('menu.please_wait', 'Please wait, your previous request is still processing...'))
      return
    }
    if (!sessionToken) {
      toast.error(tuiGlobal('menu.session_expired', 'Session expired. Please scan the QR code again.'))
      return
    }
    if (!restaurant) {
      toast.error(tuiGlobal('menu.restaurant_unavailable', 'Restaurant information not available.'))
      return
    }
    if (!currentOrder) {
      toast.error(tuiGlobal('menu.no_active_order', 'No active order found. Please place a new order.'))
      return
    }
    if (cart.length === 0) {
      toast.error(tuiGlobal('menu.cart_empty', 'Your cart is empty. Add items first.'))
      return
    }

    setIsPlacingOrder(true)

    const orderItems = cart.map((ci) => {
      let instructions = ci.specialInstructions || ''
      return {
        menuItemId: ci.menuItem.id,
        name: ci.menuItem.name,
        nameAm: ci.menuItem.nameAm,
        priceCents: ci.totalPriceCents,
        quantity: ci.quantity,
        specialInstructions: instructions || null,
        removedIngredients: ci.removedIngredients && ci.removedIngredients.length > 0
          ? ci.removedIngredients
          : undefined,
        modifierSelections: ci.selectedModifiers.map(({ group, option }) => ({
          modifierGroupId: group.id,
          modifierOptionId: option.id,
          name: option.name,
          priceDeltaCents: option.priceCents,
          quantity: 1,
        })),
      }
    })

    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}/orders/${currentOrder.id}/rounds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          items: orderItems,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const roundData = data.data || data

        // Update current order with new round info
        setCurrentOrder((prev) => prev ? {
          ...prev,
          status: prev.status, // keep current status
          totalAmountCents: roundData.newTotalCents || prev.totalAmountCents,
          roundNumber: roundData.roundNumber || prev.roundNumber,
          items: [
            ...prev.items,
            ...orderItems.map((oi) => ({
              name: oi.name,
              nameAm: oi.nameAm || null,
              quantity: oi.quantity,
              priceCents: oi.priceCents * oi.quantity,
              kitchenStatus: 'pending' as const,
            })),
          ],
        } : prev)

        setOrderRound((prev) => prev + 1)

        clearCart()
        if (typeof window !== 'undefined') {
          try { localStorage.removeItem(cartStorageKey) } catch { /* ignore */ }
        }
        setIsCartOpen(false)
        setDiscount(0)
        setAppliedPromotion(null)
        setLoyaltyDiscount(0)
        setUseLoyaltyPoints(false)

        setScreen('order')
        toast.success(tuiGlobal('menu.items_added', 'Items added to your order!'))
      } else {
        const data = await res.json().catch(() => ({}))
        const errorMsg = data.error || 'Failed to add items to order'
        console.error('[ADD_ROUND_ERROR]', res.status, errorMsg, data)
        // If order is no longer active, clear currentOrder so user can start fresh
        if (res.status === 400 && (errorMsg.includes('active state') || errorMsg.includes('no longer'))) {
          setCurrentOrder(null)
          toast.error(tuiGlobal('menu.order_closed', 'This order can no longer accept items. Please start a new order.'))
        } else {
          toast.error(errorMsg)
        }
      }
    } catch (err) {
      console.error('[ADD_ROUND_NETWORK_ERROR]', err)
      toast.error('Network error. Please try again.')
    } finally {
      setIsPlacingOrder(false)
    }
  }, [sessionToken, restaurant, currentOrder, cart, isPlacingOrder, clearCart, cartStorageKey])
  // Keep the ref in sync so placeOrder() can call addRoundToOrder() without circular dep
  addRoundToOrderRef.current = addRoundToOrder

  // ── Process Payment ──
  const processPayment = useCallback(async (orderId: string, subtotal: number, tax: number, serviceCharge: number) => {
    if (!restaurant || !sessionToken) return

    setPaymentStatus('processing')

    try {
      // Initiate payment with the selected provider
      const res = await fetch(`/api/restaurants/${restaurant.id}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          orderId,
          method: paymentMethod,
          tipAmount: 0,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        console.error('[PAYMENT_INITIATE_FAILED]', errorData)
        // Order was placed but payment initiation failed — still navigate to order screen
        setPaymentStatus('success')
        setScreen('order')
        toast.success(tuiGlobal('menu.order_placed', 'Order Placed!'))
        return
      }

      const data = await res.json()
      const paymentData = data.data || data

      // For cash: payment is pending, show success + go to order tracking
      if (paymentMethod === 'cash') {
        setPaymentStatus('success')
        setScreen('order')
        toast.success(tuiGlobal('menu.order_placed', 'Order Placed!'))
        return
      }

      // For digital payments (telebirr, chapa, cbe_birr):
      // If there's a real checkout URL, redirect to payment provider
      if (paymentData.checkoutUrl && !paymentData.checkoutUrl.includes('mock.')) {
        // Open checkout in a new tab so the SPA stays alive
        window.open(paymentData.checkoutUrl, '_blank')
        // Show processing state while customer completes payment externally
        setPaymentStatus('processing')
        // Poll for payment completion (every 5s, up to 5 minutes)
        let attempts = 0
        const maxAttempts = 60
        const poll = async () => {
          try {
            const verifyRes = await fetch(`/api/restaurants/${restaurant.id}/payments/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`,
              },
              body: JSON.stringify({
                reference: paymentData.providerReference,
              }),
            })
            if (verifyRes.ok) {
              const verifyData = await verifyRes.json()
              const status = verifyData.data?.status || verifyData.status || verifyData.payment?.status
              if (status === 'completed' || status === 'success') {
                setPaymentStatus('success')
                setScreen('order')
                toast.success(tuiGlobal('menu.payment_confirmed', 'Payment confirmed!'))
                return
              }
              if (status === 'failed') {
                setPaymentStatus('failed')
                return
              }
              // Still pending — continue polling
            }
          } catch { /* retry */ }
          attempts++
          if (attempts < maxAttempts) {
            setTimeout(poll, 5000)
          } else {
            setPaymentStatus('timeout')
          }
        }
        setTimeout(poll, 3000)
        return
      }

      // Mock mode: simulate payment processing with a brief delay
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Try to verify the payment
      try {
        const verifyRes = await fetch(`/api/restaurants/${restaurant.id}/payments/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            reference: paymentData.providerReference,
          }),
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          const status = verifyData.data?.status || verifyData.status || verifyData.payment?.status
          if (status === 'completed' || status === 'success') {
            setPaymentStatus('success')
            setScreen('order')
            toast.success(tuiGlobal('menu.payment_confirmed', 'Payment confirmed!'))
            return
          }
        }
      } catch { /* verification error, proceed optimistically */ }

      // Payment was initiated — show success optimistically
      setPaymentStatus('success')
      setScreen('order')
      toast.success(tuiGlobal('menu.order_placed', 'Order Placed!'))
    } catch {
      // Network error — order was still placed, navigate to order screen
      setPaymentStatus('success')
      setScreen('order')
      toast.success(tuiGlobal('menu.order_placed', 'Order Placed!'))
    }
  }, [restaurant, sessionToken, paymentMethod])

  // ── Waiter Call (Enhanced with cooldown) ──
  const callWaiter = useCallback(async (requestType: string, message?: string) => {
    if (!restaurant || !branch || !table || !sessionToken) return
    if (waiterCooldown > 0) return

    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}/waiter-calls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          branchId: branch.id,
          tableId: table.id,
          requestType,
          message: message || undefined,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        // Update waiter info from the response (may have changed since session init)
        if (data.waiter) {
          setWaiter(data.waiter)
        }
        const labels: Record<string, string> = {
          call_waiter: 'Waiter call',
          request_bill: 'Bill request',
          request_menu: 'Menu request',
          custom: 'Custom request',
        }
        const waiterNote = data.waiter?.name
          ? ` — ${data.waiter.name} is on the way!`
          : ''
        setWaiterToast(`✅ ${labels[requestType] || 'Request'} sent!${waiterNote}`)
        setWaiterCooldown(60)
        setIsWaiterCallOpen(false)
        setWaiterCustomMessage('')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to call waiter')
      }
    } catch {
      toast.error('Network error. Please try again.')
    }
  }, [restaurant, branch, table, sessionToken, waiterCooldown])

  // ── Submit Review ──
  const submitReview = useCallback(async () => {
    if (!restaurant || !currentOrder || !sessionToken) return

    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          orderId: currentOrder.id,
          rating: reviewRating,
          comment: reviewComment || undefined,
        }),
      })

      if (res.ok) {
        setReviewSubmitted(true)
      } else {
        const errData = await res.json().catch(() => ({}))
        const errMsg = errData.error || 'Failed to submit review. Please try again.'
        toast.error(errMsg)
      }
    } catch {
      toast.error('Network error submitting review. Please try again.')
    }
  }, [restaurant, currentOrder, sessionToken, reviewRating, reviewComment])

  // ── Toggle filter pill — exclusive/radio selection (like Uber Eats / DoorDash) ──
  // Only one filter active at a time. Clicking the same filter again deactivates it (= "All").
  const toggleFilter = useCallback((filter: string) => {
    setActiveFilters(prev => {
      if (prev.has(filter)) {
        // Clicking active filter → deactivate it (go back to "All")
        return new Set()
      }
      // Clicking a new filter → replace whatever was active with this one
      return new Set([filter])
    })
  }, [])

  // Smooth scroll to items section when category or filter changes
  const scrollToItems = useCallback(() => {
    setTimeout(() => {
      itemsStartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }, [])

  useEffect(() => {
    scrollToItems()
  }, [activeCategory, activeFilters, scrollToItems])

  // ── Toggle favorite ──
  const toggleFavorite = useCallback(async (menuItemId: string, e?: React.MouseEvent) => {
    // Prevent the click from opening the item detail drawer
    e?.stopPropagation()
    e?.preventDefault()

    if (!sessionToken || !restaurant || favoriteToggling === menuItemId) return

    const isFav = favoriteIds.has(menuItemId)
    setFavoriteToggling(menuItemId)

    // Optimistic update
    setFavoriteIds(prev => {
      const next = new Set(prev)
      if (next.has(menuItemId)) {
        next.delete(menuItemId)
      } else {
        next.add(menuItemId)
      }
      return next
    })

    try {
      if (isFav) {
        await fetch(`/api/restaurants/${restaurant.id}/favorites`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ menuItemId }),
        })
      } else {
        await fetch(`/api/restaurants/${restaurant.id}/favorites`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ menuItemId }),
        })
      }
    } catch {
      // Revert on error
      setFavoriteIds(prev => {
        const next = new Set(prev)
        if (next.has(menuItemId)) {
          next.delete(menuItemId)
        } else {
          next.add(menuItemId)
        }
        return next
      })
    } finally {
      setFavoriteToggling(null)
    }
  }, [sessionToken, restaurant, favoriteIds, favoriteToggling])

  // ── Social Sharing Handlers ──
  const getShareBaseUrl = useCallback(() => {
    if (!restaurant) return ''
    const envBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
    const baseUrl = envBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '')
    return `${baseUrl}/r/${restaurant.slug}`
  }, [restaurant])

  const shareMenu = useCallback(async () => {
    if (!restaurant) return
    const restaurantName = tName(restaurant.name, restaurant.nameAm, restaurant.nameI18n)
    const url = getShareBaseUrl()
    setShareContext({
      title: `${restaurantName} - Yene QR`,
      text: `Check out ${restaurantName}'s menu on Yene QR! 🍽️`,
      url,
    })
    setShareSheetOpen(true)
  }, [restaurant, getShareBaseUrl])

  const shareItem = useCallback(async (item: MenuItem) => {
    if (!restaurant) return
    const restaurantName = tName(restaurant.name, restaurant.nameAm, restaurant.nameI18n)
    const itemName = tName(item.name, item.nameAm, item.nameI18n)
    const price = formatPrice(item.priceCents, restaurant.currency)
    const url = `${getShareBaseUrl()}?item=${item.id}`
    setShareContext({
      title: `${itemName} - ${restaurantName}`,
      text: `${itemName} (${price}) at ${restaurantName} — check it out on Yene QR! 🍽️`,
      url,
    })
    setShareSheetOpen(true)
  }, [restaurant, getShareBaseUrl])

  // ─── Loading State ───
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-background">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="w-20 h-20 rounded-2xl bg-brand flex items-center justify-center mb-6 shadow-lg"
        >
          <UtensilsCrossed className="w-10 h-10 text-white" />
        </motion.div>
        <Loader2 className="w-8 h-8 text-brand animate-spin mb-4" />
        <p className="text-muted-foreground text-sm">Loading menu...</p>
      </div>
    )
  }

  // ─── Error State ───
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-background px-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="w-20 h-20 rounded-2xl bg-red-100 flex items-center justify-center mb-6"
        >
          <AlertCircle className="w-10 h-10 text-red-500" />
        </motion.div>
        <h1 className="text-xl font-bold mb-2">QR Code Error</h1>
        <p className="text-muted-foreground text-center text-sm mb-6">{error}</p>
        <p className="text-xs text-muted-foreground text-center mb-4">
          Please ask restaurant staff for a new QR code.
        </p>
        <button
          onClick={handleRetry}
          className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (!restaurant) return null

  // ── RTL direction & custom font ──
  const textDirection = getLanguageDirection(language)
  const currentLangConfig = enabledLanguages.find(l => l.code === language)
  const customFontCSS = getLanguageFontCSS(currentLangConfig || null)

  // ─── Screens ───
  const renderScreen = () => {
    switch (screen) {
      case 'welcome':
        return (
          <div className="flex flex-col h-full bg-gradient-to-b from-brand/10 via-background to-background overflow-y-auto">
            {/* Language Toggle */}
            <div className="flex justify-end p-3">
              {enabledLanguages.length > 0 ? (
                <LanguagePicker
                  language={language}
                  languages={enabledLanguages}
                  onChange={setLanguage}
                />
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-card shadow-sm border border-border text-sm font-medium">
                  <Globe className="w-4 h-4" />
                  {language.toUpperCase()}
                </div>
              )}
            </div>

            {/* Hero */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 pb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                className="w-20 h-20 rounded-2xl bg-brand flex items-center justify-center mb-4 shadow-lg shadow-brand/30 overflow-hidden"
              >
                {restaurant.logo ? (
                  <img src={restaurant.logo} alt={tName(restaurant.name, restaurant.nameAm, restaurant.nameI18n)} className="w-full h-full object-cover" />
                ) : (
                  <UtensilsCrossed className="w-10 h-10 text-white" />
                )}
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-xl font-bold text-center mb-1"
              >
                {tName(restaurant.name, restaurant.nameAm, restaurant.nameI18n)}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="text-muted-foreground text-center text-sm mb-4"
              >
                {restaurant.cuisineType || 'Restaurant'}
              </motion.p>

              {/* ── Feature 1: Order Type Selection ── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="w-full max-w-sm mb-4"
              >
                {!orderTypeSettings.dineIn && !orderTypeSettings.takeaway ? (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-sm text-red-700">{tuiGlobal('menu.no_order_types', 'No order types available')}</span>
                  </div>
                ) : orderTypeSettings.dineIn && orderTypeSettings.takeaway ? (
                  <>
                    <p className="text-sm font-medium text-center mb-2">
                      {tuiGlobal('menu.how_would_you_like', 'How would you like to order?')}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Dine In Card */}
                      <button
                        onClick={() => setOrderType('dine-in')}
                        className={`flex flex-col items-center p-3 rounded-2xl border-2 transition-all active:scale-[0.97] ${
                          orderType === 'dine-in'
                            ? 'border-brand bg-brand/5 shadow-sm'
                            : 'border-border bg-card hover:border-brand/30'
                        }`}
                      >
                        <span className="text-2xl mb-1">🪑</span>
                        <span className="font-semibold text-sm">{tuiGlobal('menu.dine_in', 'Dine In')}</span>
                        <span className="text-xs text-muted-foreground mt-0.5">
                          {tuiGlobal('menu.table', 'Table')} {table?.number || '—'}
                        </span>
                        {orderType === 'dine-in' && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-brand mt-1" />
                        )}
                      </button>

                      {/* Takeaway Card */}
                      <button
                        onClick={() => setOrderType('takeaway')}
                        className={`flex flex-col items-center p-3 rounded-2xl border-2 transition-all active:scale-[0.97] ${
                          orderType === 'takeaway'
                            ? 'border-brand bg-brand/5 shadow-sm'
                            : 'border-border bg-card hover:border-brand/30'
                        }`}
                      >
                        <span className="text-2xl mb-1">🥡</span>
                        <span className="font-semibold text-sm">{tuiGlobal('menu.takeaway', 'Takeaway')}</span>
                        <span className="text-xs text-muted-foreground mt-0.5">
                          {tuiGlobal('menu.pickup_in', 'Pickup in ~20 min')}
                        </span>
                        {orderType === 'takeaway' && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-brand mt-1" />
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  /* Only one order type available — auto-selected, show indicator */
                  <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-brand/5 border border-brand/20">
                    {orderTypeSettings.dineIn ? (
                      <>
                        <span className="text-lg">🪑</span>
                        <span className="text-sm font-medium">{tuiGlobal('menu.dine_in', 'Dine In')} • {tuiGlobal('menu.table', 'Table')} {table?.number || '—'}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-lg">🥡</span>
                        <span className="text-sm font-medium">{tuiGlobal('menu.takeaway', 'Takeaway')} • {tuiGlobal('menu.pickup_in', 'Pickup in ~20 min')}</span>
                      </>
                    )}
                  </div>
                )}
              </motion.div>

              {/* ── Feature 1: Guest Count ── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="w-full max-w-sm mb-5"
              >
                <p className="text-sm font-medium text-center mb-2">
                  {tuiGlobal('menu.how_many_guests', 'How many guests?')}
                </p>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                    className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <span className="text-2xl font-bold w-10 text-center">{guestCount}</span>
                  <button
                    onClick={() => setGuestCount(Math.min(20, guestCount + 1))}
                    className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>

              {/* Entertainment Teaser */}
              <div className="flex items-center gap-2 mb-4 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200">
                <Sparkles className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                <span className="text-xs text-purple-700 font-medium">
                  {tuiGlobal('menu.entertainment_teaser', 'Games, facts & stories while you wait!')}
                </span>
              </div>

              {/* Sticky Start Ordering Button — always visible */}
              <div className="w-full max-w-xs space-y-3">
                <Button
                  onClick={() => setScreen('menu')}
                  size="lg"
                  className="w-full h-14 text-lg font-semibold rounded-2xl bg-brand hover:bg-brand-dark text-white shadow-lg shadow-brand/25 active:scale-[0.98] transition-all"
                >
                  {tuiGlobal('menu.start_ordering', 'Start Ordering')}
                </Button>

                {/* Reserve a Table Button */}
                <Button
                  onClick={() => setIsReservationOpen(true)}
                  size="lg"
                  variant="outline"
                  className="w-full h-12 rounded-2xl border-brand/30 text-brand hover:bg-brand/5 font-semibold active:scale-[0.98] transition-all"
                >
                  <CalendarDays className="w-5 h-5 mr-2" />
                  {tuiGlobal('reservation.reserve_table', 'Reserve a Table')}
                </Button>

                {/* My Reservations Button */}
                <Button
                  onClick={() => setIsMyReservationsOpen(true)}
                  size="lg"
                  variant="ghost"
                  className="w-full h-11 rounded-2xl text-muted-foreground hover:text-foreground font-medium active:scale-[0.98] transition-all"
                >
                  <Receipt className="w-4 h-4 mr-2" />
                  {tuiGlobal('my_reservations.title', 'My Reservations')}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mt-3 text-center">
                {orderType === 'dine-in'
                  ? `${tuiGlobal('menu.table', 'Table')} ${table?.number} • ${guestCount} ${tuiGlobal('menu.guests', 'guests')}`
                  : `${tuiGlobal('menu.takeaway', 'Takeaway')} • ${guestCount} ${tuiGlobal('menu.guests', 'guests')}`
                }
              </p>
            </div>
          </div>
        )

      case 'menu':
        return (
          <div className="flex flex-col h-full bg-background relative overflow-hidden">
            {/* ── Redesigned Header — hamburger menu, restaurant brand prominent ── */}
            <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-xl border-b border-border/50 shadow-sm">
              {/* Row 1: Hamburger + Centered Restaurant Logo (top) + Name (bottom) */}
              <div className="flex items-start gap-3 px-4 pt-5 pb-4 relative">
                {/* Hamburger Menu Button */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="w-11 h-11 rounded-xl bg-muted/80 flex items-center justify-center shrink-0 active:scale-90 transition-all hover:bg-muted mt-1"
                  title="Menu"
                >
                  <Menu className="w-6 h-6" />
                </button>

                {/* Center: Restaurant Logo (top) + Name (bottom) — vertical stack */}
                <div className="flex flex-col items-center min-w-0 flex-1 gap-1.5">
                  {restaurant.logo && (
                    <img
                      src={restaurant.logo}
                      alt={tName(restaurant.name, restaurant.nameAm, restaurant.nameI18n)}
                      className="h-16 w-16 rounded-2xl object-contain shrink-0"
                    />
                  )}
                  <h1 className="text-xl font-bold truncate leading-tight text-center">
                    {tName(restaurant.name, restaurant.nameAm, restaurant.nameI18n)}
                  </h1>
                </div>

                {/* Spacer to balance hamburger */}
                <div className="w-11 shrink-0" />
              </div>

              {/* Table number badge — absolute top-right corner */}
              {orderType === 'dine-in' && table?.number && (
                <div className="absolute top-3 right-3 z-30">
                  <div className="w-9 h-9 rounded-full bg-brand/10 border-2 border-brand/30 flex items-center justify-center">
                    <span className="text-[11px] font-bold text-brand">T{table.number}</span>
                  </div>
                </div>
              )}

              {/* Row 2: Search Bar */}
              <div className="px-4 pb-2">
                {/* Search bar */}
                <div className="relative mb-2">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder={tuiGlobal('menu.search_placeholder', 'Search menu...')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-11 px-4 pl-11 pr-10 rounded-xl bg-muted/60 border-0 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 placeholder:text-muted-foreground/60"
                  />
                  {searchQuery && (
                    <>
                      <button onClick={() => setSearchQuery('')} className="absolute right-10 top-1/2 -translate-y-1/2">
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                      {debouncedSearch && (
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground whitespace-nowrap">
                          {filteredItems.filter(i => i._passesFilter).length}
                        </span>
                      )}
                    </>
                  )}
                </div>
                {debouncedSearch && (
                  <p className="text-[10px] text-muted-foreground mb-1 text-center">
                    {filteredItems.filter(i => i._passesFilter).length} {tuiGlobal('menu.items_found', 'items found')}
                  </p>
                )}

                {/* Promotions Banner - Auto-scrolling */}
                {promotions.length > 0 && (
                  <PromoBanner promotions={promotions} language={language} />
                )}
              </div>

              {/* Row 3: Category pills + Filter button */}
              <div className="flex items-center gap-1.5 px-4 pb-2">
                {/* Scrollable category pills */}
                <div
                  className="flex gap-1.5 overflow-x-auto scrollbar-hide flex-1 scroll-smooth relative"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  ref={(el) => {
                    if (el) {
                      const updateShadows = () => {
                        el.style.maskImage = el.scrollLeft > 10
                          ? 'linear-gradient(to right, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)'
                          : el.scrollLeft < el.scrollWidth - el.clientWidth - 10
                            ? 'linear-gradient(to right, black 0, black calc(100% - 20px), transparent 100%)'
                            : 'none'
                      }
                      el.onscroll = updateShadows
                      setTimeout(updateShadows, 100)
                    }
                  }}
                >
                  <button
                    onClick={() => { setActiveCategory(''); setActiveFilters(new Set()) }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap shrink-0 transition-all active:scale-95 ${
                      !activeCategory && activeFilters.size === 0
                        ? 'bg-brand text-white shadow-sm shadow-brand/25'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    All
                  </button>

                  {(() => {
                    // Sort categories by the admin-controlled sortOrder only.
                    // (Previously this used a hardcoded meal-time priority that
                    // overrode the admin's chosen order — removed so the owner
                    // has full control via the reorder arrows in the dashboard
                    // or the Sort Order field in the Add/Edit Category dialog.)
                    const sorted = [...categories].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                    return sorted.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          const newCat = activeCategory === cat.id ? '' : cat.id
                          setActiveCategory(newCat)
                          if (newCat && activeFilters.size > 0) setActiveFilters(new Set())
                          setTimeout(() => {
                            const btn = document.querySelector(`[data-cat-id="${cat.id}"]`) as HTMLElement
                            if (btn) btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
                          }, 50)
                        }}
                        data-cat-id={cat.id}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap shrink-0 transition-all active:scale-95 ${
                          activeCategory === cat.id
                            ? 'bg-brand text-white shadow-sm shadow-brand/25'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {cat.icon && <span className="text-xs">{cat.icon}</span>}
                        <span className="whitespace-nowrap">{tName(cat.name, cat.nameAm, cat.nameI18n)}</span>
                      </button>
                    ))
                  })()}
                </div>

                {/* Advanced Filter button */}
                <button
                  onClick={() => setFilterPanelOpen(!filterPanelOpen)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all relative ${
                    filterPanelOpen || sortOrder !== 'default' || activeFilters.size > 0
                      ? 'bg-brand text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                  title="Filters & View"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  {(activeFilters.size > 0 || sortOrder !== 'default') && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-orange-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                      {activeFilters.size + (sortOrder !== 'default' ? 1 : 0)}
                    </span>
                  )}
                </button>
              </div>

              {/* Advanced Filter Panel (slide down) */}
              <AnimatePresence>
                {filterPanelOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-border/50 bg-muted/20"
                  >
                    <div className="p-4 space-y-3">
                      {/* Dietary Filters */}
                      <div>
                        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Dietary Filters</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {[
                            { key: 'popular', label: '🔥 Popular' },
                            { key: 'veg', label: '🌱 Vegetarian' },
                            { key: 'spicy', label: '🌶️ Spicy' },
                            { key: 'new', label: '🆕 New' },
                            { key: 'favorites', label: '❤️ Saved' },
                          ].map(filter => {
                            const hasItems = filter.key === 'popular' ? popularItems.length > 0 :
                              filter.key === 'veg' ? menuItems.some(i => i.isVegetarian) :
                              filter.key === 'spicy' ? menuItems.some(i => i.isSpicy) :
                              filter.key === 'new' ? menuItems.some(i => { const c = new Date(i.createdAt); return (Date.now() - c.getTime()) / 86400000 < 14 }) :
                              filter.key === 'favorites' ? favoriteIds.size > 0 : false
                            if (!hasItems) return null
                            const isActive = activeFilters.has(filter.key)
                            return (
                              <button
                                key={filter.key}
                                onClick={() => { if (isActive) { setActiveFilters(new Set()) } else { setActiveCategory(''); toggleFilter(filter.key) } }}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                  isActive ? 'bg-brand text-white' : 'bg-card border border-border text-muted-foreground hover:bg-muted'
                                }`}
                              >
                                {filter.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Sort */}
                      <div>
                        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Sort By</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {[
                            { key: 'default' as SortOrder, label: 'Default' },
                            { key: 'price-low' as SortOrder, label: 'Price ↑' },
                            { key: 'price-high' as SortOrder, label: 'Price ↓' },
                            { key: 'popular' as SortOrder, label: 'Popular' },
                            { key: 'fastest' as SortOrder, label: 'Fastest' },
                          ].map(opt => (
                            <button
                              key={opt.key}
                              onClick={() => setSortOrder(opt.key)}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                sortOrder === opt.key ? 'bg-brand text-white' : 'bg-card border border-border text-muted-foreground hover:bg-muted'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* View Mode */}
                      <div>
                        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">View Mode</p>
                        <div className="flex gap-1.5">
                          {[
                            { key: 'card' as const, label: 'Cards', icon: <ImageIcon className="w-3.5 h-3.5" /> },
                            { key: 'grid' as const, label: 'Grid', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
                            { key: 'list' as const, label: 'List', icon: <List className="w-3.5 h-3.5" /> },
                          ].map(opt => (
                            <button
                              key={opt.key}
                              onClick={() => setViewMode(opt.key)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                viewMode === opt.key ? 'bg-brand text-white' : 'bg-card border border-border text-muted-foreground hover:bg-muted'
                              }`}
                            >
                              {opt.icon}
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Reset */}
                      {(activeFilters.size > 0 || sortOrder !== 'default' || viewMode !== 'card') && (
                        <button
                          onClick={() => { setActiveFilters(new Set()); setSortOrder('default'); setViewMode('card'); setActiveCategory('') }}
                          className="text-xs text-red-500 font-medium hover:underline"
                        >
                          Reset all filters
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>

            {/* ── Hamburger Menu Drawer ── */}
            <AnimatePresence>
              {mobileMenuOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
                    onClick={() => setMobileMenuOpen(false)}
                  />
                  <motion.div
                    initial={{ x: '-100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '-100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="fixed top-0 left-0 bottom-0 w-72 bg-card z-40 shadow-2xl overflow-y-auto"
                  >
                    {/* Header */}
                    <div className="p-4 border-b border-border">
                      <div className="flex items-center gap-3">
                        {restaurant.logo && (
                          <img src={restaurant.logo} alt="" className="w-10 h-10 rounded-xl object-contain" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{tName(restaurant.name, restaurant.nameAm, restaurant.nameI18n)}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">
                              {orderType === 'dine-in' ? `Table ${table?.number}` : 'Takeaway'}
                            </span>
                            {waiter && orderType === 'dine-in' && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-brand">
                                <Users className="w-2.5 h-2.5" />{waiter.name}
                              </span>
                            )}
                            {loyaltyPoints > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                                <Gift className="w-2.5 h-2.5" />{loyaltyPoints} pts
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => setMobileMenuOpen(false)}
                          className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Menu items */}
                    <div className="p-2 space-y-1">
                      {/* My Orders */}
                      <button
                        onClick={() => { setScreen('order'); setMobileMenuOpen(false) }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
                      >
                        <ClipboardList className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{tuiGlobal('menu.my_orders', 'My Orders')}</p>
                        </div>
                        {currentOrder && (
                          <span className="w-5 h-5 bg-brand text-white text-[9px] font-bold rounded-full flex items-center justify-center">1</span>
                        )}
                      </button>

                      {/* Profile & Rewards */}
                      <button
                        onClick={() => { setIsProfileOpen(true); setMobileMenuOpen(false) }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
                      >
                        <User className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Profile & Rewards</p>
                          {playerName && <p className="text-[10px] text-green-600">✓ {playerName}</p>}
                        </div>
                        {loyaltyPoints > 0 && (
                          <span className="text-xs font-bold text-amber-600">{loyaltyPoints} pts</span>
                        )}
                      </button>

                      {/* Share Menu */}
                      <button
                        onClick={() => { shareMenu(); setMobileMenuOpen(false) }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
                      >
                        <Share2 className="w-5 h-5 text-muted-foreground" />
                        <p className="text-sm font-medium">{tuiGlobal('menu.share_menu', 'Share Menu')}</p>
                      </button>

                      {/* Reservations */}
                      <button
                        onClick={() => { setIsMyReservationsOpen(true); setMobileMenuOpen(false) }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
                      >
                        <CalendarDays className="w-5 h-5 text-muted-foreground" />
                        <p className="text-sm font-medium">Reservations</p>
                      </button>

                      {/* Divider */}
                      <div className="h-px bg-border my-2" />

                      {/* Theme Toggle */}
                      <button
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
                      >
                        {theme === 'dark' ? <Sun className="w-5 h-5 text-muted-foreground" /> : <Moon className="w-5 h-5 text-muted-foreground" />}
                        <p className="text-sm font-medium">
                          {theme === 'dark' ? tuiGlobal('menu.light_mode', 'Light Mode') : tuiGlobal('menu.dark_mode', 'Dark Mode')}
                        </p>
                      </button>

                      {/* Language */}
                      <div className="p-3">
                        <p className="text-xs text-muted-foreground mb-2">Language</p>
                        {enabledLanguages.length > 0 ? (
                          <div className="flex gap-2 flex-wrap">
                            {enabledLanguages.map(lang => (
                              <button
                                key={lang.code}
                                onClick={() => { setLanguage(lang.code); setMobileMenuOpen(false) }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                  language === lang.code
                                    ? 'bg-brand text-white'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                              >
                                {lang.flagEmoji} {lang.nameLocal || lang.name}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm">{language.toUpperCase()}</span>
                        )}
                      </div>

                      {/* Divider */}
                      <div className="h-px bg-border my-2" />

                      {/* Back to Welcome */}
                      <button
                        onClick={() => { setScreen('welcome'); setMobileMenuOpen(false) }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
                      >
                        <Home className="w-5 h-5 text-muted-foreground" />
                        <p className="text-sm font-medium">Home</p>
                      </button>
                    </div>

                    {/* Footer */}
                    <div className="p-4 mt-auto border-t border-border">
                      <p className="text-[10px] text-center text-muted-foreground">
                        Powered by <span className="font-bold text-brand">Yene QR</span>
                      </p>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Menu Items */}
            <div className="flex-1 overflow-y-auto px-4 py-3 pb-32 scroll-smooth" ref={menuContentRef}>
              {/* ── Trending Strip (compact, only when viewing All) ── */}
              <AnimatePresence>
                {popularItems.length > 0 && !activeCategory && !debouncedSearch && activeFilters.size === 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="mb-4">
                      <h2 className="text-xs font-semibold mb-2 flex items-center gap-1 text-muted-foreground uppercase tracking-wide">
                        <span>🔥</span>
                        {tuiGlobal('menu.popular_picks', 'Popular Picks')}
                      </h2>
                      <div
                        className="overflow-hidden"
                      >
                        <div className="flex gap-2 animate-marquee w-max">
                          {[...popularItems.slice(0, 8), ...popularItems.slice(0, 8)].map((item, idx) => {
                          const itemAvailable = item.currentAvailable ?? item.isAvailable
                          return (
                          <motion.button
                            key={`${item.id}-${idx}`}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => {
                              if (!itemAvailable) return
                              setSelectedItem(item)
                              setIsItemDetailOpen(true)
                            }}
                            className={`shrink-0 flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-card border border-border shadow-sm active:scale-[0.98] transition-all ${!itemAvailable ? 'opacity-50' : 'hover:shadow-md'}`}
                          >
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-lg overflow-hidden shrink-0">
                              {item.image ? (
                                <img src={item.image} alt={tName(item.name, item.nameAm, item.nameI18n)} className="w-full h-full object-cover" />
                              ) : (
                                <span>⭐</span>
                              )}
                            </div>
                            <div className="text-left min-w-0 max-w-[100px]">
                              <h3 className="font-semibold text-[11px] leading-tight truncate">
                                {tName(item.name, item.nameAm, item.nameI18n)}
                              </h3>
                              <p className="text-[11px] font-bold text-brand mt-0.5">
                                {formatPrice(item.priceCents, restaurant.currency)}
                              </p>
                            </div>
                            <button
                              onClick={(e) => toggleFavorite(item.id, e as unknown as React.MouseEvent)}
                              className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                                favoriteIds.has(item.id)
                                  ? 'bg-red-500/90 text-white'
                                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              }`}
                              aria-label={favoriteIds.has(item.id) ? 'Remove from favorites' : 'Add to favorites'}
                            >
                              <Heart className={`w-3 h-3 ${favoriteIds.has(item.id) ? 'fill-current' : ''}`} />
                            </button>
                          </motion.button>
                          )
                          })}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Scroll anchor for items section */}
              <div ref={itemsStartRef} />

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeCategory || 'all'}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  {filteredItems.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Coffee className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="font-semibold mb-1">{tuiGlobal('menu.no_items_found', 'No items found')}</p>
                      <p className="text-sm mb-3">
                        {activeFilters.size > 0
                          ? tuiGlobal('menu.try_different_filter', 'Try a different filter or browse all items')
                          : tuiGlobal('menu.try_different_search', 'Try a different search term')
                        }
                      </p>
                      {activeFilters.size > 0 && (
                        <button
                          onClick={() => setActiveFilters(new Set())}
                          className="px-4 py-2 rounded-full bg-brand text-white text-sm font-medium active:scale-95 transition-transform"
                        >
                          {tuiGlobal('menu.filter_all', 'All')}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Card View — one item per row, full image + details */}
                  {viewMode === 'card' && (
                    <div className="flex flex-col gap-3">
                      {filteredItems.map((item, index) => {
                        const dimmed = !item._passesFilter
                        const itemAvailable = item.currentAvailable ?? item.isAvailable
                        return (
                          <motion.button
                            key={item.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(index * 0.03, 0.3) }}
                            onClick={() => {
                              if (!itemAvailable) return
                              setSelectedItem(item)
                              setIsItemDetailOpen(true)
                            }}
                            className={`flex flex-col rounded-2xl bg-card border border-border shadow-sm text-left transition-all active:scale-[0.99] overflow-hidden ${
                              !itemAvailable ? 'opacity-50' : dimmed ? 'opacity-40' : 'hover:shadow-md'
                            }`}
                          >
                            {/* Full-width image: 4:3 aspect ratio */}
                            <div className="w-full aspect-[4/3] bg-muted flex items-center justify-center text-4xl shrink-0 overflow-hidden relative">
                              {item.image ? (
                                <img src={item.image} alt={tName(item.name, item.nameAm, item.nameI18n)} className="w-full h-full object-cover" />
                              ) : (
                                <span>{item.isPopular ? '⭐' : '🍽️'}</span>
                              )}
                              {/* Favorite button */}
                              <button
                                onClick={(e) => toggleFavorite(item.id, e)}
                                className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                                  favoriteIds.has(item.id)
                                    ? 'bg-red-500/90 text-white shadow-sm'
                                    : 'bg-black/40 text-white/80 hover:bg-black/60'
                                }`}
                                aria-label={favoriteIds.has(item.id) ? 'Remove from favorites' : 'Add to favorites'}
                              >
                                <Heart className={`w-4 h-4 ${favoriteIds.has(item.id) ? 'fill-current' : ''}`} />
                              </button>
                              {/* Unavailable overlay */}
                              {!itemAvailable && (
                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                  <Badge variant="secondary" className="text-xs bg-black/60 text-white hover:bg-black/70">
                                    {item.availabilityType === 'scheduled'
                                      ? tuiGlobal('menu.unavailable', 'Unavailable')
                                      : tuiGlobal('menu.sold_out', 'Sold Out')}
                                  </Badge>
                                </div>
                              )}
                              {/* Popular badge */}
                              {item.isPopular && itemAvailable && (
                                <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 text-[10px] font-medium text-orange-700 bg-orange-100/90 dark:bg-orange-900/50 dark:text-orange-300 px-2 py-0.5 rounded-full backdrop-blur-sm">
                                  🔥 {tuiGlobal('menu.popular', 'Popular')}
                                </span>
                              )}
                            </div>
                            {/* Content area */}
                            <div className="p-3 flex-1 flex flex-col">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-semibold text-sm leading-tight">
                                    {tName(item.name, item.nameAm, item.nameI18n)}
                                  </h3>
                                  {item.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                      {tDesc(item.description, item.descriptionAm, item.descriptionI18n)}
                                    </p>
                                  )}
                                </div>
                                <span className="font-bold text-brand text-sm shrink-0">
                                  {formatPrice(item.priceCents, restaurant.currency)}
                                </span>
                              </div>
                              {/* Badges row */}
                              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                {item.isVegetarian && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded-full">
                                    <Leaf className="w-2.5 h-2.5" />
                                    {tuiGlobal('menu.veg', 'Veg')}
                                  </span>
                                )}
                                {item.isSpicy && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] text-orange-700 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 px-1.5 py-0.5 rounded-full">
                                    <Flame className="w-2.5 h-2.5" />
                                    {tuiGlobal('menu.spicy', 'Spicy')}
                                  </span>
                                )}
                                {item.preparationTime && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted/60">
                                    <Clock className="w-2.5 h-2.5" />
                                    {item.preparationTime}m
                                  </span>
                                )}
                                <span className="ml-auto">
                                  {itemAvailable ? (
                                    <span className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center shadow-sm shadow-brand/25 active:scale-90 transition-transform">
                                      <Plus className="w-4 h-4" />
                                    </span>
                                  ) : (
                                    <Badge variant="secondary" className="text-[9px]">
                                      {item.availabilityType === 'scheduled'
                                        ? tuiGlobal('menu.unavailable', 'Unavailable')
                                        : tuiGlobal('menu.sold_out', 'Sold Out')}
                                    </Badge>
                                  )}
                                </span>
                              </div>
                            </div>
                          </motion.button>
                        )
                      })}
                    </div>
                  )}

                  {/* Grid View */}
                  {viewMode === 'grid' && (
                    <div className="grid grid-cols-2 gap-3">
                      {filteredItems.map((item, index) => {
                        const dimmed = !item._passesFilter
                        const itemAvailable = item.currentAvailable ?? item.isAvailable
                        return (
                          <motion.button
                            key={item.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.02 }}
                            onClick={() => {
                              if (!itemAvailable) return
                              setSelectedItem(item)
                              setIsItemDetailOpen(true)
                            }}
                            className={`flex flex-col rounded-2xl bg-card border border-border shadow-sm text-left transition-all active:scale-[0.98] overflow-hidden ${
                              !itemAvailable ? 'opacity-50' : dimmed ? 'opacity-40' : 'hover:shadow-md'
                            }`}
                          >
                            <div className="w-full h-[90px] bg-muted flex items-center justify-center text-3xl shrink-0 overflow-hidden relative">
                              {item.image ? (
                                <img src={item.image} alt={tName(item.name, item.nameAm, item.nameI18n)} className="w-full h-full object-cover" />
                              ) : (
                                <span>{item.isPopular ? '⭐' : '🍽️'}</span>
                              )}
                              {!itemAvailable && (
                                <Badge variant="secondary" className="absolute top-1.5 right-1.5 text-[8px] shrink-0 bg-black/60 text-white hover:bg-black/70">
                                  {tuiGlobal('menu.unavailable', 'Unavailable')}
                                </Badge>
                              )}
                              {/* Favorite button */}
                              <button
                                onClick={(e) => toggleFavorite(item.id, e)}
                                className={`absolute top-1.5 left-1.5 w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                                  favoriteIds.has(item.id)
                                    ? 'bg-red-500/90 text-white shadow-sm'
                                    : 'bg-black/40 text-white/80 hover:bg-black/60'
                                }`}
                                aria-label={favoriteIds.has(item.id) ? 'Remove from favorites' : 'Add to favorites'}
                              >
                                <Heart className={`w-3.5 h-3.5 ${favoriteIds.has(item.id) ? 'fill-current' : ''}`} />
                              </button>
                            </div>
                            <div className="p-2.5 flex-1 flex flex-col">
                              <h3 className="font-semibold text-xs leading-tight line-clamp-2">
                                {tName(item.name, item.nameAm, item.nameI18n)}
                              </h3>
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                {item.isVegetarian && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] text-green-700 bg-green-100 px-1 py-0.5 rounded-full">
                                    <Leaf className="w-2.5 h-2.5" />
                                    {tuiGlobal('menu.veg', 'Veg')}
                                  </span>
                                )}
                                {item.isSpicy && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] text-orange-700 bg-orange-100 px-1 py-0.5 rounded-full">
                                    <Flame className="w-2.5 h-2.5" />
                                    {tuiGlobal('menu.spicy', 'Spicy')}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between mt-auto pt-1.5">
                                <span className="font-bold text-brand text-xs">
                                  {formatPrice(item.priceCents, restaurant.currency)}
                                </span>
                                {itemAvailable && (
                                  <span className="w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center shadow-sm">
                                    <Plus className="w-3 h-3" />
                                  </span>
                                )}
                              </div>
                            </div>
                          </motion.button>
                        )
                      })}
                    </div>
                  )}

                  {/* List View */}
                  {viewMode === 'list' && (
                    <div className="flex flex-col gap-2">
                      {filteredItems.map((item, index) => {
                        const dimmed = !item._passesFilter
                        const itemAvailable = item.currentAvailable ?? item.isAvailable
                        return (
                          <motion.button
                            key={item.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.02 }}
                            onClick={() => {
                              if (!itemAvailable) return
                              setSelectedItem(item)
                              setIsItemDetailOpen(true)
                            }}
                            className={`flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-sm text-left transition-all active:scale-[0.98] ${
                              !itemAvailable ? 'opacity-50' : dimmed ? 'opacity-40' : 'hover:shadow-md'
                            }`}
                          >
                            <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center text-2xl shrink-0 overflow-hidden relative">
                              {item.image ? (
                                <img src={item.image} alt={tName(item.name, item.nameAm, item.nameI18n)} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-lg">{item.isPopular ? '⭐' : '🍽️'}</span>
                              )}
                              {/* Favorite indicator dot */}
                              {favoriteIds.has(item.id) && (
                                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-card" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm leading-tight truncate">
                                {tName(item.name, item.nameAm, item.nameI18n)}
                              </h3>
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                {tDesc(item.description, item.descriptionAm, item.descriptionI18n)}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1">
                                {item.isVegetarian && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] text-green-700 bg-green-100 px-1 py-0.5 rounded-full">
                                    <Leaf className="w-2.5 h-2.5" />
                                  </span>
                                )}
                                {item.isSpicy && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] text-orange-700 bg-orange-100 px-1 py-0.5 rounded-full">
                                    <Flame className="w-2.5 h-2.5" />
                                  </span>
                                )}
                                <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  {item.preparationTime}m
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end shrink-0 gap-1">
                              <button
                                onClick={(e) => toggleFavorite(item.id, e)}
                                className={`transition-all active:scale-90 ${
                                  favoriteIds.has(item.id) ? 'text-red-500' : 'text-muted-foreground hover:text-red-400'
                                }`}
                                aria-label={favoriteIds.has(item.id) ? 'Remove from favorites' : 'Add to favorites'}
                              >
                                <Heart className={`w-5 h-5 ${favoriteIds.has(item.id) ? 'fill-current' : ''}`} />
                              </button>
                              <span className="font-bold text-brand text-sm">
                                {formatPrice(item.priceCents, restaurant.currency)}
                              </span>
                              {itemAvailable && (
                                <span className="w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center shadow-sm">
                                  <Plus className="w-3.5 h-3.5" />
                                </span>
                              )}
                              {!itemAvailable && (
                                <Badge variant="secondary" className="text-[9px] shrink-0">
                                  {item.availabilityType === 'scheduled'
                                    ? tuiGlobal('menu.unavailable', 'Unavailable')
                                    : tuiGlobal('menu.sold_out', 'Sold Out')}
                                </Badge>
                              )}
                            </div>
                          </motion.button>
                        )
                      })}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* ── Feature 4: While You Decide — Entertainment Section ── */}
              <div className="mt-6 mb-4">
                <button
                  onClick={() => setShowEntertainment(!showEntertainment)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-semibold text-purple-700">
                      {tuiGlobal('menu.while_you_decide', 'While You Decide')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">Games, Facts & More</span>
                    <ChevronDown className={`w-4 h-4 text-purple-500 transition-transform ${showEntertainment ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {showEntertainment && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.3 }}
                    className="mt-3"
                  >
                    <EntertainmentHub
                      entertainmentTab={entertainmentTab}
                      onTabChange={setEntertainmentTab}
                      estimatedMinutes={20}
                      restaurantId={restaurant?.id || ''}
                      sessionToken={sessionToken}
                      playerName={playerName}
                      entertainmentSettings={entertainmentSettings}
                      factsList={factsList}
                      storiesList={storiesList}
                      readsList={readsList}
                      scrambleWords={scrambleWords}
                      triviaQuestions={triviaQuestions}
                      // Trivia
                      triviaIndex={triviaIndex}
                      triviaScore={triviaScore}
                      triviaAnswered={triviaAnswered}
                      triviaSelected={triviaSelected}
                      onTriviaAnswer={(idx) => { setTriviaAnswered(true); setTriviaSelected(idx); if (idx === triviaQuestions[triviaIndex].correct) setTriviaScore((s) => s + 1) }}
                      onTriviaNext={() => { if (triviaIndex < triviaQuestions.length - 1) { setTriviaIndex((i) => i + 1); setTriviaAnswered(false); setTriviaSelected(null) } }}
                      // Word Scramble
                      scrambleWordIndex={scrambleWordIndex}
                      scrambleSelected={scrambleSelected}
                      scrambleAttempts={scrambleAttempts}
                      scrambleResult={scrambleResult}
                      onScrambleChipTap={(chipIdx) => {
                        if (scrambleResult) return
                        if (scrambleSelected.includes(chipIdx)) return
                        const next = [...scrambleSelected, chipIdx]
                        setScrambleSelected(next)
                        const word = scrambleWords[scrambleWordIndex]
                        const letters = scrambleLetters(word)
                        const spelled = next.map((i) => letters[i]).join('')
                        if (spelled.length === word.replace(/ /g, '').length) {
                          if (spelled === word.replace(/ /g, '')) {
                            setScrambleResult('correct')
                          } else {
                            const newAttempts = scrambleAttempts + 1
                            setScrambleAttempts(newAttempts)
                            if (newAttempts >= 3) {
                              setScrambleResult('wrong')
                            } else {
                              setTimeout(() => setScrambleSelected([]), 600)
                            }
                          }
                        }
                      }}
                      onScrambleClear={() => { setScrambleSelected([]); setScrambleResult(null) }}
                      onScrambleSkip={() => {
                        if (scrambleWordIndex < scrambleWords.length - 1) {
                          setScrambleWordIndex((i) => i + 1)
                          setScrambleSelected([])
                          setScrambleAttempts(0)
                          setScrambleResult(null)
                        }
                      }}
                      // Tic Tac Toe
                      tttBoard={tttBoard}
                      tttIsPlayerTurn={tttIsPlayerTurn}
                      tttScore={tttScore}
                      tttGameOver={tttGameOver}
                      tttWinner={tttWinner}
                      onTttCellClick={(cellIdx) => {
                        if (tttBoard[cellIdx] || tttGameOver || !tttIsPlayerTurn) return
                        const newBoard = [...tttBoard]
                        newBoard[cellIdx] = 'X'
                        const winner = checkTttWinner(newBoard)
                        if (winner) {
                          setTttBoard(newBoard)
                          setTttGameOver(true)
                          setTttWinner(winner)
                          if (winner === 'X') setTttScore((s) => ({ ...s, player: s.player + 1 }))
                          else setTttScore((s) => ({ ...s, ai: s.ai + 1 }))
                          return
                        }
                        if (newBoard.every((c) => c !== null)) {
                          setTttBoard(newBoard)
                          setTttGameOver(true)
                          setTttWinner('draw')
                          return
                        }
                        setTttBoard(newBoard)
                        setTttIsPlayerTurn(false)
                        setTimeout(() => {
                          const available = newBoard.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0)
                          if (available.length > 0) {
                            const aiMove = available[Math.floor(Math.random() * available.length)]
                            newBoard[aiMove] = 'O'
                            const aiWinner = checkTttWinner(newBoard)
                            if (aiWinner) {
                              setTttBoard([...newBoard])
                              setTttGameOver(true)
                              setTttWinner(aiWinner)
                              setTttScore((s) => ({ ...s, ai: s.ai + 1 }))
                              return
                            }
                            if (newBoard.every((c) => c !== null)) {
                              setTttBoard([...newBoard])
                              setTttGameOver(true)
                              setTttWinner('draw')
                              return
                            }
                            setTttBoard([...newBoard])
                            setTttIsPlayerTurn(true)
                          }
                        }, 400)
                      }}
                      onTttRestart={() => {
                        setTttBoard(Array(9).fill(null))
                        setTttIsPlayerTurn(true)
                        setTttGameOver(false)
                        setTttWinner(null)
                      }}
                      // Reads
                      expandedRead={expandedRead}
                      onExpandRead={setExpandedRead}
                    />
                  </motion.div>
                )}
              </div>
            </div>

            {/* Sticky Cart Bar */}
            {cart.length > 0 && (
              <motion.div
                initial={{ y: 80 }}
                animate={{ y: 0 }}
                className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-4"
              >
                <button
                  onClick={() => setIsCartOpen(true)}
                  className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl shadow-xl active:scale-[0.98] transition-all ${
                    currentOrder
                      ? 'bg-gradient-to-r from-brand via-brand to-brand-dark text-white shadow-brand/30 hover:shadow-2xl hover:shadow-brand/40'
                      : 'bg-brand text-white shadow-brand/30 hover:shadow-2xl hover:shadow-brand/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {currentOrder ? (
                      <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                        <Plus className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                        {getCartItemCount()}
                      </div>
                    )}
                    <span className="font-semibold">
                      {currentOrder
                        ? tuiGlobal('menu.add_to_order', 'Add to Order')
                        : getCartItemCount() === 1
                          ? tuiGlobal('menu.1_item', '1 item')
                          : tuiGlobal('menu.n_items', `${getCartItemCount()} items`)
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{formatPrice(getCartTotal(), restaurant.currency)}</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </button>
              </motion.div>
            )}

            {/* Floating Waiter Call Button - Hidden for takeaway */}
            {orderType === 'dine-in' && (
              <EnhancedWaiterSheet
                isOpen={isWaiterCallOpen}
                onToggle={() => setIsWaiterCallOpen(!isWaiterCallOpen)}
                onCall={callWaiter}
                customMessage={waiterCustomMessage}
                onCustomMessageChange={setWaiterCustomMessage}
                cooldown={waiterCooldown}
                toast={waiterToast}
                waiter={waiter}
              />
            )}

            {/* Item Detail Drawer */}
            <ItemDetailDrawer
              item={selectedItem}
              open={isItemDetailOpen}
              onOpenChange={(open) => { if (!open) { setIsItemDetailOpen(false); setSelectedItem(null) } }}
              language={language}
              currency={restaurant.currency}
              onAddToCart={addToCart}
              isFavorited={selectedItem ? favoriteIds.has(selectedItem.id) : false}
              onToggleFavorite={toggleFavorite}
              onShareItem={shareItem}
              restaurantSettings={restaurant.settings}
            />

            {/* Share Toast */}
            <AnimatePresence>
              {shareToast && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="fixed bottom-24 left-4 right-4 z-[60] bg-card border border-brand/30 text-sm font-medium text-center px-4 py-3 rounded-2xl shadow-lg flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-brand shrink-0" />
                  {shareToast}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Advanced Share Sheet */}
            <ShareSheet
              open={shareSheetOpen}
              onClose={() => setShareSheetOpen(false)}
              shareTitle={shareContext.title}
              shareText={shareContext.text}
              shareUrl={shareContext.url}
              restaurantName={restaurant ? tName(restaurant.name, restaurant.nameAm, restaurant.nameI18n) : ''}
              restaurantImage={restaurant?.logo || restaurant?.banner}
              onShared={(method) => {
                const labels: Record<string, string> = {
                  copy: 'Link copied!',
                  native: 'Shared!',
                  qr_download: 'QR code downloaded!',
                  qr_share: 'QR code shared!',
                }
                const msg = labels[method] || `Shared via ${method}!`
                setShareToast(msg)
              }}
            />

            {/* Cart Drawer */}
            <CartDrawer
              open={isCartOpen}
              onOpenChange={setIsCartOpen}
              cart={cart}
              language={language}
              currency={restaurant.currency}
              taxRate={restaurant.taxRate}
              serviceCharge={restaurant.serviceCharge}
              onUpdateQuantity={updateQuantity}
              onRemoveItem={removeFromCart}
              onPlaceOrder={() => {
                if (currentOrder) {
                  // Adding to existing order — go directly (no payment screen needed)
                  // Don't close drawer yet — addRoundToOrder will close it on success
                  addRoundToOrder()
                } else if (paymentTiming === 'before_order') {
                  // Show payment screen before placing order
                  setIsCartOpen(false)
                  setPaymentStatus('select')
                  setScreen('payment')
                } else {
                  // Default: place order directly, pay after served
                  setIsCartOpen(false)
                  placeOrder()
                }
              }}
              couponCode={couponCode}
              onCouponCodeChange={setCouponCode}
              appliedPromotion={appliedPromotion}
              discount={discount}
              couponError={couponError}
              onApplyCoupon={applyCoupon}
              onRemoveCoupon={removeCoupon}
              loyaltyPoints={loyaltyPoints}
              useLoyaltyPoints={useLoyaltyPoints}
              loyaltyDiscount={loyaltyDiscount}
              onToggleLoyaltyPoints={toggleLoyaltyPoints}
              packagingFeeCents={packagingFeeCents}
              isAddingToOrder={!!currentOrder}
              isPlacingOrder={isPlacingOrder}
              orderNumber={currentOrder?.orderNumber || ''}
            />
          </div>
        )

      case 'payment':
        return (
          <PaymentScreen
            language={language}
            currency={restaurant.currency}
            taxRate={restaurant.taxRate}
            serviceCharge={restaurant.serviceCharge}
            cart={cart}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            paymentStatus={paymentStatus}
            onPlaceOrder={placeOrder}
            isPlacingOrder={isPlacingOrder}
            discount={discount + loyaltyDiscount}
            loyaltyDiscount={loyaltyDiscount}
            couponDiscount={discount}
            appliedPromotion={appliedPromotion}
            useLoyaltyPoints={useLoyaltyPoints}
            loyaltyPoints={loyaltyPoints}
            pointsEarned={pointsEarned}
            packagingFeeCents={packagingFeeCents}
            starPayEnabled={restaurant.starPayEnabled || false}
            onBack={() => {
              setScreen('menu')
              setShowPayment(false)
              setPaymentStatus('select')
            }}
          />
        )

      case 'order':
        return (
          <div className="flex flex-col h-full bg-background relative overflow-hidden">
            {/* ── Consistent Header ── */}
            <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/50">
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setScreen('menu')}
                    className="w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center shrink-0 active:scale-90 transition-all hover:bg-muted"
                    title={tuiGlobal('menu.back_to_menu', 'Back to Menu')}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="min-w-0">
                    <h1 className="text-base font-bold truncate leading-tight">{tuiGlobal('menu.order_status', 'Order Status')}</h1>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">
                        {orderType === 'dine-in'
                          ? `${tuiGlobal('menu.table', 'Table')} ${table?.number}`
                          : tuiGlobal('menu.takeaway', 'Takeaway')
                        }
                      </span>
                      {/* Real-time indicator */}
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <span className={`w-1.5 h-1.5 rounded-full ${realtimeConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
                        {realtimeConnected ? tuiGlobal('menu.live', 'Live') : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-1">
                  {/* Theme Toggle */}
                  <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 active:scale-90 transition-all"
                    title={theme === 'dark' ? tuiGlobal('menu.light_mode', 'Light Mode') : tuiGlobal('menu.dark_mode', 'Dark Mode')}
                  >
                    <Sun className="w-4 h-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute w-4 h-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  </button>
                  {/* Add More / Browse Menu */}
                  {currentOrder ? (
                    <button
                      onClick={() => setScreen('menu')}
                      className="group relative flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-brand via-brand to-brand-dark text-white text-xs font-bold shadow-lg shadow-brand/30 active:scale-95 transition-all hover:shadow-xl hover:shadow-brand/40 hover:scale-105"
                    >
                      <span className="relative flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/30 opacity-75"></span>
                        <Plus className="relative inline-flex w-4 h-4" />
                      </span>
                      <span>{tuiGlobal('menu.add_more', 'Add More')}</span>
                      {orderRound > 1 && (
                        <span className="text-[9px] bg-white/25 px-2 py-0.5 rounded-full font-semibold">
                          R{orderRound}
                        </span>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => setScreen('menu')}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand text-white text-xs font-bold shadow-sm shadow-brand/25 active:scale-95 transition-all hover:shadow-md hover:shadow-brand/30"
                    >
                      <UtensilsCrossed className="w-3.5 h-3.5" />
                      {tuiGlobal('menu.browse_menu', 'Browse Menu')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
              {!currentOrder ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                    className="w-20 h-20 rounded-2xl bg-brand/10 flex items-center justify-center mb-5"
                  >
                    <UtensilsCrossed className="w-10 h-10 text-brand" />
                  </motion.div>
                  <h2 className="text-lg font-bold mb-2">{tuiGlobal('menu.no_active_order', 'No Active Order')}</h2>
                  <p className="text-sm text-muted-foreground text-center mb-6 max-w-[260px]">
                    {tuiGlobal('menu.place_order_to_track', 'Browse the menu and place your first order to track it here in real time.')}
                  </p>
                  <Button
                    onClick={() => setScreen('menu')}
                    className="bg-brand hover:bg-brand-dark text-white rounded-xl h-12 px-6 font-semibold shadow-lg shadow-brand/25"
                  >
                    <UtensilsCrossed className="w-4 h-4 mr-2" />
                    {tuiGlobal('menu.browse_menu', 'Browse Menu')}
                  </Button>
                </div>
              ) : (
                <>
                  {/* Order Status Card */}
                  <div className="bg-brand/5 rounded-2xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold">
                          {tuiGlobal('menu.order', 'Order')} {currentOrder.orderNumber}
                        </h2>
                        {currentOrder.roundNumber && currentOrder.roundNumber > 1 && (
                          <span className="text-[10px] font-semibold bg-brand/15 text-brand px-2 py-0.5 rounded-full">
                            {tuiGlobal('menu.round', 'Round')} {currentOrder.roundNumber}
                          </span>
                        )}
                      </div>
                      <Badge className="bg-brand text-white capitalize">
                        {currentOrder.status}
                      </Badge>
                    </div>
                    {currentOrder.estimatedReadyAt && currentOrder.status !== 'served' && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {tuiGlobal('menu.est_ready_in', 'Est. ready in')} ~{Math.max(1, Math.round((currentOrder.estimatedReadyAt.getTime() - Date.now()) / 60000))} {tuiGlobal('menu.min', 'min')}
                      </div>
                    )}
                  </div>

                  {/* Cancelled Order Notice */}
                  {currentOrder.status === 'cancelled' && (
                    <div className="mb-4 flex flex-col items-center gap-3 py-6">
                      <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <XCircle className="w-7 h-7 text-red-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-base font-semibold text-red-600 dark:text-red-400">
                          {tuiGlobal('menu.order_cancelled', 'Order Cancelled')}
                        </p>
                        {currentOrder.cancellationReason && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {currentOrder.cancellationReason}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => { setCurrentOrder(null); setScreen('menu') }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-sm font-medium active:scale-95 transition-transform"
                        >
                          <UtensilsCrossed className="w-4 h-4" />
                          {tuiGlobal('menu.browse_menu', 'Browse Menu')}
                        </button>
                        <button
                          onClick={() => setScreen('welcome')}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-muted text-sm font-medium active:scale-95 transition-transform"
                        >
                          <Home className="w-4 h-4" />
                          {tuiGlobal('menu.home', 'Home')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Status Steps */}
                  <div className="mb-6">
                    {['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'served'].map((status, i) => {
                      const allStatuses = ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'served']
                      const statusIndex = allStatuses.indexOf(currentOrder.status === 'picked_up' ? 'picked_up' : currentOrder.status === 'served' ? 'served' : currentOrder.status)
                      const isActive = i <= statusIndex
                      const statusLabels: Record<string, { en: string }> = {
                        pending: { en: 'Pending' },
                        accepted: { en: 'Confirmed' },
                        preparing: { en: 'Preparing' },
                        ready: { en: 'Ready for Pickup' },
                        picked_up: { en: 'On Its Way!' },
                        served: { en: 'Served' },
                      }
                      // Skip 'accepted' in display if not needed — show 5 steps
                      // Only show picked_up if status is picked_up or later
                      if (status === 'picked_up' && !['picked_up', 'served', 'completed'].includes(currentOrder.status)) {
                        return null
                      }
                      // Hide 'accepted' step — merge with pending
                      if (status === 'accepted') return null
                      return (
                        <div key={status} className="flex items-start gap-3 mb-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            isActive ? 'bg-brand text-white' : 'bg-muted text-muted-foreground'
                          }`}>
                            {isActive ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-xs">{i + 1}</span>}
                          </div>
                          <div className="pt-1">
                            <p className={`text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {tuiGlobal(`menu.status_${status}`, statusLabels[status].en)}
                            </p>
                            {status === 'picked_up' && isActive && (
                              <p className="text-xs text-brand font-medium mt-0.5">
                                Your waiter is bringing your food!
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Order Items */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm">{tuiGlobal('menu.items', 'Items')}</h3>
                    {currentOrder.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
                        <div>
                          <p className="text-sm font-medium">{tName(item.name, item.nameAm, null)}</p>
                          <p className="text-xs text-muted-foreground">x{item.quantity}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-brand">{formatPrice(item.priceCents, restaurant.currency)}</p>
                          {item.kitchenStatus !== 'pending' && (
                            <Badge variant="outline" className="text-[10px] capitalize">{item.kitchenStatus}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ── Payment Section ──
                    Show when:
                    - after_served mode: order status is served/ready (customer eats first, pays after)
                    - before_order mode: always (customer must pay before kitchen receives order)
                    In both modes, if orderAlreadyPaid is true, shows "Payment Complete" instead.
                    Multi-round: if customer paid round 1 then added round 2, orderAlreadyPaid
                    becomes false (total paid < new total), so payment section shows again.
                  */}
                  {currentOrder.status !== 'cancelled' && (
                    paymentTiming === 'after_served'
                      ? currentOrder.status === 'served' || currentOrder.status === 'ready'
                      : true
                  ) && (
                    <div className="mb-4">
                      {orderAlreadyPaid ? (
                        /* Fully paid — show confirmation */
                        <div className="flex flex-col items-center gap-2 py-4">
                          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          </div>
                          <p className="text-sm font-medium text-green-700">
                            {tuiGlobal('menu.already_paid', 'Payment Complete')}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {tuiGlobal('menu.already_paid_note', 'This order has been paid. Thank you!')}
                          </p>
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => setScreen('menu')}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-sm font-medium active:scale-95 transition-transform"
                            >
                              <UtensilsCrossed className="w-4 h-4" />
                              {tuiGlobal('menu.browse_menu', 'Browse Menu')}
                            </button>
                            <button
                              onClick={() => setScreen('welcome')}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-muted text-sm font-medium active:scale-95 transition-transform"
                            >
                              <Home className="w-4 h-4" />
                              {tuiGlobal('menu.home', 'Home')}
                            </button>
                          </div>
                        </div>
                      ) : hasPendingCashPayment ? (
                        /* Pending cash payment — waiting for staff confirmation */
                        <div className="flex flex-col items-center gap-2 py-4">
                          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-amber-600 animate-pulse" />
                          </div>
                          <p className="text-sm font-medium text-amber-700">
                            {tuiGlobal('menu.cash_pending_title', 'Cash Payment Recorded')}
                          </p>
                          <p className="text-[11px] text-muted-foreground text-center px-4">
                            {tuiGlobal('menu.cash_pending_note', 'Please pay at the counter. Staff will confirm your payment shortly.')}
                          </p>
                          {remainingBalanceCents > 0 && (
                            <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium mt-1">
                              {tuiGlobal('menu.amount_due', 'Amount due')}: {formatPrice(remainingBalanceCents, restaurant.currency)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <>
                          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                            {tuiGlobal('menu.payment_method', 'Payment Method')}
                          </h3>
                          {/* Show remaining balance if there's a partial payment (multi-round) */}
                          {remainingBalanceCents > 0 && remainingBalanceCents < (currentOrder.totalAmountCents || 0) && (
                            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2 mb-3 text-center">
                              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                                Remaining balance: <span className="font-bold">{formatPrice(remainingBalanceCents, restaurant.currency)}</span>
                                {' '}of <span className="font-medium">{formatPrice(currentOrder.totalAmountCents || 0, restaurant.currency)}</span>
                              </p>
                            </div>
                          )}
                          <div className="grid grid-cols-4 gap-2 mb-3">
                            {[
                              { id: 'cash' as const, icon: '💵', label: tuiGlobal('menu.cash', 'Cash'), alwaysShow: true },
                              { id: 'starpay' as const, icon: '⭐', label: 'StarPay', alwaysShow: false },
                              { id: 'telebirr' as const, icon: '📱', label: 'Telebirr', alwaysShow: true },
                              { id: 'chapa' as const, icon: '💳', label: 'Chapa', alwaysShow: true },
                              { id: 'cbe_birr' as const, icon: '🏦', label: 'CBE Birr', alwaysShow: true },
                            ].filter(m => {
      const pm = restaurant?.settings ? (typeof restaurant.settings === 'string' ? JSON.parse(restaurant.settings) : restaurant.settings)?.paymentMethods : null
      if (m.id === 'starpay') return !!restaurant?.starPayEnabled
      if (m.id === 'cash') return !pm || pm.cash !== false
      if (m.id === 'telebirr') return !pm || pm.telebirr !== false
      if (m.id === 'chapa') return !pm || pm.chapa !== false
      if (m.id === 'cbe_birr') return !pm || pm.cbeBirr !== false
      return false
    }).map(m => (
                              <button
                                key={m.id}
                                onClick={() => setPaymentMethod(m.id)}
                                className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-xs font-medium transition-all active:scale-95 ${
                                  paymentMethod === m.id
                                    ? 'bg-brand text-white shadow-sm shadow-brand/25'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                              >
                                <span className="text-lg">{m.icon}</span>
                                <span className="text-[10px] leading-tight">{m.label}</span>
                              </button>
                            ))}
                          </div>
                          <Button
                            onClick={async () => {
                              if (!restaurant || !sessionToken || !currentOrder) return
                              setPaymentStatus('processing')
                              try {
                                const res = await fetch(`/api/restaurants/${restaurant.id}/payments`, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${sessionToken}`,
                                  },
                                  body: JSON.stringify({
                                    orderId: currentOrder.id,
                                    method: paymentMethod,
                                    tipAmount: 0,
                                  }),
                                })
                                if (res.ok) {
                                  const data = await res.json()
                                  const paymentData = data.data || data
                                  if (paymentData.checkoutUrl && !paymentData.checkoutUrl.includes('mock.')) {
                                    window.open(paymentData.checkoutUrl, '_blank')
                                  }
                                  // For cash: payment is created as 'pending' — staff must confirm.
                                  // Do NOT mark as already paid; show "waiting for confirmation" state.
                                  if (paymentMethod === 'cash') {
                                    setPaymentStatus('success')
                                    setScreen('order')
                                    toast.success(tuiGlobal('menu.cash_pending', 'Cash payment recorded! Please pay at the counter. Staff will confirm receipt.'))
                                  } else {
                                    // Digital payments: optimistically show success (verification happens via polling/webhook)
                                    setPaymentStatus('success')
                                    setScreen('order')
                                    toast.success(tuiGlobal('menu.payment_recorded', 'Payment recorded! Thank you.'))
                                  }
                                } else {
                                  const errData = await res.json().catch(() => ({}))
                                  if (errData.error?.includes('already been fully paid') || errData.error?.includes('already has a completed payment')) {
                                    setOrderAlreadyPaid(true)
                                    toast.info(tuiGlobal('menu.already_paid', 'This order is already paid'))
                                  } else {
                                    toast.error(errData.error || tuiGlobal('menu.payment_failed', 'Payment failed. Please try again.'))
                                    setPaymentStatus('failed')
                                  }
                                }
                              } catch (e) {
                                console.error('[PAYMENT_FROM_ORDER]', e)
                                toast.error(tuiGlobal('menu.payment_error', 'Network error. Please try again.'))
                                setPaymentStatus('failed')
                              }
                            }}
                            disabled={paymentStatus === 'processing'}
                            className="w-full h-12 bg-brand hover:bg-brand-dark text-white rounded-xl font-semibold shadow-lg shadow-brand/25 disabled:opacity-50"
                          >
                            <CreditCard className="w-4 h-4 mr-2" />
                            {paymentStatus === 'processing'
                              ? tuiGlobal('menu.processing', 'Processing...')
                              : paymentMethod === 'cash'
                                ? tuiGlobal('menu.confirm_cash', 'Confirm Cash Payment')
                                : tuiGlobal('menu.pay_now', 'Pay Now')
                            }
                          </Button>
                          <p className="text-[10px] text-muted-foreground text-center mt-1">
                            {paymentTiming === 'after_served'
                              ? paymentMethod === 'cash'
                                ? tuiGlobal('menu.cash_after_served_note', 'Confirm to let staff know — pay at the counter when ready')
                                : tuiGlobal('menu.pay_after_served_note', 'Pay online now, or settle at the counter')
                              : paymentMethod === 'cash'
                                ? tuiGlobal('menu.cash_note', 'Cash payment — pay at counter')
                                : tuiGlobal('menu.digital_note', `${paymentMethod} payment`)
                            }
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Feature 4: While You Wait Entertainment Hub ── */}
                  <EntertainmentHub
                    entertainmentTab={entertainmentTab}
                    onTabChange={setEntertainmentTab}
                    estimatedMinutes={currentOrder.estimatedReadyAt ? Math.max(1, Math.round((currentOrder.estimatedReadyAt.getTime() - Date.now()) / 60000)) : 20}
                    restaurantId={restaurant?.id || ''}
                    sessionToken={sessionToken}
                    playerName={playerName}
                    entertainmentSettings={entertainmentSettings}
                    factsList={factsList}
                    storiesList={storiesList}
                    readsList={readsList}
                    scrambleWords={scrambleWords}
                    triviaQuestions={triviaQuestions}
                    // Trivia
                    triviaIndex={triviaIndex}
                    triviaScore={triviaScore}
                    triviaAnswered={triviaAnswered}
                    triviaSelected={triviaSelected}
                    onTriviaAnswer={(idx) => { setTriviaAnswered(true); setTriviaSelected(idx); if (idx === triviaQuestions[triviaIndex].correct) setTriviaScore((s) => s + 1) }}
                    onTriviaNext={() => { if (triviaIndex < triviaQuestions.length - 1) { setTriviaIndex((i) => i + 1); setTriviaAnswered(false); setTriviaSelected(null) } }}
                    // Word Scramble
                    scrambleWordIndex={scrambleWordIndex}
                    scrambleSelected={scrambleSelected}
                    scrambleAttempts={scrambleAttempts}
                    scrambleResult={scrambleResult}
                    onScrambleChipTap={(chipIdx) => {
                      if (scrambleResult) return
                      if (scrambleSelected.includes(chipIdx)) return
                      const next = [...scrambleSelected, chipIdx]
                      setScrambleSelected(next)
                      const word = scrambleWords[scrambleWordIndex]
                      const letters = scrambleLetters(word)
                      const spelled = next.map((i) => letters[i]).join('')
                      if (spelled.length === word.replace(/ /g, '').length) {
                        if (spelled === word.replace(/ /g, '')) {
                          setScrambleResult('correct')
                        } else {
                          const newAttempts = scrambleAttempts + 1
                          setScrambleAttempts(newAttempts)
                          if (newAttempts >= 3) {
                            setScrambleResult('wrong')
                          } else {
                            setTimeout(() => setScrambleSelected([]), 600)
                          }
                        }
                      }
                    }}
                    onScrambleClear={() => { setScrambleSelected([]); setScrambleResult(null) }}
                    onScrambleSkip={() => {
                      if (scrambleWordIndex < scrambleWords.length - 1) {
                        setScrambleWordIndex((i) => i + 1)
                        setScrambleSelected([])
                        setScrambleAttempts(0)
                        setScrambleResult(null)
                      }
                    }}
                    // Tic Tac Toe
                    tttBoard={tttBoard}
                    tttIsPlayerTurn={tttIsPlayerTurn}
                    tttScore={tttScore}
                    tttGameOver={tttGameOver}
                    tttWinner={tttWinner}
                    onTttCellClick={(cellIdx) => {
                      if (tttBoard[cellIdx] || tttGameOver || !tttIsPlayerTurn) return
                      const newBoard = [...tttBoard]
                      newBoard[cellIdx] = 'X'
                      const winner = checkTttWinner(newBoard)
                      if (winner) {
                        setTttBoard(newBoard)
                        setTttGameOver(true)
                        setTttWinner(winner)
                        if (winner === 'X') setTttScore((s) => ({ ...s, player: s.player + 1 }))
                        else setTttScore((s) => ({ ...s, ai: s.ai + 1 }))
                        return
                      }
                      if (newBoard.every((c) => c !== null)) {
                        setTttBoard(newBoard)
                        setTttGameOver(true)
                        setTttWinner('draw')
                        return
                      }
                      setTttBoard(newBoard)
                      setTttIsPlayerTurn(false)
                      // AI move after a short delay
                      setTimeout(() => {
                        const available = newBoard.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0)
                        if (available.length > 0) {
                          const aiMove = available[Math.floor(Math.random() * available.length)]
                          newBoard[aiMove] = 'O'
                          const aiWinner = checkTttWinner(newBoard)
                          if (aiWinner) {
                            setTttBoard([...newBoard])
                            setTttGameOver(true)
                            setTttWinner(aiWinner)
                            setTttScore((s) => ({ ...s, ai: s.ai + 1 }))
                            return
                          }
                          if (newBoard.every((c) => c !== null)) {
                            setTttBoard([...newBoard])
                            setTttGameOver(true)
                            setTttWinner('draw')
                            return
                          }
                          setTttBoard([...newBoard])
                          setTttIsPlayerTurn(true)
                        }
                      }, 400)
                    }}
                    onTttRestart={() => {
                      setTttBoard(Array(9).fill(null))
                      setTttIsPlayerTurn(true)
                      setTttGameOver(false)
                      setTttWinner(null)
                    }}
                    // Reads
                    expandedRead={expandedRead}
                    onExpandRead={setExpandedRead}
                  />

                  {/* Review Section */}
                  <AnimatePresence>
                    {showReview && (
                      <ReviewSection
                        language={language}
                        rating={reviewRating}
                        onRatingChange={setReviewRating}
                        comment={reviewComment}
                        onCommentChange={setReviewComment}
                        submitted={reviewSubmitted}
                        onSubmit={submitReview}
                        onSkip={() => { setShowReview(false); setReviewSubmitted(true) }}
                      />
                    )}
                  </AnimatePresence>

                  {/* Cancel Order Button — only for pending/accepted orders (before kitchen starts preparing) */}
                  {(currentOrder.status === 'pending' || currentOrder.status === 'accepted') && (
                    <div className="mt-6 pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-3 text-center">
                        {currentOrder.status === 'accepted'
                          ? tuiGlobal('menu.cancel_before_kitchen', 'You can still cancel — the kitchen hasn\'t started yet')
                          : tuiGlobal('menu.cancel_pending_note', 'Cancel before the restaurant accepts your order')
                        }
                      </p>
                      <button
                        onClick={async () => {
                          if (!restaurant || !sessionToken || !currentOrder) return
                          if (!confirm(tuiGlobal('menu.confirm_cancel', 'Are you sure you want to cancel this order?'))) return
                          try {
                            const res = await fetch(`/api/restaurants/${restaurant.id}/orders/${currentOrder.id}`, {
                              method: 'PUT',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${sessionToken}`,
                              },
                              body: JSON.stringify({
                                status: 'cancelled',
                                cancellationReason: 'Cancelled by customer',
                              }),
                            })
                            if (res.ok) {
                              setCurrentOrder((prev) => prev ? { ...prev, status: 'cancelled', cancellationReason: 'Cancelled by customer' } : prev)
                              toast.success(tuiGlobal('menu.order_cancelled_toast', 'Order cancelled successfully'))
                            } else {
                              const data = await res.json().catch(() => ({}))
                              toast.error(data.error || 'Failed to cancel order')
                            }
                          } catch {
                            toast.error('Network error. Please try again.')
                          }
                        }}
                        className="w-full py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors active:scale-[0.98]"
                      >
                        {tuiGlobal('menu.cancel_order', 'Cancel Order')}
                      </button>
                    </div>
                  )}

                  {/* Info: order is in the kitchen — cannot cancel from here */}
                  {['preparing', 'ready', 'picked_up'].includes(currentOrder.status) && !currentOrder.cancellationReason && (
                    <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                      <p className="text-xs text-amber-700 dark:text-amber-400 text-center">
                        {tuiGlobal('menu.cannot_cancel_kitchen', 'Your order is being prepared — cancellation is no longer available from here. Please contact the restaurant if needed.')}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Floating Enhanced Waiter Sheet on Order Screen - Hidden for takeaway */}
            {orderType === 'dine-in' && (
              <EnhancedWaiterSheet
                isOpen={isWaiterCallOpen}
                onToggle={() => setIsWaiterCallOpen(!isWaiterCallOpen)}
                onCall={callWaiter}
                customMessage={waiterCustomMessage}
                onCustomMessageChange={setWaiterCustomMessage}
                cooldown={waiterCooldown}
                toast={waiterToast}
                waiter={waiter}
              />
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div
      dir={textDirection}
      className="relative h-[100dvh] overflow-hidden"
      style={customFontCSS ? { fontFamily: customFontCSS.replace(/font-family:\s*/, '').replace(/;\s*$/, '') } : undefined}
    >

      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="h-full"
        >
          {renderScreen()}
        </motion.div>
      </AnimatePresence>

      {/* ── Restaurant Switch Confirmation Dialog ── */}
      <AnimatePresence>
        {showRestaurantSwitchDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center px-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-xl border border-border"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-bold text-base">
                    {tuiGlobal('menu.switch_restaurant_title', 'Switch Restaurant?')}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {tuiGlobal('menu.switch_restaurant_desc', 'Your current session will be ended.')}
                  </p>
                </div>
              </div>

              <div className="bg-muted rounded-xl p-3 mb-4 space-y-1.5">
                {cart.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <ShoppingCart className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{cart.length} {tuiGlobal('menu.items_in_cart', 'items in cart')}</span>
                    <span className="ml-auto font-semibold text-brand">{formatPrice(getCartTotal(), restaurant?.currency || 'ETB')}</span>
                  </div>
                )}
                {currentOrder && (
                  <div className="flex items-center gap-2 text-sm">
                    <ClipboardList className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{tuiGlobal('menu.active_order', 'Active order')} {currentOrder.orderNumber}</span>
                    <Badge className="ml-auto capitalize text-[10px]" variant="outline">{currentOrder.status}</Badge>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground mb-4">
                {tuiGlobal('menu.switch_warning', 'Your cart and order tracking for this restaurant will be cleared. This cannot be undone.')}
              </p>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-11 rounded-xl font-semibold"
                  onClick={() => {
                    setShowRestaurantSwitchDialog(false)
                    setPendingQRPayload(null)
                    setPendingSignature(null)
                  }}
                >
                  {tuiGlobal('menu.stay_here', 'Stay Here')}
                </Button>
                <Button
                  className="flex-1 h-11 rounded-xl font-semibold bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={async () => {
                    setShowRestaurantSwitchDialog(false)
                    setLoading(true)
                    if (pendingQRPayload && pendingSignature) {
                      await performRestaurantSwitch(pendingQRPayload, pendingSignature)
                    }
                    setPendingQRPayload(null)
                    setPendingSignature(null)
                  }}
                >
                  {tuiGlobal('menu.switch_anyway', 'Switch')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reservation Drawer — accessible from all screens */}
      <ReservationWidget
        open={isReservationOpen}
        onOpenChange={setIsReservationOpen}
        restaurantId={restaurant?.id || ''}
        branchId={branch?.id || ''}
        sessionToken={sessionToken}
        restaurantName={restaurant ? tName(restaurant.name, restaurant.nameAm, restaurant.nameI18n) : ''}
        t={tuiGlobal}
      />

      {/* My Reservations Drawer — accessible from all screens */}
      <MyReservations
        open={isMyReservationsOpen}
        onOpenChange={setIsMyReservationsOpen}
        restaurantId={restaurant?.id || ''}
        sessionToken={sessionToken}
        t={tuiGlobal}
      />

      {/* Customer Profile + Rewards Drawer */}
      <CustomerProfileDrawer
        restaurantId={restaurant?.id || ''}
        sessionToken={sessionToken}
        isOpen={isProfileOpen}
        onOpenChange={setIsProfileOpen}
        onIdentified={(name) => setPlayerName(name)}
      />
    </div>
  )
}

// ─── Payment Screen Component ─────────────────────────────────
function PaymentScreen({
  language,
  currency,
  taxRate,
  serviceCharge,
  cart,
  paymentMethod,
  onPaymentMethodChange,
  paymentStatus,
  onPlaceOrder,
  isPlacingOrder,
  onBack,
  discount = 0,
  loyaltyDiscount = 0,
  couponDiscount = 0,
  appliedPromotion = null,
  useLoyaltyPoints = false,
  loyaltyPoints = 0,
  pointsEarned = 0,
  packagingFeeCents = 0,
  starPayEnabled = false,
}: {
  language: Language
  currency: string
  taxRate: number
  serviceCharge: number
  cart: CartItem[]
  paymentMethod: 'cash' | 'telebirr' | 'chapa' | 'cbe_birr' | 'starpay'
  onPaymentMethodChange: (method: 'cash' | 'telebirr' | 'chapa' | 'cbe_birr' | 'starpay') => void
  paymentStatus: 'select' | 'processing' | 'success' | 'failed' | 'timeout'
  onPlaceOrder: () => void
  isPlacingOrder: boolean
  onBack: () => void
  discount?: number
  loyaltyDiscount?: number
  couponDiscount?: number
  appliedPromotion?: any
  useLoyaltyPoints?: boolean
  loyaltyPoints?: number
  pointsEarned?: number
  packagingFeeCents?: number
  starPayEnabled?: boolean
}) {
  const rawSubtotal = cart.reduce((sum, ci) => sum + ci.totalPriceCents * ci.quantity, 0)
  const totalDiscount = discount
  const subtotal = Math.max(0, rawSubtotal - totalDiscount)
  const tax = Math.round(subtotal * (taxRate || 0.15))
  const service = Math.round(subtotal * (serviceCharge || 0))
  const total = subtotal + tax + service + packagingFeeCents

  const paymentMethods = [
    { id: 'cash' as const, icon: '💵', label: tuiGlobal('menu.cash', 'Cash'), sublabel: tuiGlobal('menu.pay_at_counter', 'Pay at counter'), Icon: Banknote, alwaysShow: true },
    { id: 'starpay' as const, icon: '⭐', label: 'StarPay', sublabel: tuiGlobal('menu.online_payment', 'Online payment'), Icon: Wallet, alwaysShow: false },
    { id: 'telebirr' as const, icon: '📱', label: 'Telebirr', sublabel: tuiGlobal('menu.mobile_payment', 'Mobile payment'), Icon: Smartphone, alwaysShow: true },
    { id: 'chapa' as const, icon: '💳', label: 'Chapa', sublabel: tuiGlobal('menu.online_payment', 'Online payment'), Icon: CreditCard, alwaysShow: true },
    { id: 'cbe_birr' as const, icon: '🏦', label: 'CBE Birr', sublabel: tuiGlobal('menu.bank_transfer', 'Bank transfer'), Icon: Landmark, alwaysShow: true },
  ].filter(m => m.alwaysShow || (m.id === 'starpay' && starPayEnabled))

  // ── Processing state ──
  if (paymentStatus === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-full bg-background px-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="w-20 h-20 rounded-2xl bg-brand/10 flex items-center justify-center mb-6"
        >
          <Loader2 className="w-10 h-10 text-brand animate-spin" />
        </motion.div>
        <h2 className="text-xl font-bold mb-2">{tuiGlobal('menu.processing_payment', 'Processing Payment...')}</h2>
        <p className="text-sm text-muted-foreground text-center">
          {tuiGlobal('menu.redirecting_payment', 'Redirecting to payment provider...')}
        </p>
      </div>
    )
  }

  // ── Success state ──
  if (paymentStatus === 'success') {
    return (
      <div className="flex flex-col items-center justify-center min-h-full bg-background px-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="w-20 h-20 rounded-2xl bg-brand flex items-center justify-center mb-6 shadow-lg shadow-brand/30"
        >
          <CheckCircle2 className="w-10 h-10 text-white" />
        </motion.div>
        <h2 className="text-xl font-bold mb-2">{tuiGlobal('menu.order_placed', 'Order Placed!')}</h2>
        {pointsEarned > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-xl mb-3"
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-semibold">
              {tuiGlobal('menu.earned_points', `You earned ${pointsEarned} points!`)}
            </span>
          </motion.div>
        )}
        {paymentMethod === 'cash' ? (
          <p className="text-sm text-muted-foreground text-center mb-4">
            {tuiGlobal('menu.pay_at_counter_ready', 'Please pay at the counter when your order is ready.')}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground text-center mb-4">
            {tuiGlobal('menu.payment_processing_msg', "Your payment is being processed. You'll be notified once confirmed.")}
          </p>
        )}
      </div>
    )
  }

  // ── Failed state ──
  if (paymentStatus === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center min-h-full bg-background px-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="w-20 h-20 rounded-2xl bg-red-100 flex items-center justify-center mb-6"
        >
          <AlertCircle className="w-10 h-10 text-red-500" />
        </motion.div>
        <h2 className="text-xl font-bold mb-2">{tuiGlobal('menu.payment_failed', 'Payment Failed')}</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          {tuiGlobal('menu.payment_failed_msg', 'Your order was placed but payment could not be processed. Please try again or pay at the counter.')}
        </p>
        <Button onClick={onBack} className="bg-brand hover:bg-brand-dark text-white rounded-xl">
          {tuiGlobal('menu.back_to_menu', 'Back to Menu')}
        </Button>
      </div>
    )
  }

  // ── Timeout state ──
  if (paymentStatus === 'timeout') {
    return (
      <div className="flex flex-col items-center justify-center min-h-full bg-background px-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="w-20 h-20 rounded-2xl bg-amber-100 flex items-center justify-center mb-6"
        >
          <Clock className="w-10 h-10 text-amber-500" />
        </motion.div>
        <h2 className="text-xl font-bold mb-2">Payment Verification Timed Out</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Your payment may still be processing. Please check your payment app or contact staff for confirmation.
        </p>
        <Button onClick={onBack} className="bg-brand hover:bg-brand-dark text-white rounded-xl">
          {tuiGlobal('menu.back_to_menu', 'Back to Menu')}
        </Button>
      </div>
    )
  }

  // ── Select payment method state ──
  return (
    <div className="flex flex-col min-h-full bg-background relative overflow-hidden">
      {/* Header — consistent style */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 pt-3 pb-2 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center active:scale-90 transition-all hover:bg-muted"
        >
          <X className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-base font-bold">{tuiGlobal('menu.payment', 'Payment')}</h1>
          <p className="text-[11px] text-muted-foreground">{tuiGlobal('menu.choose_how_to_pay', 'Choose how to pay')}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-32">
        {/* Order Summary */}
        <div className="bg-card border border-border rounded-2xl p-4 mb-6">
          <h3 className="font-semibold text-sm mb-3">{tuiGlobal('menu.order_summary', 'Order Summary')}</h3>
          {cart.map((ci, index) => (
            <div key={`${ci.menuItem.id}-${index}`} className="flex items-center gap-2 text-sm py-1">
              {ci.menuItem.image && (
                <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
                  <img src={ci.menuItem.image} alt={tName(ci.menuItem.name, ci.menuItem.nameAm, ci.menuItem.nameI18n)} className="w-full h-full object-cover" />
                </div>
              )}
              <span className="text-muted-foreground flex-1 truncate">
                {tName(ci.menuItem.name, ci.menuItem.nameAm, ci.menuItem.nameI18n)} x{ci.quantity}
              </span>
              <span className="shrink-0">{formatPrice(ci.totalPriceCents * ci.quantity, currency)}</span>
            </div>
          ))}
          <Separator className="my-3" />
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">{tuiGlobal('menu.subtotal', 'Subtotal')}</span>
            <span>{formatPrice(rawSubtotal, currency)}</span>
          </div>
          {totalDiscount > 0 && (
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {tuiGlobal('menu.discount', 'Discount')}
              </span>
              <span className="text-brand">-{formatPrice(totalDiscount, currency)}</span>
            </div>
          )}
          {couponDiscount > 0 && appliedPromotion && (
            <div className="flex justify-between text-xs mb-1 text-muted-foreground">
              <span>{tuiGlobal('menu.coupon', 'Coupon')}: {appliedPromotion.name}</span>
              <span>-{formatPrice(couponDiscount, currency)}</span>
            </div>
          )}
          {useLoyaltyPoints && loyaltyDiscount > 0 && (
            <div className="flex justify-between text-xs mb-1 text-muted-foreground">
              <span className="flex items-center gap-1"><Gift className="w-3 h-3" />{tuiGlobal('menu.loyalty_points', 'Loyalty Points')} ({Math.floor(loyaltyDiscount / 5)} pts)</span>
              <span>-{formatPrice(loyaltyDiscount, currency)}</span>
            </div>
          )}
          {packagingFeeCents > 0 && (
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">{tuiGlobal('menu.packaging_takeaway', 'Packaging (takeaway)')}</span>
              <span>{formatPrice(packagingFeeCents, currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">{tuiGlobal('menu.tax', 'Tax')} ({Math.round((taxRate || 0.15) * 100)}%)</span>
            <span>{formatPrice(tax, currency)}</span>
          </div>
          {service > 0 && (
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">{tuiGlobal('menu.service', 'Service')} ({Math.round(serviceCharge * 100)}%)</span>
              <span>{formatPrice(service, currency)}</span>
            </div>
          )}
          <Separator className="my-2" />
          <div className="flex justify-between font-bold text-base">
            <span>{tuiGlobal('menu.total', 'Total')}</span>
            <span className="text-brand">{formatPrice(total, currency)}</span>
          </div>
        </div>

        {/* Payment Method Selection */}
        <h3 className="font-semibold text-sm mb-3">{tuiGlobal('menu.payment_method', 'Payment Method')}</h3>
        <div className="grid gap-3">
          {paymentMethods.map((method) => {
            const isSelected = paymentMethod === method.id
            return (
              <motion.button
                key={method.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => onPaymentMethodChange(method.id)}
                className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                  isSelected
                    ? 'border-brand bg-brand/5 shadow-sm'
                    : 'border-border bg-card hover:border-brand/30'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-2xl shrink-0">
                  {method.icon}
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{method.label}</span>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-brand" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{method.sublabel}</p>
                </div>
                <method.Icon className={`w-5 h-5 ${isSelected ? 'text-brand' : 'text-muted-foreground'}`} />
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Sticky Pay Button */}
      <div className="absolute bottom-0 left-0 right-0 z-30 p-4 bg-background border-t border-border">
        <Button
          onClick={onPlaceOrder}
          disabled={isPlacingOrder}
          className="w-full h-14 rounded-2xl bg-brand hover:bg-brand-dark text-white font-semibold text-base shadow-lg shadow-brand/25"
        >
          {isPlacingOrder ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              {tuiGlobal('menu.placing_order', 'Placing Order...')}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              {paymentMethod === 'cash' ? <Banknote className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
              {paymentMethod === 'cash'
                ? `${tuiGlobal('menu.place_order', 'Place Order')} • ${formatPrice(total, currency)}`
                : `${tuiGlobal('menu.pay_now', 'Pay Now')} • ${formatPrice(total, currency)}`
              }
            </span>
          )}
        </Button>
      </div>
    </div>
  )
}

// ─── Feature 5: Enhanced Waiter Call Sheet ──────────────────────
function EnhancedWaiterSheet({
  isOpen,
  onToggle,
  onCall,
  customMessage,
  onCustomMessageChange,
  cooldown,
  toast: toastMsg,
  waiter,
}: {
  isOpen: boolean
  onToggle: () => void
  onCall: (requestType: string, message?: string) => void
  customMessage: string
  onCustomMessageChange: (msg: string) => void
  cooldown: number
  toast: string | null
  waiter: WaiterInfo | null
}) {
  const [showCustomInput, setShowCustomInput] = useState(false)

  const options = [
    { type: 'call_waiter', emoji: '👋', label: 'Call a waiter' },
    { type: 'request_bill', emoji: '📋', label: 'Request the bill' },
    { type: 'request_menu', emoji: '📖', label: 'Request the menu' },
    { type: 'custom', emoji: '✏️', label: 'Custom message' },
  ]

  const handleSelect = (type: string) => {
    if (cooldown > 0) return
    if (type === 'custom') {
      setShowCustomInput(true)
    } else {
      onCall(type)
    }
  }

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={onToggle}
        className="absolute bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-brand text-white flex items-center justify-center shadow-xl shadow-brand/30 active:scale-95 transition-transform"
        whileTap={{ scale: 0.9 }}
        initial={{ scale: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, delay: 0.5 }}
        style={cooldown > 0 ? { animation: 'none' } : undefined}
      >
        {cooldown > 0 ? (
          <span className="text-sm font-bold">{cooldown}</span>
        ) : (
          <Bell className={`w-6 h-6 ${isOpen ? '' : 'animate-pulse'}`} />
        )}
      </motion.button>

      {/* Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-36 left-4 right-4 z-50 bg-card border border-brand/30 text-sm font-medium text-center px-4 py-3 rounded-2xl shadow-lg"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Sheet */}
      <Drawer open={isOpen} onOpenChange={(open) => { if (!open) { onToggle(); setShowCustomInput(false) } }}>
        <DrawerContent className="max-h-[70vh]">
          <DrawerHeader className="border-b border-border">
            <DrawerTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-brand" />
              {tuiGlobal('menu.call_waiter', 'Call Waiter')}
            </DrawerTitle>
            <DrawerDescription>
              {cooldown > 0
                ? `Please wait ${cooldown}s before next request`
                : tuiGlobal('menu.how_can_we_help', 'How can we help you?')
              }
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 py-4">
            {/* Assigned waiter info */}
            {waiter && (
              <div className="flex items-center gap-3 p-3 mb-4 rounded-xl bg-brand/5 border border-brand/10">
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand">
                  <Users className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{waiter.name}</p>
                  <p className="text-[11px] text-muted-foreground">{tuiGlobal('menu.your_waiter', 'Your waiter')}</p>
                </div>
                {waiter.phone && (
                  <a
                    href={`tel:${waiter.phone}`}
                    className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-700 active:scale-95 transition-transform"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}
            {showCustomInput ? (
              <div className="space-y-4">
                <Textarea
                  placeholder="Type your message..."
                  value={customMessage}
                  onChange={(e) => onCustomMessageChange(e.target.value)}
                  className="min-h-[100px] rounded-xl resize-none"
                  autoFocus
                />
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowCustomInput(false)}
                    className="flex-1 rounded-xl"
                  >
                    {tuiGlobal('menu.back', 'Back')}
                  </Button>
                  <Button
                    onClick={() => onCall('custom', customMessage)}
                    disabled={!customMessage.trim() || cooldown > 0}
                    className="flex-1 rounded-xl bg-brand hover:bg-brand-dark text-white"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {tuiGlobal('menu.send', 'Send')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {options.map((opt) => (
                  <motion.button
                    key={opt.type}
                    whileTap={cooldown <= 0 ? { scale: 0.95 } : undefined}
                    onClick={() => handleSelect(opt.type)}
                    disabled={cooldown > 0}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
                      cooldown > 0
                        ? 'bg-muted/50 border-border opacity-50 cursor-not-allowed'
                        : 'bg-card border-border hover:border-brand/30 hover:shadow-sm active:scale-[0.98]'
                    }`}
                  >
                    <span className="text-3xl">{opt.emoji}</span>
                    <span className="font-medium text-xs text-center leading-tight">{opt.label}</span>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}

// ─── Feature 4: Hardcoded Entertainment Data ──────────────────
const FALLBACK_TRIVIA = [
  { q: "What is the staple flatbread of Ethiopian cuisine?", opts: ["Injera", "Naan", "Pita", "Roti"], correct: 0, explain: "Injera is a sourdough flatbread made from teff flour, unique to Ethiopia and Eritrea." },
  { q: "What grain is traditionally used to make injera?", opts: ["Wheat", "Rice", "Teff", "Corn"], correct: 2, explain: "Teff is an ancient grain native to Ethiopia, packed with iron and protein." },
  { q: "What is the traditional Ethiopian coffee ceremony called?", opts: ["Buna", "Chai", "Kahwa", "Buna Tetu"], correct: 3, explain: "'Buna Tetu' means 'come drink coffee' — the ceremony can last 2-3 hours." },
  { q: "What spice blend is the foundation of most Ethiopian wot (stews)?", opts: ["Garam Masala", "Berbere", "Ras el Hanout", "Baharat"], correct: 1, explain: "Berbere contains up to 20 spices including chili, fenugreek, and cardamom." },
  { q: "What is 'Doro Wot'?", opts: ["Beef stew", "Chicken stew", "Lentil stew", "Fish stew"], correct: 1, explain: "Doro Wot is a spicy chicken stew, considered Ethiopia's national dish." },
  { q: "Which Ethiopian drink is made from honey?", opts: ["Tej", "Tella", "Areke", "Borde"], correct: 0, explain: "Tej is a golden honey wine served in traditional flask-shaped berele glasses." },
  { q: "What does 'Kitfo' refer to?", opts: ["Grilled fish", "Raw minced beef", "Vegetable stew", "Fried bread"], correct: 1, explain: "Kitfo is raw minced beef marinated in mitmita spice and niter kibbeh butter." },
  { q: "What is 'Niter Kibbeh'?", opts: ["Spice paste", "Clarified butter", "Honey sauce", "Chili oil"], correct: 1, explain: "Niter kibbeh is clarified butter infused with onion, garlic, ginger, and sacred basil." },
  { q: "How many languages are spoken in Ethiopia?", opts: ["20+", "50+", "80+", "100+"], correct: 2, explain: "Ethiopia has over 80 languages, making it one of the most linguistically diverse countries." },
  { q: "What is 'Shiro'?", opts: ["Meat stew", "Chickpea flour stew", "Flatbread", "Spiced tea"], correct: 1, explain: "Shiro is a thick stew made from ground chickpea flour, a staple during fasting days." },
]

const FALLBACK_SCRAMBLE = ["INJERA", "DORO WOT", "KITFO", "BERBERE", "TEJ", "SHIRO", "TIBS", "ATMIT", "AWAZE", "GORED"]

const FALLBACK_FACTS = [
  "☕ Ethiopia is the birthplace of coffee. A goat herder named Kaldi discovered it when his goats danced after eating coffee berries around 850 AD.",
  "🌶️ Berbere spice blend can contain up to 20 different spices and takes days to prepare from scratch.",
  "🫓 Injera isn't just food — it's also your plate and your utensil. You tear off pieces to scoop up stews.",
  "🏠 Ethiopian meals are communal. Everyone eats from the same large platter, symbolizing unity and friendship.",
  "☕ The Ethiopian coffee ceremony can last 2-3 hours and is performed 3 times daily in many households.",
  "🌱 Ethiopia has the largest number of vegetarians per capita due to Orthodox Christian fasting traditions.",
  "🍯 Tej, Ethiopian honey wine, has been brewed for over 2,000 years and was the drink of kings.",
  "🍽️ 'Gursha' is the tradition of hand-feeding a loved one a mouthful of food — a sign of love and respect.",
  "🌶️ Mitmita is a hotter spice blend than berbere, made with African bird's eye chili and cardamom.",
  "🐑 Raw meat dishes like kitfo and gored gored have been eaten in Ethiopia for centuries — refrigeration changed nothing.",
  "☕ Ethiopia is the 5th largest coffee producer in the world and the top producer in Africa.",
  "🫓 Teff, the grain used for injera, is gluten-free and rich in iron, calcium, and protein.",
  "🎉 Ethiopian New Year (Enkutatash) falls on September 11 and features special foods like doro wot.",
  "📖 Ethiopia is the only African country never colonized, preserving its food traditions intact for millennia.",
  "🌶️ The Scoville heat of Ethiopian bird's eye chili used in berbere can reach 175,000 SHU.",
  "☕ In Ethiopia, coffee is always served with popcorn or roasted barley — never alone.",
  "🫓 Making injera is a 3-day process: ferment batter, let it bubble, then cook on a large clay plate (mitad).",
  "🎵 Ethiopian dining often includes traditional music and the mesenqo (single-stringed fiddle) or krar (lyre).",
  "🌿 Ethiopia has over 6,000 plant species used in traditional cooking and medicine.",
  "🔥 'Doro Wot' can take 6-8 hours to cook properly — the onions are caramelized for hours without oil.",
]

const FALLBACK_STORIES = [
  {
    title: "The Story of Injera",
    paragraphs: [
      "Injera is more than just bread — it is the foundation of Ethiopian dining. Made from teff, an ancient grain that has been cultivated in the Ethiopian highlands for over 3,000 years, injera is a sourdough flatbread unlike anything else in the world. Its unique spongy texture and slightly sour taste come from a fermentation process that takes several days, during which wild yeasts transform the teff batter into a bubbly, tangy mixture.",
      "The preparation of injera is an art passed down through generations. The batter is poured in a thin circle onto a large clay plate called a mitad, heated over an open fire. As it cooks, tiny bubbles form on the surface, creating the characteristic porous texture that makes injera perfect for soaking up sauces and stews. A single large injera can be over two feet in diameter.",
      "In Ethiopian culture, injera is more than sustenance — it is a symbol of community. Meals are served on a shared platter of injera, with everyone eating from the same dish. The act of tearing off a piece of injera and scooping up food, especially feeding another person (a practice called gursha), represents love, trust, and togetherness."
    ]
  },
  {
    title: "The Coffee Ceremony",
    paragraphs: [
      "The Ethiopian coffee ceremony, known as 'Buna Tetu' ('come drink coffee'), is one of the most important social rituals in Ethiopian culture. It is performed three times a day in many households — morning, noon, and evening — and can last up to three hours. The ceremony is always led by a woman, who roasts green coffee beans over a charcoal stove, filling the room with aromatic smoke that is believed to cleanse the space.",
      "The coffee is served in three rounds, each with its own name and significance. The first round, called 'Abol', is the strongest and most flavorful. The second round, 'Tona', is brewed by adding more water to the same grounds. The third and final round, 'Bereka', which means 'to be blessed', is the weakest but carries the most spiritual significance. Each round is served in small handleless cups called sini, often accompanied by popcorn or roasted barley.",
      "The ceremony is far more than just brewing coffee — it is a time for community, conversation, and connection. Neighbors are invited to share in the ritual, news is exchanged, problems are discussed, and bonds are strengthened. The smell of roasting beans and burning incense (usually frankincense) marks the beginning of this sacred daily tradition that has been practiced for over a thousand years."
    ]
  },
  {
    title: "Berbere: Ethiopia's Soul Spice",
    paragraphs: [
      "Berbere is the fiery, complex spice blend that defines Ethiopian cuisine. Its name comes from the Amharic word 'barbare', meaning 'pepper' or 'hot'. A single batch of berbere can contain up to 20 different spices, including chili peppers, fenugreek, coriander, cardamom, black pepper, allspice, cumin, cloves, cinnamon, and nutmeg. Every family has its own closely guarded recipe, passed down through generations.",
      "The preparation of berbere is a labor-intensive process that can take several days. Whole dried chili peppers are sun-dried and then ground by hand on a traditional stone mortar. The other spices are separately roasted and ground before being carefully blended in precise proportions. The result is a deep red, aromatic powder that forms the base of virtually every Ethiopian stew (wot).",
      "Berbere is more than a seasoning — it is a cultural artifact that tells the story of Ethiopia's position at the crossroads of ancient spice routes. Some of its ingredients, like the long pepper and korarima (Ethiopian cardamom), are native only to Ethiopia. The spice blend embodies the country's rich history of trade, conquest, and culinary innovation, making it truly irreplaceable in Ethiopian cooking."
    ]
  }
]

const FALLBACK_READS = [
  {
    title: "How to Eat Ethiopian Food",
    subtitle: "A guide for first-timers",
    paragraphs: [
      "Eating Ethiopian food for the first time can feel intimidating, but it's actually one of the most natural and enjoyable ways to dine. The most important rule: use your right hand. In Ethiopian culture, the left hand is considered unclean, so always tear off a piece of injera with your right hand, scoop up the stew (wot), and bring it to your mouth. Don't worry about being messy — that's part of the experience!",
      "One of the most beautiful traditions in Ethiopian dining is 'gursha' — the act of hand-feeding another person a mouthful of food. If someone offers you gursha, it's a sign of deep affection and respect. To refuse it would be considered impolite. The larger the mouthful, the greater the love being expressed! Don't be surprised if your Ethiopian host insists on feeding you several gurshas during the meal.",
      "Ethiopian meals are always communal — everyone eats from the same large platter. The injera is spread flat on the platter, and various stews are ladled on top in separate mounds. Extra injera rolls are served on the side for scooping. Start eating from the area directly in front of you, and don't reach across the platter. The best part? The injera underneath the stews absorbs all the flavorful sauces — Ethiopians call this 'wot-fita' and it's considered the tastiest part.",
      "Finally, don't rush. Ethiopian dining is a leisurely affair meant to be savored. Take your time, enjoy the conversation, and don't be afraid to try everything on the platter. If you're not sure about something, ask your host — Ethiopians are incredibly proud of their cuisine and love explaining dishes to curious guests."
    ]
  },
  {
    title: "Ethiopian Coffee Guide",
    subtitle: "From Kaldi to modern export",
    paragraphs: [
      "Legend has it that coffee was discovered in Ethiopia around 850 AD, when a goat herder named Kaldi noticed his goats dancing with unusual energy after eating red berries from a certain tree. Curious, Kaldi tried the berries himself and felt an exhilarating buzz. He brought the berries to a local monastery, where the monks initially dismissed them as the devil's work and threw them into the fire — only to be captivated by the wonderful aroma of the roasting beans. They quickly retrieved the beans, brewed the world's first cup of coffee, and the rest is history.",
      "Today, Ethiopia is the 5th largest coffee producer in the world and the top producer in Africa. The country grows some of the finest specialty coffees on earth, including Yirgacheffe, Sidamo, and Harrar — names that are revered by coffee connoisseurs worldwide. Ethiopian coffee is known for its bright acidity, complex fruit and floral notes, and distinctive wine-like qualities. Most Ethiopian coffee is still grown by smallholder farmers using traditional, shade-grown methods.",
      "The Ethiopian coffee ceremony remains the heart of social life. Three rounds are served — Abol (the strongest), Tona (the second brew), and Bereka (the blessed final cup). Coffee is never served alone; it always comes with popcorn, roasted barley, or sometimes bread. The ceremony is performed three times daily in many households, making Ethiopia one of the few countries where coffee is still primarily a communal ritual rather than a quick caffeine fix."
    ]
  },
  {
    title: "Holidays & Food Traditions",
    subtitle: "Celebrating through cuisine",
    paragraphs: [
      "Ethiopian holidays are inseparable from their food traditions. Christmas, known as 'Genna', falls on January 7th and is celebrated with a feast of doro wot (spicy chicken stew) after a 43-day fasting period. The fasting isn't about going hungry — it means eating only vegan food, which makes the arrival of doro wot on Christmas Day an occasion of pure joy. Families stay up all night on Christmas Eve, attending church and preparing the feast that breaks the fast.",
      "Easter, or 'Fasika', is the most important holiday in the Ethiopian Orthodox calendar. The 55-day Lenten fast leading up to Fasika is strictly observed — no meat, dairy, or eggs. On Easter Eve, families gather for an all-night vigil at church, then return home at dawn to break the fast with a massive feast. The star of the table is, once again, doro wot, accompanied by specially baked bread called 'difo dabo' and copious amounts of tej (honey wine). The celebration continues for days.",
      "Ethiopia's Muslim community celebrates Eid al-Fitr and Eid al-Adha with equal culinary enthusiasm. Eid al-Fitr marks the end of Ramadan with special dishes like 'doro dulet' (a spicy tripe and chicken dish) and freshly baked sweets. During the fasting periods of both religions — Orthodox Christian and Muslim — shiro (chickpea flour stew) and miser wot (lentil stew) become daily staples, proving that Ethiopian fasting food is just as delicious as its feast food."
    ]
  }
]

// ─── Feature 4: Entertainment Helper Functions ────────────────
function scrambleLetters(word: string): string[] {
  const letters = word.replace(/ /g, '').split('')
  // Fisher-Yates shuffle, ensure it's actually scrambled
  let shuffled = [...letters]
  let attempts = 0
  do {
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    attempts++
  } while (shuffled.join('') === letters.join('') && attempts < 20)
  return shuffled
}

function checkTttWinner(board: (string | null)[]): string | null {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ]
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]
    }
  }
  return null
}

// ─── Games Tab Content — switches between Mini Games and YeneQR Arena ───
function GamesTabContent({
  restaurantId,
  sessionToken,
  playerName,
  currentScrambleLetters,
  currentWord,
  triviaIndex, triviaScore, triviaAnswered, triviaSelected,
  onTriviaAnswer, onTriviaNext,
  scrambleWordIndex, scrambleSelected, scrambleAttempts, scrambleResult,
  onScrambleChipTap, onScrambleClear, onScrambleSkip,
  tttBoard, tttIsPlayerTurn, tttScore, tttGameOver, tttWinner,
  onTttCellClick, onTttRestart,
  scrambleWords, triviaQuestions,
}: {
  restaurantId: string
  sessionToken: string | null
  playerName: string | null
  currentScrambleLetters: string[]
  currentWord: string
  triviaIndex: number
  triviaScore: number
  triviaAnswered: boolean
  triviaSelected: number | null
  onTriviaAnswer: (idx: number) => void
  onTriviaNext: () => void
  scrambleWordIndex: number
  scrambleSelected: number[]
  scrambleAttempts: number
  scrambleResult: 'correct' | 'wrong' | null
  onScrambleChipTap: (idx: number) => void
  onScrambleClear: () => void
  onScrambleSkip: () => void
  tttBoard: (string | null)[]
  tttIsPlayerTurn: boolean
  tttScore: { player: number; ai: number }
  tttGameOver: boolean
  tttWinner: string | null
  onTttCellClick: (idx: number) => void
  onTttRestart: () => void
  scrambleWords: string[]
  triviaQuestions: { q: string; opts: string[]; correct: number; explain: string }[]
}) {
  const [gameMode, setGameMode] = useState<'mini' | 'arena'>('arena')

  return (
    <div className="space-y-4">
      {/* Sub-tab switcher: Mini Games | YeneQR Arena */}
      <div className="flex gap-2 p-1 bg-muted rounded-xl">
        <button
          onClick={() => setGameMode('arena')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
            gameMode === 'arena'
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          YeneQR Arena
          <Badge variant="secondary" className="ml-1 text-[9px] px-1.5 py-0 h-4">LIVE</Badge>
        </button>
        <button
          onClick={() => setGameMode('mini')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
            gameMode === 'mini'
              ? 'bg-brand text-white shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Mini Games
        </button>
      </div>

      {/* Arena description banner */}
      {gameMode === 'arena' && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 border border-purple-500/20 p-3"
        >
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            🏆 <span className="font-bold text-purple-700 dark:text-purple-400">Compete with other diners</span> — earn loyalty points, climb the daily/weekly leaderboard, win rewards. Top 3 each day get bonus points + badges!
          </p>
        </motion.div>
      )}

      {/* Mode content */}
      {gameMode === 'arena' ? (
        restaurantId && sessionToken ? (
          <GameArena restaurantId={restaurantId} sessionToken={sessionToken} playerName={playerName} />
        ) : (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <p>🔒 Arena unlocks once your session is active.</p>
            <p className="text-xs mt-1">Scan the QR code on your table to start competing.</p>
          </div>
        )
      ) : (
        <MiniGameSelector
          currentScrambleLetters={currentScrambleLetters}
          currentWord={currentWord}
          triviaIndex={triviaIndex}
          triviaScore={triviaScore}
          triviaAnswered={triviaAnswered}
          triviaSelected={triviaSelected}
          onTriviaAnswer={onTriviaAnswer}
          onTriviaNext={onTriviaNext}
          scrambleWordIndex={scrambleWordIndex}
          scrambleSelected={scrambleSelected}
          scrambleAttempts={scrambleAttempts}
          scrambleResult={scrambleResult}
          onScrambleChipTap={onScrambleChipTap}
          onScrambleClear={onScrambleClear}
          onScrambleSkip={onScrambleSkip}
          tttBoard={tttBoard}
          tttIsPlayerTurn={tttIsPlayerTurn}
          tttScore={tttScore}
          tttGameOver={tttGameOver}
          tttWinner={tttWinner}
          onTttCellClick={onTttCellClick}
          onTttRestart={onTttRestart}
          scrambleWords={scrambleWords}
          triviaQuestions={triviaQuestions}
        />
      )}
    </div>
  )
}

// ─── Feature 4: Entertainment Hub Component ───────────────────
function EntertainmentHub({
  entertainmentTab,
  onTabChange,
  estimatedMinutes,
  restaurantId,
  sessionToken,
  playerName,
  // Parent-injected state (these are page-level state vars that must be passed in;
  // referencing them directly would crash the component at runtime).
  entertainmentSettings,
  factsList,
  storiesList,
  readsList,
  scrambleWords,
  triviaQuestions,
  // Trivia
  triviaIndex,
  triviaScore,
  triviaAnswered,
  triviaSelected,
  onTriviaAnswer,
  onTriviaNext,
  // Word Scramble
  scrambleWordIndex,
  scrambleSelected,
  scrambleAttempts,
  scrambleResult,
  onScrambleChipTap,
  onScrambleClear,
  onScrambleSkip,
  // Tic Tac Toe
  tttBoard,
  tttIsPlayerTurn,
  tttScore,
  tttGameOver,
  tttWinner,
  onTttCellClick,
  onTttRestart,
  // Reads
  expandedRead,
  onExpandRead,
}: {
  entertainmentTab: 'games' | 'facts' | 'stories' | 'reads'
  onTabChange: (tab: 'games' | 'facts' | 'stories' | 'reads') => void
  estimatedMinutes: number
  restaurantId: string
  sessionToken: string | null
  playerName: string | null
  entertainmentSettings: { hubEnabled: boolean; games: Record<string, boolean>; contentTypes: Record<string, boolean> } | null
  factsList: string[]
  storiesList: { title: string; paragraphs: string[] }[]
  readsList: { title: string; subtitle: string; paragraphs: string[] }[]
  scrambleWords: string[]
  triviaQuestions: { q: string; opts: string[]; correct: number; explain: string }[]
  triviaIndex: number
  triviaScore: number
  triviaAnswered: boolean
  triviaSelected: number | null
  onTriviaAnswer: (idx: number) => void
  onTriviaNext: () => void
  scrambleWordIndex: number
  scrambleSelected: number[]
  scrambleAttempts: number
  scrambleResult: 'correct' | 'wrong' | null
  onScrambleChipTap: (idx: number) => void
  onScrambleClear: () => void
  onScrambleSkip: () => void
  tttBoard: (string | null)[]
  tttIsPlayerTurn: boolean
  tttScore: { player: number; ai: number }
  tttGameOver: boolean
  tttWinner: string | null
  onTttCellClick: (idx: number) => void
  onTttRestart: () => void
  expandedRead: number | null
  onExpandRead: (idx: number | null) => void
}) {
  const allTabs: { key: 'games' | 'facts' | 'stories' | 'reads'; label: string }[] = [
    { key: 'games', label: 'Games' },
    { key: 'facts', label: 'Facts' },
    { key: 'stories', label: 'Stories' },
    { key: 'reads', label: 'Reads' },
  ]
  const tabs = allTabs.filter(tab => {
    // Filter tabs based on feature settings (if available)
    if (!entertainmentSettings) return true // No settings = show all
    if (tab.key === 'facts' && entertainmentSettings.contentTypes?.facts === false) return false
    if (tab.key === 'stories' && entertainmentSettings.contentTypes?.stories === false) return false
    if (tab.key === 'reads' && entertainmentSettings.contentTypes?.reads === false) return false
    return true
  })

  // Memoize scrambled letters for current word
  const currentScrambleLetters = useMemo(() => scrambleLetters(scrambleWords[scrambleWordIndex]), [scrambleWordIndex, scrambleWords])
  const currentWord = scrambleWords[scrambleWordIndex]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-brand/5 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <span>🎉</span> While You Wait
          </h3>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            ~{estimatedMinutes} min
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
              entertainmentTab === tab.key
                ? 'text-brand border-b-2 border-brand bg-brand/5'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {/* ─── Games Tab ─── */}
        {entertainmentTab === 'games' && (
          <GamesTabContent
            restaurantId={restaurantId}
            sessionToken={sessionToken}
            playerName={playerName}
            currentScrambleLetters={currentScrambleLetters}
            currentWord={currentWord}
            triviaIndex={triviaIndex}
            triviaScore={triviaScore}
            triviaAnswered={triviaAnswered}
            triviaSelected={triviaSelected}
            onTriviaAnswer={onTriviaAnswer}
            onTriviaNext={onTriviaNext}
            scrambleWordIndex={scrambleWordIndex}
            scrambleSelected={scrambleSelected}
            scrambleAttempts={scrambleAttempts}
            scrambleResult={scrambleResult}
            onScrambleChipTap={onScrambleChipTap}
            onScrambleClear={onScrambleClear}
            onScrambleSkip={onScrambleSkip}
            tttBoard={tttBoard}
            tttIsPlayerTurn={tttIsPlayerTurn}
            tttScore={tttScore}
            tttGameOver={tttGameOver}
            tttWinner={tttWinner}
            onTttCellClick={onTttCellClick}
            onTttRestart={onTttRestart}
            scrambleWords={scrambleWords}
            triviaQuestions={triviaQuestions}
          />
        )}

        {/* ─── Facts Tab ─── */}
        {entertainmentTab === 'facts' && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {factsList.map((fact, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex gap-3 p-3 rounded-xl bg-background border border-border"
              >
                <Coffee className="w-5 h-5 text-brand shrink-0 mt-0.5" />
                <p className="text-sm leading-relaxed">{fact}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* ─── Stories Tab ─── */}
        {entertainmentTab === 'stories' && (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {storiesList.map((story, i) => (
              <div key={i} className="p-4 rounded-xl bg-background border border-border">
                <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <span className="text-lg">📖</span>
                  {story.title}
                </h4>
                {story.paragraphs.map((p, j) => (
                  <p key={j} className="text-sm text-muted-foreground leading-relaxed mb-2 last:mb-0">{p}</p>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ─── Reads Tab ─── */}
        {entertainmentTab === 'reads' && (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {readsList.map((article, i) => (
              <div key={i} className="p-4 rounded-xl bg-background border border-border">
                <h4 className="font-bold text-sm">{article.title}</h4>
                <p className="text-xs text-muted-foreground mb-3">{article.subtitle}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{article.paragraphs[0]}</p>
                {expandedRead === i && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 space-y-2"
                  >
                    {article.paragraphs.slice(1).map((p, j) => (
                      <p key={j} className="text-sm text-muted-foreground leading-relaxed">{p}</p>
                    ))}
                  </motion.div>
                )}
                <button
                  onClick={() => onExpandRead(expandedRead === i ? null : i)}
                  className="text-brand text-sm font-medium mt-2 hover:underline"
                >
                  {expandedRead === i ? 'Show less' : 'Read more'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Feature 4: Mini Games Component ──────────────────────────
function MiniGameSelector({
  currentScrambleLetters,
  currentWord,
  triviaIndex,
  triviaScore,
  triviaAnswered,
  triviaSelected,
  onTriviaAnswer,
  onTriviaNext,
  scrambleWordIndex,
  scrambleSelected,
  scrambleAttempts,
  scrambleResult,
  onScrambleChipTap,
  onScrambleClear,
  onScrambleSkip,
  tttBoard,
  tttIsPlayerTurn,
  tttScore,
  tttGameOver,
  tttWinner,
  onTttCellClick,
  onTttRestart,
  scrambleWords,
  triviaQuestions,
}: {
  currentScrambleLetters: string[]
  currentWord: string
  triviaIndex: number
  triviaScore: number
  triviaAnswered: boolean
  triviaSelected: number | null
  onTriviaAnswer: (idx: number) => void
  onTriviaNext: () => void
  scrambleWordIndex: number
  scrambleSelected: number[]
  scrambleAttempts: number
  scrambleResult: 'correct' | 'wrong' | null
  onScrambleChipTap: (idx: number) => void
  onScrambleClear: () => void
  onScrambleSkip: () => void
  tttBoard: (string | null)[]
  tttIsPlayerTurn: boolean
  tttScore: { player: number; ai: number }
  tttGameOver: boolean
  tttWinner: string | null
  onTttCellClick: (idx: number) => void
  onTttRestart: () => void
  scrambleWords: string[]
  triviaQuestions: { q: string; opts: string[]; correct: number; explain: string }[]
}) {
  const [activeGame, setActiveGame] = useState<'trivia' | 'scramble' | 'ttt'>('trivia')

  const games = [
    { key: 'trivia' as const, icon: '🧠', label: 'Food Trivia' },
    { key: 'scramble' as const, icon: '🔀', label: 'Word Scramble' },
    { key: 'ttt' as const, icon: '⭕', label: 'Tic Tac Toe' },
  ]

  return (
    <div>
      {/* Game selector pills */}
      <div className="flex gap-2 mb-4 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {games.map((g) => (
          <button
            key={g.key}
            onClick={() => setActiveGame(g.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              activeGame === g.key
                ? 'bg-brand text-white shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <span>{g.icon}</span>
            {g.label}
          </button>
        ))}
      </div>

      {/* ── Ethiopian Food Trivia ── */}
      {activeGame === 'trivia' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Question {triviaIndex + 1}/{triviaQuestions.length}
            </span>
            <span className="text-xs font-bold text-brand">
              {triviaScore}/{triviaQuestions.length} correct
            </span>
          </div>

          {triviaIndex < triviaQuestions.length ? (
            <>
              <p className="font-semibold text-sm">{triviaQuestions[triviaIndex].q}</p>
              <div className="space-y-2">
                {triviaQuestions[triviaIndex].opts.map((opt, i) => {
                  const isCorrect = i === triviaQuestions[triviaIndex].correct
                  const isSelected = triviaSelected === i
                  let bgClass = 'bg-background border-border hover:border-brand/30'
                  if (triviaAnswered) {
                    if (isCorrect) bgClass = 'bg-green-50 border-green-400 text-green-800'
                    else if (isSelected && !isCorrect) bgClass = 'bg-red-50 border-red-400 text-red-800'
                    else bgClass = 'bg-muted/50 border-border opacity-50'
                  }
                  return (
                    <button
                      key={i}
                      onClick={() => !triviaAnswered && onTriviaAnswer(i)}
                      disabled={triviaAnswered}
                      className={`w-full text-left p-3 rounded-xl border text-sm transition-all ${bgClass}`}
                    >
                      <span className="font-medium">{opt}</span>
                      {triviaAnswered && isCorrect && <span className="ml-2">✓</span>}
                      {triviaAnswered && isSelected && !isCorrect && <span className="ml-2">✗</span>}
                    </button>
                  )
                })}
              </div>
              {triviaAnswered && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <div className={`p-3 rounded-xl text-sm ${triviaSelected === triviaQuestions[triviaIndex].correct ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                    {triviaSelected === triviaQuestions[triviaIndex].correct ? '✓ Correct!' : `Not quite — the answer was ${triviaQuestions[triviaIndex].opts[triviaQuestions[triviaIndex].correct]}`}
                    <p className="mt-1 text-xs opacity-80">{triviaQuestions[triviaIndex].explain}</p>
                  </div>
                  {triviaIndex < triviaQuestions.length - 1 && (
                    <Button onClick={onTriviaNext} size="sm" className="w-full bg-brand hover:bg-brand-dark text-white rounded-xl">
                      Next Question
                    </Button>
                  )}
                </motion.div>
              )}
            </>
          ) : (
            <div className="text-center py-6">
              <p className="text-2xl mb-2">🎉</p>
              <p className="font-bold">Trivia Complete!</p>
              <p className="text-sm text-muted-foreground">You got {triviaScore}/{triviaQuestions.length} correct</p>
            </div>
          )}
        </div>
      )}

      {/* ── Word Scramble ── */}
      {activeGame === 'scramble' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Word {scrambleWordIndex + 1}/{scrambleWords.length}
            </span>
            {scrambleAttempts > 0 && scrambleResult !== 'correct' && (
              <span className="text-xs text-orange-600">Attempt {scrambleAttempts}/3</span>
            )}
          </div>

          {/* Scrambled chips */}
          <div className="flex flex-wrap justify-center gap-2 py-4">
            {currentScrambleLetters.map((letter, i) => {
              const isUsed = scrambleSelected.includes(i)
              return (
                <motion.button
                  key={`${scrambleWordIndex}-${i}`}
                  whileTap={!scrambleResult ? { scale: 0.9 } : undefined}
                  onClick={() => onScrambleChipTap(i)}
                  disabled={isUsed || !!scrambleResult}
                  className={`w-12 h-12 rounded-xl text-lg font-bold flex items-center justify-center transition-all ${
                    isUsed
                      ? 'bg-brand text-white scale-90 opacity-60'
                      : 'bg-muted border border-border hover:border-brand/30 hover:shadow-sm'
                  }`}
                >
                  {letter}
                </motion.button>
              )
            })}
          </div>

          {/* Selected letters display */}
          <div className="flex justify-center gap-1 min-h-[40px]">
            {scrambleSelected.map((chipIdx, i) => (
              <span
                key={i}
                className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/30 flex items-center justify-center text-sm font-bold text-brand"
              >
                {currentScrambleLetters[chipIdx]}
              </span>
            ))}
          </div>

          {/* Result */}
          {scrambleResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 rounded-xl text-sm text-center font-medium ${
                scrambleResult === 'correct'
                  ? 'bg-green-50 text-green-800'
                  : 'bg-red-50 text-red-800'
              }`}
            >
              {scrambleResult === 'correct'
                ? `✓ ${currentWord}!`
                : `Not quite — it was ${currentWord}`}
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onScrambleClear}
              className="flex-1 rounded-xl"
              disabled={scrambleSelected.length === 0 && !scrambleResult}
            >
              {scrambleResult ? 'Try Again' : 'Clear'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onScrambleSkip}
              className="flex-1 rounded-xl"
            >
              Skip
            </Button>
          </div>
        </div>
      )}

      {/* ── Tic Tac Toe ── */}
      {activeGame === 'ttt' && (
        <div className="space-y-4">
          {/* Score */}
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <span className="text-xs text-muted-foreground">You (X)</span>
              <p className="text-xl font-bold text-brand">{tttScore.player}</p>
            </div>
            <span className="text-muted-foreground font-light">vs</span>
            <div className="text-center">
              <span className="text-xs text-muted-foreground">AI (O)</span>
              <p className="text-xl font-bold text-orange-600">{tttScore.ai}</p>
            </div>
          </div>

          {/* Board */}
          <div className="flex justify-center">
            <div className="grid grid-cols-3 gap-2">
              {tttBoard.map((cell, i) => (
                <motion.button
                  key={i}
                  whileTap={!cell && !tttGameOver && tttIsPlayerTurn ? { scale: 0.9 } : undefined}
                  onClick={() => onTttCellClick(i)}
                  disabled={!!cell || tttGameOver || !tttIsPlayerTurn}
                  className={`w-20 h-20 rounded-xl text-3xl font-bold flex items-center justify-center transition-all ${
                    cell
                      ? cell === 'X'
                        ? 'bg-brand/10 text-brand'
                        : 'bg-orange-50 text-orange-600'
                      : 'bg-muted border border-border hover:border-brand/30'
                  }`}
                >
                  {cell}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Status */}
          {tttGameOver && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <p className="font-bold text-sm mb-2">
                {tttWinner === 'draw' ? "It's a draw!" : tttWinner === 'X' ? 'You win! 🎉' : 'AI wins! 🤖'}
              </p>
            </motion.div>
          )}
          {!tttGameOver && (
            <p className="text-xs text-muted-foreground text-center">
              {tttIsPlayerTurn ? 'Your turn — tap a cell' : 'AI is thinking...'}
            </p>
          )}

          <Button
            onClick={onTttRestart}
            size="sm"
            variant="outline"
            className="w-full rounded-xl"
          >
            Restart Game
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Review Section Component ─────────────────────────────────
function ReviewSection({
  language,
  rating,
  onRatingChange,
  comment,
  onCommentChange,
  submitted,
  onSubmit,
  onSkip,
}: {
  language: Language
  rating: number
  onRatingChange: (r: number) => void
  comment: string
  onCommentChange: (c: string) => void
  submitted: boolean
  onSubmit: () => void
  onSkip: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mt-6 bg-brand/5 rounded-2xl p-4 border border-brand/20"
    >
      {submitted ? (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
          <p className="font-semibold text-brand">{tuiGlobal('menu.thank_you_feedback', 'Thank you for your feedback!')}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">{tuiGlobal('menu.how_was_experience', 'How was your experience?')}</h3>
            <button onClick={onSkip} className="text-xs text-muted-foreground hover:text-foreground">
              {tuiGlobal('menu.skip', 'Skip')}
            </button>
          </div>

          {/* Star Rating */}
          <div className="flex items-center gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => onRatingChange(star)}
                className="p-1 active:scale-90 transition-transform"
              >
                <Star
                  className={`w-7 h-7 ${
                    star <= rating
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-muted-foreground/30'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Comment */}
          <Textarea
            placeholder={tuiGlobal('menu.share_thoughts', 'Share your thoughts (optional)...')}
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            className="min-h-[70px] rounded-xl resize-none text-sm mb-3"
          />

          <Button
            onClick={onSubmit}
            className="w-full rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold"
          >
            {tuiGlobal('menu.submit_review', 'Submit Review')}
          </Button>
        </>
      )}
    </motion.div>
  )
}

// ─── Item detail Drawer (Enhanced with Feature 3) ───────────────
function ItemDetailDrawer({
  item,
  open,
  onOpenChange,
  language,
  currency,
  onAddToCart,
  isFavorited = false,
  onToggleFavorite,
  onShareItem,
  restaurantSettings,
}: {
  item: MenuItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  language: Language
  currency: string
  onAddToCart: (item: MenuItem, quantity: number, modifiers: { group: ModifierGroup; option: ModifierOption }[], specialInstructions: string, removedIngredients: RemovedIngredient[]) => void
  isFavorited?: boolean
  onToggleFavorite?: (menuItemId: string) => void
  onShareItem?: (item: MenuItem) => void
  restaurantSettings?: Record<string, unknown> | null
}) {
  // Track previous item id to reset state when item changes
  const [prevItemId, setPrevItemId] = useState<string | null>(null)
  const itemId = item?.id ?? null
  const itemChanged = prevItemId !== itemId
  if (itemChanged) {
    setPrevItemId(itemId)
  }

  const [quantity, setQuantity] = useState(1)
  // Feature 3: Support multi-select per group (Map<groupId, Set<optionId>>)
  const [selectedModifiersMap, setSelectedModifiersMap] = useState<Map<string, Set<string>>>(new Map())
  // Track removed ingredients as a Map<ingredientId, RemovedIngredient> so we
  // can build the structured array for the order POST body.
  const [removedIngredientMap, setRemovedIngredientMap] = useState<Map<string, RemovedIngredient>>(new Map())
  const [specialInstructions, setSpecialInstructions] = useState('')
  const [showAdded, setShowAdded] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(new Map())
  const [shakingGroups, setShakingGroups] = useState<Set<string>>(new Set())
  const groupRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Reset state when item changes (derived from itemChanged, not in useEffect)
  const effectiveQuantity = itemChanged ? 1 : quantity
  const effectiveModifiersMap = itemChanged ? new Map<string, Set<string>>() : selectedModifiersMap
  const effectiveRemovedMap = itemChanged ? new Map<string, RemovedIngredient>() : removedIngredientMap
  const effectiveInstructions = itemChanged ? '' : specialInstructions
  const effectiveShowAdded = itemChanged ? false : showAdded

  // Build selectedModifiers from map for onAddToCart (must be before early return for hooks rule)
  const getSelectedModifiers = useCallback((): { group: ModifierGroup; option: ModifierOption }[] => {
    if (!item) return []
    const mods: { group: ModifierGroup; option: ModifierOption }[] = []
    effectiveModifiersMap.forEach((optionIds, groupId) => {
      const group = item.modifierGroups.find((g) => g.id === groupId)
      if (group) {
        optionIds.forEach(optId => {
          const option = group.options.find(o => o.id === optId)
          if (option) mods.push({ group, option })
        })
      }
    })
    return mods
  }, [effectiveModifiersMap, item])

  // Feature 3: Validate required modifier groups (must be before early return for hooks rule)
  const validateModifiers = useCallback((): boolean => {
    if (!item) return true
    const errors = new Map<string, string>()
    item.modifierGroups.forEach(group => {
      if (group.isRequired) {
        const selected = effectiveModifiersMap.get(group.id)
        const selectedCount = selected ? selected.size : 0
        if (selectedCount < group.minSelection) {
          errors.set(group.id, tuiGlobal('menu.select_at_least', `Please select at least ${group.minSelection} option(s)`).replace('{n}', String(group.minSelection)))
        }
      }
    })
    setValidationErrors(errors)

    if (errors.size > 0) {
      // Shake invalid groups
      const invalidIds = new Set(errors.keys())
      setShakingGroups(invalidIds)
      setTimeout(() => setShakingGroups(new Set()), 600)

      // Scroll to first invalid group
      const firstInvalidId = errors.keys().next().value
      if (firstInvalidId) {
        const el = groupRefs.current.get(firstInvalidId)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
      return false
    }
    return true
  }, [effectiveModifiersMap, item])

  if (!item) return null

  const totalPrice = (() => {
    let price = item.priceCents
    getSelectedModifiers().forEach(({ option }) => { price += option.priceCents })
    return price * effectiveQuantity
  })()

  const handleAdd = () => {
    if (!validateModifiers()) return
    const mods = getSelectedModifiers()
    onAddToCart(item, effectiveQuantity, mods, effectiveInstructions, Array.from(effectiveRemovedMap.values()))
    setShowAdded(true)
    setTimeout(() => onOpenChange(false), 800)
  }

  const toggleModifierOption = (groupId: string, optionId: string) => {
    setSelectedModifiersMap(prev => {
      const next = new Map(prev)
      const current = next.get(groupId) || new Set()
      const group = item.modifierGroups.find(g => g.id === groupId)
      if (!group) return prev

      if (current.has(optionId)) {
        const updated = new Set(current)
        updated.delete(optionId)
        if (updated.size === 0) {
          next.delete(groupId)
        } else {
          next.set(groupId, updated)
        }
      } else {
        // Check max selection
        if (group.selectionType === 'single' || group.maxSelection === 1) {
          next.set(groupId, new Set([optionId]))
        } else {
          if (current.size >= group.maxSelection) return prev // Don't exceed max
          const updated = new Set(current)
          updated.add(optionId)
          next.set(groupId, updated)
        }
      }
      return next
    })
  }

  // ── Feature 3: Doneness renderer ──
  const renderDoneness = (group: ModifierGroup) => {
    const donenessLabels = ['Rare', 'Medium Rare', 'Medium', 'Medium Well', 'Well Done']
    const selected = effectiveModifiersMap.get(group.id) || new Set()

    return (
      <div className="flex items-center gap-2 justify-center py-2">
        {donenessLabels.map((label, i) => {
          const isActive = selected.has(group.options[i]?.id || `doneness-${i}`)
          const optionId = group.options[i]?.id || `doneness-${i}`
          return (
            <button
              key={i}
              onClick={() => toggleModifierOption(group.id, optionId)}
              className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${
                isActive ? 'scale-110' : 'opacity-50'
              }`}
            >
              <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
                isActive ? 'border-brand bg-brand text-white' : 'border-border bg-card text-muted-foreground'
              }`}>
                {i + 1}
              </div>
              <span className={`text-[9px] leading-tight text-center ${isActive ? 'text-brand font-semibold' : 'text-muted-foreground'}`}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  // ── Feature 3: Spice level renderer ──
  const renderSpiceLevel = (group: ModifierGroup) => {
    const spiceLabels = ['Mild', 'Medium', 'Hot', 'Very Hot', 'Extreme']
    const selected = effectiveModifiersMap.get(group.id) || new Set()

    return (
      <div className="flex items-center gap-3 justify-center py-2">
        {spiceLabels.map((label, i) => {
          const isActive = selected.has(group.options[i]?.id || `spice-${i}`)
          const optionId = group.options[i]?.id || `spice-${i}`
          return (
            <button
              key={i}
              onClick={() => toggleModifierOption(group.id, optionId)}
              className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${
                isActive ? 'scale-110' : 'opacity-50'
              }`}
            >
              <div className={`flex items-center gap-0.5 transition-all ${
                isActive ? 'text-red-500' : 'text-muted-foreground/40'
              }`}>
                {Array.from({ length: i + 1 }).map((_, j) => (
                  <Flame key={j} className="w-4 h-4" />
                ))}
              </div>
              <span className={`text-[9px] leading-tight text-center ${isActive ? 'text-brand font-semibold' : 'text-muted-foreground'}`}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  // ── Feature 3: Ingredient removal (toggle list) renderer ──
  const renderRemovalToggles = (group: ModifierGroup) => {
    const selected = effectiveModifiersMap.get(group.id) || new Set()

    return (
      <div className="space-y-1">
        {group.options.map((option) => {
          const isRemoved = selected.has(option.id)
          return (
            <div key={option.id} className="flex items-center justify-between py-2 px-1">
              <span className={`text-sm transition-all ${isRemoved ? 'line-through opacity-40' : 'font-medium'}`}>
                {tName(option.name, option.nameAm, option.nameI18n)}
              </span>
              <div className="flex items-center gap-2">
                {option.priceCents !== 0 && (
                  <span className={`text-xs ${option.priceCents < 0 ? 'text-brand' : 'text-muted-foreground'}`}>
                    {option.priceCents < 0 ? '' : '+'}{formatPrice(option.priceCents, currency)}
                  </span>
                )}
                <Switch
                  checked={!isRemoved}
                  onCheckedChange={(checked) => {
                    if (!checked) {
                      // Toggle off = remove ingredient
                      toggleModifierOption(group.id, option.id)
                    } else {
                      // Toggle on = include ingredient back
                      toggleModifierOption(group.id, option.id)
                    }
                  }}
                  className="data-[state=checked]:bg-brand data-[state=unchecked]:bg-red-400"
                />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Serving Size renderer — visually distinct pill selector ──
  const renderServingSize = (group: ModifierGroup) => {
    const selected = effectiveModifiersMap.get(group.id) || new Set()

    // Sort options by priceDelta to ensure logical order (small → large)
    const sortedOptions = [...group.options].sort((a, b) => a.priceCents - b.priceCents)

    return (
      <div className="flex gap-2 justify-center py-1">
        {sortedOptions.map((option) => {
          const isSelected = selected.has(option.id)
          const isDefault = option.isDefault
          return (
            <button
              key={option.id}
              onClick={() => toggleModifierOption(group.id, option.id)}
              className={`flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl border-2 transition-all active:scale-95 min-w-[70px] ${
                isSelected
                  ? 'border-brand bg-brand/10 shadow-sm'
                  : isDefault && selected.size === 0
                    ? 'border-brand/40 bg-brand/5'
                    : 'border-border bg-card hover:border-brand/30'
              }`}
            >
              <span className={`text-sm font-semibold ${isSelected ? 'text-brand' : ''}`}>
                {tName(option.name, option.nameAm, option.nameI18n)}
              </span>
              {option.priceCents !== 0 ? (
                <span className={`text-[10px] ${option.priceCents < 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {option.priceCents < 0 ? '-' : '+'}{formatPrice(Math.abs(option.priceCents), currency)}
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground">{tuiGlobal('menu.included', 'Included')}</span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  // ── Feature 3: Normal modifier renderer ──
  const renderNormalModifiers = (group: ModifierGroup) => {
    const selected = effectiveModifiersMap.get(group.id) || new Set()
    const isSingleSelect = group.selectionType === 'single' || group.maxSelection === 1

    return (
      <div className="grid gap-2">
        {group.options.map((option) => {
          const isSelected = selected.has(option.id)
          return (
            <button
              key={option.id}
              onClick={() => toggleModifierOption(group.id, option.id)}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all active:scale-[0.98] ${
                isSelected ? 'border-brand bg-brand/5' : 'border-border hover:border-brand/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-brand bg-brand' : 'border-muted-foreground/40'}`}>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className="text-sm font-medium">{tName(option.name, option.nameAm, option.nameI18n)}</span>
              </div>
              {option.priceCents !== 0 && <span className="text-sm text-muted-foreground">{option.priceCents > 0 ? '+' : ''}{formatPrice(option.priceCents, currency)}</span>}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <div className="overflow-y-auto max-h-[85vh]">
          {/* Item Header */}
          <div className="w-full h-40 bg-muted flex items-center justify-center text-5xl relative overflow-hidden">
            {item.image ? (
              <img src={item.image} alt={tName(item.name, item.nameAm, item.nameI18n)} className="w-full h-full object-cover" />
            ) : (
              <span>{item.isPopular ? '⭐' : '🍽️'}</span>
            )}
            <button
              onClick={() => onOpenChange(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 pt-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-xl font-bold">{tName(item.name, item.nameAm, item.nameI18n)}</h2>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onShareItem?.(item)}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 bg-muted text-muted-foreground hover:text-brand"
                  aria-label={tuiGlobal('menu.share_item', 'Share item')}
                >
                  <Share2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onToggleFavorite?.(item.id)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                    isFavorited
                      ? 'bg-red-50 text-red-500 dark:bg-red-900/20'
                      : 'bg-muted text-muted-foreground hover:text-red-400'
                  }`}
                  aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Heart className={`w-5 h-5 ${isFavorited ? 'fill-current' : ''}`} />
                </button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{tDesc(item.description, item.descriptionAm, item.descriptionI18n)}</p>
            <div className="flex items-center gap-2 mt-3">
              {item.isVegetarian && (
                <Badge variant="secondary" className="text-green-700 bg-green-100"><Leaf className="w-3 h-3 mr-1" />{tuiGlobal('menu.veg', 'Veg')}</Badge>
              )}
              {item.isSpicy && (
                <Badge variant="secondary" className="text-orange-700 bg-orange-100"><Flame className="w-3 h-3 mr-1" />{tuiGlobal('menu.spicy', 'Spicy')}</Badge>
              )}
              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                <Clock className="w-3 h-3" />
                {item.preparationTime}m
              </span>
            </div>
            <p className="text-xl font-bold text-brand mt-3">{formatPrice(item.priceCents, currency)}</p>

            {/* Combo Items Section */}
            {item.comboItems && item.comboItems.length > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/30">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-sm font-semibold text-purple-700 dark:text-purple-400">{tuiGlobal('menu.includes', 'Includes')}</span>
                </div>
                <div className="space-y-1.5">
                  {item.comboItems.map((ci) => {
                    const comboItemName = ci.includedItem ? tName(ci.includedItem.name, ci.includedItem.nameAm, ci.includedItem.nameI18n) : tuiGlobal('menu.item', 'Item')
                    const comboItemPrice = ci.includedItem?.priceCents || 0
                    return (
                      <div key={ci.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-800/30 flex items-center justify-center text-[10px] font-bold text-purple-700 dark:text-purple-400">
                            {ci.quantity}
                          </span>
                          <span>{comboItemName}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatPrice(comboItemPrice, currency)} {tuiGlobal('menu.each', 'each')}</span>
                      </div>
                    )
                  })}
                  {/* Show savings */}
                  {(() => {
                    const itemsTotal = item.comboItems!.reduce((sum, ci) => sum + (ci.includedItem?.priceCents || 0) * ci.quantity, 0)
                    const savings = itemsTotal - item.priceCents
                    if (savings > 0) {
                      return (
                        <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-purple-200 dark:border-purple-700/40">
                          <span className="text-xs font-medium text-purple-700 dark:text-purple-400">{tuiGlobal('menu.you_save', 'You save')}</span>
                          <span className="text-xs font-bold text-purple-700 dark:text-purple-400">{formatPrice(savings, currency)}</span>
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* ── Structured Ingredient Removal Section ── */}
          {/* Renders toggle switches for each ingredient linked to this item
              where isRemovable=true. When toggled off, the ingredient is added
              to removedIngredientMap and sent as a structured {id, name, nameAm}
              array in the order POST body. The kitchen renders these as 🚫 badges. */}
          {item.menuItemIngredients && item.menuItemIngredients.length > 0 && (
            <div className="px-4 py-3 border-t">
              <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
                <span>{tuiGlobal('menu.customize_ingredients', 'Customize Ingredients')}</span>
              </h4>
              <p className="text-[11px] text-muted-foreground mb-3">
                {tuiGlobal('menu.remove_ingredients_hint', 'Toggle off any ingredient you don\'t want')}
              </p>
              <div className="space-y-1">
                {item.menuItemIngredients
                  .filter((link) => link.ingredient.isAvailable !== false)
                  .map((link) => {
                    const ing = link.ingredient
                    const isRemoved = effectiveRemovedMap.has(ing.id)
                    const displayName = tName(ing.name, ing.nameAm, ing.nameI18n)
                    return (
                      <div
                        key={link.id}
                        className={`flex items-center justify-between py-2 px-3 rounded-lg border transition-colors ${
                          isRemoved
                            ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
                            : 'bg-card border-border'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className={`text-sm transition-all ${
                            isRemoved ? 'line-through opacity-50' : 'font-medium'
                          }`}>
                            {displayName}
                          </span>
                          {isRemoved && (
                            <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">
                              {tuiGlobal('menu.removed', 'Removed')}
                            </span>
                          )}
                        </div>
                        <Switch
                          checked={!isRemoved}
                          onCheckedChange={(checked) => {
                            if (!checked) {
                              // Toggle off = remove ingredient
                              setRemovedIngredientMap((prev) => {
                                const next = new Map(prev)
                                next.set(ing.id, {
                                  id: ing.id,
                                  name: ing.name,
                                  nameAm: ing.nameAm,
                                })
                                return next
                              })
                            } else {
                              // Toggle on = include ingredient back
                              setRemovedIngredientMap((prev) => {
                                const next = new Map(prev)
                                next.delete(ing.id)
                                return next
                              })
                            }
                          }}
                          className="data-[state=checked]:bg-brand data-[state=unchecked]:bg-red-400"
                        />
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* ── Ingredients / Allergens Section ── */}
          {(() => {
            let ingredientList: string[] = []
            if (item.ingredients) {
              try {
                const parsed = JSON.parse(item.ingredients)
                if (Array.isArray(parsed)) ingredientList = parsed
              } catch {
                ingredientList = item.ingredients.split(',').map(s => s.trim()).filter(Boolean)
              }
            }
            if (ingredientList.length === 0) return null

            // Resolve i18n ingredient names if available
            let displayIngredients: string[] = ingredientList
            if (item.ingredientsI18n && language !== 'en') {
              try {
                const i18nParsed = JSON.parse(item.ingredientsI18n)
                if (i18nParsed && typeof i18nParsed === 'object' && !Array.isArray(i18nParsed)) {
                  // ingredientsI18n format: { "am": ["አሳሙን","በርበሬ","ቅቤ"], ... }
                  const langIngredients = i18nParsed[language]
                  const defaultLangIngredients = i18nParsed[_tCtx.defaultLang]
                  const resolvedI18n = langIngredients || defaultLangIngredients
                  if (Array.isArray(resolvedI18n) && resolvedI18n.length === ingredientList.length) {
                    displayIngredients = resolvedI18n
                  }
                }
              } catch {
                // Fall back to original ingredient list
              }
            }

            return (
              <div className="px-4 mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">🧾</span>
                  <h3 className="font-semibold text-sm">{tuiGlobal('menu.ingredients', 'Ingredients')}</h3>
                  {item.isVegetarian && <Leaf className="w-3.5 h-3.5 text-green-600" />}
                  {item.isSpicy && <Flame className="w-3.5 h-3.5 text-orange-500" />}
                  {effectiveRemovedMap.size > 0 && (
                    <span className="text-[10px] text-red-500 font-medium">
                      {effectiveRemovedMap.size} {tuiGlobal('menu.removed', 'removed')}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {ingredientList.map((originalIng, idx) => {
                    const displayIng = displayIngredients[idx] || originalIng
                    const isRemoved = effectiveRemovedMap.has(originalIng)
                    return (
                      <motion.button
                        key={originalIng}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setRemovedIngredientMap(prev => {
                            const next = new Map(prev)
                            if (next.has(originalIng)) {
                              next.delete(originalIng)
                            } else {
                              next.set(originalIng, {
                                id: originalIng,
                                name: originalIng,
                                nameAm: null,
                              })
                            }
                            return next
                          })
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          isRemoved
                            ? 'border-red-300 bg-red-50 text-red-500 line-through dark:border-red-800 dark:bg-red-900/20 dark:text-red-400'
                            : 'border-border bg-card text-foreground hover:border-brand/30'
                        }`}
                      >
                        {isRemoved ? (
                          <X className="w-3 h-3" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                        )}
                        {displayIng}
                      </motion.button>
                    )
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  {tuiGlobal('menu.tap_to_remove', 'Tap an ingredient to remove it from your dish')}
                </p>
              </div>
            )
          })()}

          {item.modifierGroups.length > 0 && <Separator className="my-4" />}

          {/* ── Modifiers with enhanced rendering ── */}
          {item.modifierGroups.map((group) => {
            const groupNameLower = group.name.toLowerCase()
            const isDoneness = isDonenessGroup(groupNameLower)
            const isSpice = isSpiceLevelGroup(groupNameLower)
            const isRemoval = isRemovalGroup(groupNameLower)
            // Serving size visibility: check item-level override, then restaurant-level setting
            const restaurantShowServingSize = restaurantSettings?.showServingSize !== false  // default true
            const itemShowServingSize = item.showServingSize !== undefined && item.showServingSize !== null
              ? item.showServingSize   // item-level override
              : restaurantShowServingSize  // inherit from restaurant
            const isServingSize = isServingSizeGroup(groupNameLower) && itemShowServingSize
            // If this is a serving size group but serving size is hidden, render it as a normal modifier instead
            const shouldHideServingSize = isServingSizeGroup(groupNameLower) && !itemShowServingSize
            const errorMsg = validationErrors.get(group.id)
            const isShaking = shakingGroups.has(group.id)

            // Selection limit display
            const selectionHint = group.maxSelection === 1
              ? tuiGlobal('menu.choose_1', 'Choose 1')
              : group.maxSelection > 1
                ? tuiGlobal('menu.choose_up_to', `Choose up to ${group.maxSelection}`).replace('{n}', String(group.maxSelection))
                : null

            return (
              <motion.div
                key={group.id}
                ref={(el) => { if (el) groupRefs.current.set(group.id, el) }}
                animate={isShaking ? { x: [0, -6, 6, -4, 4, -2, 2, 0] } : {}}
                transition={{ duration: 0.5 }}
                className="px-4 mb-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-sm">{tName(group.name, group.nameAm, group.nameI18n)}</h3>
                  {group.isRequired && <Badge variant="outline" className="text-[10px]">{tuiGlobal('menu.required', 'Required')}</Badge>}
                </div>
                {selectionHint && (
                  <p className="text-[11px] text-muted-foreground mb-2">{selectionHint}</p>
                )}

                {isDoneness ? renderDoneness(group) :
                 isSpice ? renderSpiceLevel(group) :
                 isServingSize ? renderServingSize(group) :
                 shouldHideServingSize ? renderNormalModifiers(group) :
                 isRemoval ? renderRemovalToggles(group) :
                 renderNormalModifiers(group)}

                {/* Validation error */}
                {errorMsg && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-red-500 mt-2 font-medium"
                  >
                    {errorMsg}
                  </motion.p>
                )}
              </motion.div>
            )
          })}

          {/* Special Instructions — collapsible to reduce clutter */}
          <div className="px-4 mb-4">
            <button
              onClick={() => {
                const el = document.getElementById('special-instructions-field')
                if (el) el.classList.toggle('hidden')
              }}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <MessageSquare className="w-4 h-4" />
              {tuiGlobal('menu.add_note', 'Add a note')}
              <ChevronDown className="w-3 h-3" />
            </button>
            <div id="special-instructions-field" className="hidden">
              <Textarea
                placeholder={tuiGlobal('menu.allergies_preferences', 'Any allergies or preferences...')}
                value={effectiveInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                className="min-h-[80px] rounded-xl resize-none"
              />
            </div>
            {effectiveInstructions && (
              <p className="text-xs text-brand mt-1">
                {tuiGlobal('menu.note_added', 'Note added')}
              </p>
            )}
          </div>

          {/* Quantity & Add */}
          <div className="sticky bottom-0 bg-background border-t border-border p-4">
            {!(item.currentAvailable ?? item.isAvailable) ? (
              <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-muted text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="font-semibold text-sm">
                  {item.availabilityType === 'scheduled'
                    ? tuiGlobal('menu.currently_unavailable', 'Currently Unavailable')
                    : tuiGlobal('menu.sold_out', 'Sold Out')}
                </span>
              </div>
            ) : (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 bg-muted rounded-xl px-3 py-2">
                <button onClick={() => setQuantity(Math.max(1, effectiveQuantity - 1))} className="w-8 h-8 rounded-full bg-card flex items-center justify-center shadow-sm active:scale-90"><Minus className="w-4 h-4" /></button>
                <span className="w-6 text-center font-bold">{effectiveQuantity}</span>
                <button onClick={() => setQuantity(effectiveQuantity + 1)} className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center shadow-sm active:scale-90"><Plus className="w-4 h-4" /></button>
              </div>
              <Button onClick={handleAdd} className="flex-1 h-12 rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold text-base shadow-lg shadow-brand/25">
                {effectiveShowAdded ? (
                  <span className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5" />{tuiGlobal('menu.added', 'Added!')}</span>
                ) : (
                  `${tuiGlobal('menu.add_to_cart', 'Add to Cart')} • ${formatPrice(totalPrice, currency)}`
                )}
              </Button>
            </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

// ─── Cart Drawer ──────────────────────────────────────────────
function CartDrawer({
  open,
  onOpenChange,
  cart,
  language,
  currency,
  taxRate,
  serviceCharge,
  onUpdateQuantity,
  onRemoveItem,
  onPlaceOrder,
  couponCode = '',
  onCouponCodeChange,
  appliedPromotion = null,
  discount = 0,
  couponError = '',
  onApplyCoupon,
  onRemoveCoupon,
  loyaltyPoints = 0,
  useLoyaltyPoints = false,
  loyaltyDiscount = 0,
  onToggleLoyaltyPoints,
  packagingFeeCents = 0,
  isAddingToOrder = false,
  isPlacingOrder = false,
  orderNumber = '',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cart: CartItem[]
  language: Language
  currency: string
  taxRate: number
  serviceCharge: number
  onUpdateQuantity: (index: number, qty: number) => void
  onRemoveItem: (index: number) => void
  onPlaceOrder: () => void
  couponCode?: string
  onCouponCodeChange?: (code: string) => void
  appliedPromotion?: any
  discount?: number
  couponError?: string
  onApplyCoupon?: () => void
  onRemoveCoupon?: () => void
  loyaltyPoints?: number
  useLoyaltyPoints?: boolean
  loyaltyDiscount?: number
  onToggleLoyaltyPoints?: () => void
  packagingFeeCents?: number
  isAddingToOrder?: boolean
  isPlacingOrder?: boolean
  orderNumber?: string
}) {
  const subtotal = cart.reduce((sum, ci) => sum + ci.totalPriceCents * ci.quantity, 0)
  const totalDiscount = discount + loyaltyDiscount
  const discountedSubtotal = Math.max(0, subtotal - totalDiscount)
  const tax = Math.round(discountedSubtotal * (taxRate || 0.15))
  const service = Math.round(discountedSubtotal * (serviceCharge || 0))
  const total = discountedSubtotal + tax + service + packagingFeeCents

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b border-border">
          <DrawerTitle className="flex items-center gap-2">
            {isAddingToOrder ? (
              <>
                <Plus className="w-5 h-5 text-brand" />
                <span>{tuiGlobal('menu.adding_to_order', 'Add to Order')}</span>
                {orderNumber && <Badge variant="secondary" className="text-brand">{orderNumber}</Badge>}
              </>
            ) : (
              <>
                <ShoppingCart className="w-5 h-5" />
                {tuiGlobal('menu.your_cart', 'Your Cart')}
              </>
            )}
            <Badge variant="secondary">{cart.length}</Badge>
          </DrawerTitle>
        </DrawerHeader>

        {cart.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{tuiGlobal('menu.cart_empty', 'Your cart is empty')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-y-auto max-h-[50vh] px-4 py-3">
              {cart.map((ci, index) => (
                <div key={`${ci.menuItem.id}-${index}`} className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0">
                  {ci.menuItem.image ? (
                    <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
                      <img src={ci.menuItem.image} alt={tName(ci.menuItem.name, ci.menuItem.nameAm, ci.menuItem.nameI18n)} className="w-full h-full object-cover" />
                    </div>
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{tName(ci.menuItem.name, ci.menuItem.nameAm, ci.menuItem.nameI18n)}</h4>
                    {ci.selectedModifiers.length > 0 && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {ci.selectedModifiers.map((m) => tName(m.option.name, m.option.nameAm, m.option.nameI18n)).join(', ')}
                      </p>
                    )}
                    {ci.removedIngredients && ci.removedIngredients.length > 0 && (
                      <p className="text-xs text-red-500 truncate mt-0.5">
                        {tuiGlobal('menu.no', 'No')} {ci.removedIngredients.map(ri => ri.name).join(', ')}
                      </p>
                    )}
                    {ci.specialInstructions && (
                      <p className="text-xs text-orange-600 truncate mt-0.5">📝 {ci.specialInstructions}</p>
                    )}
                    <p className="text-sm font-semibold text-brand mt-1">{formatPrice(ci.totalPriceCents * ci.quantity, currency)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => ci.quantity <= 1 ? onRemoveItem(index) : onUpdateQuantity(index, ci.quantity - 1)}
                      className="w-8 h-8 rounded-full bg-muted flex items-center justify-center active:scale-90"
                    >
                      {ci.quantity <= 1 ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : <Minus className="w-3.5 h-3.5" />}
                    </button>
                    <span className="w-5 text-center text-sm font-medium">{ci.quantity}</span>
                    <button
                      onClick={() => onUpdateQuantity(index, ci.quantity + 1)}
                      className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center active:scale-90"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Coupon Code Input */}
            {!appliedPromotion ? (
              <div className="px-4 pb-3">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  {tuiGlobal('menu.have_coupon', 'Have a coupon code?')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => onCouponCodeChange?.(e.target.value.toUpperCase())}
                    placeholder={tuiGlobal('menu.enter_code', 'Enter code')}
                    className="flex-1 h-9 px-3 rounded-lg bg-muted border-0 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                  <Button
                    size="sm"
                    onClick={onApplyCoupon}
                    disabled={!couponCode.trim()}
                    className="h-9 bg-brand hover:bg-brand-dark text-white"
                  >
                    {tuiGlobal('menu.apply', 'Apply')}
                  </Button>
                </div>
                {couponError && (
                  <p className="text-xs text-red-500 mt-1">{couponError}</p>
                )}
              </div>
            ) : (
              <div className="mx-4 mb-3 flex items-center justify-between p-2.5 rounded-xl bg-brand/5 border border-brand/20">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-brand" />
                  <div>
                    <p className="text-xs font-medium text-brand">{appliedPromotion.name}</p>
                    <p className="text-[10px] text-brand/70">-{formatPrice(discount, currency)}</p>
                  </div>
                </div>
                <button onClick={onRemoveCoupon} className="p-1 rounded-full hover:bg-brand/10">
                  <X className="w-3.5 h-3.5 text-brand" />
                </button>
              </div>
            )}

            {/* Loyalty Points Toggle */}
            {loyaltyPoints >= 10 && (
              <div className="px-4 pb-3">
                <button
                  onClick={onToggleLoyaltyPoints}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                    useLoyaltyPoints
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-card border-border hover:border-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Gift className={`w-4 h-4 ${useLoyaltyPoints ? 'text-amber-600' : 'text-amber-500'}`} />
                    <div className="text-left">
                      <p className={`text-xs font-medium ${useLoyaltyPoints ? 'text-amber-700' : ''}`}>
                        {useLoyaltyPoints
                          ? tuiGlobal('menu.using_pts', `Using ${Math.floor(loyaltyDiscount / 5)} pts`)
                          : tuiGlobal('menu.use_pts', `Use ${loyaltyPoints} pts`)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {useLoyaltyPoints
                          ? tuiGlobal('menu.save_amount', `Save ${formatPrice(loyaltyDiscount, currency)}`)
                          : tuiGlobal('menu.save_up_to', `Save up to ${formatPrice(Math.min(loyaltyPoints, Math.floor(subtotal / 5)) * 5, currency)}`)}
                      </p>
                    </div>
                  </div>
                  <div className={`w-10 h-6 rounded-full transition-all flex items-center ${useLoyaltyPoints ? 'bg-amber-500 justify-end' : 'bg-muted justify-start'}`}>
                    <div className="w-5 h-5 rounded-full bg-white shadow-sm mx-0.5" />
                  </div>
                </button>
              </div>
            )}

            {/* Totals */}
            <div className="border-t border-border px-4 py-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">{tuiGlobal('menu.subtotal', 'Subtotal')}</span>
                <span>{formatPrice(subtotal, currency)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-brand flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    {tuiGlobal('menu.discount', 'Discount')}
                  </span>
                  <span className="text-brand">-{formatPrice(totalDiscount, currency)}</span>
                </div>
              )}
              {packagingFeeCents > 0 && (
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{tuiGlobal('menu.packaging_takeaway', 'Packaging (takeaway)')}</span>
                  <span>{formatPrice(packagingFeeCents, currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">{tuiGlobal('menu.tax', 'Tax')} ({Math.round((taxRate || 0.15) * 100)}%)</span>
                <span>{formatPrice(tax, currency)}</span>
              </div>
              {serviceCharge > 0 && (
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{tuiGlobal('menu.service', 'Service')} ({Math.round(serviceCharge * 100)}%)</span>
                  <span>{formatPrice(service, currency)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold mt-2">
                <span>{tuiGlobal('menu.total', 'Total')}</span>
                <span className="text-brand">{formatPrice(total, currency)}</span>
              </div>
            </div>

            <DrawerFooter>
              <Button onClick={onPlaceOrder} className="h-12 rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold text-base shadow-lg shadow-brand/25">
                {isPlacingOrder ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {isAddingToOrder
                      ? tuiGlobal('menu.adding', 'Adding...')
                      : tuiGlobal('menu.placing', 'Placing...')
                    }
                  </span>
                ) : (
                  isAddingToOrder
                    ? `${tuiGlobal('menu.add_to_order', 'Add to Order')} • ${formatPrice(total, currency)}`
                    : `${tuiGlobal('menu.place_order', 'Place Order')} • ${formatPrice(total, currency)}`
                )}
              </Button>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}
