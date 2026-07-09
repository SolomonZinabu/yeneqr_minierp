// ============================================================
// useCanvas — Zoom, Pan, Coordinate Transforms
// ============================================================

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { MIN_ZOOM, MAX_ZOOM, DEFAULT_FLOOR_WIDTH, DEFAULT_FLOOR_HEIGHT } from '../constants';

interface UseCanvasOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  floorWidth?: number;
  floorHeight?: number;
}

export function useCanvas({ containerRef, floorWidth = DEFAULT_FLOOR_WIDTH, floorHeight = DEFAULT_FLOOR_HEIGHT }: UseCanvasOptions) {
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(20);
  const [panY, setPanY] = useState(20);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panStartPanRef = useRef({ x: 0, y: 0 });

  const screenToSvg = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panX) / zoom,
      y: (clientY - rect.top - panY) / zoom,
    };
  }, [zoom, panX, panY, containerRef]);

  const handleZoomIn = useCallback(() => {
    setZoom(z => Math.min(z * 1.15, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(z => Math.max(z * 0.87, MIN_ZOOM));
  }, []);

  const handleZoomFit = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cw = container.clientWidth - 40;
    const ch = container.clientHeight - 40;
    const fw = floorWidth || DEFAULT_FLOOR_WIDTH;
    const fh = floorHeight || DEFAULT_FLOOR_HEIGHT;
    const scale = Math.min(cw / fw, ch / fh, 1.5);
    setZoom(scale);
    setPanX(20);
    setPanY(20);
  }, [containerRef, floorWidth, floorHeight]);

  const handleWheelZoom = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    setZoom(z => Math.min(Math.max(z * delta, MIN_ZOOM), MAX_ZOOM));
  }, []);

  const startPanning = useCallback((clientX: number, clientY: number) => {
    setIsPanning(true);
    panStartRef.current = { x: clientX, y: clientY };
    panStartPanRef.current = { x: panX, y: panY };
  }, [panX, panY]);

  const updatePanning = useCallback((clientX: number, clientY: number) => {
    if (!isPanning) return;
    const dx = clientX - panStartRef.current.x;
    const dy = clientY - panStartRef.current.y;
    setPanX(panStartPanRef.current.x + dx);
    setPanY(panStartPanRef.current.y + dy);
  }, [isPanning]);

  const stopPanning = useCallback(() => {
    setIsPanning(false);
  }, []);

  const setZoomLevel = useCallback((level: number) => {
    setZoom(Math.min(Math.max(level, MIN_ZOOM), MAX_ZOOM));
  }, []);

  return {
    zoom,
    panX,
    panY,
    isPanning,
    screenToSvg,
    handleZoomIn,
    handleZoomOut,
    handleZoomFit,
    handleWheelZoom,
    startPanning,
    updatePanning,
    stopPanning,
    setZoomLevel,
    setPanX,
    setPanY,
  };
}
