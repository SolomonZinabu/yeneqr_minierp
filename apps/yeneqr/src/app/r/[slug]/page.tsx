'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UtensilsCrossed,
  Loader2,
  Leaf,
  Flame,
  ChevronDown,
  Star,
  MapPin,
  Phone,
  Globe,
  Share2,
  ExternalLink,
  Search,
  Filter,
  X,
  Coffee,
  Wheat,
  Milk,
  Fish,
  Egg,
  Nut,
  ChevronRight,
} from 'lucide-react'
import ShareSheet from '@/components/customer/share-sheet'

// ─── Types ────────────────────────────────────────────────────

interface ModifierOption {
  id: string
  name: string
  nameAm: string | null
  priceDeltaCents: number
}

interface ModifierGroup {
  id: string
  name: string
  nameAm: string | null
  isRequired: boolean
  minSelection: number
  maxSelection: number
  options: ModifierOption[]
}

interface AllergenInfo {
  allergen: { id: string; name: string; icon: string | null }
}

interface SharedMenuItem {
  id: string
  name: string
  nameAm: string | null
  nameI18n?: string | null
  description: string | null
  descriptionAm: string | null
  descriptionI18n?: string | null
  image: string | null
  priceCents: number
  preparationTime: number
  isPopular: boolean
  isVegetarian: boolean
  isSpicy: boolean
  isDairyFree?: boolean
  isGlutenFree?: boolean
  isHalal?: boolean
  isVegan?: boolean
  calories?: number | null
  categoryId: string
  modifierGroups?: ModifierGroup[]
  allergens?: AllergenInfo[]
}

interface SharedCategory {
  id: string
  name: string
  nameAm: string | null
  nameI18n?: string | null
  icon: string | null
  items: SharedMenuItem[]
}

interface SharedRestaurant {
  id: string
  name: string
  nameAm: string | null
  nameI18n?: string | null
  slug: string
  logo: string | null
  banner: string | null
  cuisineType: string | null
  description: string | null
  descriptionAm: string | null
  descriptionI18n?: string | null
  city: string | null
  address: string | null
  phone: string | null
  defaultLanguage: string
  enabledLanguages?: string[] | null
  currency: string
  taxRate: number
  serviceCharge: number
  settings?: Record<string, unknown> | null
}

// ─── Helpers ──────────────────────────────────────────────────

function resolveName(name: string, nameAm: string | null, nameI18n?: string | null): string {
  if (typeof window !== 'undefined') {
    const lang = localStorage.getItem('yeneqr_language') || ''
    if (lang === 'am' && nameAm) return nameAm
    if (nameI18n) {
      try {
        const i18n = typeof nameI18n === 'string' ? JSON.parse(nameI18n) : nameI18n
        if (i18n[lang]) return i18n[lang]
      } catch {}
    }
  }
  return name
}

