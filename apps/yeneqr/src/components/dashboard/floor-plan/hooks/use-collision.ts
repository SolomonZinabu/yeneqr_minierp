// ============================================================
// useCollision — Overlap detection
// ============================================================

'use client';

import { useMemo, useCallback } from 'react';
import { COLLISION_PADDING } from '../constants';
import type { TableData, RoomZone } from '../types';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function rectsOverlap(a: Rect, b: Rect, padding: number): boolean {
  return (
    a.x - padding < b.x + b.width + padding &&
    a.x + a.width + padding > b.x - padding &&
    a.y - padding < b.y + b.height + padding &&
    a.y + a.height + padding > b.y - padding
  );
}

export function useCollision(
  tables: TableData[],
  rooms: RoomZone[],
) {
  // For each table, check if it overlaps with any other table
  const collisionMap = useMemo<Map<string, boolean>>(() => {
    const map = new Map<string, boolean>();
    for (let i = 0; i < tables.length; i++) {
      const a = tables[i];
      const rectA: Rect = {
        x: a.positionX ?? 0,
        y: a.positionY ?? 0,
        width: a.width,
        height: a.height,
      };
      for (let j = i + 1; j < tables.length; j++) {
        const b = tables[j];
        const rectB: Rect = {
          x: b.positionX ?? 0,
          y: b.positionY ?? 0,
          width: b.width,
          height: b.height,
        };
        if (rectsOverlap(rectA, rectB, COLLISION_PADDING)) {
          map.set(a.id, true);
          map.set(b.id, true);
        }
      }
    }
    return map;
  }, [tables]);

  const hasCollision = useCallback((id: string): boolean => {
    return collisionMap.get(id) ?? false;
  }, [collisionMap]);

  return { collisionMap, hasCollision };
}
