'use client';

// ============================================================
// Yene QR — Staff Order Form
// ============================================================
// Allows staff (waiter, cashier, manager, owner) to create
// orders on behalf of customers who can't use the QR menu
// (no phone, no camera, phone call orders, walk-ins, etc.)

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api-client';
import { formatCents, fromCents } from '@/lib/money';
import { hasPermission, PERMISSIONS } from '@/lib/auth';
import { useAppStore } from '@/lib/store';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Search,
  Loader2,
  User,
  Phone,
  UtensilsCrossed,
  ShoppingBag,
  ClipboardList,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────

interface MenuItemData {
  id: string;
  name: string;
  nameAm?: string | null;
  priceCents: number;
  image?: string | null;
  emoji?: string | null;
  isAvailable: boolean;
  categoryId: string;
  category?: { id: string; name: string } | null;
}

interface CategoryData {
  id: string;
  name: string;
  nameAm?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

interface TableData {
  id: string;
  number: number;
  status: string;
  branchId: string;
}

interface BranchData {
  id: string;
  name: string;
  isMainBranch: boolean;
}

interface CartItem {
  menuItemId: string;
  name: string;
  priceCents: number;
  quantity: number;
  specialInstructions: string;
}

// ─── Component ──────────────────────────────────────────────────

interface StaffOrderFormProps {
  open: boolean;
  onClose: () => void;
  onOrderCreated: () => void;
  restaurantId: string;
  userRole: string;
  /** Pre-select a table (e.g. from tables view) */
  preselectedTableId?: string | null;
}

export function StaffOrderForm({
  open,
  onClose,
  onOrderCreated,
  restaurantId,
  userRole,
  preselectedTableId,
}: StaffOrderFormProps) {
  // ── Data ──
  const [branches, setBranches] = useState<BranchData[]>([]);
  const [tables, setTables] = useState<TableData[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemData[]>([]);

  // ── Form State ──
  const globalSelectedBranchId = useAppStore((s) => s.selectedBranchId);
  const setGlobalBranchId = useAppStore((s) => s.setSelectedBranchId);
  const [localBranchId, setLocalBranchId] = useState('');
  const selectedBranchId = localBranchId || globalSelectedBranchId;
  const [selectedTableId, setSelectedTableId] = useState('');
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway'>('dine_in');
  const [priority, setPriority] = useState<'normal' | 'rush' | 'vip'>('normal');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [guestCount, setGuestCount] = useState(1);

  // ── UI State ──
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Permission Check ──
  const canCreateOrder = hasPermission(userRole, PERMISSIONS.ORDER_CREATE.key);

  // ── Fetch branches ──
  useEffect(() => {
    if (!open || !restaurantId) return;
    api.get<{ data: BranchData[] }>(`/api/restaurants/${restaurantId}/branches`)
      .then((res) => {
        const list = Array.isArray(res) ? res : (res.data || []);
        setBranches(list);
        if (list.length > 0 && !selectedBranchId) {
          const main = list.find((b) => b.isMainBranch);
          setLocalBranchId(main?.id || list[0].id);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, restaurantId]);

  // ── Fetch tables for selected branch ──
  useEffect(() => {
    if (!open || !restaurantId || !selectedBranchId) return;
    api.get<{ data: TableData[] }>(`/api/restaurants/${restaurantId}/tables`, {
      branchId: selectedBranchId,
    })
      .then((res) => {
        setTables(res.data || []);
      })
      .catch(() => {});
  }, [open, restaurantId, selectedBranchId]);

  // ── Fetch menu categories + items ──
  // Uses the menus API: /api/restaurants/{id}/menus → /menus/{menuId}/categories + /menus/{menuId}/items
  useEffect(() => {
    if (!open || !restaurantId) return;
    setLoading(true);

    (async () => {
      try {
        // 1. Fetch menus to find the main menu
        const menusRes = await api.get<{ menus?: { id: string; name: string; isActive: boolean; _count?: { categories: number } }[]; data?: { id: string; name: string; isActive: boolean; _count?: { categories: number } }[] }>(`/api/restaurants/${restaurantId}/menus`);
        let menus = menusRes.menus || menusRes.data;
        if (!Array.isArray(menus)) menus = Array.isArray(menusRes) ? menusRes as unknown as typeof menus : [];
        if (menus.length === 0) {
          setCategories([]);
          setMenuItems([]);
          setLoading(false);
          return;
        }

        // Pick the menu with the most categories (likely the main menu)
        const mainMenu = menus
          .filter((m) => m.isActive)
          .sort((a, b) => (b._count?.categories || 0) - (a._count?.categories || 0))[0] || menus[0];

        // 2. Fetch categories for the main menu
        const catRes = await api.get<{ categories?: CategoryData[]; data?: CategoryData[] }>(
          `/api/restaurants/${restaurantId}/menus/${mainMenu.id}/categories`
        );
        const cats = catRes.categories || catRes.data || (Array.isArray(catRes) ? catRes : []);
        setCategories(cats.filter((c) => c.isActive !== false));

        // 3. Fetch menu items for the main menu
        const itemRes = await api.get<{ items?: MenuItemData[]; data?: MenuItemData[] }>(
          `/api/restaurants/${restaurantId}/menus/${mainMenu.id}/items`
        );
        const items = itemRes.items || itemRes.data || (Array.isArray(itemRes) ? itemRes : []);
        setMenuItems(items.filter((i) => i.isAvailable));
      } catch {
        toast.error('Failed to load menu');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, restaurantId]);

  // ── Pre-select table if provided ──
  useEffect(() => {
    if (preselectedTableId && open) {
      setSelectedTableId(preselectedTableId);
    }
  }, [preselectedTableId, open]);

  // ── Reset form on close ──
  useEffect(() => {
    if (!open) {
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setSpecialInstructions('');
      setSearchQuery('');
      setSelectedCategoryId('all');
      setGuestCount(1);
      setOrderType('dine_in');
    }
  }, [open]);

  // ── Cart Operations ──
  const addToCart = (item: MenuItemData) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          name: item.name,
          priceCents: item.priceCents,
          quantity: 1,
          specialInstructions: '',
        },
      ];
    });
  };

  const updateQuantity = (menuItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.menuItemId === menuItemId
            ? { ...c, quantity: Math.max(0, c.quantity + delta) }
            : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const removeFromCart = (menuItemId: string) => {
    setCart((prev) => prev.filter((c) => c.menuItemId !== menuItemId));
  };

  const updateItemInstructions = (menuItemId: string, instructions: string) => {
    setCart((prev) =>
      prev.map((c) =>
        c.menuItemId === menuItemId
          ? { ...c, specialInstructions: instructions }
          : c
      )
    );
  };

  // ── Computed ──
  const subtotalCents = cart.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.nameAm && item.nameAm.includes(searchQuery));
    const matchesCategory =
      selectedCategoryId === 'all' || item.categoryId === selectedCategoryId;
    return matchesSearch && matchesCategory;
  });

  // ── Submit Order ──
  const handleSubmit = async () => {
    if (!canCreateOrder) {
      toast.error('You do not have permission to create orders');
      return;
    }
    if (!selectedTableId && orderType === 'dine_in') {
      toast.error('Please select a table for dine-in orders');
      return;
    }
    if (cart.length === 0) {
      toast.error('Please add at least one item to the order');
      return;
    }
    if (!selectedBranchId) {
      toast.error('Please select a branch');
      return;
    }

    try {
      setSubmitting(true);

      // For takeaway orders, tableId is optional
      let tableId = selectedTableId || null;
      if (orderType === 'takeaway') {
        // Takeaway orders don't require a table
        tableId = selectedTableId || null;
      }

      const orderPayload = {
        branchId: selectedBranchId,
        tableId: tableId,
        type: orderType,
        guestCount,
        priority: priority !== 'normal' ? priority : undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        items: cart.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          specialInstructions: item.specialInstructions || undefined,
        })),
        specialInstructions: specialInstructions.trim() || undefined,
      };

