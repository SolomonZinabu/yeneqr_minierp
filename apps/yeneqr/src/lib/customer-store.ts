import { create } from 'zustand'

// Types
export interface ModifierOption {
  id: string
  nameEn: string
  nameAm: string
  priceDeltaCents: number
}

export interface ModifierGroup {
  id: string
  nameEn: string
  nameAm: string
  required: boolean
  singleSelect: boolean
  options: ModifierOption[]
}

export interface AllergenInfo {
  id: string
  name: string
  icon: string | null
}

export interface MenuItem {
  id: string
  nameEn: string
  nameAm: string
  nameI18n: Record<string, string> | null
  descriptionEn: string
  descriptionAm: string
  descriptionI18n: Record<string, string> | null
  priceCents: number
  categoryId: string
  emoji: string
  imageColor: string
  image?: string  // URL to the menu item image
  isVegetarian: boolean
  isVegan: boolean
  isGlutenFree: boolean
  isDairyFree: boolean
  isHalal: boolean
  isSpicy: boolean
  isAvailable: boolean
  currentAvailable?: boolean // Server-computed real-time availability (accounts for schedule/time/day)
  modifiers: ModifierGroup[]
  addons: ModifierOption[]
  ingredients: IngredientItem[] // Proper ingredient list with removal support
  allergens: AllergenInfo[] // Allergen warnings from MenuItemAllergen
  originalPriceCents?: number | null
}

export interface Category {
  id: string
  nameEn: string
  nameAm: string
  nameI18n: Record<string, string> | null
  emoji: string
  image?: string
}

export interface IngredientItem {
  id: string
  nameEn: string
  nameAm: string
  isRemovable: boolean
  isDefault: boolean
  allergens?: string[]
}

export interface CartItemModifier {
  modifierGroupId: string
  modifierOptionId: string
  name: string
  nameEn: string
  nameAm: string
  priceDeltaCents: number
  quantity: number
}

/** @deprecated Use CartItemModifier instead */
export type SelectedModifier = CartItemModifier

export interface CartItem {
  menuItem: MenuItem
  quantity: number
  selectedModifiers: CartItemModifier[]
  selectedAddons: ModifierOption[]
  removedIngredients: IngredientItem[] // Ingredients the customer asked to remove
  specialInstructions: string
  totalPriceCents: number
}

export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'picked_up' | 'served' | 'completed' | 'cancelled'
export type KitchenItemStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled'
export type PaymentMethod = 'telebirr' | 'chapa' | 'cbe_birr' | 'cash'

export interface OrderItemModifierDisplay {
  name: string
  priceDeltaCents: number
}

export interface OrderItemRemovedIngredient {
  id: string
  name: string
  nameAm?: string
}

export interface OrderItem {
  id: string
  nameEn: string
  nameAm: string
  quantity: number
  priceCents: number
  kitchenStatus: KitchenItemStatus
  roundNumber?: number
  removedIngredients?: OrderItemRemovedIngredient[]
  modifierSelections?: OrderItemModifierDisplay[]
  specialInstructions?: string
}

export interface Order {
  id: string
  orderNumber: string
  status: OrderStatus
  items: OrderItem[]
  subtotalCents: number
  taxCents: number
  serviceChargeCents: number
  totalCents: number
  paymentMethod: PaymentMethod | null
  tipCents: number
  roundNumber: number
  createdAt: Date
  estimatedReadyAt: Date | null
}

export interface CustomerSession {
  restaurantId: string
  restaurantName: string
  restaurantNameAm: string
  restaurantLogo?: string
  tableNumber: number
  branchName: string
  branchId: string  // Phase 5.2: made required (matches CustomerTokenPayload.branchId which is always set by the session API)
  tableId?: string
  sessionId?: string
  sessionToken?: string
  taglineEn?: string
  taglineAm?: string
  taxRate?: number
  serviceCharge?: number
  customerId?: string
  customerName?: string
  customerPhone?: string
}

// ─── Order History Types ────────────────────────────────────────────

