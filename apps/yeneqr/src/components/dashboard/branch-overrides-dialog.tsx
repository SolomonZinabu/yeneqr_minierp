'use client';

// ============================================================
// Yene QR — Branch Overrides Dialog (Phase 7.1)
// ============================================================
// Manages MenuItemBranchOverride rows for a single menu item.
// Lets managers set per-branch price overrides and 86 items per branch.
// Implements the Toast LSP (Location-Specific Pricing) pattern in the UI.
//
// Usage:
//   <BranchOverridesDialog
//     open={open}
//     onOpenChange={setOpen}
//     restaurantId={restaurantId}
//     menuItemId={item.id}
//     menuItemName={item.name}
//     basePriceCents={item.priceCents}
//   />
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save, RotateCcw, Globe, Store } from 'lucide-react';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

interface BranchInfo {
  id: string;
  name: string;
  isMainBranch?: boolean;
}

interface BranchOverride {
  id: string;
  menuItemId: string;
  branchId: string;
  priceCents: number | null;
  isAvailable: boolean;
  notes: string | null;
  branch: { id: string; name: string };
}

interface BranchOverridesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  menuItemId: string;
  menuItemName: string;
  basePriceCents: number;
}

// Local editable state per branch
interface EditableOverride {
  branchId: string;
  branchName: string;
  isMainBranch: boolean;
  // Editable fields — empty string means "inherit"
  priceCentsStr: string;
  isAvailable: boolean;
  notes: string;
  // Whether an override row currently exists in the DB
  hasOverride: boolean;
  // Dirty flag — true if user changed anything
  isDirty: boolean;
}

function formatCents(cents: number): string {
  return `ETB ${(cents / 100).toFixed(2)}`;
}

