// ============================================================
// Canvas — SVG canvas container with zoom/pan/pinch
// ============================================================

'use client';

import React, { memo, useRef, useCallback, useEffect } from 'react';
import type { RoomZone as RoomZoneType, WallSegment, DoorElement, WindowElement, ColumnElement, StairsElement, UtilityElement, AlignmentGuide, EditorMode, SnapConfig, FloorData, TableData } from './types';
import { TableShapeComp } from './table-shape';
import { WallElement } from './wall-element';
import { DoorElementComp } from './door-element';
import { WindowElementComp } from './window-element';
import { RoomZone as RoomZoneComponent } from './room-zone';
import { ColumnElementComp } from './column-element';
import { StairsElementComp } from './stairs-element';
import { GridOverlay } from './grid-overlay';
import { AlignmentGuides } from './alignment-guides';
import { Minimap } from './minimap';
import { STATUS_CONFIG, WALL_TYPE_CONFIG } from './constants';

interface CanvasProps {
  // Data
  floorTables: TableData[];
  floorWalls: WallSegment[];
  floorRooms: RoomZoneType[];
  doors: DoorElement[];
  windows: WindowElement[];
  columns: ColumnElement[];
  stairs: StairsElement[];
  utilities: UtilityElement[];
  currentFloor: FloorData | null;
  floorWidth: number;
  floorHeight: number;

  // Canvas state
  zoom: number;
  panX: number;
  panY: number;
  isPanning: boolean;

  // Editor state
  editorMode: EditorMode;
  selectedIds: Set<string>;
  selectionInfo: { kind: string; id: string } | null;
  snapConfig: SnapConfig;
  collisionMap: Map<string, boolean>;
  guides: AlignmentGuide[];

  // Wall drawing
  wallDrawStart: { x: number; y: number } | null;
  wallDrawPreview: { x: number; y: number } | null;
  wallDrawType: string;

  // Refs
  containerRef: React.RefObject<HTMLDivElement | null>;

  // Actions
  screenToSvg: (clientX: number, clientY: number) => { x: number; y: number };
  onCanvasPointerDown: (e: React.PointerEvent) => void;
  onCanvasPointerMove: (e: React.PointerEvent) => void;
  onCanvasPointerUp: (e: React.PointerEvent) => void;
  onWheelZoom: (e: WheelEvent) => void;
  startPanning: (clientX: number, clientY: number) => void;
  updatePanning: (clientX: number, clientY: number) => void;
  stopPanning: () => void;
  onNavigate: (panX: number, panY: number) => void;

  // Element actions
  onSelectTable: (id: string, multiSelect: boolean) => void;
  onTableDragStart: (id: string, clientX: number, clientY: number, px: number, py: number) => void;
  onTableResizeStart: (id: string, clientX: number, clientY: number) => void;
  onTableRotateStart: (id: string, clientX: number, clientY: number, cx: number, cy: number, startAngle: number, startRotation: number) => void;
  onSelectElement: (kind: string, id: string) => void;
  onElementDragStart: (kind: string, id: string, clientX: number, clientY: number) => void;

  // Tray drop
  onDropFromTray: (item: any, x: number, y: number) => void;
}

