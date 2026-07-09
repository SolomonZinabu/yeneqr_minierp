// ============================================================
// TableShape — SVG renderer for 8 table shapes with chairs
// ============================================================

'use client';

import React, { memo } from 'react';
import { RotateCw } from 'lucide-react';
import type { TableData, TableShape as TableShapeType, AlignmentGuide } from './types';
import { STATUS_CONFIG, CHAIR_RADIUS, CHAIR_OFFSET, MAX_CHAIRS, RESIZE_HANDLE_SIZE, ROTATE_HANDLE_DISTANCE } from './constants';

interface TableShapeProps {
  table: TableData;
  isSelected: boolean;
  hasCollision: boolean;
  isOperationsMode: boolean;
  guides: AlignmentGuide[];
  onSelect: (id: string, multiSelect: boolean) => void;
  onDragStart: (id: string, clientX: number, clientY: number, px: number, py: number) => void;
  onResizeStart: (id: string, clientX: number, clientY: number) => void;
  onRotateStart: (id: string, clientX: number, clientY: number, cx: number, cy: number, startAngle: number, startRotation: number) => void;
}

function TableShapeComponent({
  table,
  isSelected,
  hasCollision,
  isOperationsMode,
  guides,
  onSelect,
  onDragStart,
  onResizeStart,
  onRotateStart,
}: TableShapeProps) {
  const config = STATUS_CONFIG[table.status] || STATUS_CONFIG.available;
  const px = table.positionX || 0;
  const py = table.positionY || 0;
  const w = table.width;
  const h = table.height;
  const rot = table.rotation || 0;

  const statusFill = config.fill;
  const statusStroke = config.stroke;
  const tableFill = isSelected ? statusFill : `${statusFill}cc`;
  const tableStroke = isSelected ? statusStroke : `${statusStroke}aa`;
  const shouldPulse = table.status === 'occupied';

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (isOperationsMode) return;
    onSelect(table.id, e.shiftKey);
    onDragStart(table.id, e.clientX, e.clientY, px, py);
  };

  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onResizeStart(table.id, e.clientX, e.clientY);
  };

  const handleRotatePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // Calculate center in screen coordinates
    const cx = px + w / 2;
    const cy = py + h / 2;
    const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
    onRotateStart(table.id, e.clientX, e.clientY, cx, cy, angle, rot);
  };

  const renderShapeBody = () => {
    switch (table.shape) {
      case 'round':
        return (
          <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2 - 2}
            fill={`url(#grad-${table.id})`} stroke={tableStroke} strokeWidth={2} />
        );
      case 'oval':
        return (
          <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 2} ry={h / 2 - 2}
            fill={`url(#grad-${table.id})`} stroke={tableStroke} strokeWidth={2} />
        );
      case 'l-shape':
        return (
          <path d={`M 2 2 L ${w * 0.6} 2 L ${w * 0.6} ${h * 0.5} L ${w - 2} ${h * 0.5} L ${w - 2} ${h - 2} L 2 ${h - 2} Z`}
            fill={`url(#grad-${table.id})`} stroke={tableStroke} strokeWidth={2} rx={4} />
        );
      case 'u-shape':
        return (
          <path d={`M 2 2 L ${w - 2} 2 L ${w - 2} ${h - 2} L ${w * 0.7} ${h - 2} L ${w * 0.7} ${h * 0.35} L ${w * 0.3} ${h * 0.35} L ${w * 0.3} ${h - 2} L 2 ${h - 2} Z`}
            fill={`url(#grad-${table.id})`} stroke={tableStroke} strokeWidth={2} />
        );
      case 'booth':
        return (
          <g>
            {/* Booth seat backs */}
            <rect x={2} y={2} width={w - 4} height={h * 0.2} rx={4}
              fill={`${statusFill}88`} stroke={tableStroke} strokeWidth={1} />
            <rect x={2} y={h * 0.8} width={w - 4} height={h * 0.2} rx={4}
              fill={`${statusFill}88`} stroke={tableStroke} strokeWidth={1} />
            {/* Table surface */}
            <rect x={4} y={h * 0.22} width={w - 8} height={h * 0.56} rx={4}
              fill={`url(#grad-${table.id})`} stroke={tableStroke} strokeWidth={2} />
          </g>
        );
      case 'high-top':
        return (
          <g>
            {/* Tall stool ring */}
            <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2 - 2}
              fill={`url(#grad-${table.id})`} stroke={tableStroke} strokeWidth={2} />
            {/* Small inner circle for high-top look */}
            <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 4}
              fill="none" stroke={`${statusStroke}44`} strokeWidth={1} />
          </g>
        );
      case 'square':
      case 'rectangle':
      default:
        return (
          <rect x={2} y={2} width={w - 4} height={h - 4} rx={6}
            fill={`url(#grad-${table.id})`} stroke={tableStroke} strokeWidth={2} />
        );
    }
  };

  const renderChairs = () => {
    const chairs: React.ReactNode[] = [];
    const numChairs = Math.min(table.capacity, MAX_CHAIRS);

    if (table.shape === 'round' || table.shape === 'oval' || table.shape === 'high-top') {
      const cx = w / 2;
      const cy = h / 2;
      const rx = w / 2 + CHAIR_OFFSET;
      const ry = h / 2 + CHAIR_OFFSET;
      for (let i = 0; i < numChairs; i++) {
        const angle = (2 * Math.PI * i) / numChairs - Math.PI / 2;
        const x = cx + rx * Math.cos(angle);
        const y = cy + ry * Math.sin(angle);
        chairs.push(
          <circle key={i} cx={x} cy={y} r={CHAIR_RADIUS}
            fill={`${statusFill}40`} stroke={`${statusStroke}60`} strokeWidth={1} />
        );
      }
    } else if (table.shape === 'booth') {
      // Booth chairs are the seat backs already rendered
    } else if (table.shape === 'l-shape') {
      // Chairs around L-shape
      const longSide = Math.ceil(numChairs * 0.6);
      const shortSide = numChairs - longSide;
      for (let i = 0; i < longSide; i++) {
        chairs.push(
          <circle key={`t${i}`} cx={(w * 0.6 / (longSide + 1)) * (i + 1)} cy={-CHAIR_OFFSET}
            r={CHAIR_RADIUS} fill={`${statusFill}40`} stroke={`${statusStroke}60`} strokeWidth={1} />
        );
      }
      for (let i = 0; i < shortSide; i++) {
        chairs.push(
          <circle key={`r${i}`} cx={w + CHAIR_OFFSET}
            cy={(h * 0.5 / (shortSide + 1)) * (i + 1) + h * 0.5}
            r={CHAIR_RADIUS} fill={`${statusFill}40`} stroke={`${statusStroke}60`} strokeWidth={1} />
        );
      }
    } else if (table.shape === 'u-shape') {
      const perSide = Math.ceil(numChairs / 3);
      let idx = 0;
      for (let i = 0; i < perSide && idx < numChairs; i++, idx++) {
        chairs.push(
          <circle key={`t${i}`} cx={(w / (perSide + 1)) * (i + 1)} cy={-CHAIR_OFFSET}
            r={CHAIR_RADIUS} fill={`${statusFill}40`} stroke={`${statusStroke}60`} strokeWidth={1} />
        );
      }
      const sideChairs = Math.ceil((numChairs - perSide) / 2);
      for (let i = 0; i < sideChairs && idx < numChairs; i++, idx++) {
        chairs.push(
          <circle key={`l${i}`} cx={-CHAIR_OFFSET}
            cy={(h / (sideChairs + 1)) * (i + 1)}
            r={CHAIR_RADIUS} fill={`${statusFill}40`} stroke={`${statusStroke}60`} strokeWidth={1} />
        );
      }
      for (let i = 0; idx < numChairs; i++, idx++) {
        chairs.push(
          <circle key={`r${i}`} cx={w + CHAIR_OFFSET}
            cy={(h / (sideChairs + 1)) * (i + 1)}
            r={CHAIR_RADIUS} fill={`${statusFill}40`} stroke={`${statusStroke}60`} strokeWidth={1} />
        );
      }
    } else {
      // Square / rectangle
      const perSide = Math.ceil(numChairs / 4);
      const positions: { x: number; y: number; side: string; i: number }[] = [];
      // Top
      for (let i = 0; i < perSide && positions.length < numChairs; i++) {
        positions.push({ x: (w / (perSide + 1)) * (i + 1), y: -CHAIR_OFFSET, side: 't', i });
      }
      // Bottom
      for (let i = 0; i < perSide && positions.length < numChairs; i++) {
        positions.push({ x: (w / (perSide + 1)) * (i + 1), y: h + CHAIR_OFFSET, side: 'b', i });
      }
      // Left
      const sideCount = Math.ceil((numChairs - 2 * perSide) / 2);
      for (let i = 0; i < sideCount && positions.length < numChairs; i++) {
        positions.push({ x: -CHAIR_OFFSET, y: (h / (sideCount + 1)) * (i + 1), side: 'l', i });
      }
      // Right
      for (let i = 0; positions.length < numChairs; i++) {
        positions.push({ x: w + CHAIR_OFFSET, y: (h / (sideCount + 1)) * (i + 1), side: 'r', i });
      }
      for (let ci = 0; ci < positions.length; ci++) {
        const pos = positions[ci];
        chairs.push(
          <circle key={`${pos.side}${pos.i}`} cx={pos.x} cy={pos.y} r={CHAIR_RADIUS}
            fill={`${statusFill}40`} stroke={`${statusStroke}60`} strokeWidth={1} />
        );
      }
    }
    return chairs;
  };

  return (
    <g
      transform={`translate(${px}, ${py}) rotate(${rot}, ${w / 2}, ${h / 2})`}
      onPointerDown={handlePointerDown}
      style={{ cursor: isOperationsMode ? 'default' : 'grab' }}
    >
      <defs>
        <linearGradient id={`grad-${table.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={`${statusFill}dd`} />
          <stop offset="100%" stopColor={`${statusFill}99`} />
        </linearGradient>
      </defs>

      {/* Collision indicator */}
      {hasCollision && (
        <rect x={-8} y={-8} width={w + 16} height={h + 16} rx={8}
          fill="none" stroke="#ef4444" strokeWidth={2} strokeDasharray="6,3" opacity={0.8}>
          <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1.5s" repeatCount="indefinite" />
        </rect>
      )}

      {/* Glow effect for selected */}
      {isSelected && !hasCollision && (
        <rect x={-6} y={-6} width={w + 12} height={h + 12} rx={12}
          fill="none" stroke={config.glow} strokeWidth={3} opacity={0.6}>
          {shouldPulse && (
            <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite" />
          )}
        </rect>
      )}

      {/* Pulse ring for occupied (not selected) */}
      {shouldPulse && !isSelected && (
        <rect x={-4} y={-4} width={w + 8} height={h + 8} rx={10}
          fill="none" stroke={config.glow} strokeWidth={2}>
          <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
        </rect>
      )}

      {/* Shadow */}
      <rect x={2} y={3} width={w - 2} height={h - 2} rx={8} fill="rgba(0,0,0,0.08)" />

      {/* Chairs */}
      {renderChairs()}

      {/* Table shape */}
      {renderShapeBody()}

      {/* Table number */}
      <text x={w / 2} y={h / 2 - 4} textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize={Math.min(w, h) > 80 ? 14 : 10} fontWeight="700"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)', pointerEvents: 'none' }}>
        T{table.number}
      </text>

      {/* Capacity */}
      <text x={w / 2} y={h / 2 + 12} textAnchor="middle" dominantBaseline="middle"
        fill="rgba(255,255,255,0.8)" fontSize={8} fontWeight="500"
        style={{ pointerEvents: 'none' }}>
        {table.capacity} seats
      </text>

      {/* Resize handles (8 directions) */}
      {isSelected && !isOperationsMode && (
        <>
          {/* Corner handles */}
          <rect x={-RESIZE_HANDLE_SIZE / 2} y={-RESIZE_HANDLE_SIZE / 2}
            width={RESIZE_HANDLE_SIZE} height={RESIZE_HANDLE_SIZE} rx={2}
            fill="white" stroke={statusStroke} strokeWidth={1.5}
            style={{ cursor: 'nwse-resize' }}
            onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onResizeStart(table.id, e.clientX, e.clientY); }} />
          <rect x={w - RESIZE_HANDLE_SIZE / 2} y={-RESIZE_HANDLE_SIZE / 2}
            width={RESIZE_HANDLE_SIZE} height={RESIZE_HANDLE_SIZE} rx={2}
            fill="white" stroke={statusStroke} strokeWidth={1.5}
            style={{ cursor: 'nesw-resize' }}
            onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onResizeStart(table.id, e.clientX, e.clientY); }} />
          <rect x={-RESIZE_HANDLE_SIZE / 2} y={h - RESIZE_HANDLE_SIZE / 2}
            width={RESIZE_HANDLE_SIZE} height={RESIZE_HANDLE_SIZE} rx={2}
            fill="white" stroke={statusStroke} strokeWidth={1.5}
            style={{ cursor: 'nesw-resize' }}
            onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onResizeStart(table.id, e.clientX, e.clientY); }} />
          <rect x={w - RESIZE_HANDLE_SIZE / 2} y={h - RESIZE_HANDLE_SIZE / 2}
            width={RESIZE_HANDLE_SIZE} height={RESIZE_HANDLE_SIZE} rx={2}
            fill="white" stroke={statusStroke} strokeWidth={1.5}
            style={{ cursor: 'nwse-resize' }}
            onPointerDown={handleResizePointerDown} />

          {/* Rotate handle */}
          <g style={{ cursor: 'grab' }} onPointerDown={handleRotatePointerDown}>
            <line x1={w / 2} y1={-4} x2={w / 2} y2={-ROTATE_HANDLE_DISTANCE}
              stroke={statusStroke} strokeWidth={1.5} strokeDasharray="3,2" />
            <circle cx={w / 2} cy={-ROTATE_HANDLE_DISTANCE - 4} r={6}
              fill="white" stroke={statusStroke} strokeWidth={1.5} />
            <text x={w / 2} y={-ROTATE_HANDLE_DISTANCE - 4}
              textAnchor="middle" dominantBaseline="middle" fontSize={8} fill={statusStroke}
              style={{ pointerEvents: 'none' }}>↻</text>
          </g>
        </>
      )}

      {/* Alignment guides */}
      {guides.map((guide, i) => (
        guide.type === 'vertical' ? (
          <line key={`vg-${i}`} x1={guide.position - px} y1={guide.start - py}
            x2={guide.position - px} y2={guide.end - py}
            stroke="#f472b6" strokeWidth={1} strokeDasharray="4,2" opacity={0.7} />
        ) : (
          <line key={`hg-${i}`} x1={guide.start - px} y1={guide.position - py}
            x2={guide.end - px} y2={guide.position - py}
            stroke="#f472b6" strokeWidth={1} strokeDasharray="4,2" opacity={0.7} />
        )
      ))}
    </g>
  );
}

export const TableShapeComp = memo(TableShapeComponent);
