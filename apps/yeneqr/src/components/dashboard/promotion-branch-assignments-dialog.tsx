'use client';

// ============================================================
// Yene QR — Promotion Branch Assignments Dialog (Phase 7.2)
// ============================================================
// Manages PromotionBranchAssignment rows for a single promotion.
// Lets managers assign a promotion to specific branches.
// Implements the Toast/Square per-location promotion pattern in the UI.
//
// Semantics:
//   - Promotion with ZERO assignments = active at ALL branches (default)
//   - Promotion with 1+ assignments = active ONLY at those branches
//   - Assignment with isActive=false = paused at that branch
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Globe, Store, Tag } from 'lucide-react';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

interface BranchInfo {
  id: string;
  name: string;
  isMainBranch?: boolean;
}

interface BranchAssignment {
  id: string;
  promotionId: string;
  branchId: string;
  isActive: boolean;
  branch: { id: string; name: string };
}

interface PromotionBranchAssignmentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  promotionId: string;
  promotionName: string;
  promotionCode?: string | null;
}

export function PromotionBranchAssignmentsDialog({
  open,
  onOpenChange,
  restaurantId,
  promotionId,
  promotionName,
  promotionCode,
}: PromotionBranchAssignmentsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  // Map of branchId → { isAssigned, isActive, isDirty }
  const [assignmentState, setAssignmentState] = useState<Record<string, { isAssigned: boolean; isActive: boolean; isDirty: boolean }>>({});

  const fetchData = useCallback(async () => {
    if (!open || !restaurantId || !promotionId) return;
    setLoading(true);
    try {
      const [branchesRes, assignmentsRes] = await Promise.all([
        api.get<{ data: BranchInfo[] }>(`/api/restaurants/${restaurantId}/branches`),
        api.get<{ data: BranchAssignment[]; activeEverywhere: boolean }>(
          `/api/restaurants/${restaurantId}/promotions/${promotionId}/branch-assignments`
        ),
      ]);

      const branchList = branchesRes.data || [];
      const assignmentList = assignmentsRes.data || [];
      setBranches(branchList);

      const stateMap: Record<string, { isAssigned: boolean; isActive: boolean; isDirty: boolean }> = {};
      for (const branch of branchList) {
        const existing = assignmentList.find((a) => a.branchId === branch.id);
        stateMap[branch.id] = {
          isAssigned: !!existing,
          isActive: existing?.isActive ?? true,
          isDirty: false,
        };
      }
      setAssignmentState(stateMap);
    } catch (err) {
      console.error('[PROMOTION_ASSIGNMENTS_FETCH]', err);
      toast.error('Failed to load branch assignments');
    } finally {
      setLoading(false);
    }
  }, [open, restaurantId, promotionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const assignedCount = Object.values(assignmentState).filter((s) => s.isAssigned).length;
  const activeEverywhere = assignedCount === 0;

  // Toggle assignment on/off
  const toggleAssignment = async (branchId: string, assign: boolean) => {
    const branch = branches.find((b) => b.id === branchId);
    try {
      if (assign) {
        // Create assignment
        await api.put(
          `/api/restaurants/${restaurantId}/promotions/${promotionId}/branch-assignments`,
          { branchId, isActive: true }
        );
        toast.success(`Promotion activated at ${branch?.name}`);
      } else {
        // Delete assignment
        await api.delete(
          `/api/restaurants/${restaurantId}/promotions/${promotionId}/branch-assignments?branchId=${branchId}`
        );
        toast.success(`Promotion removed from ${branch?.name}`);
      }
      // Update local state
      setAssignmentState((prev) => ({
        ...prev,
        [branchId]: {
          isAssigned: assign,
          isActive: assign ? true : prev[branchId]?.isActive ?? true,
          isDirty: false,
        },
      }));
    } catch (err) {
      console.error('[PROMOTION_ASSIGNMENT_TOGGLE]', err);
      toast.error(`Failed to update ${branch?.name}`);
    }
  };

  // Toggle isActive on an existing assignment (pause/resume)
  const toggleActive = async (branchId: string, active: boolean) => {
    const branch = branches.find((b) => b.id === branchId);
    try {
      await api.put(
        `/api/restaurants/${restaurantId}/promotions/${promotionId}/branch-assignments`,
        { branchId, isActive: active }
      );
      toast.success(`${branch?.name}: ${active ? 'resumed' : 'paused'}`);
      setAssignmentState((prev) => ({
        ...prev,
        [branchId]: { ...prev[branchId], isActive: active, isDirty: false },
      }));
    } catch (err) {
      console.error('[PROMOTION_ASSIGNMENT_PAUSE]', err);
      toast.error(`Failed to update ${branch?.name}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Branch Assignments — {promotionName}
          </DialogTitle>
          <DialogDescription>
            {promotionCode && <span className="font-mono text-xs">Code: {promotionCode} · </span>}
            Control which branches this promotion is active at. Zero assignments = active everywhere (default).
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
            {/* Status banner */}
            <div className={`rounded-md px-3 py-2 flex items-center gap-2 text-xs ${activeEverywhere ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'}`}>
              {activeEverywhere ? (
                <>
                  <Globe className="h-3.5 w-3.5" />
                  <span className="font-medium">Active at ALL branches</span>
                  <span className="ml-auto">(no assignments — default)</span>
                </>
              ) : (
                <>
                  <Store className="h-3.5 w-3.5" />
                  <span className="font-medium">Active at {assignedCount} of {branches.length} branches</span>
                  <span className="ml-auto">unassigned branches: inactive</span>
                </>
              )}
            </div>

            <Separator />

            {/* Per-branch rows */}
            {branches.map((branch) => {
              const state = assignmentState[branch.id];
              if (!state) return null;
              return (
                <div
                  key={branch.id}
                  className={`rounded-lg border p-3 flex items-center justify-between ${state.isAssigned && !state.isActive ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20' : state.isAssigned ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20' : ''}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{branch.name}</span>
                        {branch.isMainBranch && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">Main</Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {!state.isAssigned ? (
                          'Inherits default (active)'
                        ) : state.isActive ? (
                          <span className="text-emerald-600 dark:text-emerald-400">Active at this branch</span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">Paused at this branch</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {state.isAssigned && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => toggleActive(branch.id, !state.isActive)}
                      >
                        {state.isActive ? 'Pause' : 'Resume'}
                      </Button>
                    )}
                    <Switch
                      checked={state.isAssigned}
                      onCheckedChange={(checked) => toggleAssignment(branch.id, checked)}
                      title={state.isAssigned ? 'Remove from this branch' : 'Assign to this branch'}
                    />
                  </div>
                </div>
              );
            })}

            <Separator />

            {/* Helper text */}
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <strong>How it works:</strong> When you assign a promotion to specific branches,
              it becomes inactive at all other branches. To make it active everywhere again,
              remove all assignments. Pausing keeps the assignment record for quick reactivation.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