function CanvasComponent({
  floorTables, floorWalls, floorRooms, doors, windows, columns, stairs, utilities,
  currentFloor, floorWidth, floorHeight,
  zoom, panX, panY, isPanning,
  editorMode, selectedIds, selectionInfo, snapConfig, collisionMap, guides,
  wallDrawStart, wallDrawPreview, wallDrawType,
  containerRef,
  screenToSvg, onCanvasPointerDown, onCanvasPointerMove, onCanvasPointerUp,
  onWheelZoom, startPanning, updatePanning, stopPanning, onNavigate,
  onSelectTable, onTableDragStart, onTableResizeStart, onTableRotateStart,
  onSelectElement, onElementDragStart,
  onDropFromTray,
}: CanvasProps) {

  // Wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('wheel', onWheelZoom, { passive: false });
    return () => container.removeEventListener('wheel', onWheelZoom);
  }, [onWheelZoom, containerRef]);

  // Global pointer up
  useEffect(() => {
    const handleUp = () => stopPanning();
    window.addEventListener('pointerup', handleUp);
    return () => window.removeEventListener('pointerup', handleUp);
  }, [stopPanning]);

  // Drag-over for tray items
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/tray-item'));
      const pos = screenToSvg(e.clientX, e.clientY);
      onDropFromTray(data, pos.x, pos.y);
    } catch {
      // Invalid drop data
    }
  }, [screenToSvg, onDropFromTray]);

  const containerWidth = 800;
  const containerHeight = 600;

  return (
    <div
      ref={containerRef}
      className="flex-1 rounded-xl border border-border bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 overflow-hidden relative"
      style={{ minHeight: 500 }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Mode indicator */}
      {editorMode !== 'select' && (
        <div className="absolute top-3 left-3 z-10">
          <div className="bg-primary text-primary-foreground text-xs gap-1 px-3 py-1.5 rounded-full flex items-center shadow-md">
            {editorMode === 'draw-wall' && (
              <>
                <span className="font-medium">
                  {wallDrawStart ? 'Click to complete wall' : 'Click to start wall'}
                </span>
              </>
            )}
            {editorMode === 'operations' && (
              <span className="font-medium">Operations Mode — Read Only</span>
            )}
          </div>
        </div>
      )}

      {/* Floor name badge */}
      <div className="absolute top-3 right-3 z-10">
        <div className="bg-background/80 backdrop-blur-sm border border-border text-xs px-3 py-1.5 rounded-full text-muted-foreground font-medium">
          {currentFloor?.name || 'No Floor Selected'}
        </div>
      </div>

      {currentFloor ? (
        <svg
          className="w-full h-full"
          style={{ cursor: isPanning ? 'grabbing' : editorMode === 'select' ? 'default' : 'crosshair' }}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
        >
          <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
            {/* Floor background */}
            <rect width={floorWidth} height={floorHeight} fill="white" rx={4} className="dark:fill-slate-900" />

            {/* Grid */}
            <GridOverlay width={floorWidth} height={floorHeight} snapConfig={snapConfig} />

            {/* Room zones (render behind everything) */}
            {floorRooms.map((room) => (
              <RoomZoneComponent
                key={room.id}
                room={room}
                isSelected={selectedIds.has(room.id)}
                onSelect={(id) => onSelectElement('room', id)}
                onDragStart={(id, cx, cy) => onElementDragStart('room', id, cx, cy)}
              />
            ))}

            {/* Walls */}
            {floorWalls.map((wall) => (
              <WallElement
                key={wall.id}
                wall={wall}
                isSelected={selectedIds.has(wall.id)}
                onSelect={(id) => onSelectElement('wall', id)}
              />
            ))}

            {/* Wall drawing preview */}
            {wallDrawStart && wallDrawPreview && (
              <line
                x1={wallDrawStart.x} y1={wallDrawStart.y}
                x2={wallDrawPreview.x} y2={wallDrawPreview.y}
                stroke={WALL_TYPE_CONFIG[wallDrawType as keyof typeof WALL_TYPE_CONFIG]?.color || '#6366f1'}
                strokeWidth={WALL_TYPE_CONFIG[wallDrawType as keyof typeof WALL_TYPE_CONFIG]?.thickness || 6}
                strokeLinecap="round"
                strokeDasharray="8,4"
                opacity={0.7}
              />
            )}

            {/* Doors */}
            {doors.map((door) => (
              <DoorElementComp
                key={door.id}
                door={door}
                isSelected={selectedIds.has(door.id)}
                onSelect={(id) => onSelectElement('door', id)}
                onDragStart={(id, cx, cy) => onElementDragStart('door', id, cx, cy)}
              />
            ))}

            {/* Windows */}
            {windows.map((win) => (
              <WindowElementComp
                key={win.id}
                window={win}
                isSelected={selectedIds.has(win.id)}
                onSelect={(id) => onSelectElement('window', id)}
                onDragStart={(id, cx, cy) => onElementDragStart('window', id, cx, cy)}
              />
            ))}

            {/* Columns */}
            {columns.map((col) => (
              <ColumnElementComp
                key={col.id}
                column={col}
                isSelected={selectedIds.has(col.id)}
                onSelect={(id) => onSelectElement('column', id)}
                onDragStart={(id, cx, cy) => onElementDragStart('column', id, cx, cy)}
              />
            ))}

            {/* Stairs */}
            {stairs.map((st) => (
              <StairsElementComp
                key={st.id}
                stairs={st}
                isSelected={selectedIds.has(st.id)}
                onSelect={(id) => onSelectElement('stairs', id)}
                onDragStart={(id, cx, cy) => onElementDragStart('stairs', id, cx, cy)}
              />
            ))}

            {/* Utilities */}
            {utilities.map((util) => (
              <g key={util.id}
                transform={`translate(${util.x}, ${util.y})`}
                onPointerDown={(e) => { e.stopPropagation(); onSelectElement('utility', util.id); onElementDragStart('utility', util.id, e.clientX, e.clientY); }}
                style={{ cursor: 'grab' }}
              >
                <rect width={util.width} height={util.height} rx={4}
                  fill={`${UTILITY_TYPE_FILL[util.type] || '#78716c'}22`}
                  stroke={`${UTILITY_TYPE_FILL[util.type] || '#78716c'}66`}
                  strokeWidth={1.5} />
                <text x={util.width / 2} y={util.height / 2 + 1}
                  textAnchor="middle" dominantBaseline="middle"
                  fill={UTILITY_TYPE_FILL[util.type] || '#78716c'}
                  fontSize={7} fontWeight="600" style={{ pointerEvents: 'none' }}>
                  {util.label}
                </text>
                {selectedIds.has(util.id) && (
                  <rect x={-3} y={-3} width={util.width + 6} height={util.height + 6}
                    fill="none" stroke="#f472b6" strokeWidth={1.5} strokeDasharray="4,2" rx={6} />
                )}
              </g>
            ))}

            {/* Tables */}
            {floorTables.map((table) => (
              <TableShapeComp
                key={table.id}
                table={table}
                isSelected={selectedIds.has(table.id)}
                hasCollision={collisionMap.get(table.id) ?? false}
                isOperationsMode={editorMode === 'operations'}
                guides={[]}
                onSelect={onSelectTable}
                onDragStart={onTableDragStart}
                onResizeStart={onTableResizeStart}
                onRotateStart={onTableRotateStart}
              />
            ))}

            {/* Alignment guides */}
            <AlignmentGuides guides={guides} />

            {/* Floor boundary border */}
            <rect width={floorWidth} height={floorHeight} fill="none" stroke="#e2e8f0" strokeWidth={2} rx={4} className="dark:stroke-slate-700" />

            {/* Floor label */}
            <text x={floorWidth - 10} y={floorHeight - 10} textAnchor="end" fontSize={12}
              fill="#94a3b8" fontWeight="500" fontStyle="italic">
              {currentFloor.name} — {floorTables.length} tables
            </text>
          </g>
        </svg>
      ) : (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="h-16 w-16 text-muted-foreground/20 mb-4 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground mb-2">No floor selected</p>
        </div>
      )}

      {/* Minimap */}
      {currentFloor && (
        <Minimap
          floorWidth={floorWidth}
          floorHeight={floorHeight}
          tables={floorTables}
          walls={floorWalls}
          rooms={floorRooms}
          doors={doors}
          windows={windows}
          zoom={zoom}
          panX={panX}
          panY={panY}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}

// Utility fill colors
const UTILITY_TYPE_FILL: Record<string, string> = {
  column: '#78716c',
  'ac-unit': '#0ea5e9',
  'fire-extinguisher': '#ef4444',
  'cash-register': '#f59e0b',
  plant: '#84cc16',
};

export const Canvas = memo(CanvasComponent);
