// ============================================================
// Minimap — Corner mini-map with viewport indicator
// ============================================================

'use client';

import React, { memo, useCallback } from 'react';
import type { TableData, RoomZone, WallSegment, DoorElement, WindowElement } from './types';
import { STATUS_CONFIG, DEFAULT_FLOOR_WIDTH, DEFAULT_FLOOR_HEIGHT } from './constants';

interface MinimapProps {
  floorWidth: number;
  floorHeight: number;
  tables: TableData[];
  walls: WallSegment[];
  rooms: RoomZone[];
  doors: DoorElement[];
  windows: WindowElement[];
  zoom: number;
  panX: number;
  panY: number;
  containerWidth: number;
  containerHeight: number;
  onNavigate: (panX: number, panY: number) => void;
}

function MinimapComponent({
  floorWidth, floorHeight, tables, walls, rooms,
  zoom, panX, panY, containerWidth, containerHeight, onNavigate,
}: MinimapProps) {
  const minimapW = 160;
  const minimapH = Math.round(minimapW * (floorHeight / floorWidth));
  const scale = minimapW / floorWidth;

  // Calculate viewport rect
  const viewW = containerWidth / zoom;
  const viewH = containerHeight / zoom;
  const viewX = -panX / zoom;
  const viewY = -panY / zoom;

  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    // Convert minimap coords to floor coords
    const floorX = clickX / scale;
    const floorY = clickY / scale;
    // Center the viewport at the clicked position
    const newPanX = -(floorX - containerWidth / (2 * zoom)) * zoom;
    const newPanY = -(floorY - containerHeight / (2 * zoom)) * zoom;
    onNavigate(newPanX, newPanY);
  }, [scale, zoom, containerWidth, containerHeight, onNavigate]);

  return (
    <div className="absolute bottom-3 right-3 z-10 bg-background/90 backdrop-blur-sm border border-border rounded-lg shadow-lg overflow-hidden">
      <svg
        width={minimapW}
        height={minimapH}
        onClick={handleClick}
        style={{ cursor: 'pointer' }}
      >
        {/* Floor background */}
        <rect width={minimapW} height={minimapH} fill="#f8fafc" className="dark:fill-slate-900" />

        {/* Rooms */}
        {rooms.map((room, i) => (
          <rect key={`r-${i}`}
            x={room.x * scale} y={room.y * scale}
            width={room.width * scale} height={room.height * scale}
            fill={`${room.color}30`} stroke={`${room.color}60`} strokeWidth={0.5} rx={1} />
        ))}

        {/* Walls */}
        {walls.map((wall, i) => (
          <line key={`w-${i}`}
            x1={wall.x1 * scale} y1={wall.y1 * scale}
            x2={wall.x2 * scale} y2={wall.y2 * scale}
            stroke="#374151" strokeWidth={Math.max(wall.thickness * scale, 0.5)} strokeLinecap="round" />
        ))}

        {/* Tables */}
        {tables.map((table) => {
          const config = STATUS_CONFIG[table.status] || STATUS_CONFIG.available;
          const px = (table.positionX || 0) * scale;
          const py = (table.positionY || 0) * scale;
          const tw = table.width * scale;
          const th = table.height * scale;
          if (table.shape === 'round' || table.shape === 'oval' || table.shape === 'high-top') {
            return (
              <ellipse key={table.id} cx={px + tw / 2} cy={py + th / 2}
                rx={tw / 2} ry={th / 2}
                fill={config.fill} opacity={0.7} />
            );
          }
          return (
            <rect key={table.id} x={px} y={py} width={tw} height={th}
              fill={config.fill} opacity={0.7} rx={1} />
          );
        })}

        {/* Viewport rectangle */}
        <rect
          x={Math.max(0, viewX * scale)}
          y={Math.max(0, viewY * scale)}
          width={Math.min(viewW * scale, minimapW)}
          height={Math.min(viewH * scale, minimapH)}
          fill="none"
          stroke="#f472b6"
          strokeWidth={1.5}
          strokeDasharray="3,1"
          rx={1}
        />

        {/* Border */}
        <rect width={minimapW} height={minimapH} fill="none" stroke="#e2e8f0" strokeWidth={1} rx={0} className="dark:stroke-slate-700" />
      </svg>
    </div>
  );
}

export const Minimap = memo(MinimapComponent);
