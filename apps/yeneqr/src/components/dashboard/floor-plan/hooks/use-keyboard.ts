// ============================================================
// useKeyboard — Keyboard shortcuts
// ============================================================

'use client';

import { useEffect, useCallback } from 'react';
import type { EditorMode } from '../types';

interface UseKeyboardOptions {
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onDelete: () => void;
  onEscape: () => void;
  onNudge: (dx: number, dy: number) => void;
  onModeChange: (mode: EditorMode) => void;
  hasSelection: boolean;
  editorMode: EditorMode;
}

export function useKeyboard({
  onUndo,
  onRedo,
  onSave,
  onDelete,
  onEscape,
  onNudge,
  onModeChange,
  hasSelection,
  editorMode,
}: UseKeyboardOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;

      // Ctrl+Z → Undo
      if (isCtrl && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        onUndo();
        return;
      }

      // Ctrl+Shift+Z or Ctrl+Y → Redo
      if ((isCtrl && e.shiftKey && e.key === 'z') || (isCtrl && e.key === 'y')) {
        e.preventDefault();
        onRedo();
        return;
      }

      // Ctrl+S → Save
      if (isCtrl && e.key === 's') {
        e.preventDefault();
        onSave();
        return;
      }

      // Ctrl+D → Duplicate (future)
      if (isCtrl && e.key === 'd') {
        e.preventDefault();
        return;
      }

      // Escape
      if (e.key === 'Escape') {
        onEscape();
        return;
      }

      // Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (hasSelection) {
          e.preventDefault();
          onDelete();
        }
        return;
      }

      // Arrow keys → Nudge
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (hasSelection) {
          e.preventDefault();
          const nudge = e.shiftKey ? 10 : 1;
          switch (e.key) {
            case 'ArrowUp': onNudge(0, -nudge); break;
            case 'ArrowDown': onNudge(0, nudge); break;
            case 'ArrowLeft': onNudge(-nudge, 0); break;
            case 'ArrowRight': onNudge(nudge, 0); break;
          }
        }
        return;
      }

      // V → Select mode
      if (e.key === 'v' && !isCtrl) {
        onModeChange('select');
        return;
      }

      // W → Draw wall mode
      if (e.key === 'w' && !isCtrl) {
        onModeChange('draw-wall');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onUndo, onRedo, onSave, onDelete, onEscape, onNudge, onModeChange, hasSelection, editorMode]);
}