      const res = await api.post(`/api/restaurants/${restaurantId}/orders`, orderPayload);

      if (res) {
        toast.success(
          `Order created successfully${customerName ? ` for ${customerName}` : ''}!`,
          { description: `Order ${res.data?.orderNumber || ''}` }
        );
        onOrderCreated();
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create order';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Create Order on Behalf of Customer
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {/* ── Customer Info Section ── */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Customer Information
              <span className="text-xs text-muted-foreground font-normal">
                (optional — for walk-ins, phone orders, or customers without phones)
              </span>
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Customer Name</Label>
                <div className="relative">
                  <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="pl-8 h-9 text-sm"
                    placeholder="e.g. Abebe Kebede"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="pl-8 h-9 text-sm"
                    placeholder="e.g. +251912345678"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Order Details Section ── */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
              Order Details
            </h4>
            <div className="grid grid-cols-3 gap-3">
              {/* Branch */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Branch</Label>
                <Select value={selectedBranchId} onValueChange={(val) => { setLocalBranchId(val); setGlobalBranchId(val); }}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                        {b.isMainBranch && ' (Main)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Order Type */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Order Type</Label>
                <Select value={orderType} onValueChange={(v) => setOrderType(v as 'dine_in' | 'takeaway')}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dine_in">
                      <span className="flex items-center gap-1.5">
                        <UtensilsCrossed className="h-3 w-3" /> Dine In
                      </span>
                    </SelectItem>
                    <SelectItem value="takeaway">
                      <span className="flex items-center gap-1.5">
                        <ShoppingBag className="h-3 w-3" /> Takeaway
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as 'normal' | 'rush' | 'vip')}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-400" /> Normal
                      </span>
                    </SelectItem>
                    <SelectItem value="rush">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500" /> Rush
                      </span>
                    </SelectItem>
                    <SelectItem value="vip">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-500" /> VIP
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table (for dine-in) */}
              {orderType === 'dine_in' && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Table</Label>
                  <Select value={selectedTableId} onValueChange={setSelectedTableId}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select table" />
                    </SelectTrigger>
                    <SelectContent>
                      {tables.map((t) => (
                        <SelectItem key={t.id} value={t.id} disabled={t.status === 'occupied'}>
                          Table {t.number}
                          {t.status === 'occupied' && ' (Occupied)'}
                          {t.status === 'reserved' && ' (Reserved)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Guest Count */}
              {orderType === 'dine_in' && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Guests</Label>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      value={guestCount}
                      onChange={(e) => setGuestCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="h-9 w-16 text-center text-sm"
                      min={1}
                      max={50}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setGuestCount(Math.min(50, guestCount + 1))}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* ── Menu Browsing Section ── */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-primary" />
              Menu Items
            </h4>

            {/* Search & Category Filter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 text-sm"
                  placeholder="Search menu..."
                />
              </div>
              <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                <SelectTrigger className="h-9 w-40 text-sm">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Menu Items Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">Loading menu...</span>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <UtensilsCrossed className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No menu items found</p>
              </div>
            ) : (
              <ScrollArea className="h-48">
                <div className="grid grid-cols-2 gap-2">
                  {filteredItems.map((item) => {
                    const inCart = cart.find((c) => c.menuItemId === item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => addToCart(item)}
                        className={`flex items-center gap-2 rounded-lg border p-2.5 text-left transition-all hover:shadow-sm ${
                          inCart
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        {item.emoji ? (
                          <span className="text-lg shrink-0">{item.emoji}</span>
                        ) : item.image ? (
                          <img src={item.image} alt={item.name} className="h-8 w-8 rounded object-cover shrink-0" />
                        ) : (
                          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                            <UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{item.name}</p>
                          <p className="text-[11px] text-primary font-semibold">{formatCents(item.priceCents)}</p>
                        </div>
                        {inCart && (
                          <Badge className="bg-primary text-primary-foreground text-[10px] h-5 min-w-5 flex items-center justify-center px-1">
                            {inCart.quantity}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>

          <Separator />

          {/* ── Cart Section ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                Order Items
                {cartItemCount > 0 && (
                  <Badge variant="secondary" className="text-[10px]">{cartItemCount}</Badge>
                )}
              </h4>
              {cart.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => setCart([])}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear All
                </Button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 border border-dashed rounded-lg">
                <ShoppingCart className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No items added yet</p>
                <p className="text-xs text-muted-foreground">Click menu items above to add them</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div
                    key={item.menuItemId}
                    className="flex items-center gap-3 rounded-lg border p-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{formatCents(item.priceCents)} each</p>
                      {/* Special instructions input */}
                      <Input
                        value={item.specialInstructions}
                        onChange={(e) => updateItemInstructions(item.menuItemId, e.target.value)}
                        className="h-7 text-xs mt-1"
                        placeholder="Special instructions (optional)"
                      />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.menuItemId, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.menuItemId, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-right shrink-0 w-20">
                      <p className="text-sm font-semibold">{formatCents(item.priceCents * item.quantity)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeFromCart(item.menuItemId)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Order-level special instructions */}
            {cart.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Order Notes</Label>
                <Input
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  className="h-9 text-sm"
                  placeholder="Any notes for the kitchen or delivery?"
                />
              </div>
            )}
          </div>

          {/* ── Summary ── */}
          {cart.length > 0 && (
            <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal ({cartItemCount} items)</span>
                <span className="font-medium">{formatCents(subtotalCents)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax & Service</span>
                <span className="text-xs text-muted-foreground">Calculated at checkout</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-semibold">
                <span>Estimated Total</span>
                <span className="text-primary">{formatCents(subtotalCents)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4 mt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || cart.length === 0 || !canCreateOrder}
            className="gap-2"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="h-4 w-4" />
            )}
            {submitting ? 'Creating Order...' : `Create Order (${cartItemCount} items)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
