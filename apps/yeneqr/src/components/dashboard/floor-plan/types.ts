// ============================================================
// Yene QR — Floor Plan Editor Types
// ============================================================

import type { LucideIcon } from 'lucide-react';

// ── Table Status & Shape ──────────────────────────────────────

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning';
export type TableShape = 'round' | 'square' | 'rectangle' | 'oval' | 'l-shape' | 'u-shape' | 'booth' | 'high-top';

// ── Editor Mode ───────────────────────────────────────────────

export type EditorMode = 'select' | 'draw-wall' | 'operations';

// ── Wall Types ────────────────────────────────────────────────

export type WallType = 'thick' | 'thin' | 'glass';

// ── Door Types ────────────────────────────────────────────────

export type DoorType = 'single' | 'double' | 'sliding';

// ── Window Types ──────────────────────────────────────────────

export type WindowType = 'standard' | 'bay';

// ── Room / Obstacle Types ─────────────────────────────────────

export type RoomType =
  | 'kitchen' | 'bar' | 'restroom-m' | 'restroom-f'
  | 'storage' | 'office' | 'lounge' | 'stage'
  | 'entrance' | 'staff-room';

// ── Outdoor Types ─────────────────────────────────────────────

export type OutdoorType = 'terrace' | 'garden' | 'patio' | 'parking';

// ── Utility Types ─────────────────────────────────────────────

export type UtilityType = 'column' | 'ac-unit' | 'fire-extinguisher' | 'cash-register' | 'plant';

// ── Element Category ──────────────────────────────────────────

export type ElementCategory = 'tables' | 'walls' | 'doors' | 'windows' | 'rooms' | 'outdoor' | 'utilities';

// ── Data Interfaces ───────────────────────────────────────────

export interface TableData {
  id: string;
  number: string;
  capacity: number;
  status: TableStatus;
  shape: TableShape;
  floorId?: string;
  branchId: string;
  positionX: number | null;
  positionY: number | null;
  width: number;
  height: number;
  rotation: number;
  notes?: string | null;
  isActive: boolean;
  floor?: { id: string; name: string; sortOrder: number } | null;
  branch?: { id: string; name: string } | null;
  _count?: { orders: number; sessions: number };
}

export interface FloorData {
  id: string;
  name: string;
  sortOrder: number;
  width: number;
  height: number;
  walls: string | null;
  obstacles: string | null;
  tables?: TableData[];
  _count?: { tables: number };
}

export interface BranchData {
  id: string;
  name: string;
  floors: FloorData[];
}

// ── Wall Segment ──────────────────────────────────────────────

export interface WallSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  type: WallType;
}

// ── Door Element ──────────────────────────────────────────────

export interface DoorElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  type: DoorType;
  wallId?: string;
}

// ── Window Element ────────────────────────────────────────────

export interface WindowElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  type: WindowType;
  wallId?: string;
}

// ── Room Zone (Obstacle) ──────────────────────────────────────

export interface RoomZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: RoomType | OutdoorType;
  label: string;
  color: string;
}

// ── Column Element ────────────────────────────────────────────

export interface ColumnElement {
  id: string;
  x: number;
  y: number;
  radius: number;
}

// ── Stairs Element ────────────────────────────────────────────

export interface StairsElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  direction: 'up' | 'down';
}

// ── Utility Element ───────────────────────────────────────────

export interface UtilityElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: UtilityType;
  label: string;
}

// ── Combined Floor Element ────────────────────────────────────

export type FloorElement =
  | { kind: 'table'; data: TableData }
  | { kind: 'wall'; data: WallSegment }
  | { kind: 'door'; data: DoorElement }
  | { kind: 'window'; data: WindowElement }
  | { kind: 'room'; data: RoomZone }
  | { kind: 'column'; data: ColumnElement }
  | { kind: 'stairs'; data: StairsElement }
  | { kind: 'utility'; data: UtilityElement };

// ── Tray Item ─────────────────────────────────────────────────

export interface TrayItem {
  id: string;
  category: ElementCategory;
  label: string;
  icon: LucideIcon;
  color: string;
  defaultWidth: number;
  defaultHeight: number;
  shape?: TableShape;
  roomType?: RoomType | OutdoorType;
  utilityType?: UtilityType;
  wallType?: WallType;
  doorType?: DoorType;
  windowType?: WindowType;
}

// ── Tray Category ─────────────────────────────────────────────

export interface TrayCategory {
  id: ElementCategory;
  label: string;
  items: TrayItem[];
}

// ── Status Config ─────────────────────────────────────────────

export interface StatusConfig {
  label: string;
  color: string;
  fill: string;
  stroke: string;
  glow: string;
  icon: LucideIcon;
}

// ── Alignment Guide ───────────────────────────────────────────

export interface AlignmentGuide {
  type: 'horizontal' | 'vertical';
  position: number;
  start: number;
  end: number;
}

// ── Undo/Redo Snapshot ────────────────────────────────────────

export interface EditorSnapshot {
  tables: Array<[string, Partial<TableData>]>;
  walls: WallSegment[];
  doors: DoorElement[];
  windows: WindowElement[];
  rooms: RoomZone[];
  columns: ColumnElement[];
  stairs: StairsElement[];
  utilities: UtilityElement[];
}

// ── Canvas State ──────────────────────────────────────────────

export interface CanvasState {
  zoom: number;
  panX: number;
  panY: number;
  isPanning: boolean;
}

// ── Drag State ────────────────────────────────────────────────

export interface DragState {
  isDragging: boolean;
  elementId: string | null;
  elementKind: FloorElement['kind'] | null;
  offsetX: number;
  offsetY: number;
  startX: number;
  startY: number;
}

// ── Resize State ──────────────────────────────────────────────

export interface ResizeState {
  isResizing: boolean;
  elementId: string | null;
  handle: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  startXPos: number;
  startYPos: number;
}

// ── Rotate State ──────────────────────────────────────────────

export interface RotateState {
  isRotating: boolean;
  elementId: string | null;
  centerX: number;
  centerY: number;
  startAngle: number;
  startRotation: number;
}

// ── Wall Drawing State ────────────────────────────────────────

export interface WallDrawState {
  isDrawing: boolean;
  startPoint: { x: number; y: number } | null;
  previewPoint: { x: number; y: number } | null;
  wallType: WallType;
}

// ── Snap Config ───────────────────────────────────────────────

export interface SnapConfig {
  enabled: boolean;
  gridSize: 25 | 50 | 100;
  showGuides: boolean;
}

// ── Template ──────────────────────────────────────────────────

export interface FloorTemplate {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  width: number;
  height: number;
  walls: WallSegment[];
  rooms: RoomZone[];
  columns: ColumnElement[];
  doors: DoorElement[];
  windows: WindowElement[];
  tableShapes: Array<{
    shape: TableShape;
    x: number;
    y: number;
    number: string;
    capacity: number;
  }>;
}

// ── Selection Info ────────────────────────────────────────────

export interface SelectionInfo {
  kind: FloorElement['kind'];
  id: string;
}
