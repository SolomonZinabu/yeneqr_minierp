// ============================================================
// DoorElement — Door with swing arc animation
// ============================================================

'use client';

import React, { memo } from 'react';
import type { DoorElement as DoorElementType } from './types';
import { DOOR_TYPE_CONFIG } from './constants';

interface DoorElementProps {
  door: DoorElementType;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (id: string, clientX: number, clientY: number) => void;
}

function DoorElementComponent({ door, isSelected, onSelect, onDragStart }: DoorElementProps) {
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect(door.id);
    onDragStart(door.id, e.clientX, e.clientY);
  };

  const renderDoor = () => {
    const w = door.width;
    const h = door.height;

    switch (door.type) {
      case 'double':
        return (
          <g>
            {/* Left door frame */}
            <rect x={0} y={0} width={w / 2 - 2} height={h} fill="#8b5cf6" opacity={0.3} rx={1} />
            {/* Right door frame */}
            <rect x={w / 2 + 2} y={0} width={w / 2 - 2} height={h} fill="#8b5cf6" opacity={0.3} rx={1} />
            {/* Left swing arc */}
            <path d={`M 0 ${h} A ${w / 2} ${w / 2} 0 0 1 ${w / 2} ${h - w / 2}`}
              fill="none" stroke="#8b5cf6" strokeWidth={1} strokeDasharray="3,2" opacity={0.5} />
            {/* Right swing arc */}
            <path d={`M ${w} ${h} A ${w / 2} ${w / 2} 0 0 0 ${w / 2} ${h - w / 2}`}
              fill="none" stroke="#8b5cf6" strokeWidth={1} strokeDasharray="3,2" opacity={0.5} />
            {/* Door frame */}
            <rect x={0} y={0} width={w} height={h} fill="none" stroke="#7c3aed" strokeWidth={2} rx={1} />
          </g>
        );
      case 'sliding':
        return (
          <g>
            {/* Sliding door track */}
            <rect x={0} y={0} width={w} height={h} fill="#8b5cf620" stroke="#7c3aed" strokeWidth={2} rx={1} />
            {/* Left panel */}
            <rect x={1} y={1} width={w / 2 - 2} height={h - 2} fill="#8b5cf640" rx={1} />
            {/* Right panel (overlapping) */}
            <rect x={w / 4} y={1} width={w / 2 - 2} height={h - 2} fill="#8b5cf660" rx={1} />
            {/* Arrow indicators */}
            <text x={w * 0.25} y={h / 2 + 1} textAnchor="middle" dominantBaseline="middle"
              fontSize={8} fill="#7c3aed" style={{ pointerEvents: 'none' }}>▸</text>
            <text x={w * 0.75} y={h / 2 + 1} textAnchor="middle" dominantBaseline="middle"
              fontSize={8} fill="#7c3aed" style={{ pointerEvents: 'none' }}>◂</text>
          </g>
        );
      case 'single':
      default:
        return (
          <g>
            {/* Door frame */}
            <rect x={0} y={0} width={w} height={h} fill="#8b5cf620" stroke="#7c3aed" strokeWidth={2} rx={1} />
            {/* Swing arc */}
            <path d={`M ${w} ${h} A ${w} ${w} 0 0 1 0 ${h - Math.min(w, 50)}`}
              fill="none" stroke="#8b5cf6" strokeWidth={1} strokeDasharray="3,2" opacity={0.5} />
            {/* Door panel line */}
            <line x1={w} y1={h} x2={0} y2={h - Math.min(w, 50)}
              stroke="#7c3aed" strokeWidth={1.5} opacity={0.6}>
              <animateTransform attributeName="transform" type="rotate"
                from={`0 ${w} ${h}`} to={`-90 ${w} ${h}`} dur="3s" repeatCount="indefinite" />
            </line>
          </g>
        );
    }
  };

  return (
    <g
      transform={`translate(${door.x}, ${door.y}) rotate(${door.rotation}, ${door.width / 2}, ${door.height / 2})`}
      onPointerDown={handlePointerDown}
      style={{ cursor: 'grab' }}
    >
      {renderDoor()}

      {/* Selection */}
      {isSelected && (
        <rect x={-4} y={-4} width={door.width + 8} height={door.height + 8}
          fill="none" stroke="#f472b6" strokeWidth={1.5} strokeDasharray="4,2" rx={4} />
      )}

      {/* Label */}
      <text x={door.width / 2} y={door.height + 12} textAnchor="middle"
        fontSize={8} fill="#7c3aed" fontWeight="500" style={{ pointerEvents: 'none' }}>
        {DOOR_TYPE_CONFIG[door.type].label}
      </text>
    </g>
  );
}

export const DoorElementComp = memo(DoorElementComponent);
