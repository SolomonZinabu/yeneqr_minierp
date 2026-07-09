// ============================================================
// PropertyPanel — RIGHT SIDEBAR: selected element properties
// ============================================================

'use client';

import React, { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Edit3, Trash2, Copy, QrCode, Receipt, Armchair, Users, Clock, SprayCan,
} from 'lucide-react';
import type { TableData, TableStatus, FloorData } from './types';
import { STATUS_CONFIG, ROOM_TYPE_CONFIG, OUTDOOR_TYPE_CONFIG, UTILITY_TYPE_CONFIG } from './constants';

interface PropertyPanelProps {
  selectedTable: TableData | null;
  currentFloor: FloorData | null;
  selectionInfo: { kind: string; id: string } | null;
  // For non-table elements
  selectedRoom?: { type: string; label: string; color: string; x: number; y: number; width: number; height: number } | null;
  onStatusChange: (tableId: string, status: TableStatus) => void;
  onEditTable: (table: TableData) => void;
  onDeleteTable: (tableId: string) => void;
  onClearSelection: () => void;
}

function PropertyPanelComponent({
  selectedTable,
  currentFloor,
  selectionInfo,
  selectedRoom,
  onStatusChange,
  onEditTable,
  onDeleteTable,
  onClearSelection,
}: PropertyPanelProps) {
  if (!selectedTable && !selectionInfo) return null;

  if (selectedTable) {
    const config = STATUS_CONFIG[selectedTable.status] || STATUS_CONFIG.available;

    return (
      <Card className="w-72 shrink-0 border shadow-lg">
        <CardContent className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-4 w-4 rounded-full ${config.color}`} />
              <span className="font-bold text-lg">T{selectedTable.number}</span>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                onClick={() => onEditTable(selectedTable)}>
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => onDeleteTable(selectedTable.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                onClick={onClearSelection}>
                ✕
              </Button>
            </div>
          </div>

          <Badge className={`${config.color} text-white text-xs`}>{config.label}</Badge>

          {/* Properties grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Capacity</p>
              <p className="font-medium">{selectedTable.capacity} seats</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Shape</p>
              <p className="font-medium capitalize">{selectedTable.shape}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Floor</p>
              <p className="font-medium text-xs">{currentFloor?.name || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Position</p>
              <p className="font-medium text-xs">{Math.round(selectedTable.positionX || 0)}, {Math.round(selectedTable.positionY || 0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Size</p>
              <p className="font-medium text-xs">{Math.round(selectedTable.width)}×{Math.round(selectedTable.height)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rotation</p>
              <p className="font-medium text-xs">{Math.round(selectedTable.rotation || 0)}°</p>
            </div>
          </div>

          {selectedTable.notes && (
            <div className="rounded-lg bg-muted p-2">
              <p className="text-xs text-muted-foreground">{selectedTable.notes}</p>
            </div>
          )}

          <Separator />

          {/* Change Status */}
          <div className="space-y-2">
            <p className="text-xs font-medium">Change Status</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(STATUS_CONFIG) as TableStatus[]).map((status) => {
                const sc = STATUS_CONFIG[status];
                return (
                  <Button key={status}
                    variant={selectedTable.status === status ? 'default' : 'outline'}
                    size="sm" className="text-xs h-7 gap-1"
                    onClick={() => onStatusChange(selectedTable.id, status)}
                    disabled={selectedTable.status === status}>
                    <div className={`h-2 w-2 rounded-full ${sc.color}`} />
                    {sc.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Quick Actions */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Quick Actions</p>
            <Button variant="outline" size="sm" className="w-full text-xs h-7 gap-1">
              <QrCode className="h-3 w-3" /> View QR Code
            </Button>
            <Button variant="outline" size="sm" className="w-full text-xs h-7 gap-1">
              <Receipt className="h-3 w-3" /> View Orders
            </Button>
            <Button variant="outline" size="sm" className="w-full text-xs h-7 gap-1">
              <Copy className="h-3 w-3" /> Duplicate Table
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Non-table element properties
  if (selectedRoom) {
    const isOutdoor = ['terrace', 'garden', 'patio', 'parking'].includes(selectedRoom.type);
    const cfg = isOutdoor
      ? OUTDOOR_TYPE_CONFIG[selectedRoom.type as keyof typeof OUTDOOR_TYPE_CONFIG]
      : ROOM_TYPE_CONFIG[selectedRoom.type as keyof typeof ROOM_TYPE_CONFIG];

    return (
      <Card className="w-72 shrink-0 border shadow-lg">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded" style={{ backgroundColor: selectedRoom.color }} />
              <span className="font-bold">{selectedRoom.label}</span>
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClearSelection}>
              ✕
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Type</p>
              <p className="font-medium text-xs capitalize">{selectedRoom.type}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Position</p>
              <p className="font-medium text-xs">{Math.round(selectedRoom.x)}, {Math.round(selectedRoom.y)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Width</p>
              <p className="font-medium text-xs">{Math.round(selectedRoom.width)}px</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Height</p>
              <p className="font-medium text-xs">{Math.round(selectedRoom.height)}px</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Generic selection info
  if (selectionInfo) {
    return (
      <Card className="w-56 shrink-0 border shadow-lg">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm capitalize">{selectionInfo.kind}</span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClearSelection}>
              ✕
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">ID: {selectionInfo.id.slice(0, 12)}...</p>
        </CardContent>
      </Card>
    );
  }

  return null;
}

export const PropertyPanel = memo(PropertyPanelComponent);
