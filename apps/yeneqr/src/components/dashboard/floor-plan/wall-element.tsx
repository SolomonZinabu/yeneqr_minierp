// ============================================================
// WallElement — Wall segment with drag/edit/delete
// ============================================================

'use client';

import React, { memo } from 'react';
import type { WallSegment } from './types';
import { WALL_TYPE_CONFIG } from './constants';

interface WallElementProps {
  wall: WallSegment;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function WallElementComponent({ wall, isSelected, onSelect }: WallElementProps) {
  const cfg = WALL_TYPE_CONFIG[wall.type] || WALL_TYPE_CONFIG.thick;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect(wall.id);
  };

  return (
    <g onPointerDown={handlePointerDown} style={{ cursor: 'pointer' }}>
      {/* Wall line */}
      <line
        x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2}
        stroke={cfg.color}
        strokeWidth={wall.thickness}
        strokeLinecap="round"
        opacity={wall.type === 'glass' ? 0.6 : 1}
      />
      {/* Glass wall hatching */}
      {wall.type === 'glass' && (
        <>
          <line x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2}
            stroke="#bfdbfe" strokeWidth={wall.thickness - 1} strokeLinecap="round" />
          {/* Small tick marks for glass */}
          {Array.from({ length: Math.floor(Math.sqrt((wall.x2 - wall.x1) ** 2 + (wall.y2 - wall.y1) ** 2) / 15) }).map((_, i) => {
            const t = (i + 1) / (Math.floor(Math.sqrt((wall.x2 - wall.x1) ** 2 + (wall.y2 - wall.y1) ** 2) / 15) + 1);
            const x = wall.x1 + (wall.x2 - wall.x1) * t;
            const y = wall.y1 + (wall.y2 - wall.y1) * t;
            const dx = wall.x2 - wall.x1;
            const dy = wall.y2 - wall.y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            const nx = -dy / len * 4;
            const ny = dx / len * 4;
            return (
              <line key={i} x1={x - nx} y1={y - ny} x2={x + nx} y2={y + ny}
                stroke="#93c5fd" strokeWidth={0.5} />
            );
          })}
        </>
      )}
      {/* Selection highlight */}
      {isSelected && (
        <line x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2}
          stroke="#f472b6" strokeWidth={wall.thickness + 4} strokeLinecap="round"
          opacity={0.3} />
      )}
      {/* Endpoints (when selected) */}
      {isSelected && (
        <>
          <circle cx={wall.x1} cy={wall.y1} r={4} fill="white" stroke={cfg.color} strokeWidth={2}
            style={{ cursor: 'move' }} />
          <circle cx={wall.x2} cy={wall.y2} r={4} fill="white" stroke={cfg.color} strokeWidth={2}
            style={{ cursor: 'move' }} />
        </>
      )}
    </g>
  );
}

export const WallElement = memo(WallElementComponent);
