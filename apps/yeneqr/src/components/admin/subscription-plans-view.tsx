'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fromCents } from '@/lib/money';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Star,
  ArrowUp,
  ArrowDown,
  Loader2,
  AlertCircle,
  Search,
  Users,
  CreditCard,
  Crown,
  ToggleLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ==================== Types ====================

interface PlanData {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  priceCents: number;
  yearlyPriceCents?: number | null;
  feeRatePercent?: number;
  features: string[];
  limits: Record<string, unknown>;
  isActive: boolean;
  sortOrder: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  revenueCents: number;
  createdAt: string;
  updatedAt: string;
}

interface PlanFormData {
  name: string;
  slug: string;
  description: string;
  price: string;
  yearlyPrice: string;
  feeRatePercent: string;
  features: string[];
  limits: { maxBranches: string; maxMenuItems: string; maxTables: string; maxStaff: string };
  isActive: boolean;
  sortOrder: string;
  isPopular: boolean;
}

const emptyForm: PlanFormData = {
  name: '',
  slug: '',
  description: '',
  price: '0',
  yearlyPrice: '',
  feeRatePercent: '3.0',
  features: [''],
  limits: { maxBranches: '1', maxMenuItems: '50', maxTables: '5', maxStaff: '3' },
  isActive: true,
  sortOrder: '0',
  isPopular: false,
};

