'use client';

// ============================================================
// BRANCH SCOPING NOTE (Phase 4.5 of multi-branch audit)
// ============================================================
// This view intentionally does NOT use `useBranchChange` or pass
// `?branchId=` to API calls. Promotions are restaurant-level entities
// (the Promotion model in prisma/schema.prisma has no branchId field) —
// they apply across all branches of a restaurant. If a future product
// decision makes promotions branch-scoped (e.g., branch-specific happy
// hour), add a branchId column to the Promotion model and update this
// view + the promotions API routes.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { formatCents, discountFromCents } from '@/lib/money';
import {
  Tag,
  Plus,
  Loader2,
  Percent,
  DollarSign,
  Gift,
  Clock,
  Ticket,
  Calendar,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Copy,
  Filter,
  Sparkles,
  Search,
  Store,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { PromotionBranchAssignmentsDialog } from '@/components/dashboard/promotion-branch-assignments-dialog';

// ============================================================
// Types
// ============================================================

type PromotionType = 'discount' | 'coupon' | 'combo_offer' | 'happy_hour';
type DiscountType = 'percentage' | 'fixed';
type PromotionStatus = 'active' | 'expired' | 'scheduled' | 'inactive';

interface PromotionData {
  id: string;
  restaurantId: string;
  name: string;
  nameAm?: string | null;
  nameI18n?: string | null;
  description?: string | null;
  descriptionAm?: string | null;
  descriptionI18n?: string | null;
  type: PromotionType;
  code?: string | null;
  discountType: DiscountType;
  discountValueCents: number;
  minimumOrderCents: number;
  maxDiscountCents?: number | null;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  usageLimit?: number | null;
  usageCount: number;
  perCustomerLimit?: number | null;
  applicableItems?: string | null;
  schedule?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Config
// ============================================================

const typeConfig: Record<PromotionType, { label: string; color: string; icon: React.ElementType }> = {
  discount: {
    label: 'Discount',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    icon: Percent,
  },
  coupon: {
    label: 'Coupon',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    icon: Ticket,
  },
  combo_offer: {
    label: 'Combo Offer',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    icon: Gift,
  },
  happy_hour: {
    label: 'Happy Hour',
    color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
    icon: Clock,
  },
};

function getStatus(promotion: PromotionData): PromotionStatus {
  const now = new Date();
  const from = new Date(promotion.validFrom);
  const until = new Date(promotion.validUntil);

  if (!promotion.isActive) return 'inactive';
  if (until < now) return 'expired';
  if (from > now) return 'scheduled';
  return 'active';
}

const statusConfig: Record<PromotionStatus, { label: string; color: string }> = {
  active: {
    label: 'Active',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  expired: {
    label: 'Expired',
    color: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
  },
  scheduled: {
    label: 'Scheduled',
    color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  },
  inactive: {
    label: 'Inactive',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
};

// ============================================================
// Component
// ============================================================

export function PromotionsView() {
  const { user } = useAppStore();
  const restaurantId = user?.restaurantId || '';

  const [promotions, setPromotions] = useState<PromotionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PromotionData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PromotionData | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  // Phase 7.2: branch assignments dialog state
  const [assignmentsTarget, setAssignmentsTarget] = useState<PromotionData | null>(null);

  // ── Edit-form state (separate from create-form state) ──
  const [editName, setEditName] = useState('');
  const [editNameAm, setEditNameAm] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDiscountValue, setEditDiscountValue] = useState('');
  const [editMinimumOrder, setEditMinimumOrder] = useState('0');
  const [editMaxDiscount, setEditMaxDiscount] = useState('');
  const [editValidFrom, setEditValidFrom] = useState('');
  const [editValidUntil, setEditValidUntil] = useState('');
  const [editUsageLimit, setEditUsageLimit] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  // Convert an ISO datetime to the 'yyyy-MM-ddTHH:mm' format that <input type="datetime-local"> expects
  const isoToLocalInput = (iso: string): string => {
    try {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  };

  // Pre-fill the edit form from a promotion
  const openEditDialog = (promo: PromotionData) => {
    setEditTarget(promo);
    setEditName(promo.name || '');
    setEditNameAm(promo.nameAm || '');
    setEditDescription(promo.description || '');
    // For percentage: value is stored as cents where 100% = 10000 cents → value = cents/100
    // For fixed: value is stored as cents → value = cents/100 (ETB)
    const raw = promo.discountValueCents != null ? promo.discountValueCents / 100 : 0;
    setEditDiscountValue(String(raw));
    setEditMinimumOrder(promo.minimumOrderCents ? String(promo.minimumOrderCents / 100) : '0');
    setEditMaxDiscount(promo.maxDiscountCents ? String(promo.maxDiscountCents / 100) : '');
    setEditValidFrom(isoToLocalInput(promo.validFrom));
    setEditValidUntil(isoToLocalInput(promo.validUntil));
    setEditUsageLimit(promo.usageLimit != null ? String(promo.usageLimit) : '');
    setEditIsActive(promo.isActive);
  };

  const closeEditDialog = () => {
    setEditTarget(null);
    setEditName('');
    setEditNameAm('');
    setEditDescription('');
    setEditDiscountValue('');
    setEditMinimumOrder('0');
    setEditMaxDiscount('');
    setEditValidFrom('');
    setEditValidUntil('');
    setEditUsageLimit('');
    setEditIsActive(true);
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    if (!editName.trim()) {
      toast.error('Promotion name is required');
      return;
    }
    if (!editDiscountValue || parseFloat(editDiscountValue) <= 0) {
      toast.error('Discount value must be greater than 0');
      return;
    }
    if (!editValidFrom || !editValidUntil) {
      toast.error('Valid from and valid until dates are required');
      return;
    }
    if (new Date(editValidUntil) <= new Date(editValidFrom)) {
      toast.error('Valid until must be after valid from');
      return;
    }
    if (editTarget.discountType === 'percentage' && parseFloat(editDiscountValue) > 100) {
      toast.error('Percentage discount cannot exceed 100%');
      return;
    }

    try {
      setSaving(true);
      await api.patch(`/api/restaurants/${restaurantId}/promotions/${editTarget.id}`, {
        name: editName.trim(),
        nameAm: editNameAm.trim() || null,
        description: editDescription.trim() || null,
        discountValue: parseFloat(editDiscountValue),
        minimumOrder: parseFloat(editMinimumOrder) || 0,
        maxDiscount: editMaxDiscount ? parseFloat(editMaxDiscount) : null,
        validFrom: new Date(editValidFrom).toISOString(),
        validUntil: new Date(editValidUntil).toISOString(),
        usageLimit: editUsageLimit ? parseInt(editUsageLimit, 10) : null,
        isActive: editIsActive,
      });
      toast.success(`"${editName}" updated successfully`);
      closeEditDialog();
      fetchPromotions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update promotion';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Filters
  const [filterType, setFilterType] = useState<PromotionType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<PromotionStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formName, setFormName] = useState('');
  const [formNameAm, setFormNameAm] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<PromotionType>('discount');
  const [formCode, setFormCode] = useState('');
  const [formDiscountType, setFormDiscountType] = useState<DiscountType>('percentage');
  const [formDiscountValue, setFormDiscountValue] = useState('');
  const [formMinimumOrder, setFormMinimumOrder] = useState('0');
  const [formMaxDiscount, setFormMaxDiscount] = useState('');
  const [formValidFrom, setFormValidFrom] = useState('');
  const [formValidUntil, setFormValidUntil] = useState('');
  const [formUsageLimit, setFormUsageLimit] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  const resetForm = useCallback(() => {
    setFormName('');
    setFormNameAm('');
    setFormDescription('');
    setFormType('discount');
    setFormCode('');
    setFormDiscountType('percentage');
    setFormDiscountValue('');
    setFormMinimumOrder('0');
    setFormMaxDiscount('');
    setFormValidFrom('');
    setFormValidUntil('');
    setFormUsageLimit('');
    setFormIsActive(true);
  }, []);

  const fetchPromotions = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const res = await api.get<{ data: PromotionData[]; pagination?: { total: number } }>(
        `/api/restaurants/${restaurantId}/promotions`,
      );
      setPromotions(res.data || []);
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  // Filtered list
  const filtered = promotions.filter((p) => {
    if (filterType !== 'all' && p.type !== filterType) return false;
    if (filterStatus !== 'all' && getStatus(p) !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Stats
  const activeCount = promotions.filter((p) => getStatus(p) === 'active').length;
  const scheduledCount = promotions.filter((p) => getStatus(p) === 'scheduled').length;
  const expiredCount = promotions.filter((p) => getStatus(p) === 'expired').length;

  // Create promotion
  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error('Promotion name is required');
      return;
    }
    if (!formDiscountValue || parseFloat(formDiscountValue) <= 0) {
      toast.error('Discount value must be greater than 0');
      return;
    }
    if (!formValidFrom || !formValidUntil) {
      toast.error('Valid from and valid until dates are required');
      return;
    }
    if (new Date(formValidUntil) <= new Date(formValidFrom)) {
      toast.error('Valid until must be after valid from');
      return;
    }
    if (formType === 'coupon' && !formCode.trim()) {
      toast.error('Coupon code is required for coupon type');
      return;
    }
    if (formDiscountType === 'percentage' && parseFloat(formDiscountValue) > 100) {
      toast.error('Percentage discount cannot exceed 100%');
      return;
    }

    try {
      setCreating(true);
      await api.post(`/api/restaurants/${restaurantId}/promotions`, {
        name: formName.trim(),
        nameAm: formNameAm.trim() || null,
        description: formDescription.trim() || null,
        type: formType,
        code: formCode.trim() || null,
        discountType: formDiscountType,
        // API expects RAW discountValue (e.g. 20 for 20%), not cents.
        // The API converts to cents internally via discountToCents().
        discountValue: parseFloat(formDiscountValue),
        minimumOrder: parseFloat(formMinimumOrder) || 0,
        maxDiscount: formMaxDiscount ? parseFloat(formMaxDiscount) : null,
        validFrom: new Date(formValidFrom).toISOString(),
        validUntil: new Date(formValidUntil).toISOString(),
        isActive: formIsActive,
        usageLimit: formUsageLimit ? parseInt(formUsageLimit, 10) : null,
      });
      toast.success(`Promotion "${formName}" created successfully`);
      setIsCreateOpen(false);
      resetForm();
      fetchPromotions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create promotion';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  // Toggle active/inactive
  const handleToggle = async (promotion: PromotionData) => {
    try {
      setTogglingId(promotion.id);
      await api.patch(`/api/restaurants/${restaurantId}/promotions/${promotion.id}`, {
        isActive: !promotion.isActive,
      });
      toast.success(
        promotion.isActive
          ? `"${promotion.name}" deactivated`
          : `"${promotion.name}" activated`,
      );
      fetchPromotions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update promotion';
      toast.error(msg);
    } finally {
      setTogglingId(null);
    }
  };

  // Delete promotion
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/restaurants/${restaurantId}/promotions/${deleteTarget.id}`);
      toast.success(`"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      fetchPromotions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete promotion';
      toast.error(msg);
      setDeleteTarget(null);
    }
  };

  // Copy code to clipboard
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      toast.success('Code copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy code');
    });
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Generate a random coupon code
  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormCode(code);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <span className="ml-2 text-muted-foreground">Loading promotions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{promotions.length}</p>
            <p className="text-[11px] text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
            <p className="text-[11px] text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-sky-600">{scheduledCount}</p>
            <p className="text-[11px] text-muted-foreground">Scheduled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-gray-500">{expiredCount}</p>
            <p className="text-[11px] text-muted-foreground">Expired</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:flex-none sm:w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search promotions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
          {/* Type filter */}
          <Select value={filterType} onValueChange={(v) => setFilterType(v as PromotionType | 'all')}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <Filter className="h-3.5 w-3.5 mr-1" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {(Object.entries(typeConfig) as [PromotionType, typeof typeConfig[PromotionType]][]).map(
                ([type, config]) => (
                  <SelectItem key={type} value={type}>
                    {config.label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          {/* Status filter */}
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as PromotionStatus | 'all')}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {(Object.entries(statusConfig) as [PromotionStatus, typeof statusConfig[PromotionStatus]][]).map(
                ([status, config]) => (
                  <SelectItem key={status} value={status}>
                    {config.label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
        <Button className="gap-1.5 shrink-0" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New Promotion
        </Button>
      </div>

      {/* Promotions List */}
      {filtered.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((promo) => {
            const status = getStatus(promo);
            const sConfig = statusConfig[status];
            const tConfig = typeConfig[promo.type as PromotionType] || typeConfig.discount;
            const TypeIcon = tConfig.icon;
            const isToggling = togglingId === promo.id;

            return (
              <Card key={promo.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  {/* Top Row: Type icon + Name + Status */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${
                        status === 'active'
                          ? 'bg-emerald-500/10'
                          : status === 'scheduled'
                          ? 'bg-sky-500/10'
                          : 'bg-muted'
                      }`}
                    >
                      <TypeIcon
                        className={`h-5 w-5 ${
                          status === 'active'
                            ? 'text-emerald-600'
                            : status === 'scheduled'
                            ? 'text-sky-600'
                            : 'text-muted-foreground'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{promo.name}</span>
                        <Badge className={`text-[10px] border-0 ${sConfig.color}`}>
                          {sConfig.label}
                        </Badge>
                      </div>
                      <Badge className={`text-[10px] border-0 mt-1 ${tConfig.color}`}>
                        {tConfig.label}
                      </Badge>
                    </div>
                  </div>

                  {/* Discount Value */}
                  <div className="mt-3 flex items-baseline gap-1">
                    {promo.discountType === 'percentage' ? (
                      <>
                        <span className="text-xl font-bold text-primary">
                          {discountFromCents(promo.discountValueCents, 'percentage')}%
                        </span>
                        <span className="text-xs text-muted-foreground">off</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xl font-bold text-primary">
                          {formatCents(promo.discountValueCents)}
                        </span>
                        <span className="text-xs text-muted-foreground">off</span>
                      </>
                    )}
                    {promo.maxDiscountCents && promo.discountType === 'percentage' && (
                      <span className="text-[10px] text-muted-foreground ml-1">
                        (max {formatCents(promo.maxDiscountCents)})
                      </span>
                    )}
                  </div>

                  {/* Coupon Code */}
                  {promo.code && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                        {promo.code}
                      </code>
                      <button
                        onClick={() => handleCopyCode(promo.code!)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy code"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {/* Description */}
                  {promo.description && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                      {promo.description}
                    </p>
                  )}

                  {/* Dates */}
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {formatDate(promo.validFrom)} — {formatDate(promo.validUntil)}
                    </span>
                  </div>

                  {/* Usage & Minimum Order */}
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                    {promo.usageLimit && (
                      <span>
                        {promo.usageCount}/{promo.usageLimit} used
                      </span>
                    )}
                    {promo.minimumOrderCents > 0 && (
                      <span>Min: {formatCents(promo.minimumOrderCents)}</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex items-center justify-between border-t pt-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={promo.isActive}
                        onCheckedChange={() => handleToggle(promo)}
                        disabled={isToggling}
                        className="scale-75"
                      />
                      <span className="text-[11px] text-muted-foreground">
                        {isToggling ? (
                          <Loader2 className="h-3 w-3 animate-spin inline" />
                        ) : promo.isActive ? (
                          'Active'
                        ) : (
                          'Inactive'
                        )}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => openEditDialog(promo)}
                      title="Edit promotion"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => setAssignmentsTarget(promo)}
                      title="Manage branch assignments"
                    >
                      <Store className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(promo)}
                      title="Delete promotion"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : promotions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Sparkles className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No promotions yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create your first promotion to attract more customers
            </p>
            <Button className="mt-4" size="sm" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Promotion
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Filter className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No promotions match your filters</p>
            <Button
              variant="outline"
              className="mt-4"
              size="sm"
              onClick={() => {
                setFilterType('all');
                setFilterStatus('all');
                setSearchQuery('');
              }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Promotion Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              Create Promotion
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="promoName">Promotion Name *</Label>
              <Input
                id="promoName"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Summer Sale, Weekend Special"
              />
            </div>

            {/* Name (Amharic) */}
            <div className="space-y-2">
              <Label htmlFor="promoNameAm">Name (Amharic)</Label>
              <Input
                id="promoNameAm"
                value={formNameAm}
                onChange={(e) => setFormNameAm(e.target.value)}
                placeholder="የስም ስም"
                dir="ltr"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="promoDesc">Description</Label>
              <Textarea
                id="promoDesc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe this promotion..."
                rows={2}
              />
            </div>

            {/* Type & Discount Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Promotion Type *</Label>
                <Select value={formType} onValueChange={(v) => setFormType(v as PromotionType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(typeConfig) as [PromotionType, typeof typeConfig[PromotionType]][]).map(
                      ([type, config]) => (
                        <SelectItem key={type} value={type}>
                          <div className="flex items-center gap-2">
                            <config.icon className="h-3.5 w-3.5" />
                            {config.label}
                          </div>
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discount Type *</Label>
                <Select
                  value={formDiscountType}
                  onValueChange={(v) => setFormDiscountType(v as DiscountType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">
                      <div className="flex items-center gap-2">
                        <Percent className="h-3.5 w-3.5" />
                        Percentage
                      </div>
                    </SelectItem>
                    <SelectItem value="fixed">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-3.5 w-3.5" />
                        Fixed Amount
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Discount Value & Max Discount */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="promoValue">
                  Discount Value * {formDiscountType === 'percentage' ? '(%)' : '(ETB)'}
                </Label>
                <Input
                  id="promoValue"
                  type="number"
                  min="0"
                  max={formDiscountType === 'percentage' ? '100' : undefined}
                  step={formDiscountType === 'percentage' ? '1' : '0.01'}
                  value={formDiscountValue}
                  onChange={(e) => setFormDiscountValue(e.target.value)}
                  placeholder={formDiscountType === 'percentage' ? '10' : '500'}
                />
              </div>
              {formDiscountType === 'percentage' && (
                <div className="space-y-2">
                  <Label htmlFor="promoMaxDiscount">Max Discount (ETB)</Label>
                  <Input
                    id="promoMaxDiscount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formMaxDiscount}
                    onChange={(e) => setFormMaxDiscount(e.target.value)}
                    placeholder="e.g. 1000"
                  />
                </div>
              )}
            </div>

            {/* Coupon Code (only for coupon type) */}
            {formType === 'coupon' && (
              <div className="space-y-2">
                <Label htmlFor="promoCode">Coupon Code *</Label>
                <div className="flex gap-2">
                  <Input
                    id="promoCode"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SUMMER24"
                    className="flex-1 font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto px-3"
                    onClick={generateCode}
                  >
                    Generate
                  </Button>
                </div>
              </div>
            )}

            {/* Minimum Order & Usage Limit */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="promoMinOrder">Minimum Order (ETB)</Label>
                <Input
                  id="promoMinOrder"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formMinimumOrder}
                  onChange={(e) => setFormMinimumOrder(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promoUsageLimit">Usage Limit</Label>
                <Input
                  id="promoUsageLimit"
                  type="number"
                  min="0"
                  value={formUsageLimit}
                  onChange={(e) => setFormUsageLimit(e.target.value)}
                  placeholder="Unlimited"
                />
              </div>
            </div>

            {/* Valid From & Valid Until */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="promoFrom">Valid From *</Label>
                <Input
                  id="promoFrom"
                  type="datetime-local"
                  value={formValidFrom}
                  onChange={(e) => setFormValidFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promoUntil">Valid Until *</Label>
                <Input
                  id="promoUntil"
                  type="datetime-local"
                  value={formValidUntil}
                  onChange={(e) => setFormValidUntil(e.target.value)}
                />
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm">Activate immediately</Label>
                <p className="text-xs text-muted-foreground">
                  Promotion will be active during the validity period
                </p>
              </div>
              <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Create Promotion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Promotion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Phase 7.2: Branch Assignments Dialog — per-branch promotion activation */}
      {assignmentsTarget && (
        <PromotionBranchAssignmentsDialog
          open={!!assignmentsTarget}
          onOpenChange={(open) => { if (!open) setAssignmentsTarget(null); }}
          restaurantId={restaurantId}
          promotionId={assignmentsTarget.id}
          promotionName={assignmentsTarget.name}
          promotionCode={assignmentsTarget.code}
        />
      )}

      {/* Edit Promotion Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) closeEditDialog(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Edit Promotion
            </DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-4">
              {/* Read-only context: type + discount type + code (these cannot be changed after creation) */}
              <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-[10px] border-0 ${typeConfig[editTarget.type as PromotionType]?.color || ''}`}>
                    {typeConfig[editTarget.type as PromotionType]?.label || editTarget.type}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {editTarget.discountType === 'percentage' ? (
                      <><Percent className="h-2.5 w-2.5 mr-1" />Percentage</>
                    ) : (
                      <><DollarSign className="h-2.5 w-2.5 mr-1" />Fixed Amount</>
                    )}
                  </Badge>
                  {editTarget.code && (
                    <code className="rounded bg-background px-1.5 py-0.5 text-[10px] font-mono border">
                      {editTarget.code}
                    </code>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Type, discount type, and coupon code cannot be changed after creation. Delete and recreate to change those.
                </p>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="editName">Promotion Name *</Label>
                <Input
                  id="editName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Summer Sale, Weekend Special"
                />
              </div>

              {/* Name (Amharic) */}
              <div className="space-y-2">
                <Label htmlFor="editNameAm">Name (Amharic)</Label>
                <Input
                  id="editNameAm"
                  value={editNameAm}
                  onChange={(e) => setEditNameAm(e.target.value)}
                  placeholder="የስም ስም"
                  dir="ltr"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="editDesc">Description</Label>
                <Textarea
                  id="editDesc"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Describe this promotion..."
                  rows={2}
                />
              </div>

              {/* Discount Value & Max Discount */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editValue">
                    Discount Value * {editTarget.discountType === 'percentage' ? '(%)' : '(ETB)'}
                  </Label>
                  <Input
                    id="editValue"
                    type="number"
                    min="0"
                    max={editTarget.discountType === 'percentage' ? '100' : undefined}
                    step={editTarget.discountType === 'percentage' ? '1' : '0.01'}
                    value={editDiscountValue}
                    onChange={(e) => setEditDiscountValue(e.target.value)}
                  />
                </div>
                {editTarget.discountType === 'percentage' && (
                  <div className="space-y-2">
                    <Label htmlFor="editMaxDiscount">Max Discount (ETB)</Label>
                    <Input
                      id="editMaxDiscount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editMaxDiscount}
                      onChange={(e) => setEditMaxDiscount(e.target.value)}
                      placeholder="e.g. 1000"
                    />
                  </div>
                )}
              </div>

              {/* Minimum Order & Usage Limit */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editMinOrder">Minimum Order (ETB)</Label>
                  <Input
                    id="editMinOrder"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editMinimumOrder}
                    onChange={(e) => setEditMinimumOrder(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editUsageLimit">Usage Limit</Label>
                  <Input
                    id="editUsageLimit"
                    type="number"
                    min="0"
                    value={editUsageLimit}
                    onChange={(e) => setEditUsageLimit(e.target.value)}
                    placeholder="Unlimited"
                  />
                </div>
              </div>

              {/* Valid From & Valid Until */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editFrom">Valid From *</Label>
                  <Input
                    id="editFrom"
                    type="datetime-local"
                    value={editValidFrom}
                    onChange={(e) => setEditValidFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editUntil">Valid Until *</Label>
                  <Input
                    id="editUntil"
                    type="datetime-local"
                    value={editValidUntil}
                    onChange={(e) => setEditValidUntil(e.target.value)}
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm">Active</Label>
                  <p className="text-xs text-muted-foreground">
                    Promotion will be active during the validity period
                  </p>
                </div>
                <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Pencil className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
