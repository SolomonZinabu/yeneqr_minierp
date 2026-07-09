'use client'

import React, { useState, useCallback, useMemo, useEffect, useRef, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UtensilsCrossed,
  ShoppingCart,
  ClipboardList,
  HelpCircle,
  Plus,
  Minus,
  Trash2,
  ChevronLeft,
  Globe,
  Flame,
  Leaf,
  Clock,
  Phone,
  Receipt,
  CreditCard,
  Star,
  Send,
  X,
  CheckCircle2,
  Circle,
  Loader2,
  MessageSquare,
  Coffee,
  AlertCircle,
  ChevronRight,
  Calendar,
  Users,
  Gift,
  Package,
  AlertTriangle,
  Truck,
  Tag,
  ChevronDown,
  Wheat,
  MilkOff,
  Nut,
  Egg,
  Fish,
  Shell,
  ShieldCheck,
  Filter,
  History,
  RotateCcw,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer'
import {
  useCustomerStore,
  type CartItem,
  type MenuItem,
  type ModifierOption,
  type ModifierGroup,
  type Order,
  type OrderItem,
  type PaymentMethod,
  type AppScreen,
  type BottomTab,
  type AllergenInfo,
  type KitchenItemStatus,
  type Category,
  type IngredientItem,
  type CartItemModifier,
  type AppliedPromotion,
  type HistoryOrder,
  type HistoryOrderItem,
  type CustomerSession,
} from '@/lib/customer-store'
// Mock data kept ONLY as type reference — no longer used as fallback
// If API fails, we show an error state instead of stale mock data
import { getCustomerTier, getTierBenefits, getCustomerTierInfo, getTierBonus, getTierBenefitList } from '@/lib/loyalty'
import { toast } from 'sonner'
import { useRouter } from '@/lib/router'
import { useCustomerRealtime } from '@/lib/use-realtime'

// ─── Helper: Localized text ───────────────────────────────────
function t(en: string, am: string, lang: string): string {
  return lang === 'am' ? am : en
}

// Resolve an i18n JSON field to a string for the current language
// Fallback chain: requestedLang -> defaultLang -> 'en' -> fallback
function resolveI18n(i18nJson: Record<string, string> | null | undefined, lang: string, fallback: string): string {
  if (!i18nJson || typeof i18nJson !== 'object') return fallback
  return i18nJson[lang] || i18nJson['en'] || fallback
}

function formatPrice(cents: number): string {
  return `${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`
}

// ─── Digital Receipt HTML Generator ─────────────────────────
function generateReceiptHtml(order: Order, session: CustomerSession | null, lang: string): string {
  const restaurantName = session?.restaurantName || 'Restaurant'
  const restaurantNameAm = session?.restaurantNameAm || ''
  const tableNumber = session?.tableNumber || '-'
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding:4px 0;font-size:12px">${item.quantity}x ${item.nameEn}</td>
      <td style="padding:4px 0;font-size:12px;text-align:right">${formatPrice(item.priceCents * item.quantity)}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html><head><title>Receipt - ${restaurantName}</title>
<style>
  body { font-family: 'Courier New', monospace; max-width: 320px; margin: 0 auto; padding: 20px; color: #000; }
  .header { text-align: center; margin-bottom: 16px; border-bottom: 1px dashed #999; padding-bottom: 12px; }
  .header h1 { font-size: 18px; margin: 0 0 4px; }
  .header p { font-size: 11px; color: #666; margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; }
  .totals { border-top: 1px dashed #999; margin-top: 8px; padding-top: 8px; }
  .totals td { padding: 3px 0; font-size: 12px; }
  .grand-total { font-weight: bold; font-size: 16px; border-top: 2px solid #000; margin-top: 8px; padding-top: 8px; }
  .footer { text-align: center; margin-top: 20px; border-top: 1px dashed #999; padding-top: 12px; font-size: 10px; color: #666; }
  @media print { body { margin: 0; padding: 10px; } }
</style></head><body>
  <div class="header">
    <h1>${restaurantName}</h1>
    ${restaurantNameAm ? `<p>${restaurantNameAm}</p>` : ''}
    <p>${t('Table', 'ጠረጴዛ', lang)} ${tableNumber} | ${t('Order', 'ትዕዛዝ', lang)} #${order.orderNumber || '-'}</p>
    <p>${dateStr} ${timeStr}</p>
  </div>
  <table>${itemsHtml}</table>
  <table class="totals">
    <tr><td>${t('Subtotal', 'ንዑስ ድምር', lang)}</td><td style="text-align:right">${formatPrice(order.subtotalCents)}</td></tr>
    <tr><td>${t('Tax', 'ግብር', lang)}</td><td style="text-align:right">${formatPrice(order.taxCents)}</td></tr>
    ${order.serviceChargeCents > 0 ? `<tr><td>${t('Service Charge', 'አገልግሎት ክፍያ', lang)}</td><td style="text-align:right">${formatPrice(order.serviceChargeCents)}</td></tr>` : ''}
    ${order.tipCents > 0 ? `<tr><td>${t('Tip', 'ጁማ', lang)}</td><td style="text-align:right">${formatPrice(order.tipCents)}</td></tr>` : ''}
  </table>
  <table><tr class="grand-total"><td>${t('Total', 'ጠቅላላ', lang)}</td><td style="text-align:right">${formatPrice(order.totalCents + (order.tipCents || 0))}</td></tr></table>
  ${order.paymentMethod ? `<p style="font-size:11px;margin-top:8px">${t('Paid via', 'በ', lang)} ${order.paymentMethod.toUpperCase()}</p>` : ''}
  <div class="footer">
    <p>${t('Thank you for dining with us!', 'ከእኛ ጋር ስለተመገቡ እናመሰግናለን!', lang)}</p>
    <p>Yene QR</p>
  </div>
  <script>window.onload=function(){window.print()}</script>
</body></html>`
}

// ─── Customer Language Picker (multi-language dropdown) ──────
function CustomerLanguagePicker({ size = 'default' }: { size?: 'default' | 'sm' }) {
  const { language, setLanguage, enabledLanguages, session } = useCustomerStore()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch enabled languages from API if not already loaded
  // Uses getState() inside the effect to avoid reactive dependency on enabledLanguages,
  // which would cause a feedback loop (fetch → setEnabledLanguages → enabledLanguages
  // changes → re-trigger fetch).
  useEffect(() => {
    const currentLangs = useCustomerStore.getState().enabledLanguages
    if (currentLangs.length > 0 || !session?.restaurantId) return
    let cancelled = false
    fetch(`/api/restaurants/${session.restaurantId}/i18n/languages`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled) return
        if (data?.enabledLanguages) {
          const langs = data.enabledLanguages
            .filter((l: any) => l.isActive !== false)
            .map((l: any) => ({
              code: l.code,
              name: l.name || l.code,
              nameLocal: l.nameLocal || l.code,
              flagEmoji: l.flagEmoji || null,
              direction: l.direction || 'ltr',
            }))
          useCustomerStore.getState().setEnabledLanguages(langs)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.restaurantId])

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

  const currentLang = enabledLanguages.find(l => l.code === language)
  const displayLabel = currentLang
    ? `${currentLang.flagEmoji || ''} ${currentLang.nameLocal}`.trim()
    : language.toUpperCase()

  if (enabledLanguages.length <= 1) {
    // Single or no language: show a simple disabled-looking button
    return (
      <div
        className={`flex items-center gap-1 ${size === 'sm' ? 'px-2.5 py-1' : 'px-3 py-2'} rounded-full bg-secondary text-sm font-medium`}
      >
        <Globe className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        <span className="max-w-[100px] truncate">{displayLabel}</span>
      </div>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 ${size === 'sm' ? 'px-2.5 py-1' : 'px-3 py-2'} rounded-full ${size === 'sm' ? 'bg-secondary' : 'bg-card shadow-sm border border-border'} text-sm font-medium active:scale-95 transition-transform`}
      >
        <Globe className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        <span className="max-w-[100px] truncate">{displayLabel}</span>
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
            {enabledLanguages.map(lang => {
              const isSelected = lang.code === language
              return (
                <button
                  key={lang.code}
                  onClick={() => { setLanguage(lang.code); setOpen(false) }}
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

// ─── Animations ────────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
}

const itemVariants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
}

// ─── API Fetching Hook ────────────────────────────────────────
function useMenuData() {
  const { session, categories, menuItems, setCategories, setMenuItems, menuLoading, setMenuLoading, menuError, setMenuError } = useCustomerStore()

  useEffect(() => {
    if (!session?.restaurantId) return
    if (categories.length > 0) return // Already fetched

    let cancelled = false
    async function fetchMenu() {
      setMenuLoading(true)
      setMenuError(null)
      try {
        const rid = session.restaurantId!
        // Fetch menus
        const menusRes = await fetch(`/api/restaurants/${rid}/menus`)
        if (!menusRes.ok) throw new Error('Failed to fetch menus')
        const menusData = await menusRes.json()
        let menus = menusData.menus || menusData.data
        if (!Array.isArray(menus)) menus = Array.isArray(menusData) ? menusData : []

        if (menus.length === 0) {
          setMenuLoading(false)
          return
        }

        const mainMenu = menus[0]
        if (!mainMenu) { setMenuLoading(false); return; }

        // Fetch categories
        const catRes = await fetch(`/api/restaurants/${rid}/menus/${mainMenu.id}/categories`)
        if (catRes.ok) {
          const catData = await catRes.json()
          let catsRaw = catData.categories || catData.data
          if (!Array.isArray(catsRaw)) catsRaw = Array.isArray(catData) ? catData : []
          const activeCats = catsRaw
            .filter((c: any) => c.isActive)
            .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
            .map((c: any) => ({
              id: c.id,
              nameEn: c.name,
              nameAm: c.nameAm || '',
              nameI18n: c.nameI18n || null,
              emoji: c.icon || '🍽️',
              image: c.image || undefined,
            }))
          if (!cancelled) setCategories(activeCats)
        }

        // Fetch menu items
        const itemsRes = await fetch(`/api/restaurants/${rid}/menus/${mainMenu.id}/items`)
        if (itemsRes.ok) {
          const itemsData = await itemsRes.json()
          let rawItems = itemsData.items || itemsData.data
          if (!Array.isArray(rawItems)) rawItems = Array.isArray(itemsData) ? itemsData : []

          // Enrich items with modifier groups
          const enrichedItems = await Promise.all(
            rawItems.map(async (item: any) => {
              try {
                const [modRes, detailRes] = await Promise.all([
                  fetch(`/api/restaurants/${rid}/items/${item.id}/modifiers`),
                  fetch(`/api/restaurants/${rid}/items/${item.id}`),
                ])
                let modifierGroups: any[] = []
                let comboItems: any[] = []
                if (modRes.ok) {
                  const modData = await modRes.json()
                  modifierGroups = Array.isArray(modData.modifierGroups) ? modData.modifierGroups : Array.isArray(modData.data) ? modData.data : Array.isArray(modData) ? modData : []
                }
                if (detailRes.ok) {
                  const detailData = await detailRes.json()
                  comboItems = Array.isArray(detailData.item?.comboItems) ? detailData.item.comboItems : Array.isArray(detailData.comboItems) ? detailData.comboItems : []
                }

                // Map API modifier groups to store format
                const mappedModifiers: ModifierGroup[] = (Array.isArray(modifierGroups) ? modifierGroups : []).map((mg: any) => ({
                  id: mg.id,
                  nameEn: mg.name,
                  nameAm: mg.nameAm || '',
                  required: mg.isRequired || false,
                  singleSelect: mg.selectionType === 'single',
                  options: (mg.options || []).map((opt: any) => ({
                    id: opt.id,
                    nameEn: opt.name,
                    nameAm: opt.nameAm || '',
                    priceDeltaCents: opt.priceDeltaCents || 0,
                  })),
                }))

                // Collect addon-like modifier options from non-required multi-select groups
                const addons: ModifierOption[] = []
                for (const mg of modifierGroups) {
                  if (!mg.isRequired && mg.selectionType !== 'single') {
                    for (const opt of mg.options || []) {
                      addons.push({
                        id: opt.id,
                        nameEn: opt.name,
                        nameAm: opt.nameAm || '',
                        priceDeltaCents: opt.priceDeltaCents || 0,
                      })
                    }
                  }
                }

                // Map ingredients from the detail response (menuItemIngredients)
                let detailJson: any = null
                if (detailRes.ok) {
                  const detailData = await detailRes.json()
                  detailJson = detailData.item || detailData
                }
                const rawIngredients: IngredientItem[] = []
                if (detailJson?.menuItemIngredients && Array.isArray(detailJson.menuItemIngredients)) {
                  for (const mi of detailJson.menuItemIngredients) {
                    if (mi.isDefault && mi.ingredient) {
                      let allergens: string[] = []
                      try { if (mi.ingredient.allergens) allergens = JSON.parse(mi.ingredient.allergens) } catch {}
                      rawIngredients.push({
                        id: mi.ingredient.id,
                        nameEn: mi.ingredient.name || '',
                        nameAm: mi.ingredient.nameAm || '',
                        isRemovable: mi.isRemovable,
                        isDefault: mi.isDefault,
                        allergens,
                      })
                    }
                  }
                } else if (item.ingredients) {
                  // Fallback: parse legacy ingredients JSON
                  try {
                    const names = JSON.parse(item.ingredients)
                    if (Array.isArray(names)) {
                      for (const name of names) {
                        rawIngredients.push({
                          id: `legacy-${name}`,
                          nameEn: name,
                          nameAm: '',
                          isRemovable: true,
                          isDefault: true,
                        })
                      }
                    }
                  } catch {}
                }

                // Map allergens from API response
                const allergens: { id: string; name: string; icon: string | null }[] = []
                if (Array.isArray(item.menuItemAllergens)) {
                  for (const ma of item.menuItemAllergens) {
                    if (ma.allergen) {
                      allergens.push({
                        id: ma.allergen.id,
                        name: ma.allergen.name,
                        icon: ma.allergen.icon || null,
                      })
                    }
                  }
                }

                return {
                  id: item.id,
                  nameEn: item.name,
                  nameAm: item.nameAm || '',
                  nameI18n: item.nameI18n || null,
                  descriptionEn: item.description || '',
                  descriptionAm: item.descriptionAm || '',
                  descriptionI18n: item.descriptionI18n || null,
                  priceCents: item.priceCents,
                  categoryId: item.categoryId,
                  emoji: item.image ? '🍽️' : (item.isPopular ? '⭐' : '🍽️'),
                  imageColor: item.isVegetarian ? '#A8D5A2' : item.isSpicy ? '#E67E22' : '#D4A574',
                  image: item.image || undefined,
                  isVegetarian: item.isVegetarian || false,
                  isVegan: item.isVegan || false,
                  isGlutenFree: item.isGlutenFree || false,
                  isDairyFree: item.isDairyFree || false,
                  isHalal: item.isHalal || false,
                  isSpicy: item.isSpicy || false,
                  isAvailable: item.isAvailable !== false,
                  currentAvailable: item.currentAvailable !== false && item.isAvailable !== false,
                  modifiers: mappedModifiers,
                  addons,
                  ingredients: rawIngredients,
                  allergens,
                  comboItems: (Array.isArray(comboItems) ? comboItems : []).map((ci: any) => ({
                    id: ci.id,
                    includedItemId: ci.includedItemId,
                    quantity: ci.quantity,
                    includedItem: ci.includedItem ? {
                      id: ci.includedItem.id,
                      name: ci.includedItem.name,
                      nameAm: ci.includedItem.nameAm || '',
                      priceCents: ci.includedItem.priceCents || 0,
                    } : undefined,
                  })),
                } as any
              } catch {
                return {
                  id: item.id,
                  nameEn: item.name,
                  nameAm: item.nameAm || '',
                  nameI18n: item.nameI18n || null,
                  descriptionEn: item.description || '',
                  descriptionAm: item.descriptionAm || '',
                  descriptionI18n: item.descriptionI18n || null,
                  priceCents: item.priceCents,
                  categoryId: item.categoryId,
                  emoji: '🍽️',
                  imageColor: '#D4A574',
                  image: item.image || undefined,
                  isVegetarian: item.isVegetarian || false,
                  isVegan: item.isVegan || false,
                  isGlutenFree: item.isGlutenFree || false,
                  isDairyFree: item.isDairyFree || false,
                  isHalal: item.isHalal || false,
                  isSpicy: item.isSpicy || false,
                  isAvailable: item.isAvailable !== false,
                  currentAvailable: item.currentAvailable !== false && item.isAvailable !== false,
                  modifiers: [],
                  addons: [],
                  ingredients: [],
                  allergens: [],
                  comboItems: [],
                }
              }
            })
          )

          if (!cancelled) setMenuItems(enrichedItems)
        }
      } catch (err) {
        console.error('[MENU_FETCH_ERROR]', err)
        // Show proper error state instead of silently falling back to mock data
        if (!cancelled) {
          setMenuError(
            'Unable to load menu. Please check your connection and try again.'
          )
        }
      } finally {
        if (!cancelled) setMenuLoading(false)
      }
    }
    fetchMenu()
    return () => { cancelled = true }
  }, [session?.restaurantId])

  return { categories, menuItems, menuLoading, menuError }
}

// ─── Welcome Screen ────────────────────────────────────────────
function WelcomeScreen() {
  const { language, setLanguage, setScreen, setSession, session } = useCustomerStore()

  const handleStart = () => {
    if (session) {
      setScreen('menu')
      return
    }
    // No session means no QR scan — show message to scan QR code
    // (previously fell back to demo mock data)
  }

  const nameEn = session?.restaurantName || 'Yene QR'
  const nameAm = session?.restaurantNameAm || 'የኔ ኪውአር'
  const taglineEn = session?.taglineEn || 'Scan QR to Order'
  const taglineAm = session?.taglineAm || 'ለመዋቅር QR ይስኩን'
  const tableNumber = session?.tableNumber || 0
  const branchEn = session?.branchName || ''
  const branchAm = ''

  return (
    <motion.div
      className="flex flex-col min-h-screen bg-gradient-to-b from-brand/10 via-background to-background"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.4 }}
    >
      {/* Language Picker */}
      <div className="flex justify-end p-4">
        <CustomerLanguagePicker />
      </div>

      {/* Hero Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          className="w-28 h-28 rounded-3xl bg-brand flex items-center justify-center mb-8 shadow-lg shadow-brand/30 overflow-hidden"
        >
          {session?.restaurantLogo ? (
            <img src={session.restaurantLogo} alt={nameEn} className="w-full h-full object-cover" />
          ) : (
            <UtensilsCrossed className="w-14 h-14 text-brand-foreground" />
          )}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-3xl font-bold text-center mb-2"
        >
          {t(nameEn, nameAm, language)}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-muted-foreground text-center mb-2"
        >
          {t(taglineEn, taglineAm, language)}
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-2 text-sm text-muted-foreground mb-12"
        >
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
            {t('Table', 'ጠረጴዛ', language)} {tableNumber}
          </span>
          <span>•</span>
          <span>{t(branchEn, branchAm, language)}</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="w-full max-w-xs"
        >
          {session ? (
            <Button
              onClick={handleStart}
              size="lg"
              className="w-full h-14 text-lg font-semibold rounded-2xl bg-brand hover:bg-brand-dark text-brand-foreground shadow-lg shadow-brand/25 active:scale-[0.98] transition-all"
            >
              {t('Start Ordering', 'ትዕዛዝ ጀምር', language)}
            </Button>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {t('Scan a QR code on your table to start ordering', 'ለመዋቅር በጠረጴዛዎ ላይ ያለውን QR ኮድ ይስኩን', language)}
              </p>
            </div>
          )}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-xs text-muted-foreground mt-4 text-center"
        >
          {t('Scan QR code to order directly from your table', 'ከጠረጴዛዎ ቀጥታ ለመዋቅር QR ኮድ ይስኩን', language)}
        </motion.p>
      </div>

      {/* Bottom decorative dots */}
      <div className="flex justify-center gap-2 pb-8">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 + i * 0.15 }}
            className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-brand' : 'bg-muted-foreground/30'}`}
          />
        ))}
      </div>
    </motion.div>
  )
}

// ─── Dietary Filter Chips ─────────────────────────────────────
const DIETARY_FILTERS = [
  { key: 'vegan', labelEn: 'Vegan', labelAm: 'ቬጋን', icon: Leaf, color: 'text-emerald-700 bg-emerald-100 border-emerald-200' },
  { key: 'vegetarian', labelEn: 'Vegetarian', labelAm: 'አትክልት', icon: Leaf, color: 'text-green-700 bg-green-100 border-green-200' },
  { key: 'gluten-free', labelEn: 'Gluten-Free', labelAm: 'ግሉተን-ከስተ', icon: Wheat, color: 'text-amber-700 bg-amber-100 border-amber-200' },
  { key: 'dairy-free', labelEn: 'Dairy-Free', labelAm: 'ወተት-ከስተ', icon: MilkOff, color: 'text-sky-700 bg-sky-100 border-sky-200' },
  { key: 'halal', labelEn: 'Halal', labelAm: 'ሃላል', icon: ShieldCheck, color: 'text-teal-700 bg-teal-100 border-teal-200' },
  { key: 'nut-free', labelEn: 'Nut-Free', labelAm: 'ለውዝ-ከስተ', icon: Nut, color: 'text-orange-700 bg-orange-100 border-orange-200' },
] as const

type DietaryFilterKey = typeof DIETARY_FILTERS[number]['key']

function DietaryFilterBar({ activeFilters, onToggle }: { activeFilters: Set<DietaryFilterKey>, onToggle: (key: DietaryFilterKey) => void }) {
  const { language } = useCustomerStore()

  return (
    <div className="flex gap-1.5 px-4 pb-2 overflow-x-auto scrollbar-hide">
      {DIETARY_FILTERS.map((filter) => {
        const isActive = activeFilters.has(filter.key)
        const IconComp = filter.icon
        return (
          <button
            key={filter.key}
            onClick={() => onToggle(filter.key)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all active:scale-95 border ${
              isActive
                ? filter.color + ' border-current/20 shadow-sm'
                : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80'
            }`}
          >
            <IconComp className="w-3 h-3" />
            {t(filter.labelEn, filter.labelAm, language)}
          </button>
        )
      })}
    </div>
  )
}

// ─── Allergen Badge for item cards ───────────────────────────
function AllergenBadges({ allergens, language }: { allergens: AllergenInfo[], language: string }) {
  if (!allergens || allergens.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {allergens.map((a) => (
        <span
          key={a.id}
          className="inline-flex items-center gap-0.5 text-[9px] text-red-700 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-full"
          title={a.name}
        >
          <AlertTriangle className="w-2.5 h-2.5" />
          {a.icon || a.name}
        </span>
      ))}
    </div>
  )
}

// ─── Menu Browser Screen ───────────────────────────────────────
function MenuBrowser() {
  const store = useCustomerStore()
  const { language, setLanguage, session, categories, menuItems, menuLoading, menuError, loyaltyPoints, setScreen } = store
  const [activeCategory, setActiveCategory] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeDietaryFilters, setActiveDietaryFilters] = useState<Set<DietaryFilterKey>>(new Set())

  const toggleDietaryFilter = useCallback((key: DietaryFilterKey) => {
    setActiveDietaryFilters((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  // Set initial active category when categories load
  useEffect(() => {
    if (categories.length > 0 && !activeCategory && categories[0]?.id) {
      setActiveCategory(categories[0].id)
    }
  }, [categories, activeCategory])

  // Show error state if menu failed to load
  if (menuError && categories.length === 0 && menuItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-12">
        <AlertTriangle className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-semibold mb-2">{t('Menu Unavailable', 'ምናሌ የለም', language)}</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          {t('We couldn\'t load the menu right now. Please try again.', 'ምናሌውን በአሁኑ ጊዜ መጫን አልቻልንም። እባክዎ እንደገና ይሞክሩ።', language)}
        </p>
        <Button
          onClick={() => {
            useCustomerStore.getState().setMenuError(null)
            useCustomerStore.getState().setCategories([])
            useCustomerStore.getState().setMenuItems([])
          }}
          className="bg-brand hover:bg-brand-dark text-brand-foreground rounded-xl"
        >
          {t('Retry', 'እንደገና ሞክር', language)}
        </Button>
      </div>
    )
  }

  const displayCategories = categories
  const displayItems = menuItems

  const filteredItems = useMemo(() => {
    const items = displayItems.filter((item) => {
      const matchesCategory = !activeCategory || item.categoryId === activeCategory
      const matchesSearch =
        searchQuery === '' ||
        item.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.nameAm.includes(searchQuery) ||
        ((item as any).nameI18n && Object.values((item as any).nameI18n).some(v => v.toLowerCase().includes(searchQuery.toLowerCase())))

      // Apply dietary filters — ALL active filters must match
      let matchesDietary = true
      if (activeDietaryFilters.size > 0) {
        for (const filter of activeDietaryFilters) {
          if (filter === 'vegan' && !item.isVegan) { matchesDietary = false; break }
          if (filter === 'vegetarian' && !item.isVegetarian) { matchesDietary = false; break }
          if (filter === 'gluten-free' && !item.isGlutenFree) { matchesDietary = false; break }
          if (filter === 'dairy-free' && !item.isDairyFree) { matchesDietary = false; break }
          if (filter === 'halal' && !item.isHalal) { matchesDietary = false; break }
          if (filter === 'nut-free') {
            // Item must not contain any nut allergen
            const hasNutAllergen = (item.allergens || []).some(
              (a) => a.name.toLowerCase().includes('nut')
            )
            if (hasNutAllergen) { matchesDietary = false; break }
          }
        }
      }

      return matchesCategory && matchesSearch && matchesDietary
    })
    return items
  }, [activeCategory, searchQuery, displayItems, activeDietaryFilters])

  const nameEn = session?.restaurantName || 'Restaurant'
  const nameAm = session?.restaurantNameAm || 'ሬስቶራንት'
  const tableNumber = session?.tableNumber || 0

  if (menuLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="px-4 py-3">
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex gap-2 px-4 pb-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-20 rounded-full" />)}
          </div>
        </div>
        <MenuSkeleton />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {session?.restaurantLogo && (
              <img src={session.restaurantLogo} alt={nameEn} className="w-8 h-8 rounded-lg object-cover" />
            )}
            <div>
              <h1 className="text-lg font-bold">
                {t(nameEn, nameAm, language)}
              </h1>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  {t('Table', 'ጠረጴዛ', language)} {tableNumber}
                </p>
                {session?.restaurantId && session.restaurantId !== 'demo-1' && (
                  <LoyaltyBadge points={loyaltyPoints} language={language} />
                )}
              </div>
            </div>
          </div>
          <CustomerLanguagePicker size="sm" />
          <button
            onClick={() => setScreen('orders')}
            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform"
            title={t('My Orders', 'ትዕዛዞቼ', language)}
          >
            <History className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-2">
          <div className="relative">
            <input
              type="text"
              placeholder={t('Search menu...', 'ምናሌ ፈልግ...', language)}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 px-4 pr-10 rounded-xl bg-muted border-0 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Dietary Filter Chips */}
        <DietaryFilterBar activeFilters={activeDietaryFilters} onToggle={toggleDietaryFilter} />

        {/* Category Tabs */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
          {displayCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all active:scale-95 ${
                activeCategory === cat.id
                  ? 'bg-brand text-brand-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {cat.image ? (
                <img src={cat.image} alt={resolveI18n(cat.nameI18n, language, cat.nameEn)} className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <span>{cat.emoji}</span>
              )}
              {resolveI18n(cat.nameI18n, language, cat.nameEn)}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Items */}
      <div className="flex-1 overflow-y-auto px-4 py-3 pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="grid gap-3"
          >
            {filteredItems.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Coffee className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{t('No items found', 'ዕቃ አልተገኘም', language)}</p>
              </div>
            )}
            {filteredItems.map((item, index) => (
              <MenuItemCard key={item.id} item={item} index={index} />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Menu Item Card ────────────────────────────────────────────
function MenuItemCard({ item, index }: { item: MenuItem; index: number }) {
  const { language, setSelectedItem, setIsItemDetailOpen } = useCustomerStore()
  const lang = language
  const comboItems = (item as any).comboItems as any[] | undefined
  const isCombo = comboItems && comboItems.length > 0

  // Use currentAvailable (server-computed real-time availability) if available,
  // otherwise fall back to isAvailable
  const isCurrentlyAvailable = item.currentAvailable !== undefined ? item.currentAvailable : item.isAvailable

  return (
    <motion.button
      variants={itemVariants}
      initial="initial"
      animate="animate"
      transition={{ delay: index * 0.05 }}
      onClick={() => {
        if (!isCurrentlyAvailable) return
        setSelectedItem(item)
        setIsItemDetailOpen(true)
      }}
      className={`flex gap-3 p-3 rounded-2xl bg-card border border-border shadow-sm text-left transition-all active:scale-[0.98] relative ${
        !isCurrentlyAvailable ? 'opacity-60' : 'hover:shadow-md'
      }`}
    >
      {/* Currently Unavailable overlay badge */}
      {!isCurrentlyAvailable && (
        <div className="absolute top-2 right-2 z-10">
          <Badge variant="secondary" className="text-[10px] bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300 border-0">
            <Clock className="w-3 h-3 mr-0.5" />
            {t('Currently Unavailable', 'አሁን የለም', lang)}
          </Badge>
        </div>
      )}

      {/* Image */}
      {item.image ? (
        <div className={`w-24 h-24 rounded-xl overflow-hidden shrink-0 ${!isCurrentlyAvailable ? 'grayscale' : ''}`}>
          <img
            src={item.image}
            alt={resolveI18n((item as any).nameI18n, lang, item.nameEn)}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div
          className={`w-24 h-24 rounded-xl flex items-center justify-center text-4xl shrink-0 ${!isCurrentlyAvailable ? 'grayscale' : ''}`}
          style={{ backgroundColor: item.imageColor + '25' }}
        >
          {item.emoji}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className={`font-semibold text-sm leading-tight ${!isCurrentlyAvailable ? 'text-muted-foreground' : ''}`}>
            {resolveI18n((item as any).nameI18n, lang, item.nameEn)}
          </h3>
          <div className="flex gap-1 shrink-0">
            {isCombo && (
              <Badge variant="secondary" className="text-[10px] bg-purple-50 text-purple-700">
                <Package className="w-3 h-3 mr-0.5" />
                {t('Combo', 'ኮምቦ', lang)}
              </Badge>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
          {resolveI18n((item as any).descriptionI18n, lang, item.descriptionEn)}
        </p>

        {/* Combo items preview */}
        {isCombo && (
          <p className="text-[10px] text-purple-600 mt-1">
            {t('Includes', 'ያካትታል', lang)}: {comboItems!.map((ci: any) => `${ci.includedItem?.name || t('Item', 'ዕቃ', lang)} ×${ci.quantity}`).join(', ')}
          </p>
        )}

        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {item.isVegan && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
              <Leaf className="w-3 h-3" />
              {t('Vegan', 'ቬጋን', lang)}
            </span>
          )}
          {item.isVegetarian && !item.isVegan && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
              <Leaf className="w-3 h-3" />
              {t('Veg', 'አትክልት', lang)}
            </span>
          )}
          {item.isGlutenFree && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
              <Wheat className="w-3 h-3" />
              GF
            </span>
          )}
          {item.isDairyFree && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded-full">
              <MilkOff className="w-3 h-3" />
              DF
            </span>
          )}
          {item.isHalal && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded-full">
              <ShieldCheck className="w-3 h-3" />
              {t('Halal', 'ሃላል', lang)}
            </span>
          )}
          {item.isSpicy && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded-full">
              <Flame className="w-3 h-3" />
              {t('Spicy', 'ቅመም', lang)}
            </span>
          )}
        </div>

        {/* Allergen Warning Badges */}
        <AllergenBadges allergens={item.allergens || []} language={lang} />

        <div className="flex items-center justify-between mt-2">
          <span className={`font-bold text-sm ${!isCurrentlyAvailable ? 'text-muted-foreground' : 'text-brand'}`}>
            {formatPrice(item.priceCents)}
          </span>
          {isCurrentlyAvailable ? (
            <span className="w-8 h-8 rounded-full bg-brand text-brand-foreground flex items-center justify-center shadow-sm">
              <Plus className="w-4 h-4" />
            </span>
          ) : (
            <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center cursor-not-allowed">
              <Plus className="w-4 h-4 text-muted-foreground" />
            </span>
          )}
        </div>
      </div>
    </motion.button>
  )
}

// ─── Item Detail Sheet Inner (keyed by item id to reset state) ─
function ItemDetailSheetInner() {
  const store = useCustomerStore()
  const { language, selectedItem, setIsItemDetailOpen, setSelectedItem, addToCart } = store
  const lang = language

  const [quantity, setQuantity] = useState(1)
  const [selectedModifiers, setSelectedModifiers] = useState<CartItemModifier[]>([])
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set())
  const [removedIngredients, setRemovedIngredients] = useState<Set<string>>(new Set())
  const [specialInstructions, setSpecialInstructions] = useState('')
  const [showAddedFeedback, setShowAddedFeedback] = useState(false)

  const item = selectedItem
  const comboItems = (item as any)?.comboItems as any[] | undefined

  const totalPriceCents = useMemo(() => {
    if (!item) return 0
    let price = item.priceCents
    selectedModifiers.forEach((mod) => {
      price += mod.priceDeltaCents
    })
    selectedAddons.forEach((addonId) => {
      const addon = item.addons.find((a) => a.id === addonId)
      if (addon) price += addon.priceDeltaCents
    })
    return price * quantity
  }, [item, selectedModifiers, selectedAddons, quantity])

  const handleModifierSelect = useCallback(
    (group: ModifierGroup, option: ModifierOption) => {
      setSelectedModifiers((prev) => {
        if (group.singleSelect) {
          // For single-select: replace any existing selection in this group
          const existing = prev.find((m) => m.modifierGroupId === group.id)
          if (existing?.modifierOptionId === option.id && !group.required) {
            // Deselect if clicking the same option and group is not required
            return prev.filter((m) => m.modifierGroupId !== group.id)
          }
          // Remove any prior selection for this group, then add the new one
          const filtered = prev.filter((m) => m.modifierGroupId !== group.id)
          return [
            ...filtered,
            {
              modifierGroupId: group.id,
              modifierOptionId: option.id,
              name: option.nameEn,
              nameEn: option.nameEn,
              nameAm: option.nameAm,
              priceDeltaCents: option.priceDeltaCents,
              quantity: 1,
            },
          ]
        } else {
          // For multi-select: toggle the specific option within the group
          const existing = prev.find(
            (m) => m.modifierGroupId === group.id && m.modifierOptionId === option.id
          )
          if (existing) {
            return prev.filter(
              (m) => !(m.modifierGroupId === group.id && m.modifierOptionId === option.id)
            )
          }
          return [
            ...prev,
            {
              modifierGroupId: group.id,
              modifierOptionId: option.id,
              name: option.nameEn,
              nameEn: option.nameEn,
              nameAm: option.nameAm,
              priceDeltaCents: option.priceDeltaCents,
              quantity: 1,
            },
          ]
        }
      })
    },
    []
  )

  const handleAddonToggle = useCallback((addonId: string) => {
    setSelectedAddons((prev) => {
      const next = new Set(prev)
      if (next.has(addonId)) {
        next.delete(addonId)
      } else {
        next.add(addonId)
      }
      return next
    })
  }, [])

  const handleAddToCart = () => {
    if (!item) return
    // Block adding unavailable items to cart
    const isCurrentlyAvailable = item.currentAvailable !== undefined ? item.currentAvailable : item.isAvailable
    if (!isCurrentlyAvailable) return

    const modifierList = selectedModifiers
    const addonList = item.addons.filter((a) => selectedAddons.has(a.id))
    const removedIngredientsList = item.ingredients.filter((ing) => removedIngredients.has(ing.id))

    const cartItem: CartItem = {
      menuItem: item,
      quantity,
      selectedModifiers: modifierList,
      selectedAddons: addonList,
      removedIngredients: removedIngredientsList,
      specialInstructions,
      totalPriceCents: totalPriceCents / quantity,
    }

    addToCart(cartItem)
    setShowAddedFeedback(true)
    setTimeout(() => {
      setIsItemDetailOpen(false)
      setSelectedItem(null)
    }, 800)
  }

  if (!item) return null

  return (
    <div className="overflow-y-auto max-h-[85vh]">
      {/* Item Image */}
      {item.image ? (
        <div className="w-full h-56 relative">
          <img
            src={item.image}
            alt={resolveI18n((item as any).nameI18n, lang, item.nameEn)}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          <div className="absolute top-2 right-2">
            <button
              onClick={() => {
                setIsItemDetailOpen(false)
                setSelectedItem(null)
              }}
              className="w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          className="w-full h-48 flex items-center justify-center text-6xl relative"
          style={{ backgroundColor: item.imageColor + '30' }}
        >
          {item.emoji}
          <div className="absolute top-2 right-2">
            <button
              onClick={() => {
                setIsItemDetailOpen(false)
                setSelectedItem(null)
              }}
              className="w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

          {/* Item Info */}
          <div className="px-4 pt-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold">{resolveI18n((item as any).nameI18n, lang, item.nameEn)}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {resolveI18n((item as any).descriptionI18n, lang, item.descriptionEn)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {item.isVegan && (
                <Badge variant="secondary" className="text-emerald-700 bg-emerald-100 border-emerald-200">
                  <Leaf className="w-3 h-3 mr-1" />
                  {t('Vegan', 'ቬጋን', lang)}
                </Badge>
              )}
              {item.isVegetarian && !item.isVegan && (
                <Badge variant="secondary" className="text-green-700 bg-green-100 border-green-200">
                  <Leaf className="w-3 h-3 mr-1" />
                  {t('Vegetarian', 'አትክልት', lang)}
                </Badge>
              )}
              {item.isGlutenFree && (
                <Badge variant="secondary" className="text-amber-700 bg-amber-100 border-amber-200">
                  <Wheat className="w-3 h-3 mr-1" />
                  {t('Gluten-Free', 'ግሉተን-ከስተ', lang)}
                </Badge>
              )}
              {item.isDairyFree && (
                <Badge variant="secondary" className="text-sky-700 bg-sky-100 border-sky-200">
                  <MilkOff className="w-3 h-3 mr-1" />
                  {t('Dairy-Free', 'ወተት-ከስተ', lang)}
                </Badge>
              )}
              {item.isHalal && (
                <Badge variant="secondary" className="text-teal-700 bg-teal-100 border-teal-200">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  {t('Halal', 'ሃላል', lang)}
                </Badge>
              )}
              {item.isSpicy && (
                <Badge variant="secondary" className="text-orange-700 bg-orange-100 border-orange-200">
                  <Flame className="w-3 h-3 mr-1" />
                  {t('Spicy', 'ቅመም', lang)}
                </Badge>
              )}
              {comboItems && comboItems.length > 0 && (
                <Badge variant="secondary" className="text-purple-700 bg-purple-100 border-purple-200">
                  <Package className="w-3 h-3 mr-1" />
                  {t('Combo', 'ኮምቦ', lang)}
                </Badge>
              )}
            </div>

            {/* Allergen Warnings in Detail View */}
            {item.allergens && item.allergens.length > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800">
                <h4 className="text-xs font-semibold text-red-700 mb-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {t('Allergen Warnings', 'የአለርጂ ማስጠንቀቂያ', lang)}
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {item.allergens.map((a) => (
                    <span key={a.id} className="inline-flex items-center gap-1 text-[11px] text-red-700 bg-red-100 px-2 py-1 rounded-full">
                      {a.icon && <span>{a.icon}</span>}
                      {a.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xl font-bold text-brand mt-3">
              {formatPrice(item.priceCents)}
            </p>

            {/* Combo Items List */}
            {comboItems && comboItems.length > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20">
                <h4 className="text-xs font-semibold text-purple-700 mb-2">{t('Included Items', 'ያካትታል ዕቃዎች', lang)}</h4>
                {comboItems.map((ci: any) => (
                  <div key={ci.id} className="flex justify-between text-xs text-purple-600 py-0.5">
                    <span>{ci.includedItem?.name || t('Item', 'ዕቃ', lang)}</span>
                    <span>×{ci.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator className="my-4" />

          {/* Ingredients — Remove what you don't want */}
          {item.ingredients.length > 0 && (
            <div className="px-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-sm">
                  {t('Ingredients', 'ንጥረ ነገሮች', lang)}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {t('Tap to remove', 'ለማስወግድ ይጫኑ', lang)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {item.ingredients.map((ing) => {
                  const isRemoved = removedIngredients.has(ing.id)
                  const hasAllergen = ing.allergens && ing.allergens.length > 0
                  return (
                    <button
                      key={ing.id}
                      onClick={() => {
                        if (!ing.isRemovable) return
                        setRemovedIngredients((prev) => {
                          const next = new Set(prev)
                          if (next.has(ing.id)) {
                            next.delete(ing.id)
                          } else {
                            next.add(ing.id)
                          }
                          return next
                        })
                      }}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 ${
                        isRemoved
                          ? 'bg-red-100 text-red-600 line-through dark:bg-red-900/30 dark:text-red-400'
                          : ing.isRemovable
                            ? 'bg-secondary text-secondary-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20'
                            : 'bg-muted text-muted-foreground cursor-default'
                      }`}
                    >
                      {isRemoved && <X className="w-3 h-3" />}
                      {hasAllergen && !isRemoved && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                      {t(ing.nameEn, ing.nameAm, lang)}
                    </button>
                  )
                })}
              </div>
              {removedIngredients.size > 0 && (
                <p className="text-[11px] text-red-500 mt-2">
                  {t(`${removedIngredients.size} item(s) will be removed`, `${removedIngredients.size} ዕቃ(ዎች) ይወገዳሉ`, lang)}
                </p>
              )}
            </div>
          )}

          {/* Modifier Groups */}
          {item.modifiers.map((group) => (
            <div key={group.id} className="px-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-sm">
                  {t(group.nameEn, group.nameAm, lang)}
                </h3>
                {group.required && (
                  <Badge variant="outline" className="text-[10px]">
                    {t('Required', 'አስፈላጊ', lang)}
                  </Badge>
                )}
                {group.singleSelect && (
                  <span className="text-xs text-muted-foreground">
                    {t('Choose 1', '1 ምረጥ', lang)}
                  </span>
                )}
              </div>
              <div className="grid gap-2">
                {group.options.map((option) => {
                  const isSelected = selectedModifiers.some(
                    (m) => m.modifierGroupId === group.id && m.modifierOptionId === option.id
                  )
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleModifierSelect(group, option)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all active:scale-[0.98] ${
                        isSelected
                          ? 'border-brand bg-brand/5'
                          : 'border-border hover:border-brand/30'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-brand bg-brand' : 'border-muted-foreground/40'
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-brand-foreground" />}
                        </div>
                        <span className="text-sm font-medium">
                          {t(option.nameEn, option.nameAm, lang)}
                        </span>
                      </div>
                      {option.priceDeltaCents > 0 && (
                        <span className="text-sm text-muted-foreground">
                          +{formatPrice(option.priceDeltaCents)}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Addons */}
          {item.addons.length > 0 && (
            <div className="px-4 mb-4">
              <h3 className="font-semibold text-sm mb-2">
                {t('Add-ons', 'ተጨማሪ', lang)}
              </h3>
              <div className="grid gap-2">
                {item.addons.map((addon) => {
                  const isSelected = selectedAddons.has(addon.id)
                  return (
                    <button
                      key={addon.id}
                      onClick={() => handleAddonToggle(addon.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all active:scale-[0.98] ${
                        isSelected
                          ? 'border-brand bg-brand/5'
                          : 'border-border hover:border-brand/30'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                            isSelected ? 'border-brand bg-brand' : 'border-muted-foreground/40'
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-3 h-3 text-brand-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm font-medium">
                          {t(addon.nameEn, addon.nameAm, lang)}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        +{formatPrice(addon.priceDeltaCents)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <Separator className="my-2" />

          {/* Special Instructions */}
          <div className="px-4 mb-4">
            <h3 className="font-semibold text-sm mb-2">
              {t('Special Instructions', 'ልዩ መመሪያ', lang)}
            </h3>
            <Textarea
              placeholder={t('Any allergies or preferences...', 'ማንኛውም አለርጂ ወይም ምርጫ...', lang)}
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              className="min-h-[80px] rounded-xl resize-none"
            />
          </div>

          {/* Quantity & Add to Cart */}
          <div className="sticky bottom-0 bg-background border-t border-border p-4">
            {(() => {
              const isCurrentlyAvailable = item ? (item.currentAvailable !== undefined ? item.currentAvailable : item.isAvailable) : true
              return (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 bg-muted rounded-xl px-3 py-2">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-8 rounded-full bg-card flex items-center justify-center shadow-sm active:scale-90 transition-transform"
                  disabled={!isCurrentlyAvailable}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-6 text-center font-bold">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-8 h-8 rounded-full bg-brand text-brand-foreground flex items-center justify-center shadow-sm active:scale-90 transition-transform"
                  disabled={!isCurrentlyAvailable}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <Button
                onClick={handleAddToCart}
                disabled={!isCurrentlyAvailable}
                className={`flex-1 h-12 rounded-xl font-semibold text-base shadow-lg active:scale-[0.98] transition-all ${
                  isCurrentlyAvailable
                    ? 'bg-brand hover:bg-brand-dark text-brand-foreground shadow-brand/25'
                    : 'bg-muted text-muted-foreground cursor-not-allowed shadow-none'
                }`}
              >
                {!isCurrentlyAvailable ? (
                  <span className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    {t('Currently Unavailable', 'አሁን የለም', lang)}
                  </span>
                ) : showAddedFeedback ? (
                  <motion.span
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    {t('Added!', 'ታክሏል!', lang)}
                  </motion.span>
                ) : (
                  `${t('Add to Cart', 'ወደ ጋሪ ጨምር', lang)} • ${formatPrice(totalPriceCents)}`
                )}
              </Button>
            </div>
              )
            })()}
          </div>
        </div>
  )
}

// ─── Item Detail Sheet (wrapper with key for state reset) ──────
function ItemDetailSheet() {
  const { selectedItem, isItemDetailOpen, setIsItemDetailOpen, setSelectedItem } = useCustomerStore()

  return (
    <Drawer open={isItemDetailOpen} onOpenChange={(open) => {
      if (!open) {
        setIsItemDetailOpen(false)
        setSelectedItem(null)
      }
    }}>
      <DrawerContent className="max-h-[92vh]">
        {selectedItem && <ItemDetailSheetInner key={selectedItem.id} />}
      </DrawerContent>
    </Drawer>
  )
}

// ─── Cart Bottom Sheet ─────────────────────────────────────────
function CartSheet() {
  const store = useCustomerStore()
  const { language, cart, isCartOpen, setIsCartOpen, removeFromCart, updateQuantity, getCartTotal, appliedPromotion, setAppliedPromotion, clearAppliedPromotion, session, addToCurrentOrder, currentOrder } = store
  const lang = language

  const [promoCode, setPromoCode] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoError, setPromoError] = useState('')

  const subtotal = getCartTotal()
  const discountAmountCents = appliedPromotion?.discountAmountCents ?? 0
  const afterDiscountCents = subtotal - discountAmountCents
  const taxRate = session?.taxRate ?? 0.1
  const serviceRate = session?.serviceCharge ?? 0.05
  const taxCents = Math.round(afterDiscountCents * taxRate)
  const serviceChargeCents = Math.round(afterDiscountCents * serviceRate)
  const totalCents = afterDiscountCents + taxCents + serviceChargeCents

  const handleApplyPromo = async () => {
    if (!promoCode.trim() || !session?.restaurantId) return
    setPromoLoading(true)
    setPromoError('')
    try {
      const itemIds = cart.map((ci) => ci.menuItem.id)
      const res = await fetch(`/api/restaurants/${session.restaurantId}/promotions/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode.trim().toUpperCase(), subtotal, itemIds }),
      })
      const data = await res.json()
      if (data.valid && data.promotion) {
        setAppliedPromotion({
          id: data.promotion.id,
          name: data.promotion.name,
          nameAm: data.promotion.nameAm || undefined,
          code: data.promotion.code,
          discountType: data.promotion.discountType,
          discountValueCents: data.promotion.discountValueCents,
          discountAmountCents: data.discountAmountCents,
          maxDiscountCents: data.promotion.maxDiscountCents ?? undefined,
        })
        setPromoCode('')
        toast.success(t('Promotion applied!', 'ማስተላለፊያ ተግባር ላይ ውሏል!', lang))
      } else {
        setPromoError(data.message || t('Invalid promotion code', 'ልክ ያልሆነ የማስተላለፊያ ኮድ', lang))
      }
    } catch {
      setPromoError(t('Failed to validate code', 'ኮድ ማረጋገጥ አልተሳካም', lang))
    } finally {
      setPromoLoading(false)
    }
  }

  const handleRemovePromo = () => {
    clearAppliedPromotion()
    setPromoError('')
  }

  return (
    <Drawer open={isCartOpen} onOpenChange={setIsCartOpen}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b border-border">
          <DrawerTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            {t('Your Cart', 'የእርስዎ ጋሪ', lang)}
            <Badge variant="secondary" className="ml-1">
              {cart.length} {cart.length === 1 ? t('item', 'ዕቃ', lang) : t('items', 'ዕቃዎች', lang)}
            </Badge>
          </DrawerTitle>
          <DrawerDescription>
            {t('Review your order before placing', 'ትዕዛዝዎን ከማስገባት በፊት ይገምግሙ', lang)}
          </DrawerDescription>
        </DrawerHeader>

        {cart.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t('Your cart is empty', 'ጋሪዎ ባዶ ነው', lang)}</p>
            <p className="text-sm mt-1">{t('Browse the menu to add items', 'ዕቃዎችን ለመጨመር ምናሌውን ያስሱ', lang)}</p>
          </div>
        ) : (
          <>
            <div className="overflow-y-auto max-h-[50vh] px-4 py-3">
              <AnimatePresence>
                {cart.map((cartItem, index) => (
                  <motion.div
                    key={`${cartItem.menuItem.id}-${index}`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0, x: -100 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0"
                  >
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0 overflow-hidden"
                      style={cartItem.menuItem.image ? undefined : { backgroundColor: cartItem.menuItem.imageColor + '25' }}
                    >
                      {cartItem.menuItem.image ? (
                        <img src={cartItem.menuItem.image} alt={resolveI18n(cartItem.menuItem.nameI18n, lang, cartItem.menuItem.nameEn)} className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        cartItem.menuItem.emoji
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">
                        {resolveI18n(cartItem.menuItem.nameI18n, lang, cartItem.menuItem.nameEn)}
                      </h4>
                      {(cartItem.selectedModifiers.length > 0 || cartItem.selectedAddons.length > 0) && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {[
                            ...cartItem.selectedModifiers.map((m) => t(m.nameEn, m.nameAm, lang)),
                            ...cartItem.selectedAddons.map((a) => t(a.nameEn, a.nameAm, lang)),
                          ].join(', ')}
                        </p>
                      )}
                      {cartItem.specialInstructions && (
                        <p className="text-xs text-orange-600 truncate mt-0.5">
                          📝 {cartItem.specialInstructions}
                        </p>
                      )}
                      <p className="text-sm font-semibold text-brand mt-1">
                        {formatPrice(cartItem.totalPriceCents * cartItem.quantity)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          if (cartItem.quantity <= 1) {
                            removeFromCart(index)
                          } else {
                            updateQuantity(index, cartItem.quantity - 1)
                          }
                        }}
                        className="w-8 h-8 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform"
                      >
                        {cartItem.quantity <= 1 ? (
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        ) : (
                          <Minus className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <span className="w-5 text-center text-sm font-medium">{cartItem.quantity}</span>
                      <button
                        onClick={() => updateQuantity(index, cartItem.quantity + 1)}
                        className="w-8 h-8 rounded-full bg-brand text-brand-foreground flex items-center justify-center active:scale-90 transition-transform"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Coupon / Promotion Code */}
            <div className="border-t border-border px-4 py-3">
              {appliedPromotion ? (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <Tag className="w-4 h-4 text-green-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400 truncate">
                      {t(appliedPromotion.name, appliedPromotion.nameAm || appliedPromotion.name, lang)}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-500">
                      {appliedPromotion.discountType === 'percentage'
                        ? `-${(appliedPromotion.discountValueCents / 100).toFixed(appliedPromotion.discountValueCents % 100 === 0 ? 0 : 1)}%`
                        : `-${formatPrice(appliedPromotion.discountValueCents)}`}
                      {' · '}
                      {t('Save', 'ቁጠባ', lang)} {formatPrice(appliedPromotion.discountAmountCents)}
                    </p>
                  </div>
                  <button
                    onClick={handleRemovePromo}
                    className="shrink-0 w-7 h-7 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <X className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={promoCode}
                      onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError('') }}
                      placeholder={t('Promo code', 'የማስተላለፊያ ኮድ', lang)}
                      className="pl-9 h-10 text-sm rounded-xl"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleApplyPromo() }}
                    />
                  </div>
                  <Button
                    onClick={handleApplyPromo}
                    disabled={!promoCode.trim() || promoLoading}
                    variant="outline"
                    className="h-10 px-4 rounded-xl shrink-0"
                  >
                    {promoLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      t('Apply', 'ተግብር', lang)
                    )}
                  </Button>
                </div>
              )}
              {promoError && (
                <p className="text-xs text-destructive mt-1.5">{promoError}</p>
              )}
            </div>

            {/* Totals */}
            <div className="border-t border-border px-4 py-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">{t('Subtotal', 'ጠቅላላ', lang)}</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {appliedPromotion && discountAmountCents > 0 && (
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-green-600">{t('Discount', 'ቅናሽ', lang)}</span>
                  <span className="text-green-600">-{formatPrice(discountAmountCents)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">{t(`Tax (${Math.round(taxRate * 100)}%)`, `ግብር (${Math.round(taxRate * 100)}%)`, lang)}</span>
                <span>{formatPrice(taxCents)}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">{t(`Service Charge (${Math.round(serviceRate * 100)}%)`, `አገልግሎት ክፍያ (${Math.round(serviceRate * 100)}%)`, lang)}</span>
                <span>{formatPrice(serviceChargeCents)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold mt-2">
                <span>{t('Total', 'ጠቅላላ', lang)}</span>
                <span className="text-brand">{formatPrice(totalCents)}</span>
              </div>
            </div>

            <DrawerFooter>
              {/* Add to current order banner */}
              {addToCurrentOrder && currentOrder && (
                <div className="flex items-center gap-2 p-3 mb-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs">
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>
                    {t(
                      `Adding to Order ${currentOrder.orderNumber}`,
                      `ወደ ትዕዛዝ ${currentOrder.orderNumber} መጨመር`,
                      lang
                    )}
                  </span>
                </div>
              )}
              <Button
                onClick={() => {
                  setIsCartOpen(false)
                  handlePlaceOrder(store)
                }}
                className="h-12 rounded-xl bg-brand hover:bg-brand-dark text-brand-foreground font-semibold text-base shadow-lg shadow-brand/25"
              >
                {addToCurrentOrder
                  ? t('Add to Order', 'ወደ ትዕዛዝ ጨምር', lang)
                  : t('Place Order', 'ትዕዛዝ ስጥ', lang)
                } • {formatPrice(totalCents)}
              </Button>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}

// ─── Place Order Handler ───────────────────────────────────────
async function handlePlaceOrder(store: ReturnType<typeof useCustomerStore.getState>) {
  const { cart, getCartTotal, setCurrentOrder, setScreen, setActiveTab, clearCart, session, appliedPromotion, clearAppliedPromotion, currentOrder, addToCurrentOrder, setAddToCurrentOrder } = store

  const subtotal = getCartTotal()
  const discountAmountCents = appliedPromotion?.discountAmountCents ?? 0
  const afterDiscountCents = subtotal - discountAmountCents
  const taxRate = session?.taxRate ?? 0.1
  const serviceRate = session?.serviceCharge ?? 0.05
  const taxCents = Math.round(afterDiscountCents * taxRate)
  const serviceChargeCents = Math.round(afterDiscountCents * serviceRate)
  const totalCents = afterDiscountCents + taxCents + serviceChargeCents

  // If adding to existing order, call the rounds API instead
  if (addToCurrentOrder && currentOrder && session?.restaurantId) {
    try {
      const roundItems = cart.map((ci) => ({
        menuItemId: ci.menuItem.id,
        quantity: ci.quantity,
        specialInstructions: ci.specialInstructions || undefined,
        removedIngredients: ci.removedIngredients?.length
          ? JSON.stringify(ci.removedIngredients.map((ri) => ({
              id: ri.id,
              name: ri.nameEn,
              nameAm: ri.nameAm || '',
            })))
          : undefined,
        modifierSelections: ci.selectedModifiers.map((m) => ({
          modifierGroupId: m.modifierGroupId,
          modifierOptionId: m.modifierOptionId,
          name: m.name || m.nameEn,
          priceDeltaCents: m.priceDeltaCents,
          quantity: m.quantity || 1,
        })),
      }))

      const res = await fetch(`/api/restaurants/${session.restaurantId}/orders/${currentOrder.id}/rounds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session.sessionToken ? { 'Authorization': `Bearer ${session.sessionToken}` } : {}),
        },
        body: JSON.stringify({ items: roundItems }),
      })

      if (res.ok) {
        const data = await res.json()

        // Update the existing order with new totals and round number
        setCurrentOrder({
          ...currentOrder,
          roundNumber: data.data.roundNumber || currentOrder.roundNumber + 1,
          subtotalCents: data.data.newSubtotalCents || currentOrder.subtotalCents,
          totalCents: data.data.newTotalCents || currentOrder.totalCents,
          // Add new items to existing items
          items: [
            ...currentOrder.items,
            ...cart.map((ci, i) => ({
              id: data.data.items?.[i]?.id || `round-item-${i}`,
              nameEn: ci.menuItem.nameEn,
              nameAm: ci.menuItem.nameAm,
              quantity: ci.quantity,
              priceCents: ci.totalPriceCents * ci.quantity,
              kitchenStatus: 'pending' as KitchenItemStatus,
              roundNumber: data.data.roundNumber || currentOrder.roundNumber + 1,
              modifierSelections: ci.selectedModifiers.map((m) => ({
                name: m.name || m.nameEn,
                priceDeltaCents: m.priceDeltaCents,
              })),
              removedIngredients: ci.removedIngredients?.map((ri) => ({
                id: ri.id,
                name: ri.nameEn,
                nameAm: ri.nameAm,
              })),
              specialInstructions: ci.specialInstructions,
            })),
          ],
        })

        setAddToCurrentOrder(false)
        clearCart()
        clearAppliedPromotion()
        setScreen('order')
        setActiveTab('order')
        return
      } else {
        const errData = await res.json().catch(() => ({}))
        console.error('[ROUND_API_ERROR]', errData)
        setAddToCurrentOrder(false)
        // Fall through to create a new order
      }
    } catch (err) {
      console.error('[ROUND_API_ERROR]', err)
      setAddToCurrentOrder(false)
      // Fall through to create a new order
    }
  }

  const orderItems: OrderItem[] = cart.map((ci, i) => ({
    id: `order-item-${i}`,
    nameEn: ci.menuItem.nameEn,
    nameAm: ci.menuItem.nameAm,
    quantity: ci.quantity,
    priceCents: ci.totalPriceCents * ci.quantity,
    kitchenStatus: 'pending' as KitchenItemStatus,
  }))

  // Try real API if we have a session with a restaurantId
  if (session?.restaurantId) {
    try {
      const effectiveBranchId = session.branchId || ''
      const effectiveTableId = session.tableId || ''

      const orderItemsPayload = cart.map((ci) => ({
        menuItemId: ci.menuItem.id,
        name: ci.menuItem.nameEn,
        nameAm: ci.menuItem.nameAm,
        priceCents: ci.totalPriceCents,
        quantity: ci.quantity,
        specialInstructions: ci.specialInstructions || null,
        removedIngredients: (ci.removedIngredients || []).map((ri) => ({
          id: ri.id,
          name: ri.nameEn,
          nameAm: ri.nameAm || '',
        })),
        modifiers: ci.selectedModifiers.map((m) => ({
          modifierGroupId: m.modifierGroupId,
          modifierOptionId: m.modifierOptionId,
          name: m.name || m.nameEn,
          priceDeltaCents: m.priceDeltaCents,
          quantity: m.quantity || 1,
        })),
      }))

      const res = await fetch(`/api/restaurants/${session.restaurantId}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session.sessionToken ? { 'Authorization': `Bearer ${session.sessionToken}` } : {}),
        },
        body: JSON.stringify({
          branchId: effectiveBranchId,
          tableId: effectiveTableId,
          sessionId: session.sessionId,
          type: 'dine_in',
          items: orderItemsPayload,
          promotionCode: appliedPromotion?.code || undefined,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const order = data.data || data

        // Map server items with real IDs for kitchen status tracking
        const serverItems = order.items || []
        const mappedOrderItems: OrderItem[] = serverItems.map((si: any, i: number) => {
          // Parse removedIngredients from JSON string if present
          let removedIngs: OrderItem['removedIngredients'] = undefined
          if (si.removedIngredients) {
            try {
              const parsed = typeof si.removedIngredients === 'string'
                ? JSON.parse(si.removedIngredients)
                : si.removedIngredients
              if (Array.isArray(parsed) && parsed.length > 0) {
                removedIngs = parsed.map((ri: any) => ({ id: ri.id, name: ri.name, nameAm: ri.nameAm }))
              }
            } catch {}
          }
          // Fallback to cart item's removedIngredients
          if (!removedIngs && cart[i]?.removedIngredients?.length) {
            removedIngs = cart[i].removedIngredients!.map((ri) => ({ id: ri.id, name: ri.nameEn, nameAm: ri.nameAm }))
          }

          // Map modifier selections from server
          let mods: OrderItem['modifierSelections'] = undefined
          if (si.modifierSelections && Array.isArray(si.modifierSelections) && si.modifierSelections.length > 0) {
            mods = si.modifierSelections.map((m: any) => ({ name: m.name, priceDeltaCents: m.priceDeltaCents || 0 }))
          }
          // Fallback to cart item's modifiers
          if (!mods && cart[i]?.selectedModifiers?.length) {
            mods = cart[i].selectedModifiers.map((m) => ({ name: m.name || m.nameEn, priceDeltaCents: m.priceDeltaCents }))
          }

          return {
            id: si.id || `order-item-${i}`,
            nameEn: si.name || cart[i]?.menuItem?.nameEn || '',
            nameAm: si.nameAm || cart[i]?.menuItem?.nameAm || '',
            quantity: si.quantity || cart[i]?.quantity || 1,
            priceCents: si.priceCents || cart[i]?.totalPriceCents || 0,
            kitchenStatus: (si.kitchenStatus || 'pending') as KitchenItemStatus,
            removedIngredients: removedIngs,
            modifierSelections: mods,
            specialInstructions: si.specialInstructions || cart[i]?.specialInstructions || undefined,
          }
        })

        setCurrentOrder({
          id: order.id,
          orderNumber: order.orderNumber || `#${Date.now().toString().slice(-4)}`,
          status: order.status || 'pending',
          items: mappedOrderItems.length > 0 ? mappedOrderItems : orderItems,
          subtotalCents: subtotal,
          taxCents: taxCents,
          serviceChargeCents: serviceChargeCents,
          totalCents: totalCents,
          paymentMethod: null,
          tipCents: 0,
          createdAt: new Date(),
          estimatedReadyAt: null,
        })

        // Credit loyalty points from the server response
        const serverPointsEarned = data.meta?.loyaltyPointsEarned || 0
        if (serverPointsEarned > 0) {
          store.addLoyaltyPoints(serverPointsEarned)
        }

        // Phase R4: Display estimated wait time to the customer
        const estimatedWaitMinutes = data.meta?.estimatedWaitMinutes
        if (estimatedWaitMinutes && estimatedWaitMinutes > 0) {
          const readyAt = new Date(Date.now() + estimatedWaitMinutes * 60000)
          setCurrentOrder((prev) => prev ? { ...prev, estimatedReadyAt: readyAt } : prev)
          // Show a toast with the estimated wait time
          if (typeof window !== 'undefined') {
            // Simple inline notification — no toast library in customer app
            console.log(`[ORDER] Estimated wait time: ${estimatedWaitMinutes} minutes`)
          }
        }

        clearCart()
        clearAppliedPromotion()
        setAddToCurrentOrder(false)
        setScreen('order')
        setActiveTab('order')

        // Real-time tracking is handled by useCustomerRealtime hook in OrderTrackingScreen
        // No need for separate startOrderTracking — the hook subscribes to SSE automatically
        return
      }
    } catch (err) {
      console.error('[ORDER_API_ERROR]', err)
      // Fall through to local order
    }
  }

  // Fallback: local order with simulated progression
  const order: Order = {
    id: `order-${Date.now()}`,
    orderNumber: `#${String(Math.floor(Math.random() * 9000) + 1000)}`,
    status: 'pending',
    items: orderItems,
    subtotalCents: subtotal,
    taxCents: taxCents,
    serviceChargeCents: serviceChargeCents,
    totalCents: totalCents,
    paymentMethod: null,
    tipCents: 0,
    roundNumber: 1,
    createdAt: new Date(),
    estimatedReadyAt: null,
  }

  setCurrentOrder(order)
  clearCart()
  setScreen('order')
  setActiveTab('order')

  simulateOrderProgress(order.id)
}

// NOTE: startOrderTracking() has been removed.
// Real-time order tracking is now handled entirely by the useCustomerRealtime hook
// inside the OrderTrackingScreen component, which subscribes to SSE events properly.

function simulateOrderProgress(orderId: string) {
  const statuses: Array<{ status: Order['status']; delay: number }> = [
    { status: 'accepted', delay: 3000 },
    { status: 'preparing', delay: 5000 },
    { status: 'ready', delay: 12000 },
    { status: 'served', delay: 5000 },
  ]

  let currentDelay = 0
  for (const { status, delay } of statuses) {
    currentDelay += delay
    setTimeout(() => {
      const store = useCustomerStore.getState()
      if (store.currentOrder?.id === orderId) {
        const updatedOrder = { ...store.currentOrder, status }
        if (status === 'accepted') {
          updatedOrder.estimatedReadyAt = new Date(Date.now() + 20 * 60 * 1000)
        }
        if (status === 'preparing') {
          updatedOrder.items = updatedOrder.items.map((item) => ({
            ...item,
            kitchenStatus: 'preparing' as KitchenItemStatus,
          }))
        }
        if (status === 'ready') {
          updatedOrder.items = updatedOrder.items.map((item) => ({
            ...item,
            kitchenStatus: 'ready' as KitchenItemStatus,
          }))
        }
        if (status === 'served') {
          updatedOrder.items = updatedOrder.items.map((item) => ({
            ...item,
            kitchenStatus: 'served' as KitchenItemStatus,
          }))
        }
        store.setCurrentOrder(updatedOrder)
      }
    }, currentDelay)
  }
}

// ─── Sticky Cart Bar ───────────────────────────────────────────
function StickyCartBar() {
  const { language, cart, getCartTotal, getCartItemCount, setIsCartOpen } = useCustomerStore()
  const lang = language

  if (cart.length === 0) return null

  const total = getCartTotal()
  const count = getCartItemCount()

  return (
    <motion.div
      initial={{ y: 80 }}
      animate={{ y: 0 }}
      exit={{ y: 80 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed bottom-16 left-0 right-0 z-30 px-4 pb-2"
    >
      <button
        onClick={() => setIsCartOpen(true)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-brand text-brand-foreground rounded-2xl shadow-xl shadow-brand/30 active:scale-[0.98] transition-transform"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-brand-foreground/20 flex items-center justify-center text-sm font-bold">
            {count}
          </div>
          <span className="font-medium">
            {count === 1 ? t('1 item', '1 ዕቃ', lang) : t(`${count} items`, `${count} ዕቃዎች`, lang)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold">{formatPrice(total)}</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </button>
    </motion.div>
  )
}

// ─── Order Tracking Screen ─────────────────────────────────────
function OrderTrackingScreen() {
  const { language, currentOrder, setScreen, setCurrentOrder, session } = useCustomerStore()
  const lang = language

  // Wire up real-time order tracking via SSE + polling fallback
  useCustomerRealtime({
    restaurantId: session?.restaurantId || '',
    orderId: currentOrder?.id || null,
    token: session?.sessionToken,
    enabled: !!currentOrder?.id && !!session?.restaurantId,
    onOrderUpdate: (serverOrder: any) => {
      const store = useCustomerStore.getState()
      if (!store.currentOrder || store.currentOrder.id !== serverOrder.id) return

      // Map per-item kitchen status from server, preserving removedIngredients/modifiers
      const updatedItems = store.currentOrder.items.map((item) => {
        const serverItem = (serverOrder.items || []).find((si: any) => si.id === item.id)
        if (!serverItem) return item

        const updated = { ...item }
        if (serverItem.kitchenStatus) {
          updated.kitchenStatus = serverItem.kitchenStatus as KitchenItemStatus
        }

        // Update removedIngredients from server if present
        if (serverItem.removedIngredients) {
          try {
            const parsed = typeof serverItem.removedIngredients === 'string'
              ? JSON.parse(serverItem.removedIngredients)
              : serverItem.removedIngredients
            if (Array.isArray(parsed)) {
              updated.removedIngredients = parsed.map((ri: any) => ({ id: ri.id, name: ri.name, nameAm: ri.nameAm }))
            }
          } catch {}
        }

        // Update modifier selections from server if present
        if (serverItem.modifierSelections && Array.isArray(serverItem.modifierSelections)) {
          updated.modifierSelections = serverItem.modifierSelections.map((m: any) => ({ name: m.name, priceDeltaCents: m.priceDeltaCents || 0 }))
        }

        return updated
      })

      setCurrentOrder({
        ...store.currentOrder,
        status: serverOrder.status || store.currentOrder.status,
        items: updatedItems,
        estimatedReadyAt: serverOrder.estimatedReadyAt ? new Date(serverOrder.estimatedReadyAt) : store.currentOrder.estimatedReadyAt,
      })
    },
  })

  if (!currentOrder) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-12">
        <ClipboardList className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-semibold mb-2">{t('No Active Order', 'ንቁ ትዕዛዝ የለም', lang)}</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          {t('Place an order to track it here', 'እዚህ ለመከታተል ትዕዛዝ ያስገቡ', lang)}
        </p>
        <Button
          onClick={() => setScreen('menu')}
          className="bg-brand hover:bg-brand-dark text-brand-foreground rounded-xl"
        >
          {t('Browse Menu', 'ምናሌ አስስ', lang)}
        </Button>
      </div>
    )
  }

  const orderSteps: Array<{ status: Order['status']; labelEn: string; labelAm: string; icon: React.ReactNode }> = [
    { status: 'pending', labelEn: 'Pending', labelAm: 'በመጠባበቅ ላይ', icon: <Clock className="w-5 h-5" /> },
    { status: 'accepted', labelEn: 'Confirmed', labelAm: 'ተረጋግጧል', icon: <CheckCircle2 className="w-5 h-5" /> },
    { status: 'preparing', labelEn: 'Preparing', labelAm: 'እየተሰራ ነው', icon: <UtensilsCrossed className="w-5 h-5" /> },
    { status: 'ready', labelEn: 'Ready', labelAm: 'ዝግጁ', icon: <CheckCircle2 className="w-5 h-5" /> },
    { status: 'picked_up', labelEn: 'On Its Way', labelAm: 'መጥቷል', icon: <Truck className="w-5 h-5" /> },
    { status: 'served', labelEn: 'Served', labelAm: 'ቀርቧል', icon: <Star className="w-5 h-5" /> },
  ]

  const currentStepIndex = orderSteps.findIndex((s) => s.status === currentOrder.status)

  // Handle cancelled orders — show special UI instead of timeline
  const isCancelled = currentOrder.status === 'cancelled'

  return (
    <div className="px-4 py-4 pb-32 overflow-y-auto">
      {/* Order Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-brand/5 rounded-2xl p-4 mb-4"
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold">
            {t('Order', 'ትዕዛዝ', lang)} {currentOrder.orderNumber}
          </h2>
          <Badge className={isCancelled ? 'bg-red-500 text-white' : 'bg-brand text-brand-foreground'}>
            {isCancelled
              ? t('Cancelled', 'ተሰርዟል', lang)
              : t(
                  currentOrder.status.charAt(0).toUpperCase() + currentOrder.status.slice(1).replace('_', ' '),
                  currentOrder.status === 'pending' ? 'በመጠባበቅ' :
                  currentOrder.status === 'accepted' ? 'ተቀብሏል' :
                  currentOrder.status === 'preparing' ? 'እየተሰራ' :
                  currentOrder.status === 'ready' ? 'ዝግጁ' :
                  currentOrder.status === 'picked_up' ? 'መጥቷል' :
                  'ቀርቧል',
                  lang
                )
            }
          </Badge>
        </div>
        {currentOrder.estimatedReadyAt && !isCancelled && currentOrder.status !== 'served' && currentOrder.status !== 'picked_up' && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            {t('Est. ready in', 'አቅም ያለበት ጊዜ', lang)} ~{Math.max(1, Math.round((currentOrder.estimatedReadyAt.getTime() - Date.now()) / 60000))} {t('min', 'ደቂቃ', lang)}
          </div>
        )}
      </motion.div>

      {/* Cancelled Order Notice */}
      {isCancelled && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="font-semibold text-red-700 dark:text-red-300">
                {t('Order Cancelled', 'ትዕዛዝ ተሰርዟል', lang)}
              </p>
              <p className="text-sm text-red-600 dark:text-red-400">
                {t('This order has been cancelled by the restaurant. Please contact staff for assistance.', 'ይህ ትዕዛዝ በሆቴሉ ተሰርዟል። እባክዎ ለእርዳታ ሰራተኞችን ያነጋግሩ።', lang)}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* "On Its Way" Notice */}
      {currentOrder.status === 'picked_up' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-pulse" />
            </div>
            <div>
              <p className="font-semibold text-blue-700 dark:text-blue-300">
                {t('Your order is on its way!', 'ትዕዛዝዎ መጥቷል!', lang)}
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                {t('A waiter is bringing your food to the table.', 'አገልጋይ ምግብዎን ወደ ጠረጴዛ እያመጣ ነው።', lang)}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Status Timeline */}
      <div className="mb-6">
        <h3 className="font-semibold text-sm mb-3">{t('Order Status', 'የትዕዛዝ ሁኔታ', lang)}</h3>
        <div className="relative">
          {orderSteps.map((step, i) => {
            const isActive = i <= currentStepIndex
            const isCurrent = i === currentStepIndex
            return (
              <div key={step.status} className="flex items-start gap-3 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  <motion.div
                    initial={false}
                    animate={{
                      scale: isCurrent ? 1.15 : 1,
                      backgroundColor: isActive ? 'var(--brand)' : 'var(--muted)',
                      color: isActive ? 'var(--brand-foreground)' : 'var(--muted-foreground)',
                    }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  >
                    {step.icon}
                  </motion.div>
                  {i < orderSteps.length - 1 && (
                    <div
                      className={`w-0.5 h-6 ${i < currentStepIndex ? 'bg-brand' : 'bg-muted'}`}
                    />
                  )}
                </div>
                <div className="pt-2">
                  <p className={`font-medium text-sm ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {t(step.labelEn, step.labelAm, lang)}
                  </p>
                  {isCurrent && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs text-brand mt-0.5"
                    >
                      {t('Current', 'የአሁን', lang)}
                    </motion.p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Per-item Kitchen Status */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">{t('Kitchen Status', 'የምግብ ቤት ሁኔታ', lang)}</h3>
          {currentOrder.roundNumber > 1 && (
            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800">
              {t('Round', 'ዙር', lang)} {currentOrder.roundNumber}
            </Badge>
          )}
        </div>
        <div className="grid gap-2">
          {currentOrder.items.map((item, itemIndex) => {
            const itemRound = (item as any).roundNumber || 1
            const showRoundSeparator = itemIndex > 0 && itemRound !== ((currentOrder.items[itemIndex - 1] as any).roundNumber || 1)
            return (
              <Fragment key={item.id}>
                {showRoundSeparator && (
                  <div className="flex items-center gap-2 py-1">
                    <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      {t('Round', 'ዙር', lang)} {itemRound}
                    </span>
                    <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                  </div>
                )}
                <div className="p-3 rounded-xl bg-card border border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-sm">{resolveI18n((item as any).nameI18n, lang, item.nameEn)}</p>
                        {itemRound > 1 && (
                          <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                            R{itemRound}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">×{item.quantity}</p>
                    </div>
                    <KitchenStatusBadge status={item.kitchenStatus} lang={lang} />
                  </div>
              {/* Modifier selections */}
              {item.modifierSelections && item.modifierSelections.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {item.modifierSelections.map((mod, idx) => (
                    <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                      {mod.name}
                    </span>
                  ))}
                </div>
              )}
              {/* Removed ingredients */}
              {item.removedIngredients && item.removedIngredients.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {item.removedIngredients.map((ri) => (
                    <span key={ri.id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border border-red-100 dark:border-red-800">
                      🚫 {t(ri.name, ri.nameAm || ri.name, lang)}
                    </span>
                  ))}
                </div>
              )}
              {/* Special instructions */}
              {item.specialInstructions && (
                <div className="flex items-start gap-1 mt-1.5 rounded bg-yellow-50 dark:bg-yellow-900/20 p-1.5">
                  <AlertCircle className="h-3 w-3 text-yellow-600 shrink-0 mt-0.5" />
                  <span className="text-[11px] text-yellow-700 dark:text-yellow-300">{item.specialInstructions}</span>
                </div>
              )}
            </div>
            </Fragment>
          )})}
        </div>
      </div>

      {/* Order Total */}
      <div className="bg-card rounded-2xl border border-border p-4 mb-4">
        <h3 className="font-semibold text-sm mb-2">{t('Order Summary', 'የትዕዛዝ ማጠቃለያ', lang)}</h3>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('Subtotal', 'ንዑስ ድምር', lang)}</span>
            <span>{formatPrice(currentOrder.subtotalCents)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('Tax', 'ግብር', lang)}</span>
            <span>{formatPrice(currentOrder.taxCents)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('Service Charge', 'አገልግሎት ክፍያ', lang)}</span>
            <span>{formatPrice(currentOrder.serviceChargeCents)}</span>
          </div>
          {currentOrder.tipCents > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('Tip', 'ጁማ', lang)}</span>
              <span>{formatPrice(currentOrder.tipCents)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-bold pt-1">
            <span>{t('Total', 'ጠቅላላ', lang)}</span>
            <span className="text-brand">{formatPrice(currentOrder.totalCents + currentOrder.tipCents)}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid gap-3">
        {/* Digital Receipt Button */}
        <Button
          onClick={() => {
            // Generate a printable receipt in a new window
            const receiptHtml = generateReceiptHtml(currentOrder, session, lang)
            const receiptWindow = window.open('', '_blank', 'width=400,height=700')
            if (receiptWindow) {
              receiptWindow.document.write(receiptHtml)
              receiptWindow.document.close()
            }
          }}
          variant="outline"
          className="h-11 rounded-xl border-border hover:bg-muted"
        >
          <Receipt className="w-4 h-4 mr-2" />
          {t('View Receipt', 'ደረሰኝ አሳይ', lang)}
        </Button>

        <Button
          onClick={() => {
            useCustomerStore.getState().setAddToCurrentOrder(true)
            setScreen('menu')
          }}
          variant="outline"
          className="h-11 rounded-xl border-brand text-brand hover:bg-brand/5"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('Add More Items', 'ተጨማሪ ዕቃ ጨምር', lang)}
        </Button>

        {currentOrder.status === 'served' && !currentOrder.paymentMethod && (
          <Button
            onClick={() => setScreen('payment')}
            className="h-11 rounded-xl bg-brand hover:bg-brand-dark text-brand-foreground"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            {t('Pay Now', 'አሁን ክፈል', lang)}
          </Button>
        )}
      </div>
    </div>
  )
}

function KitchenStatusBadge({ status, lang }: { status: KitchenItemStatus; lang: 'en' | 'am' }) {
  const config: Record<KitchenItemStatus, { labelEn: string; labelAm: string; className: string }> = {
    pending: { labelEn: 'Pending', labelAm: 'በመጠባበቅ', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    preparing: { labelEn: 'Cooking', labelAm: 'እየተሰራ', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    ready: { labelEn: 'Ready', labelAm: 'ዝግጁ', className: 'bg-green-100 text-green-800 border-green-200' },
    served: { labelEn: 'Served', labelAm: 'ቀርቧል', className: 'bg-gray-100 text-gray-800 border-gray-200' },
    cancelled: { labelEn: 'Cancelled', labelAm: 'ተሰርዟል', className: 'bg-red-100 text-red-800 border-red-200' },
  }
  const c = config[status]
  return (
    <Badge variant="outline" className={`text-[10px] ${c.className}`}>
      {t(c.labelEn, c.labelAm, lang)}
    </Badge>
  )
}

// ─── Payment Screen ────────────────────────────────────────────
function PaymentScreen() {
  const { language, currentOrder, setCurrentOrder, setScreen, session, restaurant } = useCustomerStore()
  const lang = language
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [tip, setTip] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)
  const [pendingPayment, setPendingPayment] = useState(false)

  // ─── Split Bill State ──────────────────────────────────────────
  const [showSplitOption, setShowSplitOption] = useState(false)
  const [splitPeople, setSplitPeople] = useState(2)
  const [splitType, setSplitType] = useState<'equal' | 'items' | 'custom' | 'percentage'>('equal')
  const [billSplitData, setBillSplitData] = useState<{ billSplitId: string; splits: { name: string; amountCents: number }[] } | null>(null)
  const [mySplitIndex, setMySplitIndex] = useState<number | null>(null)
  const [isCreatingSplit, setIsCreatingSplit] = useState(false)
  const [splitError, setSplitError] = useState('')

  // ─── Loyalty Redemption State ──────────────────────────────────
  const [loyaltyData, setLoyaltyData] = useState<{ points: number; canRedeem: boolean; redemptionValue: number; pointValueETB: number } | null>(null)
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0)
  const [loyaltyDiscountCents, setLoyaltyDiscountCents] = useState(0)
  const [isRedeemingLoyalty, setIsRedeemingLoyalty] = useState(false)

  // Load existing splits on mount
  useEffect(() => {
    if (!session?.restaurantId || !currentOrder?.id) return
    let cancelled = false
    fetch(`/api/restaurants/${session.restaurantId}/orders/${currentOrder.id}/split`, {
      headers: {
        ...(session.sessionToken ? { 'Authorization': `Bearer ${session.sessionToken}` } : {}),
      },
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled || !data?.data?.billSplits) return
        const splits = data.data.billSplits
        // Find the most recent active split
        const activeSplit = splits.find((s: any) => s.status === 'pending' || s.status === 'partial')
        if (activeSplit) {
          try {
            const splitData = typeof activeSplit.splitData === 'string' ? JSON.parse(activeSplit.splitData) : activeSplit.splitData
            if (Array.isArray(splitData) && splitData.length > 0) {
              setBillSplitData({
                billSplitId: activeSplit.id,
                splits: splitData.map((s: any) => ({ name: s.name, amountCents: s.amountCents })),
              })
            }
          } catch {}
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.restaurantId, currentOrder?.id])

  // Load loyalty data on mount
  useEffect(() => {
    if (!session?.restaurantId || !session?.customerId) return
    let cancelled = false
    fetch(`/api/restaurants/${session.restaurantId}/loyalty?customerId=${session.customerId}`, {
      headers: {
        ...(session.sessionToken ? { 'Authorization': `Bearer ${session.sessionToken}` } : {}),
      },
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled || !data?.data) return
        setLoyaltyData({
          points: data.data.loyaltyPoints || 0,
          canRedeem: data.data.canRedeem || false,
          redemptionValue: data.data.redemptionValue || 0,
          pointValueETB: data.data.pointValueETB || 0,
        })
      })
      .catch(() => {})
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.restaurantId, session?.customerId])

  if (!currentOrder) return null

  const loyaltyDiscountAmount = loyaltyDiscountCents
  const grandTotal = Math.max(0, currentOrder.totalCents - loyaltyDiscountAmount + tip)

  // When paying a split portion, the amount is just that person's share
  const effectiveTotal = billSplitData && mySplitIndex !== null
    ? billSplitData.splits[mySplitIndex].amountCents + tip
    : grandTotal

  const allPaymentMethods: Array<{ method: PaymentMethod; labelEn: string; labelAm: string; icon: string; color: string; alwaysShow: boolean }> = [
    { method: 'starpay', labelEn: 'StarPay', labelAm: 'ስታርፔይ', icon: '⭐', color: '#FF6B00', alwaysShow: false },
    { method: 'telebirr', labelEn: 'Telebirr', labelAm: 'ቴሌብር', icon: '📱', color: '#4CAF50', alwaysShow: true },
    { method: 'chapa', labelEn: 'Chapa', labelAm: 'ቻፓ', icon: '💳', color: '#6C63FF', alwaysShow: true },
    { method: 'cbe_birr', labelEn: 'CBE Birr', labelAm: 'CBE ብር', icon: '🏦', color: '#1A237E', alwaysShow: true },
    { method: 'cash', labelEn: 'Cash', labelAm: 'ጥሬ ገንዘብ', icon: '💵', color: '#2E7D32', alwaysShow: true },
  ]

  const paymentMethods = allPaymentMethods.filter(m =>
    m.alwaysShow || (m.method === 'starpay' && restaurant?.starPayEnabled)
  )

  const tipAmounts = [0, 10, 20, 50, 100]

  const handleCreateSplit = async () => {
    if (!session?.restaurantId || !currentOrder?.id) return
    setIsCreatingSplit(true)
    setSplitError('')
    try {
      let splitsPayload: any[]
      if (splitType === 'equal') {
        splitsPayload = Array.from({ length: splitPeople }, (_, i) => ({
          name: `${t('Person', 'ሰው', lang)} ${i + 1}`,
        }))
      } else if (splitType === 'percentage') {
        // Equal percentage split
        const pctPerPerson = Math.floor(100 / splitPeople)
        const remainder = 100 - pctPerPerson * splitPeople
        splitsPayload = Array.from({ length: splitPeople }, (_, i) => ({
          name: `${t('Person', 'ሰው', lang)} ${i + 1}`,
          percentage: i === 0 ? pctPerPerson + remainder : pctPerPerson,
        }))
      } else if (splitType === 'custom') {
        // Even custom amounts
        const perPerson = Math.floor(currentOrder.totalCents / splitPeople)
        const remainderCents = currentOrder.totalCents - perPerson * splitPeople
        splitsPayload = Array.from({ length: splitPeople }, (_, i) => ({
          name: `${t('Person', 'ሰው', lang)} ${i + 1}`,
          amountCents: i === 0 ? perPerson + remainderCents : perPerson,
        }))
      } else {
        // items split — falls back to equal for simplicity in customer UI
        splitsPayload = Array.from({ length: splitPeople }, (_, i) => ({
          name: `${t('Person', 'ሰው', lang)} ${i + 1}`,
        }))
      }
      const res = await fetch(`/api/restaurants/${session.restaurantId}/orders/${currentOrder.id}/split`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session.sessionToken ? { 'Authorization': `Bearer ${session.sessionToken}` } : {}),
        },
        body: JSON.stringify({
          splitType: splitType === 'items' ? 'equal' : splitType,
          splits: splitsPayload,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const billSplit = data.data
        const splitData = typeof billSplit.splitData === 'string' ? JSON.parse(billSplit.splitData) : billSplit.splitData
        setBillSplitData({
          billSplitId: billSplit.id,
          splits: splitData.map((s: any) => ({ name: s.name, amountCents: s.amountCents })),
        })
        setShowSplitOption(false)
      } else {
        const errData = await res.json().catch(() => ({}))
        setSplitError(errData.error || t('Failed to create split', 'ማከፈል አልተሳካም', lang))
      }
    } catch {
      setSplitError(t('Failed to create split. Please try again.', 'ማከፈል አልተሳካም። እባክዎ እንደገና ይሞክሩ።', lang))
    } finally {
      setIsCreatingSplit(false)
    }
  }

  const handlePay = async () => {
    if (!selectedMethod || !session) return
    setIsProcessing(true)
    setPaymentError('')

    const isSplitPayment = !!(billSplitData && mySplitIndex !== null)

    // Try real payment API whenever we have a session
    if (session.restaurantId) {
      try {
        const paymentBody: Record<string, unknown> = {
          orderId: currentOrder.id,
          method: selectedMethod,
          amount: effectiveTotal,
          tipAmount: tip,
        }
        // Include split info when paying a portion
        if (isSplitPayment) {
          paymentBody.billSplitId = billSplitData!.billSplitId
          paymentBody.splitIndex = mySplitIndex
        }

        const res = await fetch(`/api/restaurants/${session.restaurantId}/payments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session.sessionToken ? { 'Authorization': `Bearer ${session.sessionToken}` } : {}),
          },
          body: JSON.stringify(paymentBody),
        })

        if (res.ok) {
          const data = await res.json()
          const paymentData = data.data || data

          // For cash: payment is collected physically, complete immediately
          if (selectedMethod === 'cash') {
            setCurrentOrder({
              ...currentOrder,
              paymentMethod: selectedMethod,
              tipCents: tip,
              totalCents: effectiveTotal,
              status: isSplitPayment ? 'completed' : 'completed',
            })
            setIsProcessing(false)
            setScreen('feedback')
            return
          }

          // For digital payments: if there's a checkout URL, handle based on mock vs real
          if (paymentData.checkoutUrl) {
            setCheckoutUrl(paymentData.checkoutUrl)
            setPendingPayment(true)
            setIsProcessing(false)

            const isMockCheckout = paymentData.checkoutUrl.includes('mock.')

            if (isMockCheckout) {
              // Mock mode: Don't redirect away — show inline pending payment overlay
              // with simulated confirmation button so customer stays in the app
              toast.success(t('Payment initiated! Confirm when done.', 'ክፍያ ተጀምሯል! ካጠናቀቁ በኋላ ያረጋግጡ።', lang))
            } else {
              // Real payment provider: redirect to actual checkout page
              toast.success(t('Payment initiated! Redirecting to payment provider...', 'ክፍያ ተጀምሯል! ወደ ክፍያ አቅራቢ እየተዛወሩ ነው...', lang))
              window.location.href = paymentData.checkoutUrl
            }
            return
          }

          // No checkout URL — payment completed directly
          setCurrentOrder({
            ...currentOrder,
            paymentMethod: selectedMethod,
            tipCents: tip,
            totalCents: effectiveTotal,
            status: 'completed',
          })
          setIsProcessing(false)
          setScreen('feedback')
          return
        } else {
          const errorData = await res.json().catch(() => ({}))
          // For cash, still mark as success since payment is collected physically
          if (selectedMethod === 'cash') {
            setCurrentOrder({
              ...currentOrder,
              paymentMethod: selectedMethod,
              tipCents: tip,
              totalCents: effectiveTotal,
              status: 'completed',
            })
            setIsProcessing(false)
            setScreen('feedback')
            return
          }
          setPaymentError(errorData.error || t('Payment failed. Please try again.', 'ክፍያ አልተሳካም። እባክዎ እንደገና ይሞክሩ።', lang))
          setIsProcessing(false)
          return
        }
      } catch (err) {
        console.error('[PAYMENT_API_ERROR]', err)
        // Fallback to simulated payment if API unavailable
        setCurrentOrder({
          ...currentOrder,
          paymentMethod: selectedMethod,
          tipCents: tip,
          totalCents: effectiveTotal,
          status: 'completed',
        })
        setIsProcessing(false)
        setScreen('feedback')
        return
      }
    }

    // No session: local payment processing (offline mode)
    setCurrentOrder({
      ...currentOrder,
      paymentMethod: selectedMethod,
      tipCents: tip,
      totalCents: effectiveTotal,
      status: 'completed',
    })
    setIsProcessing(false)
    setScreen('feedback')
  }

  // Calculate per-person share for the split picker
  const perPersonCents = currentOrder ? Math.round(currentOrder.totalCents / splitPeople) : 0

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="px-4 py-4 pb-32 overflow-y-auto"
    >
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => { setScreen('order'); setMySplitIndex(null); }} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">{t('Payment', 'ክፍያ', lang)}</h1>
        {billSplitData && mySplitIndex !== null && (
          <Badge variant="secondary" className="ml-2 text-xs bg-brand/10 text-brand border-brand/20">
            <Users className="w-3 h-3 mr-1" />
            {t('Split Bill', 'ቢል ማከፈል', lang)}
          </Badge>
        )}
      </div>

      {/* ─── Split Bill Section ─────────────────────────────────────── */}
      {/* Show split result when a split exists */}
      {billSplitData && mySplitIndex === null && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl border border-border p-4 mb-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-brand" />
            <h3 className="font-semibold text-sm">{t('Split Bill', 'ቢል ማከፈል', lang)}</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            {t('This bill has been split. Tap your name to pay your share.', 'ይህ ቢል ተከፍሏል። የራስዎን ስም ይጫኑ እና ዕጣዎን ይክፈሉ።', lang)}
          </p>
          <div className="space-y-2">
            {billSplitData.splits.map((split, idx) => (
              <button
                key={idx}
                onClick={() => { setMySplitIndex(idx); setTip(0); setSelectedMethod(null); setPaymentError(''); }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-muted hover:bg-muted/80 active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-brand text-xs font-bold">
                    {idx + 1}
                  </div>
                  <span className="font-medium text-sm">{split.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-brand">{formatPrice(split.amountCents)}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setBillSplitData(null)
              setMySplitIndex(null)
              setShowSplitOption(false)
            }}
            className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            {t('Pay full amount instead', 'ይልቅ ሙሉ መጠን ክፈል', lang)}
          </button>
        </motion.div>
      )}

      {/* Show "which share are you paying" info when split index is selected */}
      {billSplitData && mySplitIndex !== null && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand/5 rounded-2xl border border-brand/20 p-4 mb-6"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center text-brand text-sm font-bold">
                {mySplitIndex + 1}
              </div>
              <span className="font-semibold text-sm">{billSplitData.splits[mySplitIndex].name}</span>
            </div>
            <span className="font-bold text-lg text-brand">{formatPrice(billSplitData.splits[mySplitIndex].amountCents)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('You are paying your share of the split bill', 'የተከፈለውን ቢል ዕጣዎን እየከፈሉ ነው', lang)}
          </p>
          <button
            onClick={() => { setMySplitIndex(null); setTip(0); setSelectedMethod(null); setPaymentError(''); }}
            className="text-xs text-brand hover:underline mt-1"
          >
            {t('Choose a different share', 'ሌላ ዕጣ ምረጥ', lang)}
          </button>
        </motion.div>
      )}

      {/* Payment Method Selection */}
      <div className="mb-6">
        <h3 className="font-semibold text-sm mb-3">{t('Payment Method', 'የክፍያ ዘዴ', lang)}</h3>
        <div className="grid gap-2">
          {paymentMethods.map((pm) => (
            <button
              key={pm.method}
              onClick={() => { setSelectedMethod(pm.method); setPaymentError('') }}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all active:scale-[0.98] ${
                selectedMethod === pm.method
                  ? 'border-brand bg-brand/5'
                  : 'border-border hover:border-brand/30'
              }`}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{ backgroundColor: pm.color + '20' }}
              >
                {pm.icon}
              </div>
              <span className="font-medium text-sm">{t(pm.labelEn, pm.labelAm, lang)}</span>
              <div className="ml-auto">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedMethod === pm.method ? 'border-brand bg-brand' : 'border-muted-foreground/40'
                  }`}
                >
                  {selectedMethod === pm.method && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-foreground" />
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Tip Selector */}
      <div className="mb-6">
        <h3 className="font-semibold text-sm mb-3">{t('Add a Tip', 'ጁማ ጨምር', lang)}</h3>
        <div className="flex gap-2 flex-wrap">
          {tipAmounts.map((amount) => (
            <button
              key={amount}
              onClick={() => setTip(amount)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                tip === amount
                  ? 'bg-brand text-brand-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {amount === 0 ? t('No Tip', 'ያለ ጁማ', lang) : `${formatPrice(amount)}`}
            </button>
          ))}
        </div>
      </div>

      {/* Loyalty Points Redemption */}
      {loyaltyData && loyaltyData.points > 0 && !billSplitData && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-1.5">
              <span className="text-base">🏆</span>
              {t('Loyalty Points', 'የታማኝነት ነጥቦች', lang)}
            </h3>
            <span className="text-xs text-muted-foreground">
              {loyaltyData.points} {t('pts', 'ነጥብ', lang)}
            </span>
          </div>
          {loyaltyDiscountCents > 0 ? (
            <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400 font-medium text-sm">
                    {t('Discount Applied', 'ቅናሽ ተተግብሯል', lang)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-700 dark:text-green-300 font-bold text-sm">
                    -{formatPrice(loyaltyDiscountCents)}
                  </span>
                  <button
                    onClick={() => { setLoyaltyPointsToRedeem(0); setLoyaltyDiscountCents(0); }}
                    className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    {t('Remove', 'አስወግድ', lang)}
                  </button>
                </div>
              </div>
              <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">
                {loyaltyPointsToRedeem} {t('points redeemed', 'ነጥቦች ጥቅም ላይ ውለዋል', lang)}
              </p>
            </div>
          ) : loyaltyData.canRedeem ? (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                {t(
                  `You have ${loyaltyData.points} points worth ${formatPrice(loyaltyData.redemptionValue)}. Use them for a discount?`,
                  `${loyaltyData.points} ነጥቦች (${formatPrice(loyaltyData.redemptionValue)}) አሉዎት። ቅናሽ ለማግኘት ይጠቀሙ?`,
                  lang
                )}
              </p>
              <button
                onClick={async () => {
                  if (!session?.restaurantId || !session?.customerId) return
                  setIsRedeemingLoyalty(true)
                  try {
                    const res = await fetch(`/api/restaurants/${session.restaurantId}/loyalty`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(session.sessionToken ? { 'Authorization': `Bearer ${session.sessionToken}` } : {}),
                      },
                      body: JSON.stringify({
                        customerId: session.customerId,
                        pointsToRedeem: loyaltyData.points,
                      }),
                    })
                    if (res.ok) {
                      const data = await res.json()
                      setLoyaltyPointsToRedeem(loyaltyData.points)
                      setLoyaltyDiscountCents(Math.round((data.data?.discountAmount || 0) * 100))
                      setLoyaltyData({
                        ...loyaltyData,
                        points: data.data?.remainingPoints || 0,
                        canRedeem: false,
                      })
                    }
                  } catch (err) {
                    console.error('[LOYALTY_REDEEM_ERROR]', err)
                  } finally {
                    setIsRedeemingLoyalty(false)
                  }
                }}
                disabled={isRedeemingLoyalty}
                className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isRedeemingLoyalty
                  ? t('Redeeming...', 'እየተጠቀሙ...', lang)
                  : t('Redeem All Points', 'ሁሉንም ነጥቦች ተጠቀሙ', lang)
                }
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground p-3 rounded-xl bg-muted/50">
              {t(
                `Earn more points to unlock redemption`,
                `ለመተግበር ተጨማሪ ነጥቦችን ያግኙ`,
                lang
              )}
            </p>
          )}
        </div>
      )}

      {/* Split with Friends — only show when no active split */}
      {!billSplitData && (
        <div className="mb-6">
          {!showSplitOption ? (
            <button
              onClick={() => setShowSplitOption(true)}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:border-brand/30 transition-all active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-orange-100">
                <Users className="w-5 h-5 text-orange-600" />
              </div>
              <div className="text-left">
                <span className="font-medium text-sm block">{t('Split with Friends', 'ከጓደኞች ጋር አከፍል', lang)}</span>
                <span className="text-xs text-muted-foreground">{t('Divide the bill equally', 'ቢሉን እኩል አከፍል', lang)}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-card rounded-2xl border border-border p-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{t('Split with Friends', 'ከጓደኞች ጋር አከፍል', lang)}</h3>
                <button
                  onClick={() => { setShowSplitOption(false); setSplitError(''); }}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Split Type Selector */}
              <div className="flex gap-1.5">
                {[
                  { type: 'equal' as const, labelEn: 'Equal', labelAm: 'እኩል', icon: '÷' },
                  { type: 'custom' as const, labelEn: 'Custom', labelAm: 'ብጁ', icon: '✏️' },
                  { type: 'percentage' as const, labelEn: 'Percent', labelAm: 'ፐርሰንት', icon: '%' },
                ].map((st) => (
                  <button
                    key={st.type}
                    onClick={() => setSplitType(st.type)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all active:scale-95 ${
                      splitType === st.type
                        ? 'bg-brand text-brand-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    <span className="mr-1">{st.icon}</span>
                    {t(st.labelEn, st.labelAm, lang)}
                  </button>
                ))}
              </div>

              {/* People Picker */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('How many people?', 'ስንት ሰዎች?', lang)}</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSplitPeople(Math.max(2, splitPeople - 1))}
                    disabled={splitPeople <= 2}
                    className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-xl font-bold w-8 text-center">{splitPeople}</span>
                  <button
                    onClick={() => setSplitPeople(Math.min(10, splitPeople + 1))}
                    disabled={splitPeople >= 10}
                    className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Per-person amount */}
              <div className="text-center py-3 bg-brand/5 rounded-xl">
                <p className="text-xs text-muted-foreground mb-1">{t('Each person pays', 'እያንዳንዱ ይከፍላል', lang)}</p>
                <p className="text-2xl font-bold text-brand">{formatPrice(perPersonCents)}</p>
              </div>

              {splitError && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-destructive text-xs">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {splitError}
                </div>
              )}

              <Button
                onClick={handleCreateSplit}
                disabled={isCreatingSplit}
                className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-lg"
              >
                {isCreatingSplit ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('Creating...', 'እየፈጠረ...', lang)}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {t('Create Split', 'ለይቶ ፍጠር', lang)}
                  </span>
                )}
              </Button>
            </motion.div>
          )}
        </div>
      )}

      {/* Order Summary */}
      <div className="bg-card rounded-2xl border border-border p-4 mb-6">
        <h3 className="font-semibold text-sm mb-2">{t('Order Summary', 'የትዕዛዝ ማጠቃለያ', lang)}</h3>
        <div className="space-y-1.5 text-sm">
          {billSplitData && mySplitIndex !== null ? (
            <>
              {/* Split payment summary */}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('Your Share', 'የእርስዎ ዕጣ', lang)}</span>
                <span>{formatPrice(billSplitData.splits[mySplitIndex].amountCents)}</span>
              </div>
              {tip > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('Tip', 'ጁማ', lang)}</span>
                  <span>{formatPrice(tip)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg pt-1">
                <span>{t('Total', 'ጠቅላላ', lang)}</span>
                <span className="text-brand">{formatPrice(effectiveTotal)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t(`Split ${mySplitIndex + 1} of ${billSplitData.splits.length}`, `${billSplitData.splits.length} ውስጥ ${mySplitIndex + 1} ኛ ዕጣ`, lang)}
              </p>
            </>
          ) : (
            <>
              {/* Full payment summary */}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('Subtotal', 'ንዑስ ድምር', lang)}</span>
                <span>{formatPrice(currentOrder.subtotalCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('Tax', 'ግብር', lang)}</span>
                <span>{formatPrice(currentOrder.taxCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('Service Charge', 'አገልግሎት ክፍያ', lang)}</span>
                <span>{formatPrice(currentOrder.serviceChargeCents)}</span>
              </div>
              {tip > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('Tip', 'ጁማ', lang)}</span>
                  <span>{formatPrice(tip)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg pt-1">
                <span>{t('Total', 'ጠቅላላ', lang)}</span>
                <span className="text-brand">{formatPrice(grandTotal)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Checkout URL — fallback if redirect didn't happen or mock mode */}
      {checkoutUrl && pendingPayment && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-brand/10 border border-brand/30 mb-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-brand" />
            <h3 className="font-semibold text-sm">{t('Complete Payment', 'ክፍያ ያጠናቅቁ', lang)}</h3>
          </div>
          {checkoutUrl.includes('mock.') ? (
            // Mock mode: show inline confirmation with simulated provider reference
            <>
              <p className="text-sm text-muted-foreground">
                {t('This is a simulated payment. Click confirm to complete.', 'ይህ ተከታታይ ክፍያ ነው። ለማጠናቀቅ ያረጋግጡ።', lang)}
              </p>
              <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded-lg text-xs text-yellow-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {t('Demo mode — no real payment will be charged', 'ሙከራ ሁኔታ — ትክክለኛ ክፍያ አይወሰድም', lang)}
              </div>
            </>
          ) : (
            // Real payment: show link and confirm button
            <>
              <p className="text-sm text-muted-foreground">
                {t('If you were not redirected, click the link below. Once done, press the confirm button.', 'ካልተዛወሩ ከዚህ በታች ያለውን ማገናኛ ይጫኑ። ከዛ የማረጋገጫ ቁልፉን ይጫኑ።', lang)}
              </p>
              <a
                href={checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-brand-foreground font-medium text-sm hover:bg-brand-dark transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                {t('Open Payment Page', 'የክፍያ ገፅ ክፈት', lang)}
              </a>
            </>
          )}
          <Button
            onClick={async () => {
              // Verify the payment with the API
              try {
                if (session?.restaurantId && session?.sessionToken) {
                  const verifyRes = await fetch(`/api/restaurants/${session.restaurantId}/payments/verify`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${session.sessionToken}`,
                    },
                    body: JSON.stringify({ reference: checkoutUrl }),
                  })
                  if (verifyRes.ok) {
                    const verifyData = await verifyRes.json()
                    if (verifyData.data?.verified) {
                      setPendingPayment(false)
                      setCheckoutUrl(null)
                      setCurrentOrder({
                        ...currentOrder,
                        paymentMethod: selectedMethod,
                        tipCents: tip,
                        totalCents: effectiveTotal,
                        status: 'completed',
                      })
                      setScreen('feedback')
                      return
                    }
                  }
                }
              } catch {
                // Verification failed, fall through to mark as completed anyway
              }
              setPendingPayment(false)
              setCheckoutUrl(null)
              setCurrentOrder({
                ...currentOrder,
                paymentMethod: selectedMethod,
                tipCents: tip,
                totalCents: effectiveTotal,
                status: 'completed',
              })
              setScreen('feedback')
            }}
            className="w-full h-12 rounded-xl bg-brand hover:bg-brand-dark text-brand-foreground font-semibold shadow-lg shadow-brand/25"
          >
            <CheckCircle2 className="w-5 h-5 mr-2" />
            {t('I\'ve Completed Payment', 'ክፍያ አጠናቅቂያለሁ', lang)}
          </Button>
          <button
            onClick={() => {
              setPendingPayment(false)
              setCheckoutUrl(null)
              setSelectedMethod(null)
            }}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            {t('Cancel and choose another method', 'ሰርዝ እና ሌላ ዘዴ ምረጥ', lang)}
          </button>
        </motion.div>
      )}

      {/* Error Message */}
      {paymentError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {paymentError}
        </div>
      )}

      {/* Pay Button — hidden when pending payment checkout */}
      {!pendingPayment && (
        <>
          <Button
            onClick={handlePay}
            disabled={!selectedMethod || isProcessing}
            className="w-full h-14 rounded-2xl bg-brand hover:bg-brand-dark text-brand-foreground font-semibold text-lg shadow-lg shadow-brand/25 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('Processing...', 'እየተሰራ ነው...', lang)}
              </span>
            ) : (
              billSplitData && mySplitIndex !== null
                ? `${t('Pay My Share', 'ዕጣዬን ክፈል', lang)} ${formatPrice(effectiveTotal)}`
                : `${t('Pay', 'ክፈል', lang)} ${formatPrice(grandTotal)}`
            )}
          </Button>
          {/* Pay Full Amount option when split exists but user hasn't chosen a share yet */}
          {billSplitData && mySplitIndex === null && (
            <button
              onClick={() => {
                setBillSplitData(null)
                setMySplitIndex(null)
                setShowSplitOption(false)
              }}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-3 mt-1"
            >
              {t('Pay full amount instead', 'ይልቅ ሙሉ መጠን ክፈል', lang)}
            </button>
          )}
          {/* Back to split selection when a share is selected */}
          {billSplitData && mySplitIndex !== null && (
            <button
              onClick={() => { setMySplitIndex(null); setTip(0); setSelectedMethod(null); setPaymentError(''); }}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-3 mt-1"
            >
              {t('Back to split selection', 'ወደ ማከፈያ ምረጥ', lang)}
            </button>
          )}
        </>
      )}
    </motion.div>
  )
}

// ─── Feedback Screen ───────────────────────────────────────────
function FeedbackScreen() {
  const { language, currentOrder, setCurrentOrder, setScreen, setActiveTab, session } = useCustomerStore()
  const lang = language
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    // Try to submit review via API
    if (session?.restaurantId && session.restaurantId !== 'demo-1' && currentOrder) {
      try {
        const res = await fetch(`/api/restaurants/${session.restaurantId}/reviews`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session.sessionToken ? { 'Authorization': `Bearer ${session.sessionToken}` } : {}),
          },
          body: JSON.stringify({
            orderId: currentOrder.id,
            rating,
            comment: comment || undefined,
            sessionId: session.sessionId,
          }),
        })
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          console.error('[REVIEW_SUBMIT_ERROR]', errorData.error || 'Unknown error')
          toast.error(errorData.error || t('Failed to submit review. Please try again.', 'አስተያየት መላክ አልተሳካም።', lang))
          return
        }
      } catch (err) {
        console.error('[REVIEW_SUBMIT_ERROR]', err)
        toast.error(t('Network error. Please try again.', 'አውታረ መረብ ስህተት።', lang))
        return
      }
    }

    setSubmitted(true)
    setTimeout(() => {
      setCurrentOrder(null)
      setScreen('menu')
      setActiveTab('menu')
    }, 2000)
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center h-full px-6"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          className="w-20 h-20 rounded-full bg-brand flex items-center justify-center mb-4"
        >
          <CheckCircle2 className="w-10 h-10 text-brand-foreground" />
        </motion.div>
        <h2 className="text-xl font-bold mb-2">
          {t('Thank You!', 'አመሰግናለሁ!', lang)}
        </h2>
        <p className="text-muted-foreground text-center mb-6">
          {t('Your feedback helps us improve', 'አስተያየትዎ እንድንሻሻል ይረዳል', lang)}
        </p>
        {currentOrder && (
          <Button
            onClick={() => {
              const receiptHtml = generateReceiptHtml(currentOrder, session, lang)
              const receiptWindow = window.open('', '_blank', 'width=400,height=700')
              if (receiptWindow) {
                receiptWindow.document.write(receiptHtml)
                receiptWindow.document.close()
              }
            }}
            variant="outline"
            className="rounded-xl border-brand text-brand hover:bg-brand/5 mb-3"
          >
            <Receipt className="w-4 h-4 mr-2" />
            {t('View Receipt', 'ደረሰኝ አሳይ', lang)}
          </Button>
        )}
      </motion.div>
    )
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="px-4 py-4 pb-32 overflow-y-auto"
    >
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => { setCurrentOrder(null); setScreen('menu'); setActiveTab('menu') }} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <X className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">{t('Rate Your Experience', 'ልምድዎን ይገምግሙ', lang)}</h1>
      </div>

      {/* Order Reference */}
      {currentOrder && (
        <div className="bg-muted/50 rounded-xl p-3 mb-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t('Order', 'ትዕዛዝ', lang)} {currentOrder.orderNumber}
          </p>
        </div>
      )}

      {/* Star Rating */}
      <div className="flex flex-col items-center mb-8">
        <p className="text-sm text-muted-foreground mb-4">
          {t('How was your meal?', 'ምግብዎ እንዴት ነበር?', lang)}
        </p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <motion.button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              whileTap={{ scale: 0.8 }}
              className="p-1"
            >
              <Star
                className={`w-10 h-10 transition-colors ${
                  star <= (hoveredRating || rating)
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-muted-foreground/30'
                }`}
              />
            </motion.button>
          ))}
        </div>
        {rating > 0 && (
          <motion.p
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-muted-foreground mt-2"
          >
            {rating === 1 && t('Poor', 'ደካማ', lang)}
            {rating === 2 && t('Fair', 'መካከለኛ', lang)}
            {rating === 3 && t('Good', 'ጥሩ', lang)}
            {rating === 4 && t('Very Good', 'በጣም ጥሩ', lang)}
            {rating === 5 && t('Excellent!', 'እጅግ በጣም ጥሩ!', lang)}
          </motion.p>
        )}
      </div>

      {/* Comment */}
      <div className="mb-8">
        <Textarea
          placeholder={t('Share your thoughts (optional)...', 'አስተያየትዎን ያካፍሉ (አማራጭ)...', lang)}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="min-h-[100px] rounded-xl resize-none"
        />
      </div>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={rating === 0}
        className="w-full h-12 rounded-xl bg-brand hover:bg-brand-dark text-brand-foreground font-semibold shadow-lg shadow-brand/25 disabled:opacity-50"
      >
        <Send className="w-4 h-4 mr-2" />
        {t('Submit Feedback', 'አስተያየት ላክ', lang)}
      </Button>
    </motion.div>
  )
}

// ─── Help Screen ───────────────────────────────────────────────
function HelpScreen() {
  const { language, currentOrder, session, setScreen } = useCustomerStore()
  const lang = language
  const [waiterCalled, setWaiterCalled] = useState(false)
  const [waiterCalling, setWaiterCalling] = useState(false)
  const [billRequested, setBillRequested] = useState(false)
  const [billRequesting, setBillRequesting] = useState(false)
  const [menuRequested, setMenuRequested] = useState(false)
  const [menuRequesting, setMenuRequesting] = useState(false)
  const [customMessage, setCustomMessage] = useState('')
  const [customSending, setCustomSending] = useState(false)
  const [customSent, setCustomSent] = useState(false)

  // Generic state setter by request type
  const getRequestState = (requestType: string): { active: boolean; loading: boolean; setActive: (v: boolean) => void; setLoading: (v: boolean) => void } => {
    switch (requestType) {
      case 'call_waiter': return { active: waiterCalled, loading: waiterCalling, setActive: setWaiterCalled, setLoading: setWaiterCalling }
      case 'request_bill': return { active: billRequested, loading: billRequesting, setActive: setBillRequested, setLoading: setBillRequesting }
      case 'request_menu': return { active: menuRequested, loading: menuRequesting, setActive: setMenuRequested, setLoading: setMenuRequesting }
      case 'custom': return { active: customSent, loading: customSending, setActive: setCustomSent, setLoading: setCustomSending }
      default: return { active: false, loading: false, setActive: () => {}, setLoading: () => {} }
    }
  }

  const callWaiterApi = async (requestType: string, message?: string) => {
    if (!session?.restaurantId || session.restaurantId === 'demo-1') {
      // Demo mode: just set local state
      const { setActive } = getRequestState(requestType)
      setActive(true)
      setTimeout(() => setActive(false), 5000)
      return
    }

    const { setActive, setLoading } = getRequestState(requestType)
    try {
      setLoading(true)

      const res = await fetch(`/api/restaurants/${session.restaurantId}/waiter-calls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session.sessionToken ? { 'Authorization': `Bearer ${session.sessionToken}` } : {}),
        },
        body: JSON.stringify({
          branchId: session.branchId,
          tableId: session.tableId,
          sessionId: session.sessionId,
          requestType,
          message: message || undefined,
        }),
      })

      if (res.ok) {
        setActive(true)
        setTimeout(() => setActive(false), 120000) // 2 min cooldown
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || t('Failed to send request. Please try again.', 'ጥያቄ መላክ አልተሳካም። እባክዎ እንደገና ይሞክሩ።', lang))
      }
    } catch (err) {
      console.error('[WAITER_CALL_ERROR]', err)
      toast.error(t('Network error. Please try again.', 'አውታረ መረብ ስህተት። እባክዎ እንደገና ይሞክሩ።', lang))
      setActive(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="px-4 py-4 pb-32"
    >
      <h1 className="text-lg font-bold mb-6">{t('Need Help?', 'እርዳታ ይፈልጋሉ?', lang)}</h1>

      <div className="grid gap-4">
        {/* Call Waiter */}
        <button
          onClick={() => callWaiterApi('call_waiter')}
          disabled={waiterCalled || waiterCalling}
          className={`flex items-center gap-4 p-4 rounded-2xl border transition-all active:scale-[0.98] ${
            waiterCalled
              ? 'bg-brand/10 border-brand'
              : 'bg-card border-border hover:border-brand/30'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center">
            {waiterCalling ? <Loader2 className="w-6 h-6 text-brand animate-spin" /> : <Phone className="w-6 h-6 text-brand" />}
          </div>
          <div className="text-left">
            <h3 className="font-semibold">
              {t('Call Waiter', 'አጋሪ ጠራ', lang)}
            </h3>
            <p className="text-sm text-muted-foreground">
              {waiterCalling
                ? t('Calling...', 'እየጠራ ነው...', lang)
                : waiterCalled
                  ? t('Waiter notified!', 'አጋሪ ተሳትፏል!', lang)
                  : t('A waiter will come to your table', 'አጋሪ ወደ ጠረጴዛዎ ይመጣል', lang)}
            </p>
          </div>
          {waiterCalled && <CheckCircle2 className="w-6 h-6 text-brand ml-auto" />}
        </button>

        {/* Request Bill */}
        <button
          onClick={() => callWaiterApi('request_bill')}
          disabled={billRequested || billRequesting}
          className={`flex items-center gap-4 p-4 rounded-2xl border transition-all active:scale-[0.98] ${
            billRequested
              ? 'bg-brand/10 border-brand'
              : 'bg-card border-border hover:border-brand/30'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
            {billRequesting ? <Loader2 className="w-6 h-6 text-orange-600 animate-spin" /> : <Receipt className="w-6 h-6 text-orange-600" />}
          </div>
          <div className="text-left">
            <h3 className="font-semibold">
              {t('Request Bill', 'ደረሰኝ ጠይቅ', lang)}
            </h3>
            <p className="text-sm text-muted-foreground">
              {billRequesting
                ? t('Requesting...', 'እየጠየቀ ነው...', lang)
                : billRequested
                  ? t('Bill request sent!', 'ደረሰኝ ጥያቄ ተላከ!', lang)
                  : t('Get your bill brought to the table', 'ደረሰኝዎ ወደ ጠረጴዛ ይመጣል', lang)}
            </p>
          </div>
          {billRequested && <CheckCircle2 className="w-6 h-6 text-brand ml-auto" />}
        </button>

        {/* Request Menu */}
        <button
          onClick={() => callWaiterApi('request_menu')}
          disabled={menuRequested || menuRequesting}
          className={`flex items-center gap-4 p-4 rounded-2xl border transition-all active:scale-[0.98] ${
            menuRequested
              ? 'bg-brand/10 border-brand'
              : 'bg-card border-border hover:border-brand/30'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
            {menuRequesting ? <Loader2 className="w-6 h-6 text-purple-600 animate-spin" /> : <ClipboardList className="w-6 h-6 text-purple-600" />}
          </div>
          <div className="text-left">
            <h3 className="font-semibold">
              {t('Request Menu', 'ምናሌ ጠይቅ', lang)}
            </h3>
            <p className="text-sm text-muted-foreground">
              {menuRequesting
                ? t('Requesting...', 'እየጠየቀ ነው...', lang)
                : menuRequested
                  ? t('Menu request sent!', 'ምናሌ ጥያቄ ተላከ!', lang)
                  : t('Ask for a physical menu', 'አካላዊ ምናሌ ጠይቅ', lang)}
            </p>
          </div>
          {menuRequested && <CheckCircle2 className="w-6 h-6 text-brand ml-auto" />}
        </button>

        {/* Custom Request */}
        <div className="flex flex-col gap-3 p-4 rounded-2xl border bg-card border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
              {customSending ? <Loader2 className="w-6 h-6 text-teal-600 animate-spin" /> : <MessageSquare className="w-6 h-6 text-teal-600" />}
            </div>
            <div className="text-left">
              <h3 className="font-semibold">
                {t('Custom Request', 'ብጁ ጥያቄ', lang)}
              </h3>
              <p className="text-sm text-muted-foreground">
                {customSent
                  ? t('Request sent!', 'ጥያቄ ተላከ!', lang)
                  : t('Send a custom message to staff', 'ለሰራተኞች ብጁ መልእክት ላክ', lang)}
              </p>
            </div>
            {customSent && <CheckCircle2 className="w-6 h-6 text-brand ml-auto" />}
          </div>
          {!customSent && (
            <div className="flex gap-2">
              <Input
                placeholder={t('Type your request...', 'ጥያቄዎን ይጻፉ...', lang)}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="flex-1 rounded-xl text-sm"
                onKeyDown={(e) => { if (e.key === 'Enter' && customMessage.trim()) callWaiterApi('custom', customMessage.trim()) }}
              />
              <Button
                onClick={() => callWaiterApi('custom', customMessage.trim())}
                disabled={!customMessage.trim() || customSending}
                className="rounded-xl bg-brand hover:bg-brand-dark text-brand-foreground px-4"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Reserve a Table */}
        <button
          onClick={() => setScreen('reservation')}
          className="flex items-center gap-4 p-4 rounded-2xl border bg-card border-border hover:border-brand/30 transition-all active:scale-[0.98]"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
            <Calendar className="w-6 h-6 text-blue-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold">
              {t('Reserve a Table', 'ጠረጴዛ ያስይዙ', lang)}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('Book a table for later', 'ለመቅረብ ጠረጴዛ ያስይዙ', lang)}
            </p>
          </div>
        </button>

        {/* Order info */}
        {currentOrder && (
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold">
                {t('Active Order', 'ንቁ ትዕዛዝ', lang)}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('Order', 'ትዕዛዝ', lang)} {currentOrder.orderNumber} — {currentOrder.items.length} {t('items', 'ዕቃዎች', lang)}
              </p>
            </div>
          </div>
        )}

        {/* FAQ */}
        <div className="mt-4">
          <h3 className="font-semibold text-sm mb-3">{t('Common Questions', 'ተለምዷዊ ጥያቄዎች', lang)}</h3>
          <div className="grid gap-2">
            {[
              { qEn: 'How do I modify my order?', qAm: 'ትዕዛዜን እንዴት እቀይራለሁ?' },
              { qEn: 'Is the payment secure?', qAm: 'ክፍያው ደህንነቱ የተጠበቀ ነው?' },
              { qEn: 'Can I split the bill?', qAm: 'ደረሰኙን ማካፈል እችላለሁ?' },
            ].map((faq, i) => (
              <div key={i} className="p-3 rounded-xl bg-muted/50">
                <p className="text-sm font-medium">{t(faq.qEn, faq.qAm, lang)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Reservation Screen ───────────────────────────────────────
function ReservationScreen() {
  const { language, session, setScreen } = useCustomerStore()
  const lang = language
  const [date, setDate] = useState('')
  const [time, setTime] = useState('18:00')
  const [partySize, setPartySize] = useState(2)
  const [specialRequests, setSpecialRequests] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!customerName || !customerPhone || !date || !time) {
      setError(t('Please fill in all required fields', 'እባክዎ ሁሉንም አስፈላጊ መስኮች ይሙሉ', lang))
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const rid = session?.restaurantId || 'demo-1'
      const res = await fetch(`/api/restaurants/${rid}/reservations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.sessionToken ? { 'Authorization': `Bearer ${session.sessionToken}` } : {}),
        },
        body: JSON.stringify({
          branchId: session?.branchId,
          customerName,
          customerPhone,
          partySize,
          reservedDate: date,
          reservedTime: time,
          duration: 120,
          specialRequests: specialRequests || undefined,
        }),
      })

      if (res.ok) {
        setSubmitted(true)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || t('Failed to make reservation', 'ማስያው አልተሳካም', lang))
      }
    } catch (err) {
      setError(t('Network error. Please try again.', 'አውታረ መረብ ስህተት። እባክዎ እንደገና ይሞክሩ።', lang))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center min-h-screen px-6"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="w-20 h-20 rounded-full bg-brand flex items-center justify-center mb-4"
        >
          <CheckCircle2 className="w-10 h-10 text-brand-foreground" />
        </motion.div>
        <h2 className="text-xl font-bold mb-2">{t('Reservation Confirmed!', 'ማስያ ተረጋግጧል!', lang)}</h2>
        <p className="text-muted-foreground text-center mb-6">
          {t('We look forward to serving you!', 'ለማገልገልዎ በተስተካከለ መልካም ፍላጎት!', lang)}
        </p>
        <Button onClick={() => setScreen('menu')} className="bg-brand hover:bg-brand-dark text-brand-foreground rounded-xl">
          {t('Back to Menu', 'ወደ ምናሌ ተመለስ', lang)}
        </Button>
      </motion.div>
    )
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="px-4 py-4 pb-32 overflow-y-auto"
    >
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => setScreen('help')} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">{t('Reserve a Table', 'ጠረጴዛ ያስይዙ', lang)}</h1>
      </div>

      <div className="space-y-4">
        {/* Date */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand" />
            {t('Date', 'ቀን', lang)} *
          </label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="rounded-xl"
          />
        </div>

        {/* Time */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand" />
            {t('Time', 'ሰዓት', lang)} *
          </label>
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-xl"
          />
        </div>

        {/* Party Size */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Users className="w-4 h-4 text-brand" />
            {t('Party Size', 'ቁጥር', lang)}
          </label>
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                onClick={() => setPartySize(n)}
                className={`w-10 h-10 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                  partySize === n ? 'bg-brand text-brand-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('Your Name', 'ስምዎ', lang)} *</label>
          <Input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder={t('Enter your name', 'ስምዎን ያስገቡ', lang)}
            className="rounded-xl"
          />
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Phone className="w-4 h-4 text-brand" />
            {t('Phone Number', 'ስልክ ቁጥር', lang)} *
          </label>
          <Input
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="+251..."
            className="rounded-xl"
          />
        </div>

        {/* Special Requests */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('Special Requests', 'ልዩ ጥያቄ', lang)}</label>
          <Textarea
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
            placeholder={t('Any special requests...', 'ልዩ ጥያቄ ካለ...', lang)}
            className="min-h-[80px] rounded-xl resize-none"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full h-12 rounded-xl bg-brand hover:bg-brand-dark text-brand-foreground font-semibold shadow-lg shadow-brand/25"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('Booking...', 'እየተዘጋጀ ነው...', lang)}
            </span>
          ) : (
            t('Confirm Reservation', 'ማስያ አረጋግጥ', lang)
          )}
        </Button>
      </div>
    </motion.div>
  )
}

// ─── Floating Call Waiter Button ───────────────────────────────
function FloatingWaiterButton() {
  const { language, currentScreen, session } = useCustomerStore()
  const [waiterCalled, setWaiterCalled] = useState(false)
  const [callingWaiter, setCallingWaiter] = useState(false)

  if (currentScreen === 'welcome') return null

  const handleCallWaiter = async () => {
    if (!session) return
    setCallingWaiter(true)
    try {
      const res = await fetch(`/api/restaurants/${session.restaurantId}/waiter-calls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session.sessionToken ? { 'Authorization': `Bearer ${session.sessionToken}` } : {}),
        },
        body: JSON.stringify({
          branchId: session.branchId,
          tableId: session.tableId,
          sessionId: session.sessionId,
          requestType: 'call_waiter',
        }),
      })
      if (res.ok) {
        setWaiterCalled(true)
        setTimeout(() => setWaiterCalled(false), 120000) // 2-min cooldown
      }
    } catch {
      // Still mark as called for UX even if API fails
      setWaiterCalled(true)
      setTimeout(() => setWaiterCalled(false), 120000)
    } finally {
      setCallingWaiter(false)
    }
  }

  return (
    <motion.button
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      onClick={handleCallWaiter}
      disabled={waiterCalled || callingWaiter}
      className={`fixed bottom-20 right-4 z-20 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-90 ${
        waiterCalled
          ? 'bg-brand text-brand-foreground'
          : 'bg-card border border-border text-brand hover:bg-brand/10'
      }`}
    >
      {callingWaiter ? <Loader2 className="w-5 h-5 animate-spin" /> :
       waiterCalled ? <CheckCircle2 className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
    </motion.button>
  )
}

// ─── Loyalty Badge ────────────────────────────────────────────
function LoyaltyBadge({ points, language }: { points: number; language: 'en' | 'am' }) {
  const tierInfo = getCustomerTierInfo(points)
  const benefits = getTierBenefits(getCustomerTier(points))

  const tierColors: Record<string, string> = {
    bronze: 'bg-orange-100 text-orange-700 border-orange-200',
    silver: 'bg-gray-100 text-gray-700 border-gray-300',
    gold: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    platinum: 'bg-purple-100 text-purple-700 border-purple-300',
  }

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${tierColors[tierInfo.tier] || tierColors.bronze}`}>
      <Gift className="w-3 h-3" />
      {t(tierInfo.nameEn, tierInfo.nameAm, language)} · {points} {t('pts', 'ነጥብ', language)}
    </span>
  )
}

// ─── My Orders Screen ──────────────────────────────────────────
function MyOrdersScreen() {
  const store = useCustomerStore()
  const {
    language,
    session,
    customerId,
    customerPhone,
    customerName,
    setCustomerId,
    setCustomerName,
    setCustomerPhone,
    orderHistory,
    orderHistoryLoading,
    orderHistoryPage,
    orderHistoryTotalPages,
    orderHistoryTotal,
    setOrderHistory,
    setOrderHistoryLoading,
    setOrderHistoryPage,
    setOrderHistoryTotalPages,
    setOrderHistoryTotal,
    clearOrderHistory,
    menuItems,
    addToCart,
    setScreen,
  } = store
  const lang = language

  // Phone input state for customer identification
  const [phoneInput, setPhoneInput] = useState(customerPhone || '')
  const [nameInput, setNameInput] = useState(customerName || '')
  const [isIdentifying, setIsIdentifying] = useState(false)
  const [identifyError, setIdentifyError] = useState('')
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [reordering, setReordering] = useState<string | null>(null)
  const hasFetchedRef = useRef(false)

  // Fetch order history when we have a customerId
  const fetchOrderHistory = useCallback(async (page = 1) => {
    if (!session?.restaurantId || !customerId) return

    setOrderHistoryLoading(true)
    try {
      const res = await fetch(
        `/api/restaurants/${session.restaurantId}/customers/${customerId}/orders?page=${page}&limit=10`,
        {
          headers: session.sessionToken
            ? { Authorization: `Bearer ${session.sessionToken}` }
            : {},
        }
      )

      if (!res.ok) {
        console.error('[ORDER_HISTORY_FETCH]', res.status)
        return
      }

      const data = await res.json()
      if (page === 1) {
        setOrderHistory(data.orders || [])
      } else {
        store.appendOrderHistory(data.orders || [])
      }
      setOrderHistoryPage(data.pagination?.page || 1)
      setOrderHistoryTotalPages(data.pagination?.totalPages || 1)
      setOrderHistoryTotal(data.pagination?.total || 0)
    } catch (err) {
      console.error('[ORDER_HISTORY_FETCH_ERROR]', err)
    } finally {
      setOrderHistoryLoading(false)
    }
  }, [session?.restaurantId, customerId, session?.sessionToken])

  // Auto-fetch when we have a customer ID
  useEffect(() => {
    if (customerId && session?.restaurantId && !hasFetchedRef.current) {
      hasFetchedRef.current = true
      fetchOrderHistory(1)
    }
  }, [customerId, session?.restaurantId, fetchOrderHistory])

  // Handle phone identification
  const handleIdentify = async () => {
    if (!session?.restaurantId || !phoneInput.trim()) return
    if (phoneInput.trim().length < 7) {
      setIdentifyError(t('Please enter a valid phone number', 'እባክዎ ትክክለኛ ስልክ ያስገቡ', lang))
      return
    }

    setIsIdentifying(true)
    setIdentifyError('')

    try {
      const res = await fetch(
        `/api/restaurants/${session.restaurantId}/customers/identify`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session.sessionToken
              ? { Authorization: `Bearer ${session.sessionToken}` }
              : {}),
          },
          body: JSON.stringify({
            phone: phoneInput.trim(),
            name: nameInput.trim() || undefined,
          }),
        }
      )

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        setIdentifyError(errData.error || t('Failed to identify', 'መለየት አልተሳካም', lang))
        return
      }

      const data = await res.json()
      const customer = data.customer

      setCustomerId(customer.id)
      setCustomerName(customer.name)
      setCustomerPhone(customer.phone)

      // Update session in store
      if (session) {
        useCustomerStore.getState().setSession({
          ...session,
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
        })
      }

      toast.success(data.message || t('Welcome back!', 'እንኳን ደህና መጡ!', lang))

      // Fetch order history
      hasFetchedRef.current = true
      fetchOrderHistory(1)
    } catch (err) {
      console.error('[CUSTOMER_IDENTIFY_ERROR]', err)
      setIdentifyError(t('Something went wrong', 'የሆነ ችግር ተከስቷል', lang))
    } finally {
      setIsIdentifying(false)
    }
  }

  // Handle reorder — maps modifier selections and removed ingredients from history
  const handleReorder = async (order: HistoryOrder) => {
    setReordering(order.id)
    try {
      let addedCount = 0
      let unavailableCount = 0
      for (const item of order.items) {
        // Find matching menu item by ID or name
        const menuItem = menuItems.find(
          (mi) => mi.id === item.menuItemId || mi.nameEn === item.name
        )
        // Check if item is still available (currentAvailable accounts for schedule)
        const isAvailable = menuItem && (menuItem.currentAvailable !== undefined ? menuItem.currentAvailable : menuItem.isAvailable)
        if (!menuItem || !isAvailable) {
          unavailableCount++
          continue
        }

        // Reconstruct modifier selections from order history
        const selectedModifiers: CartItemModifier[] = (item.modifierSelections || []).map((ms) => {
          // Try to find the matching option in the menu item's modifier groups
          let nameEn = ms.name
          let nameAm = ''
          for (const mg of menuItem.modifiers) {
            const opt = mg.options.find((o) => o.id === ms.modifierOptionId)
            if (opt) {
              nameEn = opt.nameEn
              nameAm = opt.nameAm
              break
            }
          }
          return {
            modifierGroupId: ms.modifierGroupId,
            modifierOptionId: ms.modifierOptionId,
            name: ms.name,
            nameEn,
            nameAm,
            priceDeltaCents: ms.priceDeltaCents,
            quantity: ms.quantity,
          }
        })

        // Map removed ingredients from history
        const removedIngredients: IngredientItem[] = (item.removedIngredients || []).map((ri) => ({
          id: ri.id,
          nameEn: ri.name,
          nameAm: ri.nameAm || '',
          isRemovable: true,
          isDefault: true,
        }))

        // Calculate unit price including modifiers
        let unitPriceCents = menuItem.priceCents
        for (const mod of selectedModifiers) {
          unitPriceCents += mod.priceDeltaCents * mod.quantity
        }

        addToCart({
          menuItem,
          quantity: item.quantity,
          selectedModifiers,
          selectedAddons: [],
          removedIngredients,
          specialInstructions: '',
          totalPriceCents: unitPriceCents,
        })
        addedCount++
      }

      if (addedCount > 0) {
        const msg = unavailableCount > 0
          ? t(
              `${addedCount} item${addedCount > 1 ? 's' : ''} added, ${unavailableCount} unavailable`,
              `${addedCount} ዕቃ ታክሏል፣ ${unavailableCount} የለም`,
              lang
            )
          : t(
              `${addedCount} item${addedCount > 1 ? 's' : ''} added to cart`,
              `${addedCount} ዕቃ ወደ ጋሪ ታክሏል`,
              lang
            )
        toast.success(msg)
        setScreen('menu')
        useCustomerStore.getState().setIsCartOpen(true)
      } else {
        toast.error(t('Items no longer available', 'ዕቃዎች አሁን የሉም', lang))
      }
    } finally {
      setReordering(null)
    }
  }

  // Order status badge color
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-700'
      case 'cancelled':
        return 'bg-red-100 text-red-700'
      case 'pending':
        return 'bg-yellow-100 text-yellow-700'
      case 'preparing':
        return 'bg-orange-100 text-orange-700'
      case 'ready':
        return 'bg-blue-100 text-blue-700'
      case 'served':
        return 'bg-teal-100 text-teal-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatusLabel = (status: string) => {
    const map: Record<string, { en: string; am: string }> = {
      pending: { en: 'Pending', am: 'በመጠባበቅ ላይ' },
      accepted: { en: 'Confirmed', am: 'ተረጋግጧል' },
      preparing: { en: 'Preparing', am: 'እየተሰራ ነው' },
      ready: { en: 'Ready', am: 'ዝግጁ' },
      served: { en: 'Served', am: 'ቀርቧል' },
      completed: { en: 'Completed', am: 'ተጠናቀቀ' },
      cancelled: { en: 'Cancelled', am: 'ተሰርዟል' },
    }
    const label = map[status] || { en: status, am: status }
    return t(label.en, label.am, lang)
  }

  // If no customer ID, show identification form
  if (!customerId) {
    return (
      <motion.div
        className="px-4 py-6 pb-32"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setScreen('menu')}
            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">
            {t('My Orders', 'ትዕዛዞቼ', lang)}
          </h1>
        </div>

        {/* Identification form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-6 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-brand" />
          </div>

          <h2 className="text-lg font-semibold mb-2">
            {t('Access Your Orders', 'ትዕዛዞችዎን ይድረሱ', lang)}
          </h2>

          <p className="text-sm text-muted-foreground mb-6">
            {t(
              'Enter your phone number to view your order history and reorder favorites',
              'የስልክ ቁጥርዎን ያስገቡ የትዕዛዝ ታሪክዎን ለማየት እና ለድጋሚ ትዕዛዝ',
              lang
            )}
          </p>

          <div className="space-y-3 text-left">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {t('Phone Number', 'ስልክ ቁጥር', lang)}
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => {
                    setPhoneInput(e.target.value)
                    setIdentifyError('')
                  }}
                  placeholder="+251 9XX XXX XXX"
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-muted border-0 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {t('Name (optional)', 'ስም (አማራጭ)', lang)}
              </label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder={t('Your name', 'የእርስዎ ስም', lang)}
                className="w-full h-11 px-4 rounded-xl bg-muted border-0 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          </div>

          {identifyError && (
            <p className="text-sm text-destructive mt-3">{identifyError}</p>
          )}

          <Button
            onClick={handleIdentify}
            disabled={isIdentifying || !phoneInput.trim()}
            className="w-full mt-4 h-12 bg-brand hover:bg-brand-dark text-brand-foreground rounded-xl font-semibold"
          >
            {isIdentifying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('Finding your orders...', 'ትዕዛዞችዎን ፈልጎ እያገኘ...', lang)}
              </>
            ) : (
              t('View My Orders', 'ትዕዛዞቼን አሳይ', lang)
            )}
          </Button>
        </motion.div>
      </motion.div>
    )
  }

  // Customer is identified — show order history
  return (
    <motion.div
      className="px-4 py-4 pb-32 overflow-y-auto"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setScreen('menu')}
          className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">
            {t('My Orders', 'ትዕዛዞቼ', lang)}
          </h1>
          {customerName && (
            <p className="text-xs text-muted-foreground">
              {t('Welcome', 'እንኳን ደህና', lang)}, {customerName}
            </p>
          )}
        </div>
        {customerPhone && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {customerPhone}
          </span>
        )}
      </div>

      {/* Loading state */}
      {orderHistoryLoading && orderHistory.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!orderHistoryLoading && orderHistory.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center mb-4">
            <ClipboardList className="w-10 h-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            {t('No orders yet', 'እስካሁን ትዕዛዝ የለም', lang)}
          </h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-[250px]">
            {t(
              'Your order history will appear here after you place your first order',
              'የመጀመሪያ ትዕዛዝዎን ካስገቡ በኋላ የትዕዛዝ ታሪክዎ እዚህ ይታያል',
              lang
            )}
          </p>
          <Button
            onClick={() => setScreen('menu')}
            className="bg-brand hover:bg-brand-dark text-brand-foreground rounded-xl"
          >
            {t('Browse Menu', 'ምናሌ አስስ', lang)}
          </Button>
        </motion.div>
      )}

      {/* Order list */}
      <div className="space-y-3">
        {orderHistory.map((order, index) => {
          const isExpanded = expandedOrderId === order.id
          const date = new Date(order.createdAt)
          const dateStr = date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
          })
          const timeStr = date.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
          })

          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-card border border-border rounded-xl overflow-hidden"
            >
              {/* Order header — always visible */}
              <button
                onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                className="w-full p-4 text-left hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">
                      {order.orderNumber}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusStyle(
                        order.status
                      )}`}
                    >
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 text-muted-foreground transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {dateStr} · {timeStr}
                  </span>
                  <span className="text-sm font-semibold text-brand">
                    {formatPrice(order.totalAmountCents)}
                  </span>
                </div>

                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {order.itemCount} {t('items', 'ዕቃዎች', lang)}
                  </span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {order.items
                      .slice(0, 3)
                      .map((item) => item.name)
                      .join(', ')}
                    {order.items.length > 3 && '...'}
                  </span>
                </div>
              </button>

              {/* Expanded details */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 border-t border-border pt-3 space-y-2">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3"
                        >
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-10 h-10 rounded-lg object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <UtensilsCrossed className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {item.name}
                              {item.quantity > 1 && (
                                <span className="text-muted-foreground ml-1">
                                  ×{item.quantity}
                                </span>
                              )}
                            </p>
                            {item.modifierSelections &&
                              item.modifierSelections.length > 0 && (
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {item.modifierSelections
                                    .map((m) => m.name)
                                    .join(', ')}
                                </p>
                              )}
                          </div>
                          <span className="text-xs font-medium">
                            {formatPrice(item.priceCents * item.quantity)}
                          </span>
                        </div>
                      ))}

                      {/* Totals */}
                      <Separator className="my-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{t('Subtotal', 'ንዑስ ድምር', lang)}</span>
                        <span>{formatPrice(order.subtotalCents)}</span>
                      </div>
                      {order.discountAmountCents > 0 && (
                        <div className="flex justify-between text-xs text-emerald-600">
                          <span>{t('Discount', 'ቅናሽ', lang)}</span>
                          <span>-{formatPrice(order.discountAmountCents)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs font-semibold">
                        <span>{t('Total', 'ጠቅላላ', lang)}</span>
                        <span>{formatPrice(order.totalAmountCents)}</span>
                      </div>

                      {/* Reorder button */}
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleReorder(order)
                        }}
                        disabled={reordering === order.id}
                        className="w-full mt-2 bg-brand/10 text-brand hover:bg-brand/20 border-0 rounded-xl h-10 font-semibold"
                        variant="outline"
                      >
                        {reordering === order.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {t('Adding...', 'እያከተተ...', lang)}
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-4 h-4 mr-2" />
                            {t('Reorder', 'ድጋሚ ያዝዙ', lang)}
                          </>
                        )}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>

      {/* Load more */}
      {orderHistoryPage < orderHistoryTotalPages && (
        <div className="mt-4 text-center">
          <Button
            variant="outline"
            onClick={() => fetchOrderHistory(orderHistoryPage + 1)}
            disabled={orderHistoryLoading}
            className="rounded-xl"
          >
            {orderHistoryLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            {t('Load More', 'ተጨማሪ አሳይ', lang)}
          </Button>
        </div>
      )}

      {/* Summary footer */}
      {orderHistoryTotal > 0 && (
        <p className="text-center text-xs text-muted-foreground mt-4">
          {t(
            `${orderHistoryTotal} order${orderHistoryTotal !== 1 ? 's' : ''} found`,
            `${orderHistoryTotal} ትዕዛዝ ተገኝቷል`,
            lang
          )}
        </p>
      )}
    </motion.div>
  )
}

// ─── Bottom Navigation Bar ─────────────────────────────────────
function BottomNav() {
  const { language, activeTab, setActiveTab, setScreen, getCartItemCount, currentOrder } = useCustomerStore()
  const lang = language
  const cartCount = getCartItemCount()

  const tabs: Array<{ tab: BottomTab; labelEn: string; labelAm: string; icon: React.ReactNode; badge?: number }> = [
    { tab: 'menu', labelEn: 'Menu', labelAm: 'ምናሌ', icon: <UtensilsCrossed className="w-5 h-5" /> },
    { tab: 'cart', labelEn: 'Cart', labelAm: 'ጋሪ', icon: <ShoppingCart className="w-5 h-5" />, badge: cartCount },
    { tab: 'order', labelEn: 'Order', labelAm: 'ትዕዛዝ', icon: <ClipboardList className="w-5 h-5" /> },
    { tab: 'help', labelEn: 'Help', labelAm: 'እርዳታ', icon: <HelpCircle className="w-5 h-5" /> },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border">
      <div className="flex items-center justify-around py-1">
        {tabs.map(({ tab, labelEn, labelAm, icon, badge }) => {
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab)
                if (tab === 'menu') setScreen('menu')
                else if (tab === 'cart') {
                  if (cartCount > 0) {
                    useCustomerStore.getState().setIsCartOpen(true)
                  }
                }
                else if (tab === 'order') setScreen('order')
                else if (tab === 'help') setScreen('help')
              }}
              className={`flex flex-col items-center gap-0.5 py-2 px-4 min-w-[64px] transition-colors relative ${
                isActive ? 'text-brand' : 'text-muted-foreground'
              }`}
            >
              <div className="relative">
                {icon}
                {badge && badge > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1"
                  >
                    {badge}
                  </motion.span>
                )}
                {tab === 'order' && currentOrder && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-brand animate-pulse" />
                )}
              </div>
              <span className="text-[10px] font-medium">{t(labelEn, labelAm, lang)}</span>
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-brand rounded-full"
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Skeleton Loading ──────────────────────────────────────────
function MenuSkeleton() {
  return (
    <div className="grid gap-3 px-4 py-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-3 p-3 rounded-2xl bg-card border border-border">
          <Skeleton className="w-24 h-24 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Customer App ─────────────────────────────────────────
// ─── QR Session Initialization Hook ─────────────────────────────
// When navigating to #/menu/{payload} via the hash router (e.g. from UAT testing),
// this hook parses the payload, calls the session API, and sets the customer store.
function useQRSessionInit() {
  const { route } = useRouter()
  const { session, setSession } = useCustomerStore()

  useEffect(() => {
    // Only run when on the customer-menu route with a qrPayload param
    if (route.name !== 'customer-menu') return
    if (!route.params.qrPayload) return
    // Don't re-initialize if we already have a real session (not demo)
    if (session?.sessionToken) return

    const payloadStr = route.params.qrPayload

    async function initSession() {
      try {
        // Parse the payload. Two formats are supported:
        //   New: <base64payload>--<signature>  (current buildQRUrl output)
        //   Legacy: <base64payload>.<signature>  (old QR codes still in the wild)
        // Phase 5.3: previously only the legacy '.' separator was supported here,
        // so newly-generated QR codes scanned into this entrypoint failed to parse.
        // The /menu/[payload]/page.tsx flow already handled both; this fixes the
        // root-page entrypoint to match.
        let encodedPayload: string | undefined
        let signature: string | undefined

        const dashIndex = payloadStr.lastIndexOf('--')
        if (dashIndex !== -1) {
          encodedPayload = payloadStr.slice(0, dashIndex)
          signature = payloadStr.slice(dashIndex + 2)
        } else {
          const dotIndex = payloadStr.lastIndexOf('.')
          if (dotIndex !== -1) {
            encodedPayload = payloadStr.slice(0, dotIndex)
            signature = payloadStr.slice(dotIndex + 1)
          }
        }

        if (!encodedPayload || !signature) return

        let qrPayload: { rid: string; bid: string; tid: string; type: string; iat: number; exp: number | null }
        try {
          const decoded = atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/'))
          qrPayload = JSON.parse(decoded)
        } catch {
          console.error('[QR_SESSION_INIT] Invalid QR payload')
          return
        }

        // Call session API to validate and create session
        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload: qrPayload, signature }),
        })

        if (!res.ok) {
          console.error('[QR_SESSION_INIT] Session API failed:', res.status)
          return
        }

        const data = await res.json()

        // Set the session in the customer store
        setSession({
          restaurantId: data.restaurant?.id || qrPayload.rid,
          restaurantName: data.restaurant?.name || '',
          restaurantNameAm: data.restaurant?.nameAm || '',
          restaurantLogo: data.restaurant?.logo || undefined,
          tableNumber: data.table?.number ? parseInt(data.table.number, 10) : 1,
          branchName: data.branch?.name || '',
          branchId: data.branch?.id || qrPayload.bid,
          tableId: data.table?.id || qrPayload.tid,
          sessionId: data.session?.id || data.token?.slice(0, 20) || 'session-qr',
          sessionToken: data.token,
          taxRate: data.restaurant?.taxRate,
          serviceCharge: data.restaurant?.serviceCharge,
          customerId: data.session?.customerId || data.customer?.id || undefined,
          customerName: data.session?.customerName || data.customer?.name || undefined,
          customerPhone: data.session?.customerPhone || data.customer?.phone || undefined,
        })

        // Also set customer identity in store for order history
        const custId = data.session?.customerId || data.customer?.id
        if (custId) {
          useCustomerStore.getState().setCustomerId(custId)
          useCustomerStore.getState().setCustomerName(data.session?.customerName || data.customer?.name || null)
          useCustomerStore.getState().setCustomerPhone(data.session?.customerPhone || data.customer?.phone || null)
        }
      } catch (err) {
        console.error('[QR_SESSION_INIT] Error:', err)
      }
    }

    initSession()
  }, [route.name, route.params.qrPayload, session?.sessionToken, setSession])
}

export default function CustomerApp() {
  const { currentScreen, currentOrder, session } = useCustomerStore()
  const [isLoading, setIsLoading] = useState(true)
  const [showExpiryWarning, setShowExpiryWarning] = useState(false)

  // Initialize session from QR payload when navigating via hash router
  useQRSessionInit()

  // Fetch menu data when session is set
  useMenuData()

  // ─── Session Watchdog ─────────────────────────────────────────
  // Monitors JWT token expiry, shows warning before expiration,
  // and auto-refreshes to prevent session interruption.
  useEffect(() => {
    if (!session?.sessionToken) return

    let warningShown = false
    let refreshAttempted = false
    let expiredHandled = false

    const checkToken = async () => {
      try {
        const token = session!.sessionToken!
        const parts = token.split('.')
        if (parts.length !== 3) return

        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
        const payload = JSON.parse(decodeURIComponent(escape(atob(base64))))
        if (!payload.exp) return

        const nowSec = Date.now() / 1000
        const remainingSec = payload.exp - nowSec
        const remainingMin = Math.max(0, Math.floor(remainingSec / 60))

        // Session expired
        if (remainingSec <= 0 && !expiredHandled) {
          expiredHandled = true
          toast.error('Session expired', {
            description: 'Your session has expired. Please scan the QR code again.',
            duration: 10000,
          })
          // Clear stale session
          useCustomerStore.getState().setSession(null)
          return
        }

        // Auto-refresh when within 5 minutes of expiry
        if (remainingMin <= 5 && !refreshAttempted) {
          refreshAttempted = true
          try {
            const res = await fetch('/api/auth/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token }),
            })
            if (res.ok) {
              const data = await res.json()
              // Update the session token in the store
              useCustomerStore.getState().setSession({
                ...session!,
                sessionToken: data.token,
              })
              toast.success('Session refreshed', {
                description: 'Your session has been extended.',
                duration: 3000,
              })
              // Reset flags since we have a new token now
              refreshAttempted = false
              warningShown = false
              return
            }
            // Refresh failed — fall through to warning
          } catch {
            // Network error — show warning instead
          }
        }

        // Show warning when within 10 minutes of expiry
        if (remainingMin <= 10 && !warningShown && !refreshAttempted) {
          warningShown = true
          setShowExpiryWarning(true)
          toast.warning('Session expiring soon', {
            description: `Your session expires in ${remainingMin} minutes. Please place your order soon.`,
            duration: 8000,
          })
        }
      } catch {
        // Token decode error — ignore
      }
    }

    // Check immediately then every 30 seconds
    checkToken()
    const interval = setInterval(checkToken, 30_000)
    return () => clearInterval(interval)
  }, [session?.sessionToken])

  // ─── Cart Persistence ─────────────────────────────────────────
  // Save cart to localStorage so it survives page refreshes
  const cartRef = useRef(useCustomerStore.getState().cart)
  useEffect(() => {
    const unsub = useCustomerStore.subscribe((state) => {
      cartRef.current = state.cart
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!session?.sessionToken) return

    const cart = cartRef.current
    if (cart.length > 0) {
      try {
        localStorage.setItem(
          `yeneqr-cart-${session.restaurantId}`,
          JSON.stringify({
            items: cart,
            savedAt: Date.now(),
            sessionId: session.sessionId,
          })
        )
      } catch {
        // localStorage full or unavailable — non-critical
      }
    } else {
      // Cart is empty — remove saved cart
      localStorage.removeItem(`yeneqr-cart-${session.restaurantId}`)
    }
  }, [cartRef.current, session?.sessionToken, session?.restaurantId])

  // Restore cart from localStorage on session init
  useEffect(() => {
    if (!session?.restaurantId) return

    try {
      const saved = localStorage.getItem(`yeneqr-cart-${session.restaurantId}`)
      if (!saved) return

      const { items, savedAt, sessionId } = JSON.parse(saved)
      // Only restore if saved within the last 4 hours and same session
      const fourHoursMs = 4 * 60 * 60 * 1000
      if (Date.now() - savedAt < fourHoursMs && sessionId === session.sessionId) {
        const currentCart = useCustomerStore.getState().cart
        // Only restore if cart is currently empty
        if (currentCart.length === 0 && items.length > 0) {
          useCustomerStore.getState().setCart(items)
          toast.info('Cart restored', {
            description: `${items.length} item(s) restored from your previous session.`,
            duration: 4000,
          })
        }
      }
    } catch {
      // Corrupted data — clear it
      localStorage.removeItem(`yeneqr-cart-${session.restaurantId}`)
    }
  }, [session?.sessionId])

  // Simulate initial loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800)
    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-background">
        <div className="p-4 space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-8 w-1/2" />
          <MenuSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-background relative">
      {/* Session Expiry Warning Banner */}
      {showExpiryWarning && session?.sessionToken && (
        <div className="bg-amber-500 text-white text-xs text-center py-1.5 px-3 flex items-center justify-center gap-2">
          <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse" />
          Session expiring soon — place your order to keep it active
          <button
            onClick={() => setShowExpiryWarning(false)}
            className="ml-1 text-white/70 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
      <AnimatePresence mode="wait">
        {currentScreen === 'welcome' && <WelcomeScreen key="welcome" />}
        {currentScreen === 'menu' && (
          <motion.div
            key="menu"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="h-screen flex flex-col"
          >
            <div className="flex-1 overflow-hidden">
              <MenuBrowser />
            </div>
          </motion.div>
        )}
        {currentScreen === 'order' && (
          <motion.div
            key="order"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="min-h-screen"
          >
            <OrderTrackingScreen />
          </motion.div>
        )}
        {currentScreen === 'payment' && <PaymentScreen key="payment" />}
        {currentScreen === 'feedback' && <FeedbackScreen key="feedback" />}
        {currentScreen === 'help' && <HelpScreen key="help" />}
        {currentScreen === 'reservation' && <ReservationScreen key="reservation" />}
        {currentScreen === 'orders' && (
          <motion.div
            key="orders"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="min-h-screen"
          >
            <MyOrdersScreen />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlays */}
      {currentScreen !== 'welcome' && (
        <>
          <StickyCartBar />
          <ItemDetailSheet />
          <CartSheet />
          <FloatingWaiterButton />
          <BottomNav />
        </>
      )}
    </div>
  )
}
