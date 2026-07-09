// ============================================================
// StatsBar — BOTTOM: table stats
// ============================================================

'use client';

import React, { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Armchair, Users, Clock, SprayCan } from 'lucide-react';
import type { TableStatus } from './types';
import { STATUS_CONFIG } from './constants';

interface StatsBarProps {
  stats: {
    available: number;
    occupied: number;
    reserved: number;
    cleaning: number;
    total: number;
  };
}

const statIcons: Record<TableStatus, React.ElementType> = {
  available: Armchair,
  occupied: Users,
  reserved: Clock,
  cleaning: SprayCan,
};

const statColors: Record<TableStatus, { bg: string; text: string }> = {
  available: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600' },
  occupied: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600' },
  reserved: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600' },
  cleaning: { bg: 'bg-slate-100 dark:bg-slate-900/30', text: 'text-slate-600' },
};

function StatsBarComponent({ stats }: StatsBarProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {(Object.entries(stats) as [TableStatus | 'total', number][]).filter(([k]) => k !== 'total').map(([status, count]) => {
        const config = STATUS_CONFIG[status];
        const Icon = statIcons[status];
        const colors = statColors[status];
        return (
          <Card key={status} className="py-0">
            <CardContent className="p-2.5 flex items-center gap-2.5">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${colors.bg}`}>
                <Icon className={`h-4 w-4 ${colors.text}`} />
              </div>
              <div>
                <p className="text-lg font-bold leading-none">{count}</p>
                <p className="text-[10px] text-muted-foreground">{config.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export const StatsBar = memo(StatsBarComponent);
