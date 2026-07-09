// ============================================================
// ElementTray — LEFT SIDEBAR: categorized draggable elements
// ============================================================

'use client';

import React, { useState, useCallback, memo } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
} from 'lucide-react';
import type { TrayCategory, TrayItem, TableShape } from './types';
import { TRAY_CATEGORIES, TABLE_SHAPE_DEFAULTS } from './constants';

interface ElementTrayProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onAddTable: (shape: TableShape) => void;
}

// Small SVG preview for each item
function TrayItemPreview({ item }: { item: TrayItem }) {
  const size = 28;

  if (item.category === 'tables' && item.shape) {
    const defaults = TABLE_SHAPE_DEFAULTS[item.shape];
    const w = defaults.w;
    const h = defaults.h;
    const scale = Math.min(size / w, size / h) * 0.8;
    const sw = w * scale;
    const sh = h * scale;

    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {item.shape === 'round' || item.shape === 'high-top' ? (
          <circle cx={size / 2} cy={size / 2} r={Math.min(sw, sh) / 2}
            fill={item.color} opacity={0.6} stroke={item.color} strokeWidth={1} />
        ) : item.shape === 'oval' ? (
          <ellipse cx={size / 2} cy={size / 2} rx={sw / 2} ry={sh / 2}
            fill={item.color} opacity={0.6} stroke={item.color} strokeWidth={1} />
        ) : item.shape === 'l-shape' ? (
          <path d={`M ${size * 0.2} ${size * 0.2} L ${size * 0.55} ${size * 0.2} L ${size * 0.55} ${size * 0.5} L ${size * 0.8} ${size * 0.5} L ${size * 0.8} ${size * 0.8} L ${size * 0.2} ${size * 0.8} Z`}
            fill={item.color} opacity={0.6} stroke={item.color} strokeWidth={1} />
        ) : item.shape === 'u-shape' ? (
          <path d={`M ${size * 0.2} ${size * 0.2} L ${size * 0.8} ${size * 0.2} L ${size * 0.8} ${size * 0.8} L ${size * 0.6} ${size * 0.8} L ${size * 0.6} ${size * 0.4} L ${size * 0.4} ${size * 0.4} L ${size * 0.4} ${size * 0.8} L ${size * 0.2} ${size * 0.8} Z`}
            fill={item.color} opacity={0.6} stroke={item.color} strokeWidth={1} />
        ) : item.shape === 'booth' ? (
          <g>
            <rect x={size * 0.15} y={size * 0.15} width={size * 0.7} height={size * 0.2} rx={2}
              fill={item.color} opacity={0.3} />
            <rect x={size * 0.15} y={size * 0.38} width={size * 0.7} height={size * 0.24} rx={2}
              fill={item.color} opacity={0.6} />
            <rect x={size * 0.15} y={size * 0.65} width={size * 0.7} height={size * 0.2} rx={2}
              fill={item.color} opacity={0.3} />
          </g>
        ) : (
          <rect x={(size - sw) / 2} y={(size - sh) / 2} width={sw} height={sh}
            fill={item.color} opacity={0.6} stroke={item.color} strokeWidth={1} rx={2} />
        )}
      </svg>
    );
  }

  if (item.category === 'walls') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <line x1={4} y1={size / 2} x2={size - 4} y2={size / 2}
          stroke={item.color} strokeWidth={item.wallType === 'thick' ? 4 : item.wallType === 'glass' ? 2 : 2}
          strokeDasharray={item.wallType === 'glass' ? '3,2' : undefined} />
      </svg>
    );
  }

  if (item.category === 'doors') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <rect x={4} y={size / 2 - 2} width={size - 8} height={4}
          fill={item.color} opacity={0.4} rx={1} />
        <path d={`M ${size - 6} ${size / 2 + 2} A ${size / 3} ${size / 3} 0 0 1 ${size / 3} ${size / 2 - size / 3}`}
          fill="none" stroke={item.color} strokeWidth={1} strokeDasharray="2,1" />
      </svg>
    );
  }

  if (item.category === 'windows') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <rect x={3} y={size / 2 - 2} width={size - 6} height={4}
          fill="#e0f2fe" stroke={item.color} strokeWidth={1.5} rx={1} />
        <line x1={size / 2} y1={size / 2 - 2} x2={size / 2} y2={size / 2 + 2}
          stroke={item.color} strokeWidth={0.5} />
      </svg>
    );
  }

  if (item.category === 'rooms' || item.category === 'outdoor') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <rect x={3} y={3} width={size - 6} height={size - 6}
          fill={`${item.color}20`} stroke={`${item.color}60`} strokeWidth={1} rx={3}
          strokeDasharray={item.category === 'outdoor' ? '3,2' : undefined} />
      </svg>
    );
  }

  // Utilities
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {item.utilityType === 'column' ? (
        <circle cx={size / 2} cy={size / 2} r={size / 3}
          fill={`${item.color}30`} stroke={item.color} strokeWidth={1.5} />
      ) : (
        <rect x={5} y={8} width={size - 10} height={size - 16}
          fill={`${item.color}20`} stroke={`${item.color}60`} strokeWidth={1} rx={3} />
      )}
    </svg>
  );
}

function TrayItemRow({ item, onAddTable }: { item: TrayItem; onAddTable: (shape: TableShape) => void }) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/tray-item', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleClick = () => {
    if (item.category === 'tables' && item.shape) {
      onAddTable(item.shape);
    }
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={handleClick}
      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-grab active:cursor-grabbing transition-colors group"
    >
      <GripVertical className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0" />
      <TrayItemPreview item={item} />
      <span className="text-xs font-medium truncate">{item.label}</span>
    </div>
  );
}

function CategorySection({ category, onAddTable }: { category: TrayCategory; onAddTable: (shape: TableShape) => void }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="mb-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {category.label}
        <span className="ml-auto text-[10px] text-muted-foreground/60">{category.items.length}</span>
      </button>
      {isOpen && (
        <div className="space-y-0.5 px-1">
          {category.items.map(item => (
            <TrayItemRow key={item.id} item={item} onAddTable={onAddTable} />
          ))}
        </div>
      )}
    </div>
  );
}

function ElementTrayComponent({ collapsed, onToggleCollapse, onAddTable }: ElementTrayProps) {
  if (collapsed) {
    return (
      <div className="w-10 shrink-0 border-r border-border bg-background flex flex-col items-center py-2 gap-2">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onToggleCollapse}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {TRAY_CATEGORIES.map(cat => {
          const Icon = cat.items?.[0]?.icon;
          if (!Icon) return null;
          return <Icon key={cat.id} className="h-4 w-4 text-muted-foreground/50" />;
        })}
      </div>
    );
  }

  return (
    <div className="w-56 shrink-0 border-r border-border bg-background flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Elements</span>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onToggleCollapse}>
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-1">
          {TRAY_CATEGORIES.map(category => (
            <CategorySection key={category.id} category={category} onAddTable={onAddTable} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export const ElementTray = memo(ElementTrayComponent);
