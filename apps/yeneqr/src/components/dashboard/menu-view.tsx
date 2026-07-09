'use client';

// ============================================================
// BRANCH SCOPING NOTE (Phase 4.5 of multi-branch audit)
// ============================================================
// This view intentionally does NOT use `useBranchChange` or pass
// `?branchId=` to API calls. Menus are restaurant-level entities
// (the Menu model in prisma/schema.prisma has no branchId field) —
// they are shared across all branches of a restaurant. If a future
// product decision makes menus branch-scoped, add a branchId column
// to the Menu model and update this view + the menus API routes.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useAppStore } from '@/lib/store';
import { useLanguageStore } from '@/hooks/useLanguage';
import { useTranslation } from '@/hooks/useTranslation';
import { useI18n } from '@/hooks/useI18n';
import { api } from '@/lib/api-client';
import { formatCents, toCents, fromCents } from '@/lib/money';
import { useRef } from 'react';
import { BranchOverridesDialog } from '@/components/dashboard/branch-overrides-dialog';
import {
  Plus,
  Check,
  Pencil,
  Clock,
  Image as ImageIcon,
  X,
  Loader2,
  UtensilsCrossed,
  Upload,
  Package,
  Search,
  Trash2,
  FolderPlus,
  Calendar,
  AlertCircle,
  LayoutGrid,
  List,
  Layers,
  BookOpen,
  MoreVertical,
  Store,
  ArrowLeft,
  ArrowRight,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Settings2,
} from 'lucide-react';
import { ImageUpload } from '@/components/ui/image-upload';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────

interface CategoryData {
  id: string;
  name: string;
  nameAm?: string | null;
  nameI18n: string | null;
  description: string | null;
  descriptionAm?: string | null;
  descriptionI18n: string | null;
  icon: string | null;
  image: string | null;
  isActive: boolean;
  sortOrder: number;
  menuId: string;
}

interface ModifierOptionData {
  id: string;
  name: string;
  priceDeltaCents: number;
  isDefault: boolean;
}

interface ModifierGroupData {
  id: string;
  name: string;
  isRequired: boolean;
  selectionType: string;
  minSelection: number;
  maxSelection: number;
  options: ModifierOptionData[];
}

interface ComboItemData {
  id: string;
  includedItemId: string;
  quantity: number;
  includedItem?: {
    id: string;
    name: string;
    priceCents: number;
  };
}

interface MenuItemData {
  id: string;
  name: string;
  nameI18n: string | null;
  description: string | null;
  descriptionI18n: string | null;
  ingredients: string | null;
  ingredientsI18n: string | null;
  image: string | null;
  priceCents: number;
  originalPriceCents: number | null;
  preparationTime: number;
  calories: number | null;
  isAvailable: boolean;
  isPopular: boolean;
  isVegetarian: boolean;
  isSpicy: boolean;
  showServingSize: boolean | null;
  categoryId: string;
  restaurantId: string;
  availabilityType: string;
  availableFrom: string | null;
  availableTo: string | null;
  availableDays: string | null;
  currentAvailable?: boolean;
  sortOrder: number;
  modifierGroups?: ModifierGroupData[];
  comboItems?: ComboItemData[];
}

interface MenuData {
  id: string;
  name: string;
  nameAm?: string | null;
  description?: string | null;
  descriptionAm?: string | null;
  isActive: boolean;
  sortOrder: number;
  schedule?: string | null;
  _count?: {
    categories: number;
    qrCodes: number;
  };
}

// ─── Menu Item Card ─────────────────────────────────────────