export interface HistoryOrderItem {
  id: string
  menuItemId: string | null
  name: string
  nameAm: string | null
  priceCents: number
  quantity: number
  image: string | null
  isAvailable: boolean
  modifierSelections: { modifierGroupId: string; modifierOptionId: string; name: string; priceDeltaCents: number; quantity: number }[]
  removedIngredients?: { id: string; name: string; nameAm?: string }[]
}

export interface HistoryOrder {
  id: string
  orderNumber: string
  status: string
  type: string
  subtotalCents: number
  taxAmountCents: number
  serviceChargeCents: number
  discountAmountCents: number
  totalAmountCents: number
  createdAt: string
  completedAt: string | null
  items: HistoryOrderItem[]
  itemCount: number
}

export type AppScreen = 'welcome' | 'menu' | 'cart' | 'order' | 'payment' | 'feedback' | 'help' | 'reservation' | 'orders'
export type BottomTab = 'menu' | 'cart' | 'order' | 'help'

export interface AppliedPromotion {
  id: string
  name: string
  nameAm?: string
  code: string
  discountType: 'percentage' | 'fixed'
  discountValueCents: number
  discountAmountCents: number // Calculated discount for the current cart
  maxDiscountCents?: number
}

interface CustomerStore {
  // State
  language: string
  enabledLanguages: { code: string; name: string; nameLocal: string; flagEmoji: string | null; direction: string }[]
  cart: CartItem[]
  currentOrder: Order | null
  session: CustomerSession | null
  currentScreen: AppScreen
  activeTab: BottomTab
  selectedItem: MenuItem | null
  isCartOpen: boolean
  isLoading: boolean
  isItemDetailOpen: boolean
  appliedPromotion: AppliedPromotion | null

  // Navigation
  setScreen: (screen: AppScreen) => void
  setActiveTab: (tab: BottomTab) => void

  // Language
  setLanguage: (lang: string) => void
  setEnabledLanguages: (langs: { code: string; name: string; nameLocal: string; flagEmoji: string | null; direction: string }[]) => void

  // Cart
  addToCart: (item: CartItem) => void
  removeFromCart: (index: number) => void
  updateQuantity: (index: number, qty: number) => void
  setCart: (items: CartItem[]) => void
  clearCart: () => void
  getCartTotal: () => number
  getCartItemCount: () => number
  setIsCartOpen: (open: boolean) => void

  // Item detail
  setSelectedItem: (item: MenuItem | null) => void
  setIsItemDetailOpen: (open: boolean) => void

  // Order
  setCurrentOrder: (order: Order | null) => void
  setSession: (session: CustomerSession | null) => void

  // Loading
  setIsLoading: (loading: boolean) => void

  // Promotion
  setAppliedPromotion: (promotion: AppliedPromotion | null) => void
  clearAppliedPromotion: () => void

  // Loyalty
  loyaltyPoints: number
  loyaltyPointsEarned: number
  setLoyaltyPoints: (points: number) => void
  addLoyaltyPoints: (points: number) => void

  // API-fetched data
  categories: Category[]
  menuItems: MenuItem[]
  setCategories: (categories: Category[]) => void
  setMenuItems: (items: MenuItem[]) => void
  menuLoading: boolean
  setMenuLoading: (loading: boolean) => void
  menuError: string | null
  setMenuError: (error: string | null) => void

  // Customer identity & order history
  customerId: string | null
  customerName: string | null
  customerPhone: string | null
  orderHistory: HistoryOrder[]
  orderHistoryLoading: boolean
  orderHistoryPage: number
  orderHistoryTotalPages: number
  orderHistoryTotal: number
  setCustomerId: (id: string | null) => void
  setCustomerName: (name: string | null) => void
  setCustomerPhone: (phone: string | null) => void
  setOrderHistory: (orders: HistoryOrder[]) => void
  setOrderHistoryLoading: (loading: boolean) => void
  setOrderHistoryPage: (page: number) => void
  setOrderHistoryTotalPages: (total: number) => void
  setOrderHistoryTotal: (total: number) => void
  appendOrderHistory: (orders: HistoryOrder[]) => void
  clearOrderHistory: () => void
}

