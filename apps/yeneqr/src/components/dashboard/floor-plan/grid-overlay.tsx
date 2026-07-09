// ============================================================
// GridOverlay — Grid with snap-to-grid support
// ============================================================

'use client';

import React, { memo } from 'react';
import type { SnapConfig } from './types';

interface GridOverlayProps {
  width: number;
  height: number;
  snapConfig: SnapConfig;
}

function GridOverlayComponent({ width, height, snapConfig }: GridOverlayProps) {
  const gridSize = snapConfig.gridSize;

  return (
    <>
      <defs>
        <pattern id="grid-small" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
          <path
            d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
            fill="none"
            stroke="rgba(0,0,0,0.04)"
            strokeWidth={0.5}
          />
        </pattern>
        <pattern id="grid-large" width={gridSize * 4} height={gridSize * 4} patternUnits="userSpaceOnUse">
          <rect width={gridSize * 4} height={gridSize * 4} fill="url(#grid-small)" />
          <path
            d={`M ${gridSize * 4} 0 L 0 0 0 ${gridSize * 4}`}
            fill="none"
            stroke="rgba(0,0,0,0.08)"
            strokeWidth={1}
          />
        </pattern>
      </defs>
      <rect width={width} height={height} fill="url(#grid-large)" />
    </>
  );
}

export const GridOverlay = memo(GridOverlayComponent);
