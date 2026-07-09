// ============================================================
// useSnap — Grid snap + smart alignment
// ============================================================

'use client';

import { useCallback, useMemo } from 'react';
import { ALIGNMENT_THRESHOLD } from '../constants';
import type { SnapConfig, AlignmentGuide, TableData, RoomZone } from '../types';

interface SnapResult {
  x: number;
  y: number;
  guides: AlignmentGuide[];
}

interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

function getElementBounds(x: number, y: number, w: number, h: number): ElementBounds {
  return {
    x, y, width: w, height: h,
    centerX: x + w / 2,
    centerY: y + h / 2,
  };
}

export function useSnap(
  snapConfig: SnapConfig,
  tables: TableData[],
  rooms: RoomZone[],
  floorWidth: number,
  floorHeight: number,
) {
  // Collect bounds of all existing elements
  const existingBounds = useMemo<ElementBounds[]>(() => {
    const bounds: ElementBounds[] = [];
    for (const t of tables) {
      const px = t.positionX ?? 0;
      const py = t.positionY ?? 0;
      bounds.push(getElementBounds(px, py, t.width, t.height));
    }
    for (const r of rooms) {
      bounds.push(getElementBounds(r.x, r.y, r.width, r.height));
    }
    // Floor boundary guides
    bounds.push(getElementBounds(0, 0, floorWidth, floorHeight));
    return bounds;
  }, [tables, rooms, floorWidth, floorHeight]);

  const snapToGrid = useCallback((value: number): number => {
    if (!snapConfig.enabled) return value;
    return Math.round(value / snapConfig.gridSize) * snapConfig.gridSize;
  }, [snapConfig.enabled, snapConfig.gridSize]);

  const computeSnap = useCallback(
    (rawX: number, rawY: number, elemW: number, elemH: number, excludeId?: string): SnapResult => {
      let x = rawX;
      let y = rawY;
      const guides: AlignmentGuide[] = [];

      // Grid snap
      if (snapConfig.enabled) {
        x = snapToGrid(x);
        y = snapToGrid(y);
      }

      if (!snapConfig.showGuides) {
        return { x, y, guides };
      }

      const movingBounds = getElementBounds(x, y, elemW, elemH);
      const threshold = ALIGNMENT_THRESHOLD;

      for (const existing of existingBounds) {
        // Vertical alignment guides (left, right, center)
        const vChecks = [
          { pos: movingBounds.x, start: Math.min(movingBounds.y, existing.y), end: Math.max(movingBounds.y + movingBounds.height, existing.y + existing.height) },
          { pos: movingBounds.x + movingBounds.width, start: Math.min(movingBounds.y, existing.y), end: Math.max(movingBounds.y + movingBounds.height, existing.y + existing.height) },
          { pos: movingBounds.centerX, start: Math.min(movingBounds.y, existing.y), end: Math.max(movingBounds.y + movingBounds.height, existing.y + existing.height) },
        ];
        // Horizontal alignment guides (top, bottom, center)
        const hChecks = [
          { pos: movingBounds.y, start: Math.min(movingBounds.x, existing.x), end: Math.max(movingBounds.x + movingBounds.width, existing.x + existing.width) },
          { pos: movingBounds.y + movingBounds.height, start: Math.min(movingBounds.x, existing.x), end: Math.max(movingBounds.x + movingBounds.width, existing.x + existing.width) },
          { pos: movingBounds.centerY, start: Math.min(movingBounds.x, existing.x), end: Math.max(movingBounds.x + movingBounds.width, existing.x + existing.width) },
        ];

        // Check vertical alignments against existing element edges
        for (const check of vChecks) {
          if (Math.abs(check.pos - existing.x) < threshold) {
            const diff = existing.x - check.pos;
            x += diff;
            guides.push({ type: 'vertical', position: existing.x, start: check.start, end: check.end });
          } else if (Math.abs(check.pos - (existing.x + existing.width)) < threshold) {
            const diff = existing.x + existing.width - check.pos;
            x += diff;
            guides.push({ type: 'vertical', position: existing.x + existing.width, start: check.start, end: check.end });
          } else if (Math.abs(check.pos - existing.centerX) < threshold) {
            const diff = existing.centerX - check.pos;
            x += diff;
            guides.push({ type: 'vertical', position: existing.centerX, start: check.start, end: check.end });
          }
        }

        // Check horizontal alignments
        for (const check of hChecks) {
          if (Math.abs(check.pos - existing.y) < threshold) {
            const diff = existing.y - check.pos;
            y += diff;
            guides.push({ type: 'horizontal', position: existing.y, start: check.start, end: check.end });
          } else if (Math.abs(check.pos - (existing.y + existing.height)) < threshold) {
            const diff = existing.y + existing.height - check.pos;
            y += diff;
            guides.push({ type: 'horizontal', position: existing.y + existing.height, start: check.start, end: check.end });
          } else if (Math.abs(check.pos - existing.centerY) < threshold) {
            const diff = existing.centerY - check.pos;
            y += diff;
            guides.push({ type: 'horizontal', position: existing.centerY, start: check.start, end: check.end });
          }
        }
      }

      return { x, y, guides };
    },
    [snapConfig, existingBounds, snapToGrid],
  );

  return { snapToGrid, computeSnap };
}
