// ============================================================
// StairsElement — Stairs with directional arrows
// ============================================================

'use client';

import React, { memo } from 'react';
import type { StairsElement as StairsElementType } from './types';

interface StairsElementProps {
  stairs: StairsElementType;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (id: string, clientX: number, clientY: number) => void;
}

function StairsElementComponent({ stairs, isSelected, onSelect, onDragStart }: StairsElementProps) {
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect(stairs.id);
    onDragStart(stairs.id, e.clientX, e.clientY);
  };

  const numSteps = 6;
  const stepH = stairs.height / numSteps;

  return (
    <g
      transform={`translate(${stairs.x}, ${stairs.y}) rotate(${stairs.rotation}, ${stairs.width / 2}, ${stairs.height / 2})`}
      onPointerDown={handlePointerDown}
      style={{ cursor: 'grab' }}
    >
      {/* Background */}
      <rect x={0} y={0} width={stairs.width} height={stairs.height}
        fill="#f5f5f4" stroke="#a1a1aa" strokeWidth={1.5} rx={3} />

      {/* Steps */}
      {Array.from({ length: numSteps }).map((_, i) => (
        <rect
          key={i}
          x={2}
          y={i * stepH + 1}
          width={stairs.width - 4}
          height={stepH - 1}
          fill="#e7e5e4"
          stroke="#d6d3d1"
          strokeWidth={0.5}
          rx={1}
        />
      ))}

      {/* Direction arrow */}
      <g style={{ pointerEvents: 'none' }}>
        {stairs.direction === 'up' ? (
          <>
            <line x1={stairs.width / 2} y1={stairs.height * 0.7}
              x2={stairs.width / 2} y2={stairs.height * 0.3}
              stroke="#78716c" strokeWidth={2} />
            <polygon
              points={`${stairs.width / 2},${stairs.height * 0.2} ${stairs.width / 2 - 6},${stairs.height * 0.35} ${stairs.width / 2 + 6},${stairs.height * 0.35}`}
              fill="#78716c"
            />
          </>
        ) : (
          <>
            <line x1={stairs.width / 2} y1={stairs.height * 0.3}
              x2={stairs.width / 2} y2={stairs.height * 0.7}
              stroke="#78716c" strokeWidth={2} />
            <polygon
              points={`${stairs.width / 2},${stairs.height * 0.8} ${stairs.width / 2 - 6},${stairs.height * 0.65} ${stairs.width / 2 + 6},${stairs.height * 0.65}`}
              fill="#78716c"
            />
          </>
        )}
      </g>

      {/* Label */}
      <text x={stairs.width / 2} y={stairs.height - 4} textAnchor="middle"
        fontSize={7} fill="#78716c" fontWeight="600" style={{ pointerEvents: 'none' }}>
        {stairs.direction === 'up' ? 'UP' : 'DOWN'}
      </text>

      {/* Selection */}
      {isSelected && (
        <rect x={-4} y={-4} width={stairs.width + 8} height={stairs.height + 8}
          fill="none" stroke="#f472b6" strokeWidth={1.5} strokeDasharray="4,2" rx={6} />
      )}
    </g>
  );
}

export const StairsElementComp = memo(StairsElementComponent);
