// ============================================================
// WindowElement — Window with glass pattern
// ============================================================

'use client';

import React, { memo } from 'react';
import type { WindowElement as WindowElementType } from './types';
import { WINDOW_TYPE_CONFIG } from './constants';

interface WindowElementProps {
  window: WindowElementType;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (id: string, clientX: number, clientY: number) => void;
}

function WindowElementComponent({ window: win, isSelected, onSelect, onDragStart }: WindowElementProps) {
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect(win.id);
    onDragStart(win.id, e.clientX, e.clientY);
  };

  const renderWindow = () => {
    const w = win.width;
    const h = win.height;

    switch (win.type) {
      case 'bay':
        return (
          <g>
            {/* Bay window outer shape */}
            <path d={`M 0 ${h} L ${w * 0.1} 0 L ${w * 0.9} 0 L ${w} ${h} Z`}
              fill="#e0f2fe" stroke="#0284c7" strokeWidth={2} opacity={0.8} />
            {/* Glass panes */}
            <line x1={w * 0.33} y1={0} x2={w * 0.33} y2={h} stroke="#0284c7" strokeWidth={1} opacity={0.4} />
            <line x1={w * 0.67} y1={0} x2={w * 0.67} y2={h} stroke="#0284c7" strokeWidth={1} opacity={0.4} />
            {/* Light reflection */}
            <line x1={w * 0.15} y1={h * 0.2} x2={w * 0.25} y2={h * 0.8}
              stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
            <line x1={w * 0.5} y1={h * 0.15} x2={w * 0.55} y2={h * 0.7}
              stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
          </g>
        );
      case 'standard':
      default:
        return (
          <g>
            {/* Window frame */}
            <rect x={0} y={0} width={w} height={h} fill="#e0f2fe" stroke="#0284c7" strokeWidth={2} rx={1} opacity={0.8} />
            {/* Center divider */}
            <line x1={w / 2} y1={0} x2={w / 2} y2={h} stroke="#0284c7" strokeWidth={1} opacity={0.5} />
            {/* Light reflection */}
            <line x1={w * 0.15} y1={1} x2={w * 0.2} y2={h - 1}
              stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
            <line x1={w * 0.65} y1={1} x2={w * 0.7} y2={h - 1}
              stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
          </g>
        );
    }
  };

  return (
    <g
      transform={`translate(${win.x}, ${win.y}) rotate(${win.rotation}, ${win.width / 2}, ${win.height / 2})`}
      onPointerDown={handlePointerDown}
      style={{ cursor: 'grab' }}
    >
      {renderWindow()}

      {/* Selection */}
      {isSelected && (
        <rect x={-4} y={-4} width={win.width + 8} height={win.height + 8}
          fill="none" stroke="#f472b6" strokeWidth={1.5} strokeDasharray="4,2" rx={4} />
      )}

      {/* Label */}
      <text x={win.width / 2} y={win.height + 12} textAnchor="middle"
        fontSize={8} fill="#0284c7" fontWeight="500" style={{ pointerEvents: 'none' }}>
        {WINDOW_TYPE_CONFIG[win.type].label}
      </text>
    </g>
  );
}

export const WindowElementComp = memo(WindowElementComponent);