function formatPrice(cents: number, currency: string = 'ETB'): string {
  const sym = currency === 'ETB' ? 'ብር' : currency
  return `${sym} ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function getImageUrl(image: string | null): string | null {
  if (!image) return null
  if (image.startsWith('http') || image.startsWith('data:')) return image
  return image
}

const ALLERGEN_ICONS: Record<string, React.ReactNode> = {
  Gluten: <Wheat className="w-3 h-3" />,
  Dairy: <Milk className="w-3 h-3" />,
  Nuts: <Nut className="w-3 h-3" />,
  Shellfish: <Fish className="w-3 h-3" />,
  Eggs: <Egg className="w-3 h-3" />,
  Soy: <span className="text-[10px]">🫘</span>,
  Fish: <Fish className="w-3 h-3" />,
  Sesame: <span className="text-[10px]">⚪</span>,
}

const DIETARY_BADGES = [
  { key: 'isVegetarian', label: 'Vegetarian', icon: <Leaf className="w-3 h-3" />, color: 'text-green-600 bg-green-50 dark:bg-green-950/30' },
  { key: 'isVegan', label: 'Vegan', icon: <Leaf className="w-3 h-3" />, color: 'text-green-700 bg-green-100 dark:bg-green-950/40' },
  { key: 'isGlutenFree', label: 'Gluten-Free', icon: <Wheat className="w-3 h-3" />, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
  { key: 'isDairyFree', label: 'Dairy-Free', icon: <Milk className="w-3 h-3" />, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
  { key: 'isHalal', label: 'Halal', icon: <span className="text-[10px] font-bold">ح</span>, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30' },
] as const

// ─── Language Picker ──────────────────────────────────────────

function LanguagePicker({ defaultLang, enabledLanguages }: { defaultLang: string; enabledLanguages?: string[] | null }) {
  const [current, setCurrent] = useState(defaultLang)
  const [open, setOpen] = useState(false)

  const languages = [
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'am', label: 'አማርኛ', flag: '🇪🇹' },
    { code: 'om', label: 'Oromiffa', flag: '🇪🇹' },
    { code: 'ti', label: 'ትግርኛ', flag: '🇪🇹' },
    { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  ].filter(l => !enabledLanguages || enabledLanguages.length === 0 || enabledLanguages.includes(l.code))

  const changeLang = (code: string) => {
    setCurrent(code)
    localStorage.setItem('yeneqr_language', code)
    setOpen(false)
    // Force re-render by reloading
    window.location.reload()
  }

  const currentLang = languages.find(l => l.code === current) || languages[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border/50 text-xs font-medium shadow-sm"
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{currentLang?.flag}</span>
        <span>{currentLang?.label}</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full right-0 mt-1 bg-card border rounded-xl shadow-xl py-1 min-w-[140px] z-50"
        >
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => changeLang(lang.code)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 transition-colors ${lang.code === current ? 'font-bold text-brand' : ''}`}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
              {lang.code === current && <Check className="w-3 h-3 ml-auto" />}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  )
}