export const useCustomerStore = create<CustomerStore>((set, get) => ({
  // Initial state
  language: 'en',
  enabledLanguages: [],
  cart: [],
  currentOrder: null,
  session: null,
  currentScreen: 'welcome',
  activeTab: 'menu',
  selectedItem: null,
  isCartOpen: false,
  isLoading: false,
  isItemDetailOpen: false,
  appliedPromotion: null,

  // Promotion
  setAppliedPromotion: (promotion) => set({ appliedPromotion: promotion }),
  clearAppliedPromotion: () => set({ appliedPromotion: null }),

  // Loyalty
  loyaltyPoints: 0,
  loyaltyPointsEarned: 0,
  setLoyaltyPoints: (points) => set({ loyaltyPoints: points }),
  addLoyaltyPoints: (points) => set((state) => ({ loyaltyPoints: state.loyaltyPoints + points, loyaltyPointsEarned: points })),

  // API-fetched data
  categories: [],
  menuItems: [],
  menuLoading: false,
  menuError: null,

  // Customer identity & order history
  customerId: null,
  customerName: null,
  customerPhone: null,
  orderHistory: [],
  orderHistoryLoading: false,
  orderHistoryPage: 1,
  orderHistoryTotalPages: 1,
  orderHistoryTotal: 0,

  // Navigation
  setScreen: (screen) => set({ currentScreen: screen }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Language
  setLanguage: (lang) => set({ language: lang }),
  setEnabledLanguages: (langs) => set({ enabledLanguages: langs }),

  // Cart
  addToCart: (item) => set((state) => ({ cart: [...state.cart, item] })),
  removeFromCart: (index) => set((state) => ({
    cart: state.cart.filter((_, i) => i !== index),
  })),
  updateQuantity: (index, qty) => set((state) => ({
    cart: state.cart.map((item, i) =>
      i === index ? { ...item, quantity: Math.max(0, qty) } : item
    ).filter((item) => item.quantity > 0),
  })),
  setCart: (items) => set({ cart: items }),
  clearCart: () => set({ cart: [] }),
  getCartTotal: () => get().cart.reduce((sum, item) => sum + item.totalPriceCents * item.quantity, 0),
  getCartItemCount: () => get().cart.reduce((sum, item) => sum + item.quantity, 0),
  setIsCartOpen: (open) => set({ isCartOpen: open }),

  // Item detail
  setSelectedItem: (item) => set({ selectedItem: item }),
  setIsItemDetailOpen: (open) => set({ isItemDetailOpen: open }),

  // Order
  setCurrentOrder: (order) => set({ currentOrder: order }),
  setSession: (session) => set({ session }),

  // Loading
  setIsLoading: (loading) => set({ isLoading: loading }),

  // API-fetched data
  setCategories: (categories) => set({ categories }),
  setMenuItems: (items) => set({ menuItems: items }),
  setMenuLoading: (loading) => set({ menuLoading: loading }),
  setMenuError: (error) => set({ menuError: error }),

  // Customer identity & order history
  setCustomerId: (id) => set({ customerId: id }),
  setCustomerName: (name) => set({ customerName: name }),
  setCustomerPhone: (phone) => set({ customerPhone: phone }),
  setOrderHistory: (orders) => set({ orderHistory: orders }),
  setOrderHistoryLoading: (loading) => set({ orderHistoryLoading: loading }),
  setOrderHistoryPage: (page) => set({ orderHistoryPage: page }),
  setOrderHistoryTotalPages: (total) => set({ orderHistoryTotalPages: total }),
  setOrderHistoryTotal: (total) => set({ orderHistoryTotal: total }),
  appendOrderHistory: (orders) => set((state) => ({ orderHistory: [...state.orderHistory, ...orders] })),
  clearOrderHistory: () => set({ orderHistory: [], orderHistoryPage: 1, orderHistoryTotalPages: 1, orderHistoryTotal: 0 }),
}))
