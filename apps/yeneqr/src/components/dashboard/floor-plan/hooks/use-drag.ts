// ============================================================
// useDrag — DnD with pointer events
// ============================================================

'use client';

import { useState, useCallback, useRef } from 'react';
import type { DragState, FloorElement } from '../types';

export function useDrag() {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    elementId: null,
    elementKind: null,
    offsetX: 0,
    offsetY: 0,
    startX: 0,
    startY: 0,
  });

  const startDrag = useCallback((
    elementId: string,
    elementKind: FloorElement['kind'],
    clientX: number,
    clientY: number,
    elementX: number,
    elementY: number,
  ) => {
    setDragState({
      isDragging: true,
      elementId,
      elementKind,
      offsetX: clientX - elementX,
      offsetY: clientY - elementY,
      startX: elementX,
      startY: elementY,
    });
  }, []);

  const updateDrag = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!dragState.isDragging) return null;
    return {
      x: clientX - dragState.offsetX,
      y: clientY - dragState.offsetY,
    };
  }, [dragState]);

  const endDrag = useCallback((): { elementId: string | null; dx: number; dy: number } => {
    const result = {
      elementId: dragState.elementId,
      dx: 0,
      dy: 0,
    };
    setDragState({
      isDragging: false,
      elementId: null,
      elementKind: null,
      offsetX: 0,
      offsetY: 0,
      startX: 0,
      startY: 0,
    });
    return result;
  }, [dragState]);

  const cancelDrag = useCallback(() => {
    setDragState({
      isDragging: false,
      elementId: null,
      elementKind: null,
      offsetX: 0,
      offsetY: 0,
      startX: 0,
      startY: 0,
    });
  }, []);

  return {
    dragState,
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,
  };
}
