'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { api, formatCurrency } from '@/lib/api-client';
import { useBranchChange } from '@/hooks/use-branch-change';
import {
  Package,
  Plus,
  Loader2,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Filter,
  Search,
  ArrowUpCircle,
  Pencil,
  Trash2,
  PackageX,
  TrendingDown,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================
// Types
// ============================================================

type StockStatus = 'ok' | 'low' | 'out';

interface InventoryItemData {
  id: string;
  restaurantId: string;
  name: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  costPerUnit: number;
  supplier: string | null;
  lastRestocked: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Config
// ============================================================

const statusConfig: Record<StockStatus, { label: string; color: string; icon: React.ElementType; dotColor: string }> = {
  ok: {
    label: 'In Stock',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    icon: CheckCircle2,
    dotColor: 'bg-emerald-500',
  },
  low: {
    label: 'Low Stock',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    icon: AlertTriangle,
    dotColor: 'bg-amber-500',
  },
  out: {
    label: 'Out of Stock',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    icon: XCircle,
    dotColor: 'bg-red-500',
  },
};

const unitLabels: Record<string, string> = {
  pcs: 'Pieces',
  kg: 'Kilograms',
  liter: 'Liters',
  g: 'Grams',
  ml: 'Milliliters',
  box: 'Boxes',
  bag: 'Bags',
  bottle: 'Bottles',
  can: 'Cans',
  pack: 'Packs',
};

function getStockStatus(item: InventoryItemData): StockStatus {
  if (item.currentStock === 0) return 'out';
  if (item.currentStock <= item.minimumStock) return 'low';
  return 'ok';
}

// ============================================================
// Component
// ============================================================

export function InventoryView() {
  const { user, selectedBranchId, branchChangeVersion } = useAppStore();
  const restaurantId = user?.restaurantId || '';

  const [items, setItems] = useState<InventoryItemData[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStatus, setFilterStatus] = useState<StockStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDataRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const handleBranchChange = useCallback((newBranchId: string) => {
    console.log('[InventoryView] handleBranchChange called with:', newBranchId);
    setLoading(true);
    setItems([]);
    fetchDataRef.current?.();
  }, []);

  useBranchChange(handleBranchChange);

  // Dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItemData | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formUnit, setFormUnit] = useState('pcs');
  const [formCurrentStock, setFormCurrentStock] = useState('0');
  const [formMinimumStock, setFormMinimumStock] = useState('0');
  const [formCostPerUnit, setFormCostPerUnit] = useState('0');
  const [formSupplier, setFormSupplier] = useState('');
  const [restockAmount, setRestockAmount] = useState('');
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setFormName('');
    setFormUnit('pcs');
    setFormCurrentStock('0');
    setFormMinimumStock('0');
    setFormCostPerUnit('0');
    setFormSupplier('');
    setRestockAmount('');
    setActiveItemId(null);
  }, []);

  const fetchData = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const branchId = useAppStore.getState().selectedBranchId;
      const params: Record<string, string> = {};
      if (branchId) params.branchId = branchId;
      const res = await api.get<{ data: InventoryItemData[] }>(
        `/api/restaurants/${restaurantId}/inventory`,
        params
      );
      setItems(res.data || []);
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchDataRef.current = fetchData; }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData, selectedBranchId, branchChangeVersion]);

  // Reset loading state when branch changes
  useEffect(() => {
    if (selectedBranchId !== undefined) {
      setLoading(true);
    }
  }, [selectedBranchId]);

  // Stats
  const totalItems = items.length;
  const lowStockCount = items.filter((i) => getStockStatus(i) === 'low').length;
  const outOfStockCount = items.filter((i) => getStockStatus(i) === 'out').length;
  const totalValue = items.reduce((sum, i) => sum + i.currentStock * i.costPerUnit, 0);

  // Filtered items
  const filtered = items.filter((item) => {
    const status = getStockStatus(item);
    if (filterStatus !== 'all' && status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.supplier && item.supplier.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Sort: out of stock first, then low, then ok
  const sorted = [...filtered].sort((a, b) => {
    const statusOrder = { out: 0, low: 1, ok: 2 };
    const aStatus = getStockStatus(a);
    const bStatus = getStockStatus(b);
    if (statusOrder[aStatus] !== statusOrder[bStatus]) {
      return statusOrder[aStatus] - statusOrder[bStatus];
    }
    return a.name.localeCompare(b.name);
  });

  // Create item
  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error('Item name is required');
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/api/restaurants/${restaurantId}/inventory`, {
        name: formName.trim(),
        unit: formUnit,
        currentStock: parseFloat(formCurrentStock) || 0,
        minimumStock: parseFloat(formMinimumStock) || 0,
        costPerUnit: parseFloat(formCostPerUnit) || 0,
        supplier: formSupplier.trim() || null,
        ...(useAppStore.getState().selectedBranchId ? { branchId: useAppStore.getState().selectedBranchId } : {}),
      });
      toast.success('Inventory item created successfully');
      setIsCreateOpen(false);
      resetForm();
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create item';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Restock item
  const handleRestock = async () => {
    if (!activeItemId) return;
    const amount = parseFloat(restockAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid restock quantity');
      return;
    }

    try {
      setSubmitting(true);
      await api.put(`/api/restaurants/${restaurantId}/inventory/${activeItemId}`, {
        restockAmount: amount,
      });
      toast.success('Item restocked successfully');
      setIsRestockOpen(false);
      resetForm();
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to restock item';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Edit item
  const handleEdit = async () => {
    if (!activeItemId) return;
    if (!formName.trim()) {
      toast.error('Item name is required');
      return;
    }

    try {
      setSubmitting(true);
      await api.put(`/api/restaurants/${restaurantId}/inventory/${activeItemId}`, {
        name: formName.trim(),
        unit: formUnit,
        minimumStock: parseFloat(formMinimumStock) || 0,
        costPerUnit: parseFloat(formCostPerUnit) || 0,
        supplier: formSupplier.trim() || null,
      });
      toast.success('Inventory item updated successfully');
      setIsEditOpen(false);
      resetForm();
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update item';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete item
  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await api.delete(`/api/restaurants/${restaurantId}/inventory/${deleteTarget.id}`);
      toast.success('Inventory item removed');
      setDeleteTarget(null);
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete item';
      toast.error(msg);
    }
  };

  // Open restock dialog
  const openRestock = (item: InventoryItemData) => {
    setActiveItemId(item.id);
    setRestockAmount('');
    setIsRestockOpen(true);
  };

  // Open edit dialog
  const openEdit = (item: InventoryItemData) => {
    setActiveItemId(item.id);
    setFormName(item.name);
    setFormUnit(item.unit);
    setFormCurrentStock(item.currentStock.toString());
    setFormMinimumStock(item.minimumStock.toString());
    setFormCostPerUnit(item.costPerUnit.toString());
    setFormSupplier(item.supplier || '');
    setIsEditOpen(true);
  };

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Stock bar percentage
  const stockPercentage = (item: InventoryItemData) => {
    if (item.minimumStock === 0) return 100;
    const pct = (item.currentStock / item.minimumStock) * 100;
    return Math.min(Math.max(pct, 0), 200);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <span className="ml-2 text-muted-foreground">Loading inventory...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{totalItems}</p>
            <p className="text-[11px] text-muted-foreground">Total Items</p>
          </CardContent>
        </Card>
        <Card className={lowStockCount > 0 ? 'border-amber-200 dark:border-amber-800' : ''}>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{lowStockCount}</p>
            <p className="text-[11px] text-muted-foreground">Low Stock</p>
          </CardContent>
        </Card>
        <Card className={outOfStockCount > 0 ? 'border-red-200 dark:border-red-800' : ''}>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{outOfStockCount}</p>
            <p className="text-[11px] text-muted-foreground">Out of Stock</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
            <p className="text-[11px] text-muted-foreground">Stock Value</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:flex-none sm:w-52">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search inventory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
          {/* Status filter */}
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as StockStatus | 'all')}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <Filter className="h-3.5 w-3.5 mr-1" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="ok">In Stock</SelectItem>
              <SelectItem value="low">Low Stock</SelectItem>
              <SelectItem value="out">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button className="gap-1.5 shrink-0" onClick={() => { resetForm(); setIsCreateOpen(true); }}>
          <Plus className="h-4 w-4" />
          Add Item
        </Button>
      </div>

      {/* Inventory List */}
      {sorted.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((item) => {
            const status = getStockStatus(item);
            const sConfig = statusConfig[status];
            const StatusIcon = sConfig.icon;
            const pct = stockPercentage(item);

            return (
              <Card
                key={item.id}
                className={`hover:shadow-md transition-shadow ${
                  status === 'out'
                    ? 'border-red-200 dark:border-red-800/50'
                    : status === 'low'
                    ? 'border-amber-200 dark:border-amber-800/50'
                    : ''
                }`}
              >
                <CardContent className="p-4">
                  {/* Top Row: Name + Status */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${
                        status === 'out'
                          ? 'bg-red-500/10'
                          : status === 'low'
                          ? 'bg-amber-500/10'
                          : 'bg-emerald-500/10'
                      }`}
                    >
                      <Package
                        className={`h-5 w-5 ${
                          status === 'out'
                            ? 'text-red-600'
                            : status === 'low'
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{item.name}</span>
                        <Badge className={`text-[10px] border-0 ${sConfig.color}`}>
                          {sConfig.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {unitLabels[item.unit] || item.unit}
                        </span>
                        {item.supplier && (
                          <>
                            <span className="text-[10px] text-muted-foreground">·</span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                              {item.supplier}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stock Level */}
                  <div className="mt-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xl font-bold">
                        {item.currentStock % 1 === 0 ? item.currentStock : item.currentStock.toFixed(2)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        min: {item.minimumStock % 1 === 0 ? item.minimumStock : item.minimumStock.toFixed(2)}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          status === 'out'
                            ? 'bg-red-500'
                            : status === 'low'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Cost & Last Restocked */}
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {item.costPerUnit > 0
                        ? `${formatCurrency(item.costPerUnit)}/${item.unit}`
                        : '—'}
                    </span>
                    {item.lastRestocked && (
                      <span className="text-[10px]">Restocked: {formatDate(item.lastRestocked)}</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex items-center gap-2 border-t pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] gap-1 flex-1"
                      onClick={() => openRestock(item)}
                    >
                      <ArrowUpCircle className="h-3 w-3" />
                      Restock
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => openEdit(item)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(item)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <PackageX className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No inventory items yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add items to start tracking stock levels
            </p>
            <Button className="mt-4" size="sm" onClick={() => { resetForm(); setIsCreateOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Filter className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No items match your filters</p>
            <Button
              variant="outline"
              className="mt-4"
              size="sm"
              onClick={() => {
                setFilterStatus('all');
                setSearchQuery('');
              }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Item Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Add Inventory Item
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="itemName">Item Name *</Label>
              <Input
                id="itemName"
                placeholder="e.g. Onion, Berbere, Butter"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="itemUnit">Unit</Label>
                <Select value={formUnit} onValueChange={setFormUnit}>
                  <SelectTrigger id="itemUnit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                    <SelectItem value="kg">Kilograms (kg)</SelectItem>
                    <SelectItem value="g">Grams (g)</SelectItem>
                    <SelectItem value="liter">Liters (L)</SelectItem>
                    <SelectItem value="ml">Milliliters (ml)</SelectItem>
                    <SelectItem value="box">Boxes</SelectItem>
                    <SelectItem value="bag">Bags</SelectItem>
                    <SelectItem value="bottle">Bottles</SelectItem>
                    <SelectItem value="can">Cans</SelectItem>
                    <SelectItem value="pack">Packs</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="itemStock">Current Stock</Label>
                <Input
                  id="itemStock"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formCurrentStock}
                  onChange={(e) => setFormCurrentStock(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="itemMinStock">Min. Stock Threshold</Label>
                <Input
                  id="itemMinStock"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formMinimumStock}
                  onChange={(e) => setFormMinimumStock(e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="itemCost">Cost per Unit (ETB)</Label>
                <Input
                  id="itemCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formCostPerUnit}
                  onChange={(e) => setFormCostPerUnit(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemSupplier">Supplier (optional)</Label>
              <Input
                id="itemSupplier"
                placeholder="e.g. Local Market, ABC Foods"
                value={formSupplier}
                onChange={(e) => setFormSupplier(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting || !formName.trim()}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restock Dialog */}
      <Dialog open={isRestockOpen} onOpenChange={(open) => { setIsRestockOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-primary" />
              Restock Item
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {activeItemId && (() => {
              const item = items.find((i) => i.id === activeItemId);
              if (!item) return null;
              return (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Item</span>
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Current Stock</span>
                    <span className="font-medium">
                      {item.currentStock % 1 === 0 ? item.currentStock : item.currentStock.toFixed(2)} {item.unit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Minimum</span>
                    <span className="font-medium">
                      {item.minimumStock % 1 === 0 ? item.minimumStock : item.minimumStock.toFixed(2)} {item.unit}
                    </span>
                  </div>
                </div>
              );
            })()}
            <div className="space-y-2">
              <Label htmlFor="restockAmount">Quantity to Add *</Label>
              <Input
                id="restockAmount"
                type="number"
                min="0.01"
                step="0.01"
                value={restockAmount}
                onChange={(e) => setRestockAmount(e.target.value)}
                placeholder="Enter quantity to add"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsRestockOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleRestock} disabled={submitting || !restockAmount || parseFloat(restockAmount) <= 0}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowUpCircle className="h-4 w-4 mr-2" />}
              Restock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Edit Inventory Item
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Item Name *</Label>
              <Input
                id="editName"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="editUnit">Unit</Label>
                <Select value={formUnit} onValueChange={setFormUnit}>
                  <SelectTrigger id="editUnit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                    <SelectItem value="kg">Kilograms (kg)</SelectItem>
                    <SelectItem value="g">Grams (g)</SelectItem>
                    <SelectItem value="liter">Liters (L)</SelectItem>
                    <SelectItem value="ml">Milliliters (ml)</SelectItem>
                    <SelectItem value="box">Boxes</SelectItem>
                    <SelectItem value="bag">Bags</SelectItem>
                    <SelectItem value="bottle">Bottles</SelectItem>
                    <SelectItem value="can">Cans</SelectItem>
                    <SelectItem value="pack">Packs</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editMinStock">Min. Stock Threshold</Label>
                <Input
                  id="editMinStock"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formMinimumStock}
                  onChange={(e) => setFormMinimumStock(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="editCost">Cost per Unit (ETB)</Label>
                <Input
                  id="editCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formCostPerUnit}
                  onChange={(e) => setFormCostPerUnit(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editSupplier">Supplier</Label>
                <Input
                  id="editSupplier"
                  value={formSupplier}
                  onChange={(e) => setFormSupplier(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={submitting || !formName.trim()}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Pencil className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Inventory Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deleteTarget?.name}</strong> from your inventory?
              This will mark the item as inactive. You can also permanently delete it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
