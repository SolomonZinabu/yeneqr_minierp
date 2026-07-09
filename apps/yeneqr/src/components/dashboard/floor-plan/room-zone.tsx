// ============================================================
// RoomZone — Room/obstacle zone renderer with drag/resize
// ============================================================

'use client';

import React, { memo } from 'react';
import type { RoomZone as RoomZoneType } from './types';
import { ROOM_TYPE_CONFIG, OUTDOOR_TYPE_CONFIG } from './constants';

interface RoomZoneProps {
  room: RoomZoneType;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (id: string, clientX: number, clientY: number) => void;
}

function RoomZoneComponent({ room, isSelected, onSelect, onDragStart }: RoomZoneProps) {
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect(room.id);
    onDragStart(room.id, e.clientX, e.clientY);
  };

  const isOutdoor = ['terrace', 'garden', 'patio', 'parking'].includes(room.type);
  const cfg = isOutdoor
    ? OUTDOOR_TYPE_CONFIG[room.type as keyof typeof OUTDOOR_TYPE_CONFIG]
    : ROOM_TYPE_CONFIG[room.type as keyof typeof ROOM_TYPE_CONFIG];
  const fillColor = room.color || cfg?.fill || '#78716c';

  return (
    <g onPointerDown={handlePointerDown} style={{ cursor: 'grab' }}>
      {/* Room background */}
      <rect
        x={room.x} y={room.y}
        width={room.width} height={room.height}
        rx={6}
        fill={`${fillColor}15`}
        stroke={`${fillColor}55`}
        strokeWidth={isSelected ? 2 : 1.5}
        strokeDasharray={isOutdoor ? '8,4' : '4,2'}
      />

      {/* Room label */}
      <text
        x={room.x + room.width / 2}
        y={room.y + room.height / 2 - 6}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={fillColor}
        fontSize={12}
        fontWeight="600"
        style={{ pointerEvents: 'none' }}
      >
        {room.label}
      </text>

      {/* Room type icon hint */}
      <text
        x={room.x + room.width / 2}
        y={room.y + room.height / 2 + 10}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={`${fillColor}88`}
        fontSize={9}
        fontWeight="400"
        style={{ pointerEvents: 'none' }}
      >
        {room.width}×{room.height}
      </text>

      {/* Selection outline */}
      {isSelected && (
        <rect
          x={room.x - 4} y={room.y - 4}
          width={room.width + 8} height={room.height + 8}
          fill="none" stroke="#f472b6" strokeWidth={1.5}
          strokeDasharray="4,2" rx={8}
        />
      )}

      {/* Resize handle */}
      {isSelected && (
        <rect
          x={room.x + room.width - 5}
          y={room.y + room.height - 5}
          width={10} height={10} rx={2}
          fill="white" stroke={fillColor} strokeWidth={1.5}
          style={{ cursor: 'nwse-resize' }}
          onPointerDown={(e) => e.stopPropagation()}
        />
      )}
    </g>
  );
}

export const RoomZone = memo(RoomZoneComponent);
