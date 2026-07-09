// ============================================================
// FloorDialog — Add floor dialog
// ============================================================

'use client';

import React, { memo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface FloorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  floorName: string;
  setFloorName: (v: string) => void;
  adding: boolean;
  onAdd: () => void;
}

function FloorDialogComponent({
  open, onOpenChange, floorName, setFloorName, adding, onAdd,
}: FloorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add New Floor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Floor Name</Label>
            <Input
              value={floorName}
              onChange={(e) => setFloorName(e.target.value)}
              placeholder="e.g. Terrace, Mezzanine..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onAdd} disabled={adding}>
            {adding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Add Floor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const FloorDialog = memo(FloorDialogComponent);