function MenuItemCard({
  item,
  onEdit,
  onToggleAvailability,
  onManageModifiers,
  onManageBranchOverrides,
  viewMode = 'list',
  categoryName,
}: {
  item: MenuItemData;
  onEdit: (item: MenuItemData) => void;
  onToggleAvailability: (item: MenuItemData) => void;
  onManageModifiers: (item: MenuItemData) => void;
  onManageBranchOverrides?: (item: MenuItemData) => void;
  viewMode?: 'list' | 'card';
  categoryName?: string;
}) {
  const { tRaw } = useTranslation();
  const { t } = useI18n();
  const displayName = tRaw(item.nameI18n, item.name);
  const displayDesc = tRaw(item.descriptionI18n, item.description || '');
  const isCombo = (item.comboItems && item.comboItems.length > 0);

  // ── Card View ──
  if (viewMode === 'card') {
    return (
      <div className="rounded-lg border overflow-hidden hover:shadow-md transition-shadow bg-card flex flex-col">
        {/* Image */}
        <div className="relative h-36 bg-muted flex items-center justify-center">
          {item.image ? (
            <img src={item.image} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
          )}
          {/* Availability overlay */}
          {!item.isAvailable && (
            <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
              <Badge variant="secondary" className="text-xs">{t('menu.sold_out')}</Badge>
            </div>
          )}
          {/* Toggle switch */}
          <div className="absolute top-2 right-2">
            <Switch
              checked={item.isAvailable}
              onCheckedChange={() => onToggleAvailability(item)}
              className="scale-75"
            />
          </div>
          {/* Category badge (for "All" view) */}
          {categoryName && (
            <Badge variant="secondary" className="absolute top-2 left-2 text-[10px] px-1.5 py-0 bg-background/80 backdrop-blur-sm">
              {categoryName}
            </Badge>
          )}
        </div>
        {/* Content */}
        <div className="p-3 flex-1 flex flex-col">
          <div className="flex items-start justify-between gap-1">
            <span className="text-sm font-medium line-clamp-1">{displayName}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 min-h-[2rem]">{displayDesc}</p>
          {/* Badges */}
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            {item.isAvailable && item.currentAvailable === false && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-amber-50 text-amber-700">
                <Clock className="h-2.5 w-2.5 mr-0.5" />Off
              </Badge>
            )}
            {item.isPopular && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-amber-50 text-amber-700">Popular</Badge>
            )}
            {isCombo && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-purple-50 text-purple-700">
                <Package className="h-2.5 w-2.5 mr-0.5" />{t('menu.combo')}
              </Badge>
            )}
            {item.isVegetarian && (
              <span className="text-[9px] text-green-600">Veg</span>
            )}
            {item.isSpicy && (
              <span className="text-[9px] text-orange-600">Spicy</span>
            )}
          </div>
          {/* Price + meta */}
          <div className="flex items-center gap-2 mt-auto pt-2">
            <span className="text-sm font-semibold text-primary">{formatCents(item.priceCents)}</span>
            {item.originalPriceCents && item.originalPriceCents > item.priceCents && (
              <span className="text-[10px] line-through text-muted-foreground">{formatCents(item.originalPriceCents)}</span>
            )}
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground ml-auto">
              <Clock className="h-2.5 w-2.5" />{item.preparationTime}m
            </span>
          </div>
          {/* Combo breakdown */}
          {isCombo && item.comboItems && (
            <div className="mt-2 p-1.5 rounded-md bg-purple-50 dark:bg-purple-900/20 space-y-0.5">
              <span className="text-[9px] font-medium text-purple-700 dark:text-purple-400">{t('menu.includes')}:</span>
              {item.comboItems?.map(ci => (
                <div key={ci.id} className="flex items-center justify-between text-[10px] text-purple-600 dark:text-purple-400">
                  <span>{ci.includedItem?.name || 'Item'}</span>
                  <span className="font-medium">×{ci.quantity}</span>
                </div>
              ))}
            </div>
          )}
          {/* Actions */}
          <div className="flex items-center gap-1 mt-2 pt-2 border-t">
            <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 flex-1" onClick={() => onManageModifiers(item)}>
              <FolderPlus className="h-3 w-3" />Modifiers
            </Button>
            <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 flex-1" onClick={() => onEdit(item)}>
              <Pencil className="h-3 w-3" />Edit
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── List View (default) ──
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3 hover:bg-accent/30 transition-colors">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted">
        {item.image ? (
          <img src={item.image} alt={displayName} className="h-full w-full rounded-lg object-cover" />
        ) : (
          <ImageIcon className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{displayName}</span>
              {categoryName && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                  {categoryName}
                </Badge>
              )}
              {!item.isAvailable && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {t('menu.sold_out')}
                </Badge>
              )}
              {item.isAvailable && item.currentAvailable === false && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700">
                  <Clock className="h-3 w-3 mr-0.5" />
                  Scheduled Off
                </Badge>
              )}
              {item.isPopular && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700">
                  Popular
                </Badge>
              )}
              {isCombo && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700">
                  <Package className="h-3 w-3 mr-0.5" />
                  {t('menu.combo')}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{displayDesc}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm font-semibold text-primary">{formatCents(item.priceCents)}</span>
              {item.originalPriceCents && item.originalPriceCents > item.priceCents && (
                <span className="text-xs line-through text-muted-foreground">{formatCents(item.originalPriceCents)}</span>
              )}
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {item.preparationTime}m
              </span>
              {item.isVegetarian && (
                <span className="text-[10px] text-green-600">{t('menu.vegetarian')}</span>
              )}
              {item.isSpicy && (
                <span className="text-[10px] text-orange-600">{t('menu.spicy')}</span>
              )}
            </div>
            {isCombo && item.comboItems && (
              <div className="mt-2 p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 space-y-1">
                <span className="text-[10px] font-medium text-purple-700 dark:text-purple-400">
                  {t('menu.includes')}:
                </span>
                {item.comboItems?.map(ci => (
                  <div key={ci.id} className="flex items-center justify-between text-xs text-purple-600 dark:text-purple-400">
                    <span>{ci.includedItem?.name || 'Item'}</span>
                    <span className="font-medium">×{ci.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={item.isAvailable}
              onCheckedChange={() => onToggleAvailability(item)}
              className="scale-75"
            />
            {onManageBranchOverrides && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onManageBranchOverrides(item)} title="Branch overrides (per-branch price & availability)">
                <Store className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onManageModifiers(item)} title="Manage modifiers & ingredients">
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add/Edit Item Dialog ───────────────────────────────────

function AddEditItemDialog({
  open,
  onClose,
  item,
  categories,
  allMenuItems,
  restaurantId,
  onSaved,
  comboMode,
}: {
  open: boolean;
  onClose: () => void;
  item: MenuItemData | null;
  categories: CategoryData[];
  allMenuItems: MenuItemData[];
  restaurantId: string;
  onSaved: () => void;
  comboMode?: boolean;
}) {
  const isEdit = !!item;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // ─── Ingredient linking state ───
  const [selectedIngredients, setSelectedIngredients] = useState<Map<string, { isRemovable: boolean; isDefault: boolean }>>(new Map());
  const [allIngredients, setAllIngredients] = useState<IngredientData[]>([]);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [ingredientsLoading, setIngredientsLoading] = useState(false);
  const [price, setPrice] = useState('');
  const [prepTime, setPrepTime] = useState('15');
  const [isAvailable, setIsAvailable] = useState(true);
  const [categoryId, setCategoryId] = useState('');
  const [isVegetarian, setIsVegetarian] = useState(false);
  const [isSpicy, setIsSpicy] = useState(false);
  const [isPopular, setIsPopular] = useState(false);
  const [showServingSize, setShowServingSize] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  // ─── Availability Schedule State ───
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableTo, setAvailableTo] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  // Create a new category inline from the item dialog
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !restaurantId) return
    setCreatingCategory(true)
    try {
      // Prefer the parent's menuId prop if available; otherwise fall back to first category's menuId
      const menuId = categories[0]?.menuId
      if (!menuId) {
        toast.error('No menu found. Create a menu first.')
        return
      }
      const res = await api.post<{ category?: CategoryData; data?: CategoryData }>(
        `/api/restaurants/${restaurantId}/menus/${menuId}/categories`,
        {
          name: newCategoryName.trim(),
          icon: newCategoryIcon.trim() || null,
          isActive: true,
          sortOrder: categories.length + 1,
        }
      )
      const newCat = res.category || res.data
      if (newCat) {
        // Add to categories list and select it
        // Note: parent component will re-fetch on save, but we update locally for immediate feedback
        toast.success(`Category "${newCategoryName.trim()}" created`)
        setCategoryId(newCat.id)
        setShowNewCategoryInput(false)
        setNewCategoryName('')
        setNewCategoryIcon('')
        onSaved() // Trigger re-fetch
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to create category')
    } finally {
      setCreatingCategory(false)
    }
  }

  const DAY_OPTIONS = [
    { value: 'monday', label: 'Mon' },
    { value: 'tuesday', label: 'Tue' },
    { value: 'wednesday', label: 'Wed' },
    { value: 'thursday', label: 'Thu' },
    { value: 'friday', label: 'Fri' },
    { value: 'saturday', label: 'Sat' },
    { value: 'sunday', label: 'Sun' },
  ];

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };
  const [itemImageUrl, setItemImageUrl] = useState<string | null>(null);
  // Track if user explicitly removed the image (to send null to server)
  const [imageRemoved, setImageRemoved] = useState(false);
  // For new items: hold the File object until the item is saved and has an ID.
  // For existing items: upload happens immediately via the per-item endpoint.
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);

  // ─── Combo State ───
  const [isCombo, setIsCombo] = useState(comboMode ?? false);
  const [comboItems, setComboItems] = useState<{ menuItemId: string; quantity: number }[]>([]);
  const [comboSearch, setComboSearch] = useState('');

  // Reset all form state when item changes (edit) or is null (add new)
  useEffect(() => {
    setName(item?.name ?? '');
    setDescription(item?.description ?? '');
    setPrice(item?.priceCents != null ? fromCents(item.priceCents).toString() : '');
    setPrepTime(item?.preparationTime?.toString() ?? '15');
    setIsAvailable(item?.isAvailable ?? true);
    setCategoryId(item?.categoryId ?? (categories[0]?.id ?? ''));
    setIsVegetarian(item?.isVegetarian ?? false);
    setIsSpicy(item?.isSpicy ?? false);
    setIsPopular(item?.isPopular ?? false);
    setShowServingSize(item?.showServingSize ?? null);
    setAvailableFrom(item?.availableFrom ?? '');
    setAvailableTo(item?.availableTo ?? '');
    setItemImageUrl(item?.image ?? null);
    setImageRemoved(false);
    setPendingImageFile(null);
    try {
      setSelectedDays(item?.availableDays ? JSON.parse(item.availableDays) as string[] : []);
    } catch {
      setSelectedDays([]);
    }
    // Combo state
    if (item?.comboItems && item.comboItems.length > 0) {
      setIsCombo(true);
      setComboItems(
        item.comboItems.map((ci) => ({
          menuItemId: ci.includedItemId,
          quantity: ci.quantity,
        }))
      );
    } else {
      setIsCombo(comboMode ?? false);
      setComboItems([]);
    }
  }, [item, categories, comboMode]);

  // Fetch all available ingredients and existing links when dialog opens
  useEffect(() => {
    if (!open || !restaurantId) return;
    let cancelled = false;
    const fetchIngredientData = async () => {
      setIngredientsLoading(true);
      try {
        // Fetch all ingredients
        const ingRes = await api.get<{ data: IngredientData[] }>(`/api/restaurants/${restaurantId}/ingredients`);
        const ings = ingRes.data || [];
        if (!cancelled) setAllIngredients(ings);

        // Fetch existing linked ingredients if editing
        if (item?.id) {
          const linkRes = await api.get<{ data: Array<{ ingredientId: string; isRemovable: boolean; isDefault: boolean }> }>(`/api/restaurants/${restaurantId}/items/${item.id}/ingredients`);
          const linked = linkRes.data || [];
          if (!cancelled) {
            const map = new Map<string, { isRemovable: boolean; isDefault: boolean }>();
            for (const li of linked) {
              map.set(li.ingredientId, { isRemovable: li.isRemovable, isDefault: li.isDefault });
            }
            setSelectedIngredients(map);
          }
        } else {
          if (!cancelled) setSelectedIngredients(new Map());
        }
      } catch {
        // Silently handle
      } finally {
        if (!cancelled) setIngredientsLoading(false);
      }
    };
    fetchIngredientData();
    return () => { cancelled = true; };
  }, [open, restaurantId, item?.id]);

  const handleItemImageChange = (url: string | null) => {
    setItemImageUrl(url);
    setImageRemoved(url === null);
    // If user removed the image, also clear any pending file
    if (url === null) setPendingImageFile(null);
  };

  const handleItemImageFileSelect = (file: File | null) => {
    setPendingImageFile(file);
  };

  const addComboItem = (menuItemId: string) => {
    if (comboItems.some((ci) => ci.menuItemId === menuItemId)) {
      toast.error('This item is already in the combo');
      return;
    }
    setComboItems((prev) => [...prev, { menuItemId, quantity: 1 }]);
    setComboSearch('');
  };

  const removeComboItem = (menuItemId: string) => {
    setComboItems((prev) => prev.filter((ci) => ci.menuItemId !== menuItemId));
  };

  const updateComboQuantity = (menuItemId: string, quantity: number) => {
    setComboItems((prev) =>
      prev.map((ci) => (ci.menuItemId === menuItemId ? { ...ci, quantity: Math.max(1, quantity) } : ci))
    );
  };

  // Get the combo items with names
  const comboItemsWithNames = comboItems.map((ci) => {
    const menuItem = allMenuItems.find((m) => m.id === ci.menuItemId);
    return {
      ...ci,
      name: menuItem?.name || 'Unknown Item',
      priceCents: menuItem?.priceCents || 0,
    };
  });

  const comboItemsTotalCents = comboItemsWithNames.reduce((sum, ci) => sum + ci.priceCents * ci.quantity, 0);

  const handleSave = async () => {
    if (!name || !price) {
      toast.error('Name and price are required');
      return;
    }
    try {
      setSaving(true);
      const payload: Record<string, unknown> = {
        name,
        description: description || null,
        priceCents: toCents(parseFloat(price)),
        preparationTime: parseInt(prepTime) || 15,
        isAvailable,
        categoryId,
        isVegetarian,
        isSpicy,
        isPopular,
        showServingSize,
        availableFrom: availableFrom || null,
        availableTo: availableTo || null,
        availableDays: selectedDays.length > 0 ? JSON.stringify(selectedDays) : null,
      };

      // ── Image handling ──
      // Edit mode: when user uploads via the per-item endpoint, the endpoint
      // already updated the DB row's `image` field. So we ONLY include `image`
      // in the PUT body if the user explicitly removed it (send null) or if
      // they never touched it (don't include — preserve existing value).
      // Create mode: include the image URL only if set; the deferred upload
      // (if any) happens AFTER the item is created.
      if (imageRemoved) {
        payload.image = null;
      } else if (isEdit) {
        // Edit mode + image NOT removed + image NOT just-uploaded → don't touch
        // Only send `image` if user uploaded a new one (itemImageUrl changed
        // from the original). The per-item endpoint already updated the DB.
        // Skip — leave `image` out of the PUT body to preserve the DB value.
      } else if (itemImageUrl) {
        // Create mode: don't have a real URL yet (deferred upload), but we
        // also don't want to set placeholder. The upload step below will
        // set it via the per-item endpoint after save.
      }

      let savedItemId = item?.id || null;

      if (isEdit && item) {
        await api.put(`/api/restaurants/${restaurantId}/items/${item.id}`, payload);
        toast.success('Item updated successfully');
      } else {
        // Need menuId for creating items — use the category's menuId
        const cat = categories.find(c => c.id === categoryId);
        if (cat) {
          const res = await api.post(`/api/restaurants/${restaurantId}/menus/${cat.menuId}/items`, payload);
          const newItem = res?.data || res;
          savedItemId = newItem?.id || null;
          toast.success('Item added successfully');
        } else {
          toast.error('Could not determine menu for this category');
          return;
        }
      }

      // ── Deferred image upload (new items only) ──
      // If this was a create flow and the user attached an image, upload it
      // now that we have a savedItemId. The per-item endpoint saves the file
      // AND updates the DB row in one shot.
      if (!isEdit && savedItemId && pendingImageFile) {
        try {
          const formData = new FormData();
          formData.append('image', pendingImageFile);
          const token = typeof window !== 'undefined' ? localStorage.getItem('yeneqr_token') : null;
          const upRes = await fetch(
            `/api/restaurants/${restaurantId}/items/${savedItemId}/image`,
            {
              method: 'POST',
              headers: token ? { Authorization: `Bearer ${token}` } : {},
              body: formData,
            }
          );
          if (!upRes.ok) {
            const errData = await upRes.json().catch(() => ({}));
            toast.warning(`Item saved, but image upload failed: ${errData.error || upRes.statusText}`);
          } else {
            toast.success('Item image uploaded');
          }
        } catch (err) {
          console.error('[ITEM_IMAGE_UPLOAD]', err);
          toast.warning('Item saved, but image upload failed');
        }
      }

      // Save ingredient links
      if (savedItemId && selectedIngredients.size > 0) {
        try {
          const ingredientLinks = Array.from(selectedIngredients.entries()).map(([ingredientId, opts], idx) => ({
            ingredientId,
            isRemovable: opts.isRemovable,
            isDefault: opts.isDefault,
            sortOrder: idx,
          }));
          await fetch(`/api/restaurants/${restaurantId}/items/${savedItemId}/ingredients`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ingredients: ingredientLinks }),
          });
        } catch (err) {
          console.error('[INGREDIENTS_SAVE]', err);
          toast.warning('Item saved, but ingredient links may not have been saved');
        }
      } else if (savedItemId && isEdit && selectedIngredients.size === 0) {
        // Clear ingredient links if all removed
        try {
          await fetch(`/api/restaurants/${restaurantId}/items/${savedItemId}/ingredients`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ingredients: [] }),
          });
        } catch (err) {
          console.error('[INGREDIENTS_CLEAR]', err);
        }
      }

      // Save combo items if this is a combo
      if (isCombo && savedItemId) {
        try {
          await fetch(`/api/restaurants/${restaurantId}/items/${savedItemId}/combo`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ comboItems: comboItems.map(ci => ({ includedItemId: ci.menuItemId, quantity: ci.quantity })) }),
          });
        } catch (err) {
          console.error('[COMBO_SAVE]', err);
          toast.warning('Item saved, but combo items may not have been saved');
        }
      } else if (!isCombo && savedItemId && isEdit) {
        // Remove combo items if combo was turned off
        try {
          await fetch(`/api/restaurants/${restaurantId}/items/${savedItemId}/combo`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ comboItems: [] }),
          });
        } catch (err) {
          console.error('[COMBO_CLEAR]', err);
        }
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Filter available items for combo selection (exclude self)
  const availableComboItems = allMenuItems.filter(
    (mi) => mi.id !== item?.id && mi.name.toLowerCase().includes(comboSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Menu Item' : (comboMode ? 'Create Combo Meal' : 'Add Menu Item')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Item description" rows={2} />
            </div>
            {/* Ingredient Linking */}
            <div className="space-y-2">
              <Label>Ingredients <span className="text-muted-foreground font-normal text-xs">(customers can remove these when ordering)</span></Label>
              <div className="space-y-2">
                {/* Search and add ingredients */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={ingredientSearch}
                    onChange={(e) => setIngredientSearch(e.target.value)}
                    placeholder="Search ingredients to add..."
                    className="pl-9 h-9"
                  />
                </div>
                {ingredientSearch && (
                  <div className="border rounded-lg max-h-32 overflow-y-auto">
                    {allIngredients
                      .filter((ing) => !selectedIngredients.has(ing.id) && ing.name.toLowerCase().includes(ingredientSearch.toLowerCase()))
                      .slice(0, 10)
                      .map((ing) => (
                        <button
                          key={ing.id}
                          onClick={() => {
                            setSelectedIngredients((prev) => {
                              const next = new Map(prev);
                              next.set(ing.id, { isRemovable: true, isDefault: true });
                              return next;
                            });
                            setIngredientSearch('');
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent/50 transition-colors"
                        >
                          <span>{ing.name}</span>
                          <Plus className="h-3 w-3 text-muted-foreground" />
                        </button>
                      ))
                    }
                    {allIngredients.filter((ing) => !selectedIngredients.has(ing.id) && ing.name.toLowerCase().includes(ingredientSearch.toLowerCase())).length === 0 && (
                      <p className="text-xs text-muted-foreground p-2">No ingredients found. Add new ones in Ingredient Library.</p>
                    )}
                  </div>
                )}

                {/* Linked ingredients */}
                {selectedIngredients.size > 0 && (
                  <div className="space-y-1">
                    {Array.from(selectedIngredients.entries()).map(([id, opts]) => {
                      const ing = allIngredients.find((i) => i.id === id);
                      if (!ing) return null;
                      return (
                        <div key={id} className="flex items-center gap-2 rounded-lg border p-2">
                          <span className="text-sm font-medium flex-1">{ing.name}</span>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1 text-xs text-muted-foreground" title="Included by default (toggle off for optional add-ons)">
                              <input
                                type="checkbox"
                                checked={opts.isDefault}
                                onChange={(e) => {
                                  setSelectedIngredients((prev) => {
                                    const next = new Map(prev);
                                    next.set(id, { ...opts, isDefault: e.target.checked });
                                    return next;
                                  });
                                }}
                                className="h-3 w-3"
                              />
                              Default
                            </label>
                            <label className="flex items-center gap-1 text-xs text-muted-foreground" title="Customer can remove this ingredient when ordering">
                              <input
                                type="checkbox"
                                checked={opts.isRemovable}
                                onChange={(e) => {
                                  setSelectedIngredients((prev) => {
                                    const next = new Map(prev);
                                    next.set(id, { ...opts, isRemovable: e.target.checked });
                                    return next;
                                  });
                                }}
                                className="h-3 w-3"
                              />
                              Removable
                            </label>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                setSelectedIngredients((prev) => {
                                  const next = new Map(prev);
                                  next.delete(id);
                                  return next;
                                });
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {selectedIngredients.size === 0 && !ingredientSearch && (
                  <p className="text-xs text-muted-foreground text-center py-2">Search to add ingredients from your library</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price (ETB)</Label>
                <Input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prepTime">Prep Time (min)</Label>
                <Input id="prepTime" type="number" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} placeholder="15" />
              </div>
            </div>
            {/* Category — full width row with search + create */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Category</Label>
                <button
                  type="button"
                  onClick={() => { setShowNewCategoryInput(true); setNewCategoryName(''); setNewCategoryIcon('') }}
                  className="text-xs text-brand font-medium hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  New category
                </button>
              </div>
              {showNewCategoryInput ? (
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={newCategoryIcon}
                    onChange={(e) => setNewCategoryIcon(e.target.value)}
                    placeholder="🍕"
                    className="w-16 text-center text-lg"
                    maxLength={4}
                    title="Emoji (optional)"
                  />
                  <Input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Category name (e.g. Lunch Specials)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newCategoryName.trim()) {
                        e.preventDefault()
                        handleCreateCategory()
                      }
                    }}
                  />
                  <Button type="button" size="sm" onClick={handleCreateCategory} disabled={creatingCategory || !newCategoryName.trim()}>
                    {creatingCategory ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowNewCategoryInput(false)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {categories.length === 0 && (
                      <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                        No categories yet. Click "New category" to create one.
                      </div>
                    )}
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          {cat.icon && <span>{cat.icon}</span>}
                          <span>{cat.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            ({allMenuItems?.filter(i => i.categoryId === cat.id).length || 0} items)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
                <Label>Available</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isVegetarian} onCheckedChange={setIsVegetarian} />
                <Label>Vegetarian</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isSpicy} onCheckedChange={setIsSpicy} />
                <Label>Spicy</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isPopular} onCheckedChange={setIsPopular} />
                <Label>Popular</Label>
              </div>
            </div>

            {/* Availability Schedule */}
            <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Availability Schedule</Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Set time windows and days when this item is available. Leave blank for always available.
              </p>

              {/* Time Window */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Available From</Label>
                  <Input
                    type="time"
                    value={availableFrom}
                    onChange={(e) => setAvailableFrom(e.target.value)}
                    className="h-8 text-xs"
                    placeholder="09:00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Available To</Label>
                  <Input
                    type="time"
                    value={availableTo}
                    onChange={(e) => setAvailableTo(e.target.value)}
                    className="h-8 text-xs"
                    placeholder="22:00"
                  />
                </div>
              </div>

              {/* Day of Week Checkboxes */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Available Days</Label>
                <div className="flex flex-wrap gap-2">
                  {DAY_OPTIONS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                        selectedDays.includes(day.value)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                {selectedDays.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Available on: {selectedDays.map(d => DAY_OPTIONS.find(o => o.value === d)?.label).join(', ')}
                  </p>
                )}
                {selectedDays.length === 0 && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    No days selected — item is available every day
                  </p>
                )}
              </div>

              {/* Schedule Summary */}
              {(availableFrom || availableTo || selectedDays.length > 0) && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-background rounded-md px-2 py-1.5 border">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>
                    Available
                    {availableFrom && availableTo ? ` ${availableFrom}–${availableTo}` : ' all day'}
                    {selectedDays.length > 0
                      ? ` on ${selectedDays.map(d => DAY_OPTIONS.find(o => o.value === d)?.label).join(', ')}`
                      : ' every day'}
                  </span>
                </div>
              )}
            </div>

            {/* Serving Size Override */}
            <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Serving Size Display</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {showServingSize === null
                      ? 'Inheriting restaurant default setting'
                      : showServingSize
                        ? 'Always show serving size for this item'
                        : 'Never show serving size for this item'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={showServingSize === null ? 'inherit' : showServingSize ? 'show' : 'hide'}
                    onValueChange={(val) => {
                      if (val === 'inherit') setShowServingSize(null)
                      else if (val === 'show') setShowServingSize(true)
                      else setShowServingSize(false)
                    }}
                  >
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">Inherit Default</SelectItem>
                      <SelectItem value="show">Always Show</SelectItem>
                      <SelectItem value="hide">Always Hide</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Item Image</Label>
            <ImageUpload
              currentImage={item?.image ?? null}
              onImageChange={handleItemImageChange}
              // For existing items: upload immediately via the per-item endpoint
              // (/api/restaurants/{id}/items/{itemId}/image) — that endpoint both
              // saves the file AND updates the DB row in one shot, so we don't
              // need to include `image` in the PUT body separately.
              // For new items: defer the upload — we have no itemId until save.
              deferUpload={!isEdit}
              onFileSelect={handleItemImageFileSelect}
              uploadEndpoint={
                isEdit && item?.id
                  ? `/api/restaurants/${restaurantId}/items/${item.id}/image`
                  : '/api/upload'
              }
              entity="menu-item"
              entityId={item?.id ?? 'new'}
              size={200}
              height={160}
              shape="square"
              label="Click or drag & drop to upload"
            />
            {!isEdit && pendingImageFile && (
              <p className="text-[11px] text-muted-foreground">
                Image will be uploaded after the item is saved.
              </p>
            )}
          </div>

          <Separator />

          {/* Combo Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-purple-600" />
                <Label className="text-sm font-medium">This is a combo meal</Label>
              </div>
              <Switch checked={isCombo} onCheckedChange={setIsCombo} />
            </div>

            {isCombo && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Add items that are included in this combo. The combo price can be different from the sum of individual items.
                </p>

                {/* Search and add items */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={comboSearch}
                      onChange={(e) => setComboSearch(e.target.value)}
                      placeholder="Search menu items to add..."
                      className="pl-9 h-9"
                    />
                  </div>

                  {/* Search results */}
                  {comboSearch && (
                    <div className="border rounded-lg max-h-32 overflow-y-auto">
                      {availableComboItems.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-2">No items found</p>
                      ) : (
                        availableComboItems.slice(0, 10).map((mi) => (
                          <button
                            key={mi.id}
                            onClick={() => addComboItem(mi.id)}
                            className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent/50 transition-colors"
                          >
                            <span>{mi.name}</span>
                            <span className="text-xs text-muted-foreground">{formatCents(mi.priceCents)}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Added combo items */}
                {comboItemsWithNames.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Included Items</Label>
                    {comboItemsWithNames.map((ci) => (
                      <div key={ci.menuItemId} className="flex items-center gap-3 rounded-lg border p-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{ci.name}</p>
                          <p className="text-xs text-muted-foreground">{formatCents(ci.priceCents)} each</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateComboQuantity(ci.menuItemId, ci.quantity - 1)}
                          >
                            -
                          </Button>
                          <span className="text-sm font-medium w-6 text-center">{ci.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateComboQuantity(ci.menuItemId, ci.quantity + 1)}
                          >
                            +
                          </Button>
                          <span className="text-sm font-medium w-20 text-right">
                            {formatCents(ci.priceCents * ci.quantity)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground"
                            onClick={() => removeComboItem(ci.menuItemId)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {/* Combo pricing summary */}
                    <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 p-3 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Sum of individual items</span>
                        <span>{formatCents(comboItemsTotalCents)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Combo price</span>
                        <span className="font-medium">{formatCents(toCents(parseFloat(price) || 0))}</span>
                      </div>
                      {comboItemsTotalCents > 0 && toCents(parseFloat(price) || 0) < comboItemsTotalCents && (
                        <div className="flex justify-between text-xs">
                          <span className="text-purple-700 dark:text-purple-400">Customer saves</span>
                          <span className="text-purple-700 dark:text-purple-400 font-medium">
                            {formatCents(comboItemsTotalCents - toCents(parseFloat(price) || 0))}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {comboItemsWithNames.length === 0 && (
                  <div className="text-center py-4 border rounded-lg border-dashed">
                    <Package className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Search and add items to this combo</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {isEdit ? 'Save Changes' : (comboMode ? 'Create Combo' : 'Add Item')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Manage Categories Dialog (drag-and-drop reordering) ──────
// Shows all categories in a vertical list with drag handles.
// On drop, renumbers ALL categories 1..N sequentially to eliminate
// duplicates, then persists all sortOrder updates via parallel PUTs.
function ManageCategoriesDialog({
  open,
  onClose,
  categories,
  restaurantId,
  menuId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  categories: CategoryData[];
  restaurantId: string;
  menuId: string;
  onSaved: () => void;
}) {
  // Local working copy — sorted by sortOrder, renumbered 1..N on every change
  const [localCats, setLocalCats] = useState<CategoryData[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync local state when dialog opens or categories change
  useEffect(() => {
    if (open) {
      // Sort by current sortOrder, then renumber 1..N to clean up any duplicates
      const sorted = [...categories].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      const renumbered = sorted.map((c, i) => ({ ...c, sortOrder: i + 1 }));
      setLocalCats(renumbered);
      setHasChanges(false);
    }
  }, [open, categories]);

  // ── Drag-and-drop handlers (HTML5 native) ──
  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Set a transparent drag image (optional — the default ghost is fine)
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    // Don't clear dragOverIndex here — it gets set to the new index on the next dragOver
  };

  const handleDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    // Move the dragged item from dragIndex to index, shifting the others
    setLocalCats(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(index, 0, moved);
      // Renumber 1..N to eliminate any duplicates
      return next.map((c, i) => ({ ...c, sortOrder: i + 1 }));
    });
    setHasChanges(true);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // ── Move up/down buttons (fallback for touch devices) ──
  const moveItem = (index: number, direction: 'up' | 'down') => {
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= localCats.length) return;
    setLocalCats(prev => {
      const next = [...prev];
      [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
      return next.map((c, i) => ({ ...c, sortOrder: i + 1 }));
    });
    setHasChanges(true);
  };

  // ── Save: persist all sortOrder updates in parallel ──
  const handleSave = async () => {
    setSaving(true);
    try {
      // Compare each category's new sortOrder to its original and only update changed ones
      const updates = localCats
        .filter(c => {
          const original = categories.find(oc => oc.id === c.id);
          return original && original.sortOrder !== c.sortOrder;
        })
        .map(c =>
          api.put(`/api/restaurants/${restaurantId}/menus/${menuId}/categories/${c.id}`, { sortOrder: c.sortOrder })
        );
      if (updates.length > 0) {
        await Promise.all(updates);
        toast.success(`${updates.length} categor${updates.length === 1 ? 'y' : 'ies'} reordered`);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save order';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeft className="h-5 w-5 text-primary" />
            Manage Category Order
          </DialogTitle>
          <DialogDescription>
            Drag and drop categories to reorder them. The order you set here is exactly what guests see on the menu.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {localCats.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No categories yet. Close this dialog and click &ldquo;Add Category&rdquo; first.
            </div>
          ) : (
            localCats.map((cat, index) => (
              <div
                key={cat.id}
                draggable
                onDragStart={handleDragStart(index)}
                onDragOver={handleDragOver(index)}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-2 p-2.5 rounded-lg border bg-card transition-all ${
                  dragIndex === index ? 'opacity-40 border-dashed' : ''
                } ${
                  dragOverIndex === index && dragIndex !== null && dragIndex !== index
                    ? 'border-primary border-2 bg-primary/5'
                    : ''
                } cursor-grab active:cursor-grabbing`}
              >
                {/* Drag handle */}
                <div className="flex flex-col gap-0.5 text-muted-foreground shrink-0">
                  <GripVertical className="h-4 w-4" />
                </div>
                {/* Sort order badge */}
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-[10px] font-bold text-muted-foreground shrink-0">
                  {index + 1}
                </div>
                {/* Category icon + name */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {cat.image ? (
                    <img src={cat.image} alt={cat.name} className="h-6 w-6 rounded object-cover shrink-0" />
                  ) : cat.icon ? (
                    <span className="text-lg shrink-0">{cat.icon}</span>
                  ) : null}
                  <span className="text-sm font-medium truncate">{cat.name}</span>
                  {cat.nameAm && <span className="text-xs text-muted-foreground truncate">({cat.nameAm})</span>}
                </div>
                {/* Up/down buttons for touch devices */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveItem(index, 'up')}
                    disabled={index === 0}
                    className="h-4 w-5 rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center"
                    title="Move up"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(index, 'down')}
                    disabled={index === localCats.length - 1}
                    className="h-4 w-5 rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center"
                    title="Move down"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        {/* Hint */}
        {localCats.length > 1 && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <GripVertical className="h-3 w-3" />
            Drag the handle to reorder. Categories are renumbered 1–{localCats.length} automatically — no duplicates possible.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {hasChanges ? 'Save Order' : 'No Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add/Edit Category Dialog ──────────────────────────────────

function AddEditCategoryDialog({
  open,
  onClose,
  category,
  categories,
  restaurantId,
  menuId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  category: CategoryData | null;
  categories: CategoryData[];
  restaurantId: string;
  menuId: string;
  onSaved: () => void;
}) {
  const isEdit = !!category;
  const [name, setName] = useState('');
  const [nameAm, setNameAm] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionAm, setDescriptionAm] = useState('');
  const [icon, setIcon] = useState('');
  // sortOrder is no longer edited here — it's managed via drag-and-drop in the
  // ManageCategoriesDialog. Removed to prevent duplicate sortOrder values.
  const [categoryImageUrl, setCategoryImageUrl] = useState<string | null>(null);
  const [categoryImageRemoved, setCategoryImageRemoved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset all form state when category changes (edit) or is null (add new)
  useEffect(() => {
    setName(category?.name ?? '');
    setNameAm(category?.nameAm ?? '');
    setDescription(category?.description ?? '');
    setDescriptionAm(category?.descriptionAm ?? '');
    setIcon(category?.icon ?? '');
    setCategoryImageUrl(category?.image ?? null);
    setCategoryImageRemoved(false);
  }, [category]);

  const handleCategoryImageChange = (url: string | null) => {
    setCategoryImageUrl(url);
    setCategoryImageRemoved(url === null);
  };

  const handleSave = async () => {
    if (!name) {
      toast.error('Category name is required');
      return;
    }
    try {
      setSaving(true);
      const payload: Record<string, unknown> = {
        name,
        nameAm: nameAm || null,
        description: description || null,
        descriptionAm: descriptionAm || null,
        icon: icon || null,
      };
      // For NEW categories, assign sortOrder = current count + 1 so it appears last.
      // For EDIT, don't send sortOrder — it's managed via the drag-and-drop "Order" dialog.
      if (!isEdit) {
        payload.sortOrder = (categories?.length || 0) + 1;
      }
      if (categoryImageRemoved) {
        payload.image = null;
      } else if (categoryImageUrl) {
        payload.image = categoryImageUrl;
      }

      if (isEdit && category) {
        await api.put(`/api/restaurants/${restaurantId}/menus/${menuId}/categories/${category.id}`, payload);
        toast.success('Category updated successfully');
      } else {
        await api.post(`/api/restaurants/${restaurantId}/menus/${menuId}/categories`, payload);
        toast.success('Category added successfully');
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Category' : 'Add Category'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name (e.g. Main Dishes)" />
          </div>
          <div className="space-y-2">
            <Label>Name (Amharic)</Label>
            <Input value={nameAm} onChange={(e) => setNameAm(e.target.value)} placeholder="ስም (e.g. ዋና ምግቦች)" dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Category description" rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Description (Amharic)</Label>
            <Textarea value={descriptionAm} onChange={(e) => setDescriptionAm(e.target.value)} placeholder="ገለጻ" rows={2} dir="ltr" />
          </div>

          {/* Icon (emoji) — full picker with search + categories */}
          <div className="space-y-2">
            <Label>Icon (emoji)</Label>
            <EmojiPicker value={icon} onChange={setIcon} />
          </div>

          {/* Sort order is managed via drag-and-drop in the "Order" dialog.
              Manual entry is hidden to prevent duplicate sortOrder values. */}

          <div className="space-y-2">
            <Label>Category Image</Label>
            <ImageUpload
              currentImage={category?.image ?? null}
              onImageChange={handleCategoryImageChange}
              entity="category"
              entityId={category?.id ?? 'new'}
              size={160}
              height={120}
              shape="square"
              label="Click or drop image"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {isEdit ? 'Save Changes' : 'Add Category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Ingredient Management Dialog ────────────────────────────────

interface IngredientData {
  id: string;
  name: string;
  nameAm: string | null;
  allergens: string | null;
  isAvailable: boolean;
}

function IngredientManagementDialog({
  open,
  onClose,
  restaurantId,
}: {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
}) {
  const [ingredients, setIngredients] = useState<IngredientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newNameAm, setNewNameAm] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchIngredients = useCallback(async () => {
    if (!restaurantId) return;
    try {
      setLoading(true);
      const res = await api.get<{ data: IngredientData[] }>(`/api/restaurants/${restaurantId}/ingredients`);
      setIngredients(res.data || []);
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (open) fetchIngredients();
  }, [open, fetchIngredients]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      setSaving(true);
      await api.post(`/api/restaurants/${restaurantId}/ingredients`, {
        name: newName.trim(),
        nameAm: newNameAm.trim() || null,
      });
      toast.success('Ingredient created');
      setNewName('');
      setNewNameAm('');
      fetchIngredients();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/restaurants/${restaurantId}/ingredients/${id}`);
      toast.success('Ingredient deleted');
      fetchIngredients();
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Ingredient Library
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create new ingredient */}
          <div className="flex gap-2">
            <Input
              placeholder="Ingredient name (English)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            />
            <Input
              placeholder="በአማርኛ"
              value={newNameAm}
              onChange={(e) => setNewNameAm(e.target.value)}
              className="w-28"
            />
            <Button onClick={handleCreate} disabled={saving || !newName.trim()} size="sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>

          {/* Ingredient list */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : ingredients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No ingredients yet. Create your first one above.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {ingredients.map((ing) => (
                <div key={ing.id} className="flex items-center justify-between rounded-lg border p-2.5 hover:bg-accent/30">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{ing.name}</span>
                    {ing.nameAm && <span className="text-xs text-muted-foreground">({ing.nameAm})</span>}
                    {ing.allergens && (
                      <Badge variant="secondary" className="text-[10px] bg-amber-50 text-amber-700">allergen</Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(ing.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modifier Group Editor Dialog ────────────────────────────────

interface ModifierGroupEditData {
  id: string;
  name: string;
  isRequired: boolean;
  selectionType: string;
  options: { id: string; name: string; price: number; isDefault: boolean }[];
}

function ModifierGroupDialog({
  open,
  onClose,
  restaurantId,
  itemId,
  itemName,
}: {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  itemId: string | null;
  itemName: string;
}) {
  const [groups, setGroups] = useState<ModifierGroupEditData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New group form
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupRequired, setNewGroupRequired] = useState(false);
  const [newGroupType, setNewGroupType] = useState('single');
  const [newOptions, setNewOptions] = useState<{ name: string; price: string }[]>([{ name: '', price: '0' }]);

  const fetchModifiers = useCallback(async () => {
    if (!itemId) return;
    try {
      setLoading(true);
      const res = await api.get<{ modifierGroups: ModifierGroupEditData[]; data: ModifierGroupEditData[] }>(
        `/api/restaurants/${restaurantId}/items/${itemId}/modifiers`
      );
      const g = res.modifierGroups || res.data || (Array.isArray(res) ? res : []);
      setGroups(g);
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, [restaurantId, itemId]);

  useEffect(() => {
    if (open && itemId) fetchModifiers();
  }, [open, itemId, fetchModifiers]);

  const handleCreateGroup = async () => {
    if (!itemId || !newGroupName.trim()) return;
    try {
      setSaving(true);
      await api.post(`/api/restaurants/${restaurantId}/items/${itemId}/modifiers`, {
        name: newGroupName.trim(),
        isRequired: newGroupRequired,
        selectionType: newGroupType,
        minSelection: 1,
        maxSelection: newGroupType === 'multi' ? 10 : 1,
        options: newOptions.filter((o) => o.name.trim()).map((o) => ({
          name: o.name.trim(),
          priceDeltaCents: toCents(parseFloat(o.priceCents) || 0),
          isDefault: false,
        })),
      });
      toast.success('Modifier group created');
      setNewGroupName('');
      setNewGroupRequired(false);
      setNewGroupType('single');
      setNewOptions([{ name: '', price: '0' }]);
      fetchModifiers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!itemId) return;
    try {
      await api.delete(`/api/restaurants/${restaurantId}/items/${itemId}/modifiers/${groupId}`);
      toast.success('Modifier group deleted');
      fetchModifiers();
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Modifiers — {itemName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Existing groups */}
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : groups.length > 0 ? (
            <div className="space-y-2">
              {groups.map((group) => (
                <div key={group.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{group.name}</span>
                      {group.isRequired && <Badge className="text-[10px] bg-red-50 text-red-700 border-0">Required</Badge>}
                      <Badge variant="outline" className="text-[10px]">{group.selectionType}</Badge>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteGroup(group.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {group.options.map((opt) => (
                      <span key={opt.id} className="text-xs px-2 py-1 rounded-full bg-muted">
                        {opt.name}{opt.priceDeltaCents > 0 ? ` +${formatCents(opt.priceDeltaCents)}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No modifier groups yet</p>
          )}

          <Separator />

          {/* Create new group */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Add Modifier Group</h4>
            <Input placeholder="Group name (e.g. Spice Level)" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={newGroupRequired} onCheckedChange={setNewGroupRequired} />
                <Label className="text-xs">Required</Label>
              </div>
              <Select value={newGroupType} onValueChange={setNewGroupType}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single select</SelectItem>
                  <SelectItem value="multi">Multi select</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Options */}
            <div className="space-y-2">
              <Label className="text-xs">Options</Label>
              {newOptions.map((opt, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    placeholder="Option name"
                    value={opt.name}
                    onChange={(e) => {
                      const next = [...newOptions];
                      next[idx] = { ...next[idx], name: e.target.value };
                      setNewOptions(next);
                    }}
                    className="flex-1 h-8 text-xs"
                  />
                  <Input
                    placeholder="Price"
                    type="number"
                    value={opt.priceCents}
                    onChange={(e) => {
                      const next = [...newOptions];
                      next[idx] = { ...next[idx], price: e.target.value };
                      setNewOptions(next);
                    }}
                    className="w-20 h-8 text-xs"
                  />
                  {newOptions.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setNewOptions(newOptions.filter((_, i) => i !== idx))}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setNewOptions([...newOptions, { name: '', price: '0' }])}>
                <Plus className="h-3 w-3" /> Add option
              </Button>
            </div>

            <Button onClick={handleCreateGroup} disabled={saving || !newGroupName.trim()} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Create Group
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main View ──────────────────────────────────────────────

export function MenuView() {
  const { isAddMenuItemOpen, setIsAddMenuItemOpen, editMenuItemId, setEditMenuItemId, user, selectedBranchId, branchChangeVersion } = useAppStore();
  const { tRaw } = useTranslation();
  const { t } = useI18n(user?.restaurantId);
  const restaurantId = user?.restaurantId || '';

  const [menus, setMenus] = useState<MenuData[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [localCategory, setLocalCategory] = useState('');
  const [togglingAvailability, setTogglingAvailability] = useState<string | null>(null);
  const [isComboMode, setIsComboMode] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [isIngredientDialogOpen, setIsIngredientDialogOpen] = useState(false);
  const [isModifierDialogOpen, setIsModifierDialogOpen] = useState(false);
  const [modifierEditItemId, setModifierEditItemId] = useState<string | null>(null);
  // Phase 7.1: branch overrides dialog state
  const [isBranchOverridesDialogOpen, setIsBranchOverridesDialogOpen] = useState(false);
  const [branchOverridesItemId, setBranchOverridesItemId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');

  // Menu management state
  const [isMenuDialogOpen, setIsMenuDialogOpen] = useState(false);
  const [editMenuTarget, setEditMenuTarget] = useState<MenuData | null>(null);
  const [menuFormName, setMenuFormName] = useState('');
  const [menuFormNameAm, setMenuFormNameAm] = useState('');
  const [menuFormDescription, setMenuFormDescription] = useState('');
  const [menuFormIsActive, setMenuFormIsActive] = useState(true);
  const [savingMenu, setSavingMenu] = useState(false);
  const [deleteMenuTarget, setDeleteMenuTarget] = useState<MenuData | null>(null);
  const [deletingMenu, setDeletingMenu] = useState(false);

  const fetchMenuList = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const menusRes = await api.get<{ menus?: MenuData[]; data?: MenuData[] }>(`/api/restaurants/${restaurantId}/menus`);
      const menuList = menusRes.menus || menusRes.data || [];
      setMenus(menuList);
      return menuList;
    } catch {
      return [];
    }
  }, [restaurantId]);

  const fetchData = useCallback(async () => {
    if (!restaurantId) return;
    try {
      // Fetch menus first
      const menuList = await fetchMenuList();
      if (!menuList || menuList.length === 0) {
        setCategories([]);
        setMenuItems([]);
        setMenuId('');
        setLoading(false);
        return;
      }

      // Use the currently selected menu, or fall back to the first one
      const targetMenuId = menuId && menuList.some((m: MenuData) => m.id === menuId) ? menuId : menuList[0].id;
      setMenuId(targetMenuId);

      // Fetch categories
      const catRes = await api.get<{ categories?: CategoryData[]; data?: CategoryData[] }>(
        `/api/restaurants/${restaurantId}/menus/${targetMenuId}/categories`
      );
      let cats = catRes.categories || catRes.data;
      if (!Array.isArray(cats)) cats = Array.isArray(catRes) ? catRes : [];
      const activeCats = cats.filter((c: CategoryData) => c.isActive).sort((a: CategoryData, b: CategoryData) => a.sortOrder - b.sortOrder);
      const enrichedCats = activeCats.map((c: CategoryData) => ({ ...c, menuId: targetMenuId }));
      setCategories(enrichedCats);

      if (enrichedCats.length > 0 && !localCategory && enrichedCats[0]?.id) {
        setLocalCategory(enrichedCats[0].id);
      }

      // Fetch menu items
      const itemsRes = await api.get<{ items?: MenuItemData[]; data?: MenuItemData[] }>(
        `/api/restaurants/${restaurantId}/menus/${targetMenuId}/items`
      );
      const items = itemsRes.items || itemsRes.data || (Array.isArray(itemsRes) ? itemsRes : []);

      // Enrich items with combo data
      const enrichedItems = await Promise.all(
        items.map(async (item: MenuItemData) => {
          try {
            const detailRes = await api.get<{ item?: MenuItemData & { comboItems?: ComboItemData[] } }>(
              `/api/restaurants/${restaurantId}/items/${item.id}`
            );
            const detail = detailRes.item || detailRes;
            return { ...item, comboItems: detail.comboItems || [] };
          } catch {
            return { ...item, comboItems: [] };
          }
        })
      );

      setMenuItems(enrichedItems);
    } catch (err) {
      // Silently handle — show empty state
    } finally {
      setLoading(false);
    }
  }, [restaurantId, localCategory, menuId, fetchMenuList]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Re-fetch when branch changes — items may have branch-specific overrides
  // (price, availability) that should be reflected in the dashboard view
  useEffect(() => {
    if (selectedBranchId) {
      fetchData();
    }
  }, [selectedBranchId, branchChangeVersion]);

  // ── Menu CRUD handlers ────────────────────────────────────

  const openCreateMenuDialog = () => {
    setEditMenuTarget(null);
    setMenuFormName('');
    setMenuFormNameAm('');
    setMenuFormDescription('');
    setMenuFormIsActive(true);
    setIsMenuDialogOpen(true);
  };

  const openEditMenuDialog = (menu: MenuData) => {
    setEditMenuTarget(menu);
    setMenuFormName(menu.name);
    setMenuFormNameAm(menu.nameAm || '');
    setMenuFormDescription(menu.description || '');
    setMenuFormIsActive(menu.isActive);
    setIsMenuDialogOpen(true);
  };

  const handleSaveMenu = async () => {
    if (!menuFormName.trim()) {
      toast.error('Menu name is required');
      return;
    }
    try {
      setSavingMenu(true);
      if (editMenuTarget) {
        await api.put(`/api/restaurants/${restaurantId}/menus/${editMenuTarget.id}`, {
          name: menuFormName.trim(),
          nameAm: menuFormNameAm.trim() || null,
          description: menuFormDescription.trim() || null,
          isActive: menuFormIsActive,
        });
        toast.success(`"${menuFormName.trim()}" updated`);
      } else {
        await api.post(`/api/restaurants/${restaurantId}/menus`, {
          name: menuFormName.trim(),
          nameAm: menuFormNameAm.trim() || null,
          description: menuFormDescription.trim() || null,
          isActive: menuFormIsActive,
        });
        toast.success(`"${menuFormName.trim()}" menu created`);
      }
      setIsMenuDialogOpen(false);
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save menu';
      toast.error(msg);
    } finally {
      setSavingMenu(false);
    }
  };

  const handleDeleteMenu = async () => {
    if (!deleteMenuTarget) return;
    try {
      setDeletingMenu(true);
      await api.delete(`/api/restaurants/${restaurantId}/menus/${deleteMenuTarget.id}`);
      toast.success(`"${deleteMenuTarget.name}" deleted`);
      setDeleteMenuTarget(null);
      if (menuId === deleteMenuTarget.id) {
        setMenuId('');
      }
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete menu';
      toast.error(msg);
    } finally {
      setDeletingMenu(false);
    }
  };

  const handleSwitchMenu = (newMenuId: string) => {
    setMenuId(newMenuId);
    setLocalCategory('');
    setCategories([]);
    setMenuItems([]);
    setLoading(true);
  };

  // ── Category reordering ──────────────────────────────────────
  // Moves a category one slot left (lower sortOrder) or right (higher sortOrder).
  // Swaps sortOrder values with the adjacent category, then persists both via PUT.
  // Falls back to re-fetching on error to keep UI in sync with the DB.
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const handleReorderCategory = async (catId: string, direction: 'left' | 'right') => {
    const sortedCats = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sortedCats.findIndex(c => c.id === catId);
    if (idx === -1) return;
    const swapIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sortedCats.length) return; // Already at the edge
    const cat = sortedCats[idx];
    const swapCat = sortedCats[swapIdx];

    setReorderingId(catId);
    // Optimistically swap the sortOrder values in local state
    const oldCatOrder = cat.sortOrder;
    const oldSwapOrder = swapCat.sortOrder;
    setCategories(prev => prev.map(c => {
      if (c.id === cat.id) return { ...c, sortOrder: oldSwapOrder };
      if (c.id === swapCat.id) return { ...c, sortOrder: oldCatOrder };
      return c;
    }));

    try {
      // Persist both updates in parallel
      await Promise.all([
        api.put(`/api/restaurants/${restaurantId}/menus/${menuId}/categories/${cat.id}`, { sortOrder: oldSwapOrder }),
        api.put(`/api/restaurants/${restaurantId}/menus/${menuId}/categories/${swapCat.id}`, { sortOrder: oldCatOrder }),
      ]);
      // No toast on success — the visual reorder is the feedback.
      // Silent failure recovery: re-fetch to guarantee DB sync.
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reorder category';
      toast.error(msg);
      // Revert optimistic update by re-fetching
      fetchData();
    } finally {
      setReorderingId(null);
    }
  };

  // ── Category drag-and-drop (inline on the tabs bar) ──────────
  // Moves a category from any position to any other position, renumbers
  // ALL categories 1..N to eliminate duplicates, and persists only the
  // changed ones via parallel PUTs.
  const [inlineDragId, setInlineDragId] = useState<string | null>(null);
  const [inlineDragOverId, setInlineDragOverId] = useState<string | null>(null);

  const handleReorderCategoryToPosition = async (draggedCatId: string, targetCatId: string) => {
    if (draggedCatId === targetCatId) return;
    const sortedCats = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const fromIdx = sortedCats.findIndex(c => c.id === draggedCatId);
    const toIdx = sortedCats.findIndex(c => c.id === targetCatId);
    if (fromIdx === -1 || toIdx === -1) return;

    // Move the dragged item from fromIdx to toIdx, shifting the others
    const reordered = [...sortedCats];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    // Renumber 1..N to eliminate duplicates
    const renumbered = reordered.map((c, i) => ({ ...c, sortOrder: i + 1 }));

    // Compute which categories actually changed sortOrder
    const changed = renumbered.filter(c => {
      const original = sortedCats.find(oc => oc.id === c.id);
      return original && original.sortOrder !== c.sortOrder;
    });

    if (changed.length === 0) return;

    setReorderingId(draggedCatId);
    // Optimistically update local state
    setCategories(prev => {
      const map = new Map(renumbered.map(c => [c.id, c.sortOrder]));
      return prev.map(c => map.has(c.id) ? { ...c, sortOrder: map.get(c.id)! } : c);
    });

    try {
      // Persist all changed categories in parallel
      await Promise.all(
        changed.map(c =>
          api.put(`/api/restaurants/${restaurantId}/menus/${menuId}/categories/${c.id}`, { sortOrder: c.sortOrder })
        )
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reorder category';
      toast.error(msg);
      fetchData();
    } finally {
      setReorderingId(null);
    }
  };

  const isAllCategories = localCategory === '__all__';
  const currentCategory = isAllCategories ? null : categories.find((c) => c.id === localCategory);
  const editItem = editMenuItemId ? menuItems.find((i) => i.id === editMenuItemId) ?? null : null;
  const categoryItems = isAllCategories ? menuItems : menuItems.filter((i) => i.categoryId === localCategory);

  // Helper to get category name for an item (used in "All" view)
  const getCategoryName = useCallback((categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat ? tRaw(cat.nameI18n, cat.name) : '';
  }, [categories, tRaw]);

  const handleToggleAvailability = async (item: MenuItemData) => {
    try {
      setTogglingAvailability(item.id);
      await api.put(`/api/restaurants/${restaurantId}/items/${item.id}`, {
        isAvailable: !item.isAvailable,
      });
      toast.success(`${item.name} ${item.isAvailable ? 'marked unavailable' : 'marked available'}`);
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update';
      toast.error(msg);
    } finally {
      setTogglingAvailability(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <span className="ml-2 text-muted-foreground">{t('dashboard.loading_menu')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Menu Selector Bar ── */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={menuId} onValueChange={handleSwitchMenu}>
            <SelectTrigger className="w-[220px] h-8 text-xs">
              <SelectValue placeholder="Select menu..." />
            </SelectTrigger>
            <SelectContent>
              {menus.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <span className="flex items-center gap-2">
                    {m.name}
                    {!m.isActive && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-red-100 text-red-700">Inactive</Badge>
                    )}
                    {m._count && (
                      <span className="text-muted-foreground text-[10px]">
                        {m._count.categories} cat{m._count.categories !== 1 ? 's' : ''}
                      </span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {menus.length > 0 && menus.find(m => m.id === menuId) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => openEditMenuDialog(menus.find(m => m.id === menuId)!)}>
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  Edit Menu
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeleteMenuTarget(menus.find(m => m.id === menuId)!)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Delete Menu
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 h-8 text-xs"
          onClick={openCreateMenuDialog}
        >
          <Plus className="h-3.5 w-3.5" />
          New Menu
        </Button>
      </div>

      {/* Empty state: no menus */}
      {menus.length === 0 && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm font-medium">No menus yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create your first menu to start adding categories and items.</p>
            <Button className="mt-4" size="sm" onClick={openCreateMenuDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Menu
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Category Tabs + View Mode Toggle */}
      {menus.length > 0 && menuId && (<>
      <div className="flex items-center gap-2">
        <div className="flex gap-2 overflow-x-auto pb-2 items-center flex-1">
          {/* "All" tab */}
          <Button
            variant={isAllCategories ? 'default' : 'outline'}
            size="sm"
            className="shrink-0 gap-2 h-9"
            onClick={() => setLocalCategory('__all__')}
          >
            <Layers className="h-3.5 w-3.5" />
            <span className="text-xs">All</span>
            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
              {menuItems.length}
            </Badge>
          </Button>
          {/* Per-category tabs — drag-and-drop reorderable, with left/right arrows */}
          {(() => {
            const sortedCats = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
            return sortedCats.map((cat, idx) => {
              const isSelected = localCategory === cat.id;
              const isFirst = idx === 0;
              const isLast = idx === sortedCats.length - 1;
              const isReordering = reorderingId === cat.id;
              const isDragging = inlineDragId === cat.id;
              const isDragOver = inlineDragOverId === cat.id && inlineDragId !== null && inlineDragId !== cat.id;
              return (
                <div
                  key={cat.id}
                  draggable
                  onDragStart={(e) => {
                    setInlineDragId(cat.id);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', cat.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (inlineDragOverId !== cat.id) setInlineDragOverId(cat.id);
                  }}
                  onDragLeave={() => {
                    if (inlineDragOverId === cat.id) setInlineDragOverId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (inlineDragId && inlineDragId !== cat.id) {
                      handleReorderCategoryToPosition(inlineDragId, cat.id);
                    }
                    setInlineDragId(null);
                    setInlineDragOverId(null);
                  }}
                  onDragEnd={() => {
                    setInlineDragId(null);
                    setInlineDragOverId(null);
                  }}
                  className={`flex items-center shrink-0 group transition-all ${
                    isDragging ? 'opacity-40' : ''
                  } ${isDragOver ? 'ring-2 ring-primary ring-offset-1 rounded-md' : ''}`}
                >
                  {/* Left arrow — move category earlier (lower sortOrder) */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleReorderCategory(cat.id, 'left'); }}
                    disabled={isFirst || isReordering}
                    className="h-6 w-4 rounded-l-md border border-r-0 border-input bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    title="Move left (show earlier)"
                    aria-label={`Move ${cat.name} earlier`}
                  >
                    <ArrowLeft className="h-3 w-3" />
                  </button>
                  {/* Category tab — click to select, double-click to edit, drag to reorder */}
                  <Button
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-none border-x-0 h-9 gap-2 cursor-grab active:cursor-grabbing"
                    onClick={() => setLocalCategory(cat.id)}
                    onDoubleClick={() => { setEditCategoryId(cat.id); setIsCategoryDialogOpen(true); }}
                    title={`${cat.name} — click to view, double-click to edit, drag to reorder`}
                  >
                    {isReordering ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : cat.image ? (
                      <img src={cat.image} alt={cat.name} className="h-5 w-5 rounded object-cover" />
                    ) : cat.icon ? (
                      <span>{cat.icon}</span>
                    ) : null}
                    <span className="text-xs">{tRaw(cat.nameI18n, cat.name)}</span>
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                      {menuItems.filter((i) => i.categoryId === cat.id).length}
                    </Badge>
                  </Button>
                  {/* Right arrow — move category later (higher sortOrder) */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleReorderCategory(cat.id, 'right'); }}
                    disabled={isLast || isReordering}
                    className="h-6 w-4 rounded-r-md border border-l-0 border-input bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    title="Move right (show later)"
                    aria-label={`Move ${cat.name} later`}
                  >
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              );
            });
          })()}
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 h-9 w-9 p-0"
            onClick={() => { setEditCategoryId(null); setIsCategoryDialogOpen(true); }}
            title="Add Category"
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
          {categories.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 h-9 gap-1.5 px-2"
              onClick={() => setIsManageCategoriesOpen(true)}
              title="Reorder categories (drag & drop)"
            >
              <Settings2 className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Order</span>
            </Button>
          )}
        </div>
        {/* View Mode Toggle */}
        <div className="flex items-center rounded-lg border p-0.5 shrink-0">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            title="List view"
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewMode('card')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'card' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            title="Card view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Category Description + Action Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">
            {isAllCategories ? (
              <>
                <Layers className="h-3.5 w-3.5 inline mr-1" />
                All Items
              </>
            ) : (
              <>
                {currentCategory?.icon ? `${currentCategory.icon} ` : ''}
                {currentCategory ? tRaw(currentCategory.nameI18n, currentCategory.name) : ''}
              </>
            )}
          </h3>
          <p className="text-xs text-muted-foreground">
            {isAllCategories
              ? `${menuItems.length} item${menuItems.length !== 1 ? 's' : ''} across ${categories.length} categor${categories.length !== 1 ? 'ies' : 'y'}`
              : currentCategory ? tRaw(currentCategory.descriptionI18n, currentCategory.description || '') : ''
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isAllCategories && currentCategory && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 h-7 text-xs text-muted-foreground"
              onClick={() => { setEditCategoryId(currentCategory.id); setIsCategoryDialogOpen(true); }}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              setEditMenuItemId(null);
              setIsComboMode(true);
              setIsAddMenuItemOpen(true);
            }}
          >
            <Package className="h-3.5 w-3.5" />
            Create Combo
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setIsIngredientDialogOpen(true)}
          >
            <Search className="h-3.5 w-3.5" />
            Ingredients
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setEditMenuItemId(null);
              setIsComboMode(false);
              setIsAddMenuItemOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Items */}
      {isAllCategories ? (
        // ── "All" view: items grouped by category ──
        categories.map((cat) => {
          const catItems = menuItems.filter(i => i.categoryId === cat.id);
          if (catItems.length === 0) return null;
          return (
            <div key={cat.id} className="space-y-2">
              <div className="flex items-center gap-2 pt-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {cat.icon ? `${cat.icon} ` : ''}{tRaw(cat.nameI18n, cat.name)}
                </span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {catItems.length}
                </Badge>
                <div className="flex-1 border-b" />
              </div>
              {viewMode === 'card' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {catItems.map((item) => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      viewMode="card"
                      categoryName={tRaw(cat.nameI18n, cat.name)}
                      onEdit={(i) => { setEditMenuItemId(i.id); setIsAddMenuItemOpen(true); }}
                      onToggleAvailability={handleToggleAvailability}
                      onManageModifiers={(i) => { setModifierEditItemId(i.id); setIsModifierDialogOpen(true); }}
                onManageBranchOverrides={(i) => { setBranchOverridesItemId(i.id); setIsBranchOverridesDialogOpen(true); }}
                      onManageBranchOverrides={(i) => { setBranchOverridesItemId(i.id); setIsBranchOverridesDialogOpen(true); }}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {catItems.map((item) => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      viewMode="list"
                      categoryName={tRaw(cat.nameI18n, cat.name)}
                      onEdit={(i) => { setEditMenuItemId(i.id); setIsAddMenuItemOpen(true); }}
                      onToggleAvailability={handleToggleAvailability}
                      onManageModifiers={(i) => { setModifierEditItemId(i.id); setIsModifierDialogOpen(true); }}
                onManageBranchOverrides={(i) => { setBranchOverridesItemId(i.id); setIsBranchOverridesDialogOpen(true); }}
                      onManageBranchOverrides={(i) => { setBranchOverridesItemId(i.id); setIsBranchOverridesDialogOpen(true); }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })
      ) : (
        // ── Single category view ──
        viewMode === 'card' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {categoryItems.length === 0 && (
              <div className="col-span-full">
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <UtensilsCrossed className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-sm text-muted-foreground">{t('menu.no_items')}</p>
                    <Button className="mt-4" size="sm" onClick={() => { setEditMenuItemId(null); setIsAddMenuItemOpen(true); }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add your first item
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
            {categoryItems.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                viewMode="card"
                onEdit={(i) => { setEditMenuItemId(i.id); setIsAddMenuItemOpen(true); }}
                onToggleAvailability={handleToggleAvailability}
                onManageModifiers={(i) => { setModifierEditItemId(i.id); setIsModifierDialogOpen(true); }}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {categoryItems.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <UtensilsCrossed className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-sm text-muted-foreground">{t('menu.no_items')}</p>
                  <Button className="mt-4" size="sm" onClick={() => { setEditMenuItemId(null); setIsAddMenuItemOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add your first item
                  </Button>
                </CardContent>
              </Card>
            )}
            {categoryItems.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                viewMode="list"
                onEdit={(i) => { setEditMenuItemId(i.id); setIsAddMenuItemOpen(true); }}
                onToggleAvailability={handleToggleAvailability}
                onManageModifiers={(i) => { setModifierEditItemId(i.id); setIsModifierDialogOpen(true); }}
              />
            ))}
          </div>
        )
      )}
      </>)}

      {/* ── Create/Edit Menu Dialog ── */}
      <Dialog open={isMenuDialogOpen} onOpenChange={setIsMenuDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {editMenuTarget ? 'Edit Menu' : 'Create New Menu'}
            </DialogTitle>
            <DialogDescription>
              {editMenuTarget
                ? 'Update menu details. Changes will affect all QR codes assigned to this menu.'
                : 'Create a separate menu for VIP tables, special events, happy hour, etc. You can assign different menus to different tables via QR codes.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="menuName">Name</Label>
              <Input
                id="menuName"
                value={menuFormName}
                onChange={(e) => setMenuFormName(e.target.value)}
                placeholder="e.g. VIP Menu, Happy Hour, Drinks Only"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="menuNameAm">Name (Amharic) — optional</Label>
              <Input
                id="menuNameAm"
                value={menuFormNameAm}
                onChange={(e) => setMenuFormNameAm(e.target.value)}
                placeholder="e.g. የቪአይፒ ምናሌ"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="menuDesc">Description — optional</Label>
              <Textarea
                id="menuDesc"
                value={menuFormDescription}
                onChange={(e) => setMenuFormDescription(e.target.value)}
                placeholder="e.g. Premium menu for VIP lounge tables"
                rows={2}
              />
            </div>
            {editMenuTarget && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm">Active</Label>
                  <p className="text-[11px] text-muted-foreground">
                    {menuFormIsActive ? 'Menu is currently active' : 'Menu is currently inactive'}
                  </p>
                </div>
                <Switch
                  checked={menuFormIsActive}
                  onCheckedChange={setMenuFormIsActive}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMenuDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveMenu} disabled={savingMenu || !menuFormName.trim()}>
              {savingMenu ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              {editMenuTarget ? 'Save Changes' : 'Create Menu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Menu Confirmation ── */}
      <AlertDialog open={!!deleteMenuTarget} onOpenChange={(open) => { if (!open) setDeleteMenuTarget(null); }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <Trash2 className="h-5 w-5" />
              Delete &ldquo;{deleteMenuTarget?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  This will permanently delete this menu and all its categories and items.
                </p>
                {deleteMenuTarget?._count?.qrCodes ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-3">
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                      {deleteMenuTarget._count.qrCodes} QR code{deleteMenuTarget._count.qrCodes !== 1 ? 's' : ''} assigned
                    </p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                      Tables with QR codes pointing to this menu will fall back to the default menu.
                    </p>
                  </div>
                ) : null}
                <p className="text-[11px] text-muted-foreground">
                  This action cannot be undone.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMenu}
              disabled={deletingMenu}
              className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
            >
              {deletingMenu ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete Menu
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add/Edit Category Dialog */}
      <AddEditCategoryDialog
        open={isCategoryDialogOpen}
        onClose={() => { setIsCategoryDialogOpen(false); setEditCategoryId(null); }}
        category={editCategoryId ? categories.find(c => c.id === editCategoryId) ?? null : null}
        categories={categories}
        restaurantId={restaurantId}
        menuId={menuId}
        onSaved={fetchData}
      />

      {/* Manage Categories Dialog (drag-and-drop reordering) */}
      <ManageCategoriesDialog
        open={isManageCategoriesOpen}
        onClose={() => setIsManageCategoriesOpen(false)}
        categories={categories}
        restaurantId={restaurantId}
        menuId={menuId}
        onSaved={fetchData}
      />

      {/* Add/Edit Dialog */}
      <AddEditItemDialog
        open={isAddMenuItemOpen}
        onClose={() => {
          setIsAddMenuItemOpen(false);
          setEditMenuItemId(null);
          setIsComboMode(false);
        }}
        item={editItem}
        categories={categories}
        allMenuItems={menuItems}
        restaurantId={restaurantId}
        onSaved={fetchData}
        comboMode={isComboMode}
      />

      {/* Phase 7.1: Branch Overrides Dialog — per-branch price + 86'd items */}
      {branchOverridesItemId && (
        <BranchOverridesDialog
          open={isBranchOverridesDialogOpen}
          onOpenChange={(open) => {
            setIsBranchOverridesDialogOpen(open);
            if (!open) setBranchOverridesItemId(null);
          }}
          restaurantId={restaurantId}
          menuItemId={branchOverridesItemId}
          menuItemName={menuItems.find((i) => i.id === branchOverridesItemId)?.name || ''}
          basePriceCents={menuItems.find((i) => i.id === branchOverridesItemId)?.priceCents || 0}
        />
      )}
    </div>
  );
}
