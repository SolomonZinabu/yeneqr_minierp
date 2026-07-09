// ============================================================
// ColumnElement — Column/pillar element
// ============================================================

'use client';

import React, { memo } from 'react';
import type { ColumnElement as ColumnElementType } from './types';

interface ColumnElementProps {
  column: ColumnElementType;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (id: string, clientX: number, clientY: number) => void;
}

function ColumnElementComponent({ column, isSelected, onSelect, onDragStart }: ColumnElementProps) {
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect(column.id);
    onDragStart(column.id, e.clientX, e.clientY);
  };

  return (
    <g onPointerDown={handlePointerDown} style={{ cursor: 'grab' }}>
      {/* Column shadow */}
      <circle cx={column.x + 2} cy={column.y + 2} r={column.radius}
        fill="rgba(0,0,0,0.08)" />

      {/* Column body */}
      <circle cx={column.x} cy={column.y} r={column.radius}
        fill="#d4d4d8" stroke="#78716c" strokeWidth={2} />

      {/* Inner ring */}
      <circle cx={column.x} cy={column.y} r={column.radius * 0.6}
        fill="none" stroke="#a1a1aa" strokeWidth={1} />

      {/* Cross pattern */}
      <line x1={column.x - column.radius * 0.4} y1={column.y}
        x2={column.x + column.radius * 0.4} y2={column.y}
        stroke="#a1a1aa" strokeWidth={0.5} />
      <line x1={column.x} y1={column.y - column.radius * 0.4}
        x2={column.x} y2={column.y + column.radius * 0.4}
        stroke="#a1a1aa" strokeWidth={0.5} />

      {/* Selection */}
      {isSelected && (
        <circle cx={column.x} cy={column.y} r={column.radius + 4}
          fill="none" stroke="#f472b6" strokeWidth={1.5} strokeDasharray="4,2" />
      )}
    </g>
  );
}

export const ColumnElementComp = memo(ColumnElementComponent);
