// ============================================================
// FloorManager — Floor tabs + add/delete
// ============================================================

'use client';

import React, { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Home, Plus, Trash2 } from 'lucide-react';
import type { FloorData } from './types';

interface FloorManagerProps {
  floors: FloorData[];
  selectedFloorId: string;
  onSelectFloor: (id: string) => void;
  onDeleteFloor: (id: string) => void;
  onAddFloor: () => void;
}

function FloorManagerComponent({
  floors, selectedFloorId, onSelectFloor, onDeleteFloor, onAddFloor,
}: FloorManagerProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {floors.map((floor) => (
        <div key={floor.id} className="flex items-center gap-1">
          <Button
            variant={selectedFloorId === floor.id ? 'default' : 'outline'}
            size="sm" className="text-xs h-8 gap-1"
            onClick={() => onSelectFloor(floor.id)}
          >
            <Home className="h-3 w-3" />
            {floor.name}
            <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">
              {floor._count?.tables || 0}
            </Badge>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => onDeleteFloor(floor.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="text-xs h-8 gap-1" onClick={onAddFloor}>
        <Plus className="h-3 w-3" />
        Add Floor
      </Button>
    </div>
  );
}

export const FloorManager = memo(FloorManagerComponent);
