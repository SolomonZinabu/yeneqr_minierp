// ============================================================
// Yene QR — Branch Change Hook
// Listens for the 'branch-changed' custom event and triggers
// a callback. This is more reliable than useEffect deps when
// dealing with stale closures in SSE/interval callbacks.
// ============================================================

'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '@/lib/store'

/**
 * Hook that calls `onBranchChange` whenever the user switches branches.
 * Uses a combination of:
 *  1. Custom 'branch-changed' event (guaranteed to fire from the store)
 *  2. Zustand's branchChangeVersion counter (for React-driven re-fetches)
 *
 * Returns the current branchId so the caller can pass it to API calls.
 */
export function useBranchChange(onBranchChange: (branchId: string) => void) {
  const selectedBranchId = useAppStore((s) => s.selectedBranchId)
  const branchChangeVersion = useAppStore((s) => s.branchChangeVersion)
  const callbackRef = useRef(onBranchChange)

  // Keep callback ref in sync
  useEffect(() => {
    callbackRef.current = onBranchChange
  }, [onBranchChange])

  // Listen for the custom 'branch-changed' DOM event (fires immediately,
  // bypasses React's scheduling — ensures re-fetch happens even if the
  // component hasn't re-rendered yet)
  useEffect(() => {
    const handler = (e: Event) => {
      const { branchId } = (e as CustomEvent).detail
      console.log('[useBranchChange] branch-changed event received, branchId:', branchId)
      callbackRef.current(branchId)
    }
    window.addEventListener('branch-changed', handler)
    return () => window.removeEventListener('branch-changed', handler)
  }, [])

  // Also trigger when branchChangeVersion changes (React-driven path)
  useEffect(() => {
    if (branchChangeVersion > 0) {
      console.log('[useBranchChange] branchChangeVersion changed:', branchChangeVersion, 'branchId:', selectedBranchId)
      callbackRef.current(selectedBranchId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchChangeVersion])

  return selectedBranchId
}

/**
 * Simpler hook: just returns the current branchId from the store,
 * re-rendering whenever it changes. Use in component body for rendering.
 */
export function useCurrentBranchId() {
  return useAppStore((s) => s.selectedBranchId)
}
