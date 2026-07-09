// ============================================================
// TableDialog — Add/Edit table dialog
// ============================================================

'use client';

import React, { memo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Circle, Square, RectangleHorizontal } from 'lucide-react';
import type { TableData, TableShape } from './types';
import { TABLE_SHAPE_DEFAULTS } from './constants';

interface TableDialogProps {
  mode: 'add' | 'edit';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableNumber: string;
  setTableNumber: (v: string) => void;
  tableCapacity: string;
  setTableCapacity: (v: string) => void;
  tableShape: TableShape;
  setTableShape: (v: TableShape) => void;
  editingTable: TableData | null;
  setEditingTable: (t: TableData | null) => void;
  adding: boolean;
  onAdd: () => void;
  onEdit: () => void;
}

const SHAPE_OPTIONS: Array<{ shape: TableShape; icon: React.ElementType; label: string }> = [
  { shape: 'round', icon: Circle, label: 'Round' },
  { shape: 'square', icon: Square, label: 'Square' },
  { shape: 'rectangle', icon: RectangleHorizontal, label: 'Rect' },
  { shape: 'oval', icon: Circle, label: 'Oval' },
  { shape: 'l-shape', icon: RectangleHorizontal, label: 'L-Shape' },
  { shape: 'u-shape', icon: RectangleHorizontal, label: 'U-Shape' },
  { shape: 'booth', icon: RectangleHorizontal, label: 'Booth' },
  { shape: 'high-top', icon: Circle, label: 'High-Top' },
];

function TableDialogComponent({
  mode, open, onOpenChange,
  tableNumber, setTableNumber,
  tableCapacity, setTableCapacity,
  tableShape, setTableShape,
  editingTable, setEditingTable,
  adding, onAdd, onEdit,
}: TableDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'add' ? 'Add New Table' : `Edit Table T${editingTable?.number}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Table Number</Label>
              <Input
                value={mode === 'edit' && editingTable ? editingTable.number : tableNumber}
                onChange={(e) => mode === 'edit' && editingTable
                  ? setEditingTable({ ...editingTable, number: e.target.value })
                  : setTableNumber(e.target.value)
                }
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <Label>Capacity</Label>
              <Input
                type="number"
                value={mode === 'edit' && editingTable ? editingTable.capacity : tableCapacity}
                onChange={(e) => mode === 'edit' && editingTable
                  ? setEditingTable({ ...editingTable, capacity: parseInt(e.target.value) || 4 })
                  : setTableCapacity(e.target.value)
                }
                placeholder="4"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Shape</Label>
            {mode === 'add' ? (
              <div className="grid grid-cols-4 gap-2">
                {SHAPE_OPTIONS.map(({ shape, icon: Icon, label }) => (
                  <Button
                    key={shape}
                    variant={tableShape === shape ? 'default' : 'outline'}
                    size="sm"
                    className="flex-col h-auto py-2 gap-1"
                    onClick={() => setTableShape(shape)}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-[10px]">{label}</span>
                  </Button>
                ))}
              </div>
            ) : (
              <Select
                value={editingTable?.shape || 'square'}
                onValueChange={(v) => editingTable && setEditingTable({ ...editingTable, shape: v as TableShape })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SHAPE_OPTIONS.map(({ shape, label }) => (
                    <SelectItem key={shape} value={shape}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {mode === 'edit' && editingTable && (
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={editingTable.notes || ''}
                onChange={(e) => setEditingTable({ ...editingTable, notes: e.target.value })}
                placeholder="Optional notes..."
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={mode === 'add' ? onAdd : onEdit} disabled={adding}>
            {adding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {mode === 'add' ? 'Add Table' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const TableDialog = memo(TableDialogComponent);