export function BranchOverridesDialog({
  open,
  onOpenChange,
  restaurantId,
  menuItemId,
  menuItemName,
  basePriceCents,
}: BranchOverridesDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [edits, setEdits] = useState<Record<string, EditableOverride>>({});

  // Fetch branches + existing overrides when dialog opens
  const fetchData = useCallback(async () => {
    if (!open || !restaurantId || !menuItemId) return;
    setLoading(true);
    try {
      // Fetch branches and overrides in parallel
      const [branchesRes, overridesRes] = await Promise.all([
        api.get<{ data: BranchInfo[] }>(`/api/restaurants/${restaurantId}/branches`),
        api.get<{ data: BranchOverride[]; menuItem: { basePriceCents: number } }>(
          `/api/restaurants/${restaurantId}/items/${menuItemId}/branch-overrides`
        ),
      ]);

      const branchList = branchesRes.data || [];
      const overrideList = overridesRes.data || [];
      setBranches(branchList);

      // Build editable state for each branch
      const editMap: Record<string, EditableOverride> = {};
      for (const branch of branchList) {
        const existing = overrideList.find((o) => o.branchId === branch.id);
        editMap[branch.id] = {
          branchId: branch.id,
          branchName: branch.name,
          isMainBranch: branch.isMainBranch || false,
          priceCentsStr: existing?.priceCents !== null && existing?.priceCents !== undefined
            ? (existing.priceCents / 100).toString()
            : '',
          isAvailable: existing ? existing.isAvailable : true,
          notes: existing?.notes || '',
          hasOverride: !!existing,
          isDirty: false,
        };
      }
      setEdits(editMap);
    } catch (err) {
      console.error('[BRANCH_OVERRIDES_FETCH]', err);
      toast.error('Failed to load branch overrides');
    } finally {
      setLoading(false);
    }
  }, [open, restaurantId, menuItemId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update a single branch's editable field
  const updateField = (branchId: string, field: keyof EditableOverride, value: string | boolean) => {
    setEdits((prev) => ({
      ...prev,
      [branchId]: {
        ...prev[branchId],
        [field]: value,
        isDirty: true,
      },
    }));
  };

  // Save all dirty branches
  const handleSave = async () => {
    const dirtyBranches = Object.values(edits).filter((e) => e.isDirty);
    if (dirtyBranches.length === 0) {
      toast.info('No changes to save');
      return;
    }

    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const edit of dirtyBranches) {
      try {
        // Parse priceCents: empty string = null (inherit), otherwise parse as ETB → cents
        const priceCentsNum = edit.priceCentsStr.trim() === ''
          ? null
          : Math.round(parseFloat(edit.priceCentsStr) * 100);

        if (edit.priceCentsStr.trim() !== '' && (isNaN(priceCentsNum as number) || (priceCentsNum as number) < 0)) {
          toast.error(`Invalid price for ${edit.branchName}`);
          errorCount++;
          continue;
        }

        await api.put(
          `/api/restaurants/${restaurantId}/items/${menuItemId}/branch-overrides`,
          {
            branchId: edit.branchId,
            priceCents: priceCentsNum,
            isAvailable: edit.isAvailable,
            notes: edit.notes.trim() || null,
          }
        );
        successCount++;
      } catch (err) {
        console.error('[BRANCH_OVERRIDE_SAVE]', err);
        errorCount++;
      }
    }

    setSaving(false);

    if (successCount > 0 && errorCount === 0) {
      toast.success(`Saved overrides for ${successCount} branch${successCount > 1 ? 'es' : ''}`);
      // Mark all as clean
      setEdits((prev) => {
        const next = { ...prev };
        for (const id of Object.keys(next)) {
          next[id] = { ...next[id], isDirty: false, hasOverride: true };
        }
        return next;
      });
    } else if (successCount > 0 && errorCount > 0) {
      toast.warning(`Saved ${successCount}, failed ${errorCount}`);
    } else if (errorCount > 0) {
      toast.error(`Failed to save ${errorCount} override(s)`);
    }
  };

  // Reset a single branch to inherit (delete the override)
  const handleReset = async (branchId: string) => {
    const edit = edits[branchId];
    if (!edit) return;

    try {
      await api.delete(
        `/api/restaurants/${restaurantId}/items/${menuItemId}/branch-overrides?branchId=${branchId}`
      );
      toast.success(`${edit.branchName} reset to inherit restaurant defaults`);
      // Reset local state
      setEdits((prev) => ({
        ...prev,
        [branchId]: {
          ...prev[branchId],
          priceCentsStr: '',
          isAvailable: true,
          notes: '',
          hasOverride: false,
          isDirty: false,
        },
      }));
    } catch (err) {
      console.error('[BRANCH_OVERRIDE_RESET]', err);
      toast.error(`Failed to reset ${edit.branchName}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Branch Overrides — {menuItemName}
          </DialogTitle>
          <DialogDescription>
            Set per-branch pricing and availability. Empty price = inherit restaurant default ({formatCents(basePriceCents)}).
            Toggle off = 86&apos;d at that branch (hidden from customers there).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : branches.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No branches found. Create branches first in the Branches tab.
          </div>
        ) : (
          <div className="space-y-3">
            {/* Base price hint */}
            <div className="rounded-md bg-muted/50 px-3 py-2 flex items-center gap-2 text-xs">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Restaurant base price:</span>
              <span className="font-medium">{formatCents(basePriceCents)}</span>
              <span className="text-muted-foreground ml-auto">Used when a branch has no override</span>
            </div>

            <Separator />

            {/* Per-branch editors */}
            {branches.map((branch) => {
              const edit = edits[branch.id];
              if (!edit) return null;
              return (
                <div
                  key={branch.id}
                  className={`rounded-lg border p-3 space-y-3 ${edit.isDirty ? 'border-primary/40 bg-primary/5' : ''}`}
                >
                  {/* Branch header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{branch.name}</span>
                      {branch.isMainBranch && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">Main</Badge>
                      )}
                      {edit.hasOverride && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-600 border-amber-300">
                          Override active
                        </Badge>
                      )}
                    </div>
                    {edit.hasOverride && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleReset(branch.id)}
                        title="Reset to inherit restaurant defaults"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Reset
                      </Button>
                    )}
                  </div>

                  {/* Editable grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Price */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Price (ETB) — empty = {formatCents(basePriceCents)}
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={formatCents(basePriceCents)}
                        value={edit.priceCentsStr}
                        onChange={(e) => updateField(branch.id, 'priceCentsStr', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>

                    {/* Availability */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Available at this branch</Label>
                      <div className="flex items-center gap-2 h-8">
                        <Switch
                          checked={edit.isAvailable}
                          onCheckedChange={(checked) => updateField(branch.id, 'isAvailable', checked)}
                        />
                        <span className="text-xs text-muted-foreground">
                          {edit.isAvailable ? 'Visible to customers' : '86\'d (hidden)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Notes (staff-only, e.g., &ldquo;out until tomorrow&rdquo;)
                    </Label>
                    <Textarea
                      placeholder="Optional reason for 86 or price change"
                      value={edit.notes}
                      onChange={(e) => updateField(branch.id, 'notes', e.target.value)}
                      className="text-xs min-h-[40px] resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