function Check({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>
}

// ─── Item Card ────────────────────────────────────────────────

function ItemCard({
  item,
  restaurant,
  isHighlighted,
  onShare,
}: {
  item: SharedMenuItem
  restaurant: SharedRestaurant
  isHighlighted: boolean
  onShare: (item: SharedMenuItem) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const itemName = resolveName(item.name, item.nameAm, item.nameI18n)
  const itemDesc = resolveName(item.description || '', item.descriptionAm, item.descriptionI18n)
  const hasModifiers = item.modifierGroups && item.modifierGroups.length > 0
  const hasAllergens = item.allergens && item.allergens.length > 0
  const hasDetails = hasModifiers || hasAllergens || (item.calories && item.calories > 0)

  return (
    <motion.div
      layout
      className={`rounded-2xl overflow-hidden transition-all ${
        isHighlighted ? 'bg-brand/5 border-2 border-brand/30 shadow-md' : 'bg-card border border-border/50 hover:shadow-sm'
      }`}
    >
      <div className="flex gap-3 p-3">
        {/* Image */}
        {item.image && (
          <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
            <img
              src={getImageUrl(item.image) || ''}
              alt={itemName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{itemName}</p>
              {itemDesc && (
                <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{itemDesc}</p>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onShare(item) }}
              className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-brand hover:bg-brand/10 transition-colors shrink-0"
              title="Share item"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Price + badges */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-sm font-bold text-brand">
              {formatPrice(item.priceCents, restaurant.currency)}
            </span>
            {item.isPopular && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-amber-700 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full">
                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                Popular
              </span>
            )}
            {item.isSpicy && <Flame className="w-3 h-3 text-orange-500" />}
            {item.isVegetarian && <Leaf className="w-3 h-3 text-green-500" />}
            {item.preparationTime > 0 && (
              <span className="text-[10px] text-muted-foreground">{item.preparationTime}m</span>
            )}
          </div>

          {/* Dietary badges */}
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {DIETARY_BADGES.map(badge => {
              const isActive = (item as any)[badge.key]
              if (!isActive) return null
              return (
                <span key={badge.key} className={`inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${badge.color}`}>
                  {badge.icon}
                  {badge.label}
                </span>
              )
            })}
            {item.allergens?.map(a => (
              <span key={a.allergen.id} className="inline-flex items-center gap-0.5 text-[9px] font-medium text-red-600 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded-full" title={`Contains ${a.allergen.name}`}>
                {ALLERGEN_ICONS[a.allergen.name] || <span className="text-[10px]">⚠</span>}
                {a.allergen.name}
              </span>
            ))}
          </div>

          {/* Expand details */}
          {hasDetails && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-[10px] text-brand font-medium mt-2 hover:underline"
            >
              {expanded ? 'Hide options' : 'View options'}
              <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded details: modifiers + calories */}
      <AnimatePresence>
        {expanded && hasDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/30">
              {/* Calories */}
              {item.calories && item.calories > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  🔥 {item.calories} cal
                </p>
              )}

              {/* Modifier groups */}
              {item.modifierGroups?.map(group => (
                <div key={group.id} className="space-y-1">
                  <p className="text-[11px] font-semibold text-foreground">
                    {resolveName(group.name, group.nameAm)}
                    {group.isRequired && <span className="text-red-500 ml-1">*</span>}
                    {group.minSelection > 0 && (
                      <span className="text-[9px] text-muted-foreground ml-1">
                        (min {group.minSelection}{group.maxSelection > 0 ? `, max ${group.maxSelection}` : ''})
                      </span>
                    )}
                  </p>
                  <div className="space-y-0.5">
                    {group.options.map(opt => (
                      <div key={opt.id} className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{resolveName(opt.name, opt.nameAm)}</span>
                        {opt.priceDeltaCents > 0 && (
                          <span className="font-medium text-brand">+{formatPrice(opt.priceDeltaCents, restaurant.currency)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Allergen warning */}
              {hasAllergens && (
                <p className="text-[9px] text-red-500 flex items-center gap-1">
                  <span>⚠</span>
                  Contains: {item.allergens!.map(a => a.allergen.name).join(', ')}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────

export default function SharedMenuPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const highlightItemId = searchParams.get('item') || undefined

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restaurant, setRestaurant] = useState<SharedRestaurant | null>(null)
  const [categories, setCategories] = useState<SharedCategory[]>([])
  const [highlightItem, setHighlightItem] = useState<SharedMenuItem | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [shareSheetOpen, setShareSheetOpen] = useState(false)
  const [shareContext, setShareContext] = useState<{ title: string; text: string; url: string }>({ title: '', text: '', url: '' })
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    ;(async () => {
      try {
        const itemParam = highlightItemId ? `?item=${highlightItemId}` : ''
        const res = await fetch(`/api/restaurants/share/${slug}${itemParam}`)
        if (!res.ok) {
          setError('Restaurant not found')
          return
        }
        const data = await res.json()
        if (!cancelled) {
          setRestaurant(data.restaurant)
          setCategories(data.categories || [])
          setHighlightItem(data.highlightItem || null)
          const initial = new Set<string>()
          if (data.categories?.length > 0) initial.add(data.categories[0].id)
          if (data.highlightItem) {
            const cat = data.categories.find((c: SharedCategory) =>
              c.items.some((i: SharedMenuItem) => i.id === data.highlightItem.id)
            )
            if (cat) initial.add(cat.id)
          }
          setExpandedCategories(initial)
        }
      } catch {
        if (!cancelled) setError('Failed to load menu')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [slug, highlightItemId])

  const baseUrl = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_BASE_URL || window.location.origin)
    : ''

  const menuShareUrl = restaurant ? `${baseUrl}/r/${restaurant.slug}` : ''
  const itemShareUrl = (item: SharedMenuItem) => restaurant ? `${baseUrl}/r/${restaurant.slug}?item=${item.id}` : ''

  const openShareMenu = useCallback(() => {
    if (!restaurant) return
    const name = resolveName(restaurant.name, restaurant.nameAm, restaurant.nameI18n)
    setShareContext({
      title: `${name} - Yene QR`,
      text: `Check out ${name}'s menu on Yene QR! 🍽️`,
      url: menuShareUrl,
    })
    setShareSheetOpen(true)
  }, [restaurant, menuShareUrl])

  const openShareItem = useCallback((item: SharedMenuItem) => {
    if (!restaurant) return
    const rName = resolveName(restaurant.name, restaurant.nameAm, restaurant.nameI18n)
    const iName = resolveName(item.name, item.nameAm, item.nameI18n)
    const price = formatPrice(item.priceCents, restaurant.currency)
    setShareContext({
      title: `${iName} - ${rName}`,
      text: `${iName} (${price}) at ${rName} — check it out on Yene QR! 🍽️`,
      url: itemShareUrl(item),
    })
    setShareSheetOpen(true)
  }, [restaurant, itemShareUrl])

  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  // Filter items by search
  const filteredCategories = categories.map(cat => ({
    ...cat,
    items: search
      ? cat.items.filter(i =>
          i.name.toLowerCase().includes(search.toLowerCase()) ||
          (i.description || '').toLowerCase().includes(search.toLowerCase())
        )
      : cat.items,
  })).filter(cat => cat.items.length > 0)

  const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0)

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-background">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="w-20 h-20 rounded-2xl bg-brand flex items-center justify-center mb-6 shadow-lg shadow-brand/30"
        >
          <UtensilsCrossed className="w-10 h-10 text-white" />
        </motion.div>
        <Loader2 className="w-8 h-8 text-brand animate-spin mb-4" />
        <p className="text-muted-foreground text-sm">Loading menu...</p>
      </div>
    )
  }

  // ── Error ──
  if (error || !restaurant) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-background px-6">
        <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-6">
          <UtensilsCrossed className="w-10 h-10 text-muted-foreground" />
        </div>
        <p className="text-lg font-semibold mb-2">Menu Not Found</p>
        <p className="text-muted-foreground text-sm text-center">{error || 'This restaurant menu is not available.'}</p>
      </div>
    )
  }

  const rName = resolveName(restaurant.name, restaurant.nameAm, restaurant.nameI18n)
  const rDesc = resolveName(restaurant.description || '', restaurant.descriptionAm, restaurant.descriptionI18n)
  const parsedSettings = restaurant.settings ? (typeof restaurant.settings === 'string' ? JSON.parse(restaurant.settings as string) : restaurant.settings) : null
  const enabledLangs = parsedSettings?.enabledLanguages as string[] | undefined

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-brand/5 via-background to-background pb-20">
      {/* ── Banner ── */}
      {restaurant.banner && (
        <div className="relative h-48 overflow-hidden">
          <img
            src={restaurant.banner.startsWith('http') ? restaurant.banner : restaurant.banner}
            alt={rName}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />

          {/* Language picker overlay */}
          <div className="absolute top-3 right-3">
            <LanguagePicker defaultLang={restaurant.defaultLanguage} enabledLanguages={enabledLangs} />
          </div>

          {/* Share button overlay */}
          <div className="absolute top-3 left-3">
            <button
              onClick={openShareMenu}
              className="w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center text-brand hover:bg-card transition-colors shadow-md"
              title="Share menu"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* If no banner, still show language picker + share */}
      {!restaurant.banner && (
        <div className="flex justify-between items-center px-4 pt-4">
          <button
            onClick={openShareMenu}
            className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand hover:bg-brand/20 transition-colors"
            title="Share menu"
          >
            <Share2 className="w-5 h-5" />
          </button>
          <LanguagePicker defaultLang={restaurant.defaultLanguage} enabledLanguages={enabledLangs} />
        </div>
      )}

      {/* ── Restaurant Header ── */}
      <div className={`px-5 ${restaurant.banner ? '-mt-12 relative z-10' : 'pt-2'}`}>
        <div className="flex items-end gap-4">
          {restaurant.logo && (
            <div className="w-16 h-16 rounded-2xl bg-white border-2 border-white shadow-md overflow-hidden shrink-0">
              <img
                src={restaurant.logo.startsWith('http') ? restaurant.logo : restaurant.logo}
                alt={rName}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{rName}</h1>
            {restaurant.cuisineType && (
              <p className="text-sm text-muted-foreground">{restaurant.cuisineType}</p>
            )}
          </div>
        </div>

        {/* Info row */}
        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
          {restaurant.city && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {restaurant.city}
            </span>
          )}
          {restaurant.phone && (
            <a href={`tel:${restaurant.phone}`} className="flex items-center gap-1 hover:text-brand transition-colors">
              <Phone className="w-3 h-3" />
              {restaurant.phone}
            </a>
          )}
          {totalItems > 0 && (
            <span className="flex items-center gap-1">
              <UtensilsCrossed className="w-3 h-3" />
              {totalItems} items
            </span>
          )}
        </div>

        {/* Description */}
        {rDesc && (
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed line-clamp-3">
            {rDesc}
          </p>
        )}

        {/* Scan to order CTA */}
        <a
          href={`/#/${restaurant.slug}`}
          className="mt-4 p-3 bg-brand/5 border border-brand/20 rounded-xl flex items-center gap-3 hover:bg-brand/10 transition-colors group"
        >
          <div className="w-10 h-10 rounded-lg bg-brand flex items-center justify-center shrink-0">
            <UtensilsCrossed className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Want to order?</p>
            <p className="text-xs text-muted-foreground">Scan the QR code at your table to place an order</p>
          </div>
          <ChevronRight className="w-4 h-4 text-brand shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </a>
      </div>

      {/* ── Highlighted Item ── */}
      <AnimatePresence>
        {highlightItem && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="px-5 mt-5"
          >
            <div className="mb-2">
              <p className="text-[10px] font-semibold text-brand uppercase tracking-wider">⭐ Recommended for you</p>
            </div>
            <ItemCard
              item={highlightItem}
              restaurant={restaurant}
              isHighlighted={true}
              onShare={openShareItem}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Search bar ── */}
      <div className="px-5 mt-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search menu..."
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted flex items-center justify-center"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── Menu Categories ── */}
      <div className="px-5 mt-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Menu</h2>
          {filteredCategories.length > 0 && (
            <button
              onClick={() => {
                const all = new Set<string>()
                if (expandedCategories.size === 0) {
                  filteredCategories.forEach(c => all.add(c.id))
                }
                setExpandedCategories(all)
              }}
              className="text-xs text-brand font-medium hover:underline"
            >
              {expandedCategories.size === 0 ? 'Expand all' : 'Collapse all'}
            </button>
          )}
        </div>

        {filteredCategories.length === 0 ? (
          <div className="text-center py-12">
            <Search className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              {search ? `No items found for "${search}"` : 'No menu items available'}
            </p>
          </div>
        ) : (
          filteredCategories.map((cat) => {
            const isExpanded = expandedCategories.has(cat.id) || !!search
            const catName = resolveName(cat.name, cat.nameAm, cat.nameI18n)
            return (
              <div key={cat.id} className="rounded-2xl overflow-hidden bg-card border border-border/50">
                <button
                  onClick={() => toggleCategory(cat.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {cat.icon && <span className="text-lg">{cat.icon}</span>}
                    <span className="font-semibold text-sm">{catName}</span>
                    <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {cat.items.length}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 space-y-2">
                        {cat.items.map((item) => (
                          <ItemCard
                            key={item.id}
                            item={item}
                            restaurant={restaurant}
                            isHighlighted={highlightItem?.id === item.id}
                            onShare={openShareItem}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })
        )}
      </div>

      {/* ── Footer ── */}
      <div className="mt-8 px-5 pb-6 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand/5 border border-brand/20">
          <span className="text-xs text-muted-foreground">Powered by</span>
          <span className="text-xs font-bold text-brand">Yene QR</span>
        </div>
      </div>

      {/* ── Share Sheet ── */}
      <ShareSheet
        open={shareSheetOpen}
        onClose={() => setShareSheetOpen(false)}
        shareTitle={shareContext.title}
        shareText={shareContext.text}
        shareUrl={shareContext.url}
        restaurantName={rName}
        restaurantImage={restaurant?.logo || restaurant?.banner}
      />
    </div>
  )
}
