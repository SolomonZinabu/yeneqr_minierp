// ============================================================
// useUndoRedo — Per-action undo/redo history
// ============================================================

'use client';

import { useRef, useCallback, useState } from 'react';
import { MAX_UNDO_HISTORY } from '../constants';
import type { EditorSnapshot } from '../types';

const EMPTY_SNAPSHOT: EditorSnapshot = {
  tables: [],
  walls: [],
  doors: [],
  windows: [],
  rooms: [],
  columns: [],
  stairs: [],
  utilities: [],
};

export function useUndoRedo() {
  const historyRef = useRef<EditorSnapshot[]>([EMPTY_SNAPSHOT]);
  const indexRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateState = useCallback(() => {
    setCanUndo(indexRef.current > 0);
    setCanRedo(indexRef.current < historyRef.current.length - 1);
  }, []);

  const captureSnapshot = useCallback((): EditorSnapshot => {
    // This will be overridden by the editor to capture current state
    return EMPTY_SNAPSHOT;
  }, []);

  const pushHistory = useCallback((snapshot: EditorSnapshot) => {
    const stack = historyRef.current.slice(0, indexRef.current + 1);
    stack.push(snapshot);
    if (stack.length > MAX_UNDO_HISTORY) stack.shift();
    historyRef.current = stack;
    indexRef.current = stack.length - 1;
    updateState();
  }, [updateState]);

  const undo = useCallback((): EditorSnapshot | null => {
    if (indexRef.current <= 0) return null;
    indexRef.current -= 1;
    updateState();
    return historyRef.current[indexRef.current];
  }, [updateState]);

  const redo = useCallback((): EditorSnapshot | null => {
    if (indexRef.current >= historyRef.current.length - 1) return null;
    indexRef.current += 1;
    updateState();
    return historyRef.current[indexRef.current];
  }, [updateState]);

  const resetHistory = useCallback(() => {
    historyRef.current = [EMPTY_SNAPSHOT];
    indexRef.current = 0;
    updateState();
  }, [updateState]);

  return {
    canUndo,
    canRedo,
    pushHistory,
    undo,
    redo,
    resetHistory,
  };
}
