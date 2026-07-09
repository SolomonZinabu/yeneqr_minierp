'use client';

// ============================================================
// Yene QR — Merge Tables Dialog
// ============================================================
// Wraps the POST /api/restaurants/{id}/tables/merge endpoint.
//
// Use case: A large party occupies two adjacent tables and wants to
// order/pay together. Staff picks a primary table (the one that will
// receive all items) and a secondary table (the one that will be freed).
// The API transfers all items from the secondary's active order to
// the primary's active order, cancels the secondary's (now empty)
// order, and marks the secondary table as available.
//
// Restrictions enforced by the API:
//   - Both tables must be in the same branch
//   - Secondary table must have an active order with items
//   - Primary table can have either no order or an active order
// ============================================================

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, GitMerge, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

export interface TableSummary {
  id: string;
  number: string;
  capacity: number;
  status: string;
  branchId: string;
  branchName?: string;
  floorName?: string | null;
}

interface MergeTablesDialogProps {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  tables: TableSummary[];
  /** Optional preselected primary table (e.g. right-clicked table) */
  defaultPrimaryId?: string;
  onMerged?: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  available: { label: 'Available', color: 'bg-emerald-100 text-emerald-800' },
  occupied: { label: 'Occupied', color: 'bg-red-100 text-red-800' },
  reserved: { label: 'Reserved', color: 'bg-amber-100 text-amber-800' },
  cleaning: { label: 'Cleaning', color: 'bg-blue-100 text-blue-800' },
};

export function MergeTablesDialog({
  open,
  onClose,
  restaurantId,
  tables,
  defaultPrimaryId,
  onMerged,
}: MergeTablesDialogProps) {
  const [primaryId, setPrimaryId] = useState<string>(defaultPrimaryId || '');
  const [secondaryId, setSecondaryId] = useState<string>('');
  const [merging, setMerging] = useState(false);

  // Reset state when dialog opens
  useMemo(() => {
    if (open) {
      setPrimaryId(defaultPrimaryId || '');
      setSecondaryId('');
    }
  }, [open, defaultPrimaryId]);

  // Group tables by branch so the picker only shows tables in the same branch
  const primaryTable = tables.find((t) => t.id === primaryId);
  const branchId = primaryTable?.branchId;

  const candidateSecondaries = useMemo(() => {
    if (!branchId) return [];
    return tables.filter((t) => t.branchId === branchId && t.id !== primaryId);
  }, [tables, branchId, primaryId]);

  const handleMerge = async () => {
    if (!primaryId || !secondaryId) {
      toast.error('Select both a primary and a secondary table');
      return;
    }
    setMerging(true);
    try {
      const res = await api.post<{
        success: boolean;
        message: string;
        mergedOrderId: string;
        cancelledOrderId?: string;
        itemsTransferred: number;
      }>(`/api/restaurants/${restaurantId}/tables/merge`, {
        primaryTableId: primaryId,
        secondaryTableId: secondaryId,
      });
      toast.success(res.message || `Merged — ${res.itemsTransferred} item(s) transferred`);
      onClose();
      onMerged?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(msg || 'Failed to merge tables');
    } finally {
      setMerging(false);
    }
  };

  const primaryStatus = primaryTable ? STATUS_LABELS[primaryTable.status] : null;
  const secondaryTable = tables.find((t) => t.id === secondaryId);
  const secondaryStatus = secondaryTable ? STATUS_LABELS[secondaryTable.status] : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-4 w-4" />
            Merge Tables
          </DialogTitle>
          <DialogDescription>
            Combine two tables into one party. Items from the secondary table will be transferred to the primary table&apos;s order. The secondary table will be freed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Primary table picker */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Primary Table (receives items)</label>
            <p className="text-xs text-muted-foreground">
              This table will keep its order and absorb the items from the other table.
            </p>
            <select
              value={primaryId}
              onChange={(e) => {
                setPrimaryId(e.target.value);
                setSecondaryId(''); // reset secondary when branch changes
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— Select primary table —</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  Table {t.number} · {t.branchName || 'Unknown branch'}
                  {t.floorName ? ` · ${t.floorName}` : ''} · {STATUS_LABELS[t.status]?.label || t.status}
                </option>
              ))}
            </select>
            {primaryTable && primaryStatus && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant="outline" className={`text-[10px] ${primaryStatus.color}`}>
                  {primaryStatus.label}
                </Badge>
                <span className="text-muted-foreground">· Capacity: {primaryTable.capacity}</span>
              </div>
            )}
          </div>

          {/* Arrow indicator */}
          {primaryId && (
            <div className="flex justify-center">
              <div className="flex flex-col items-center text-xs text-muted-foreground">
                <ArrowRight className="h-4 w-4 rotate-90 text-primary" />
                <span className="mt-0.5">items flow up</span>
              </div>
            </div>
          )}

          {/* Secondary table picker */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Secondary Table (will be freed)</label>
            <p className="text-xs text-muted-foreground">
              Must be in the same branch as the primary. This table&apos;s active order will be cancelled after items transfer.
            </p>
            <select
              value={secondaryId}
              onChange={(e) => setSecondaryId(e.target.value)}
              disabled={!primaryId}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">— Select secondary table —</option>
              {candidateSecondaries.map((t) => (
                <option key={t.id} value={t.id}>
                  Table {t.number}
                  {t.floorName ? ` · ${t.floorName}` : ''} · {STATUS_LABELS[t.status]?.label || t.status}
                </option>
              ))}
            </select>
            {secondaryTable && secondaryStatus && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant="outline" className={`text-[10px] ${secondaryStatus.color}`}>
                  {secondaryStatus.label}
                </Badge>
                {secondaryTable.status !== 'occupied' && (
                  <span className="text-amber-600 text-[11px]">
                    ⚠ Should be occupied to have items to merge
                  </span>
                )}
              </div>
            )}
            {primaryId && candidateSecondaries.length === 0 && (
              <p className="text-xs text-amber-600">
                No other tables in this branch. Merge requires two tables in the same branch.
              </p>
            )}
          </div>

          {/* Warning */}
          {primaryId && secondaryId && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300">
              <strong>Action:</strong> Table {secondaryTable?.number}&apos;s items will be moved to Table {primaryTable?.number}.
              The order on Table {secondaryTable?.number} will be cancelled, and Table {secondaryTable?.number} will be marked available.
              This cannot be undone.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleMerge}
            disabled={merging || !primaryId || !secondaryId || primaryId === secondaryId}
          >
            {merging ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <GitMerge className="h-4 w-4 mr-1.5" />
                Merge Tables
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