function formatETB(cents: number): string {
  return `${fromCents(cents).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
}

// ==================== Component ====================

export function SubscriptionPlansView() {
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanData | null>(null);
  const [formData, setFormData] = useState<PlanFormData>(emptyForm);
  const [formLoading, setFormLoading] = useState(false);

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; plan: PlanData | null }>({
    open: false,
    plan: null,
  });
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Toggle loading
  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null);

  // ==================== Data Fetching ====================

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: PlanData[]; meta: { totalMRR: number } }>(
        '/api/admin/subscriptions'
      );
      setPlans(Array.isArray(res.data) ? res.data : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load subscription plans';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // ==================== Filtered Plans ====================

  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.slug.toLowerCase().includes(search.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(search.toLowerCase());
      const matchesActive = showInactive || p.isActive;
      return matchesSearch && matchesActive;
    });
  }, [plans, search, showInactive]);

  // ==================== Slug Generation ====================

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  // ==================== Form Handlers ====================

  const openCreateDialog = () => {
    setEditingPlan(null);
    setFormData(emptyForm);
    setFormOpen(true);
  };

  const openEditDialog = (plan: PlanData) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || '',
      price: String(fromCents(plan.priceCents)),
      yearlyPrice: plan.yearlyPriceCents ? String(fromCents(plan.yearlyPriceCents)) : '',
      feeRatePercent: String(plan.feeRatePercent ?? 3.0),
      features: plan.features.length > 0 ? plan.features : [''],
      limits: {
        maxBranches: String((plan.limits as Record<string, unknown>)?.maxBranches || 1),
        maxMenuItems: String((plan.limits as Record<string, unknown>)?.maxMenuItems || 50),
        maxTables: String((plan.limits as Record<string, unknown>)?.maxTables || 5),
        maxStaff: String((plan.limits as Record<string, unknown>)?.maxStaff || 3),
      },
      isActive: plan.isActive,
      sortOrder: String(plan.sortOrder),
      isPopular: Boolean((plan.limits as Record<string, unknown>)?.isPopular),
    });
    setFormOpen(true);
  };

  const handleFormSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Plan name is required');
      return;
    }

    setFormLoading(true);
    try {
      const cleanedFeatures = formData.features.filter((f) => f.trim() !== '');
      const slug = formData.slug || generateSlug(formData.name);
      const limits: Record<string, unknown> = {
        maxBranches: parseInt(formData.limits.maxBranches) || 1,
        maxMenuItems: parseInt(formData.limits.maxMenuItems) || 50,
        maxTables: parseInt(formData.limits.maxTables) || 5,
        maxStaff: parseInt(formData.limits.maxStaff) || 3,
        isPopular: formData.isPopular,
      };

      if (editingPlan) {
        // Update — API expects `price` and `yearlyPrice` in ETB (raw numbers),
        // NOT `priceCents`/`yearlyPriceCents`. The server converts to cents via toCents().
        await api.put(`/api/admin/subscriptions/${editingPlan.id}`, {
          name: formData.name,
          slug,
          description: formData.description || null,
          price: parseFloat(formData.price) || 0,
          yearlyPrice: formData.yearlyPrice ? parseFloat(formData.yearlyPrice) : null,
          feeRatePercent: parseFloat(formData.feeRatePercent) || 3.0,
          features: cleanedFeatures,
          limits,
          isActive: formData.isActive,
          sortOrder: parseInt(formData.sortOrder) || 0,
          isPopular: formData.isPopular,
        });
        toast.success(`"${formData.name}" plan updated`);
      } else {
        // Create — same: send `price` and `yearlyPrice` in ETB
        await api.post('/api/admin/subscriptions', {
          name: formData.name,
          slug,
          description: formData.description || null,
          price: parseFloat(formData.price) || 0,
          yearlyPrice: formData.yearlyPrice ? parseFloat(formData.yearlyPrice) : null,
          feeRatePercent: parseFloat(formData.feeRatePercent) || 3.0,
          features: cleanedFeatures,
          limits,
          isActive: formData.isActive,
          sortOrder: parseInt(formData.sortOrder) || 0,
          isPopular: formData.isPopular,
        });
        toast.success(`"${formData.name}" plan created`);
      }

      setFormOpen(false);
      await fetchPlans();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save plan';
      toast.error(msg);
    } finally {
      setFormLoading(false);
    }
  };

  // ==================== Toggle Active ====================

  const handleToggleActive = async (plan: PlanData) => {
    setToggleLoadingId(plan.id);
    try {
      await api.put(`/api/admin/subscriptions/${plan.id}`, {
        isActive: !plan.isActive,
      });
      toast.success(`${plan.name} ${plan.isActive ? 'deactivated' : 'activated'}`);
      await fetchPlans();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to toggle plan';
      toast.error(msg);
    } finally {
      setToggleLoadingId(null);
    }
  };

  // ==================== Delete ====================

  const handleDelete = async () => {
    const { plan } = deleteDialog;
    if (!plan) return;

    setDeleteLoading(true);
    try {
      await api.delete(`/api/admin/subscriptions/${plan.id}`);
      toast.success(`"${plan.name}" plan deleted`);
      setDeleteDialog({ open: false, plan: null });
      await fetchPlans();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete plan';
      toast.error(msg);
    } finally {
      setDeleteLoading(false);
    }
  };

  // ==================== Reorder ====================

  const handleMoveUp = async (plan: PlanData) => {
    const sorted = [...filteredPlans].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((p) => p.id === plan.id);
    if (idx <= 0) return;

    const prevPlan = sorted[idx - 1];
    // Swap sortOrder
    try {
      await Promise.all([
        api.put(`/api/admin/subscriptions/${plan.id}`, { sortOrder: prevPlan.sortOrder }),
        api.put(`/api/admin/subscriptions/${prevPlan.id}`, { sortOrder: plan.sortOrder }),
      ]);
      await fetchPlans();
      toast.success('Plan order updated');
    } catch (err: unknown) {
      toast.error('Failed to reorder plans');
    }
  };

  const handleMoveDown = async (plan: PlanData) => {
    const sorted = [...filteredPlans].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((p) => p.id === plan.id);
    if (idx >= sorted.length - 1) return;

    const nextPlan = sorted[idx + 1];
    try {
      await Promise.all([
        api.put(`/api/admin/subscriptions/${plan.id}`, { sortOrder: nextPlan.sortOrder }),
        api.put(`/api/admin/subscriptions/${nextPlan.id}`, { sortOrder: plan.sortOrder }),
      ]);
      await fetchPlans();
      toast.success('Plan order updated');
    } catch (err: unknown) {
      toast.error('Failed to reorder plans');
    }
  };

  // ==================== Feature List Helpers ====================

  const addFeature = () => {
    setFormData((prev) => ({ ...prev, features: [...prev.features, ''] }));
  };

  const removeFeature = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index),
    }));
  };

  const updateFeature = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.map((f, i) => (i === index ? value : f)),
    }));
  };

  // ==================== Render ====================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading plans...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchPlans}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Subscription Plans</h2>
          <p className="text-sm text-muted-foreground">
            Manage pricing tiers and feature limits for restaurants
          </p>
        </div>
        <Button className="gap-1.5" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          New Plan
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search plans..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border">
          <Switch
            checked={showInactive}
            onCheckedChange={setShowInactive}
            id="show-inactive"
          />
          <Label htmlFor="show-inactive" className="text-sm cursor-pointer">
            Show inactive
          </Label>
        </div>
      </div>

      {/* Plan Cards */}
      {filteredPlans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              {plans.length === 0
                ? 'No subscription plans yet. Create your first plan.'
                : 'No plans match your search.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filteredPlans
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((plan) => {
                const isPopular = Boolean(
                  (plan.limits as Record<string, unknown>)?.isPopular
                );
                return (
                  <motion.div
                    key={plan.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card
                      className={`relative overflow-hidden h-full flex flex-col ${
                        isPopular ? 'ring-2 ring-primary' : ''
                      } ${!plan.isActive ? 'opacity-60' : ''}`}
                    >
                      {/* Popular Badge */}
                      {isPopular && (
                        <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-bl-lg flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          Popular
                        </div>
                      )}

                      {/* Inactive overlay badge */}
                      {!plan.isActive && (
                        <div className="absolute top-0 left-0 bg-muted text-muted-foreground text-xs font-medium px-3 py-1 rounded-br-lg">
                          Inactive
                        </div>
                      )}

                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{plan.name}</CardTitle>
                            <CardDescription className="text-xs font-mono mt-0.5">
                              {plan.slug}
                            </CardDescription>
                          </div>
                          {/* Reorder Buttons */}
                          <div className="flex flex-col gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleMoveUp(plan)}
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleMoveDown(plan)}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <CardDescription className="mt-2">
                          <span className="text-3xl font-bold text-foreground">
                            {plan.priceCents === 0 ? 'Free' : formatETB(plan.priceCents)}
                          </span>
                          {plan.priceCents > 0 && (
                            <span className="text-sm text-muted-foreground">/mo</span>
                          )}
                          {plan.yearlyPriceCents && plan.yearlyPriceCents > 0 && (
                            <span className="ml-2 text-sm text-muted-foreground">
                              {formatETB(plan.yearlyPriceCents)}/yr
                            </span>
                          )}
                          <span className="ml-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-semibold">
                            {plan.feeRatePercent ?? 3.0}% fee
                          </span>
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="flex-1 flex flex-col space-y-4">
                        {/* Limits Grid */}
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="p-2 rounded-md bg-muted/50">
                            <p className="text-xs text-muted-foreground">Tables</p>
                            <p className="text-sm font-semibold">
                              {(plan.limits as Record<string, unknown>)?.maxTables
                                ? Number((plan.limits as Record<string, unknown>)?.maxTables) >= 999
                                  ? '∞'
                                  : String((plan.limits as Record<string, unknown>)?.maxTables)
                                : '—'}
                            </p>
                          </div>
                          <div className="p-2 rounded-md bg-muted/50">
                            <p className="text-xs text-muted-foreground">Branches</p>
                            <p className="text-sm font-semibold">
                              {(plan.limits as Record<string, unknown>)?.maxBranches
                                ? Number((plan.limits as Record<string, unknown>)?.maxBranches) >= 999
                                  ? '∞'
                                  : String((plan.limits as Record<string, unknown>)?.maxBranches)
                                : '—'}
                            </p>
                          </div>
                          <div className="p-2 rounded-md bg-muted/50">
                            <p className="text-xs text-muted-foreground">Menu Items</p>
                            <p className="text-sm font-semibold">
                              {(plan.limits as Record<string, unknown>)?.maxMenuItems
                                ? Number((plan.limits as Record<string, unknown>)?.maxMenuItems) >= 999
                                  ? '∞'
                                  : String((plan.limits as Record<string, unknown>)?.maxMenuItems)
                                : '—'}
                            </p>
                          </div>
                          <div className="p-2 rounded-md bg-muted/50">
                            <p className="text-xs text-muted-foreground">Staff</p>
                            <p className="text-sm font-semibold">
                              {(plan.limits as Record<string, unknown>)?.maxStaff
                                ? Number((plan.limits as Record<string, unknown>)?.maxStaff) >= 999
                                  ? '∞'
                                  : String((plan.limits as Record<string, unknown>)?.maxStaff)
                                : '—'}
                            </p>
                          </div>
                        </div>

                        <Separator />

                        {/* Features */}
                        <ScrollArea className="max-h-32">
                          <ul className="space-y-1.5">
                            {plan.features.length === 0 && (
                              <li className="text-xs text-muted-foreground italic">
                                No features listed
                              </li>
                            )}
                            {plan.features.map((feature, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </ScrollArea>

                        {/* Subscriber Stats */}
                        <div className="flex items-center justify-between text-sm pt-1">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            <strong>{plan.activeSubscriptions}</strong> active
                          </span>
                          <span className="text-muted-foreground">
                            Rev: <strong>{formatETB(plan.revenueCents)}</strong>
                          </span>
                        </div>

                        {/* Actions */}
                        <Separator />
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1 text-xs h-8"
                            onClick={() => openEditDialog(plan)}
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className={`gap-1 text-xs h-8 ${
                              plan.isActive
                                ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                                : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                            onClick={() => handleToggleActive(plan)}
                            disabled={toggleLoadingId === plan.id}
                          >
                            {toggleLoadingId === plan.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ToggleLeft className="h-3 w-3" />
                            )}
                            {plan.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-8 text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteDialog({ open: true, plan })}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
          </AnimatePresence>
        </div>
      )}

      {/* ==================== Create/Edit Dialog ==================== */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              {editingPlan ? 'Edit Plan' : 'Create New Plan'}
            </DialogTitle>
            <DialogDescription>
              {editingPlan
                ? `Update the ${editingPlan.name} plan configuration`
                : 'Define a new subscription tier for restaurants'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Basic Information
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="plan-name">Plan Name *</Label>
                  <Input
                    id="plan-name"
                    value={formData.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        name,
                        slug: prev.slug || generateSlug(name),
                      }));
                    }}
                    placeholder="e.g. Pro"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-slug">Slug</Label>
                  <Input
                    id="plan-slug"
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, slug: e.target.value }))
                    }
                    placeholder="auto-generated-from-name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-desc">Description</Label>
                <Textarea
                  id="plan-desc"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Plan description..."
                  rows={2}
                />
              </div>
            </div>

            <Separator />

            {/* Pricing */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Pricing
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="plan-price">Monthly Price (ETB) *</Label>
                  <Input
                    id="plan-price"
                    type="number"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, price: e.target.value }))
                    }
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-yearly">Yearly Price (ETB)</Label>
                  <Input
                    id="plan-yearly"
                    type="number"
                    value={formData.yearlyPrice}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, yearlyPrice: e.target.value }))
                    }
                    placeholder="Optional"
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-fee">Fee Rate (%) *</Label>
                  <Input
                    id="plan-fee"
                    type="number"
                    step="0.1"
                    value={formData.feeRatePercent}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, feeRatePercent: e.target.value }))
                    }
                    min="0"
                    max="100"
                    placeholder="3.0"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Per-transaction platform fee. Free=3%, Pro=2%, Premium=1%
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Features */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Features
                </h4>
                <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={addFeature}>
                  <Plus className="h-3 w-3" />
                  Add Feature
                </Button>
              </div>
              <div className="space-y-2">
                {formData.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <Input
                      value={feature}
                      onChange={(e) => updateFeature(i, e.target.value)}
                      placeholder="e.g. Custom branding"
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFeature(i)}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Limits */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Limits
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max-branches">Max Branches</Label>
                  <Input
                    id="max-branches"
                    type="number"
                    value={formData.limits.maxBranches}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        limits: { ...prev.limits, maxBranches: e.target.value },
                      }))
                    }
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-tables">Max Tables</Label>
                  <Input
                    id="max-tables"
                    type="number"
                    value={formData.limits.maxTables}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        limits: { ...prev.limits, maxTables: e.target.value },
                      }))
                    }
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-menu-items">Max Menu Items</Label>
                  <Input
                    id="max-menu-items"
                    type="number"
                    value={formData.limits.maxMenuItems}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        limits: { ...prev.limits, maxMenuItems: e.target.value },
                      }))
                    }
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-staff">Max Staff</Label>
                  <Input
                    id="max-staff"
                    type="number"
                    value={formData.limits.maxStaff}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        limits: { ...prev.limits, maxStaff: e.target.value },
                      }))
                    }
                    min="1"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Settings
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sort-order">Sort Order</Label>
                  <Input
                    id="sort-order"
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, sortOrder: e.target.value }))
                    }
                    min="0"
                  />
                </div>
                <div className="flex flex-col gap-3 justify-center">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="plan-active"
                      checked={formData.isActive}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, isActive: checked }))
                      }
                    />
                    <Label htmlFor="plan-active" className="cursor-pointer">
                      Active
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="plan-popular"
                      checked={formData.isPopular}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, isPopular: checked }))
                      }
                    />
                    <Label htmlFor="plan-popular" className="cursor-pointer">
                      Most Popular
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={formLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleFormSubmit} disabled={formLoading}>
              {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingPlan ? 'Update Plan' : 'Create Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Delete Confirmation ==================== */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, plan: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Plan</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteDialog.plan?.name}&quot;?
              {deleteDialog.plan && deleteDialog.plan.totalSubscriptions > 0 && (
                <span className="block mt-2 text-amber-600 font-medium">
                  This plan has {deleteDialog.plan.totalSubscriptions} subscription(s).
                  You must deactivate it instead of deleting.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, plan: null })}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={
                deleteLoading ||
                (deleteDialog.plan?.totalSubscriptions ?? 0) > 0
              }
            >
              {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
