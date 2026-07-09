// ============================================================
// Yene QR — Floor Plan Editor Constants
// ============================================================

import {
  Armchair, Users, Clock, SprayCan,
  Circle, Square, RectangleHorizontal,
  Wine, Coffee, DoorOpen, Home, LayoutGrid,
  Columns3, Flame, Snowflake, Paintbrush, Store, TreePine,
  Stars,
  type LucideIcon,
} from 'lucide-react';
import type {
  TableStatus, TableShape, StatusConfig,
  TrayCategory, TrayItem, ElementCategory,
  WallType, DoorType, WindowType, RoomType, OutdoorType, UtilityType,
  FloorTemplate, WallSegment, RoomZone, DoorElement, TableData,
} from './types';

// ── Status Configuration ──────────────────────────────────────

export const STATUS_CONFIG: Record<TableStatus, StatusConfig> = {
  available: {
    label: 'Available',
    color: 'bg-emerald-500',
    fill: '#10b981',
    stroke: '#059669',
    glow: 'rgba(16,185,129,0.3)',
    icon: Armchair,
  },
  occupied: {
    label: 'Occupied',
    color: 'bg-red-500',
    fill: '#ef4444',
    stroke: '#dc2626',
    glow: 'rgba(239,68,68,0.3)',
    icon: Users,
  },
  reserved: {
    label: 'Reserved',
    color: 'bg-amber-500',
    fill: '#f59e0b',
    stroke: '#d97706',
    glow: 'rgba(245,158,11,0.3)',
    icon: Clock,
  },
  cleaning: {
    label: 'Cleaning',
    color: 'bg-slate-400',
    fill: '#94a3b8',
    stroke: '#64748b',
    glow: 'rgba(148,163,184,0.3)',
    icon: SprayCan,
  },
};

// ── Table Shape Defaults ──────────────────────────────────────

export const TABLE_SHAPE_DEFAULTS: Record<TableShape, { w: number; h: number; defaultCapacity: number; label: string }> = {
  round: { w: 70, h: 70, defaultCapacity: 4, label: 'Round' },
  square: { w: 80, h: 80, defaultCapacity: 4, label: 'Square' },
  rectangle: { w: 120, h: 80, defaultCapacity: 6, label: 'Rectangle' },
  oval: { w: 110, h: 75, defaultCapacity: 4, label: 'Oval' },
  'l-shape': { w: 120, h: 100, defaultCapacity: 6, label: 'L-Shape' },
  'u-shape': { w: 140, h: 120, defaultCapacity: 6, label: 'U-Shape' },
  booth: { w: 130, h: 80, defaultCapacity: 4, label: 'Booth' },
  'high-top': { w: 50, h: 50, defaultCapacity: 2, label: 'High-Top' },
};

// ── Room Type Config ──────────────────────────────────────────

export const ROOM_TYPE_CONFIG: Record<RoomType, { label: string; fill: string; icon: LucideIcon; defaultW: number; defaultH: number }> = {
  kitchen: { label: 'Kitchen', fill: '#f97316', icon: Coffee, defaultW: 200, defaultH: 150 },
  bar: { label: 'Bar', fill: '#8b5cf6', icon: Wine, defaultW: 180, defaultH: 80 },
  'restroom-m': { label: 'Restroom M', fill: '#3b82f6', icon: DoorOpen, defaultW: 100, defaultH: 80 },
  'restroom-f': { label: 'Restroom F', fill: '#ec4899', icon: DoorOpen, defaultW: 100, defaultH: 80 },
  storage: { label: 'Storage', fill: '#78716c', icon: Square, defaultW: 120, defaultH: 80 },
  office: { label: 'Office', fill: '#6366f1', icon: Home, defaultW: 120, defaultH: 100 },
  lounge: { label: 'VIP Lounge', fill: '#ec4899', icon: Home, defaultW: 200, defaultH: 150 },
  stage: { label: 'Stage', fill: '#14b8a6', icon: LayoutGrid, defaultW: 200, defaultH: 100 },
  entrance: { label: 'Entrance', fill: '#22c55e', icon: DoorOpen, defaultW: 120, defaultH: 60 },
  'staff-room': { label: 'Staff Room', fill: '#64748b', icon: Home, defaultW: 120, defaultH: 80 },
};

// ── Outdoor Type Config ───────────────────────────────────────

export const OUTDOOR_TYPE_CONFIG: Record<OutdoorType, { label: string; fill: string; icon: LucideIcon; defaultW: number; defaultH: number }> = {
  terrace: { label: 'Terrace', fill: '#84cc16', icon: TreePine, defaultW: 250, defaultH: 200 },
  garden: { label: 'Garden', fill: '#22c55e', icon: TreePine, defaultW: 300, defaultH: 250 },
  patio: { label: 'Patio', fill: '#a3e635', icon: TreePine, defaultW: 200, defaultH: 150 },
  parking: { label: 'Parking', fill: '#78716c', icon: Square, defaultW: 300, defaultH: 200 },
};

// ── Utility Type Config ───────────────────────────────────────

export const UTILITY_TYPE_CONFIG: Record<UtilityType, { label: string; fill: string; icon: LucideIcon; defaultW: number; defaultH: number }> = {
  column: { label: 'Column', fill: '#78716c', icon: Columns3, defaultW: 30, defaultH: 30 },
  'ac-unit': { label: 'AC Unit', fill: '#0ea5e9', icon: Snowflake, defaultW: 60, defaultH: 40 },
  'fire-extinguisher': { label: 'Fire Ext.', fill: '#ef4444', icon: Flame, defaultW: 20, defaultH: 30 },
  'cash-register': { label: 'Register', fill: '#f59e0b', icon: Store, defaultW: 50, defaultH: 40 },
  plant: { label: 'Plant', fill: '#84cc16', icon: TreePine, defaultW: 30, defaultH: 30 },
};

// ── Wall Type Config ──────────────────────────────────────────

export const WALL_TYPE_CONFIG: Record<WallType, { label: string; color: string; thickness: number }> = {
  thick: { label: 'Thick Wall', color: '#1f2937', thickness: 10 },
  thin: { label: 'Thin Wall', color: '#374151', thickness: 5 },
  glass: { label: 'Glass Wall', color: '#93c5fd', thickness: 4 },
};

// ── Door Type Config ──────────────────────────────────────────

export const DOOR_TYPE_CONFIG: Record<DoorType, { label: string; defaultW: number; defaultH: number }> = {
  single: { label: 'Single Door', defaultW: 60, defaultH: 10 },
  double: { label: 'Double Door', defaultW: 100, defaultH: 10 },
  sliding: { label: 'Sliding Door', defaultW: 80, defaultH: 8 },
};

// ── Window Type Config ────────────────────────────────────────

export const WINDOW_TYPE_CONFIG: Record<WindowType, { label: string; defaultW: number; defaultH: number }> = {
  standard: { label: 'Window', defaultW: 80, defaultH: 10 },
  bay: { label: 'Bay Window', defaultW: 120, defaultH: 30 },
};

// ── Element Tray Categories ───────────────────────────────────

export const TRAY_CATEGORIES: TrayCategory[] = [
  {
    id: 'tables',
    label: 'Tables',
    items: [
      { id: 'tray-round', category: 'tables', label: 'Round (4)', icon: Circle, color: '#10b981', defaultWidth: 70, defaultHeight: 70, shape: 'round' },
      { id: 'tray-square', category: 'tables', label: 'Square (4)', icon: Square, color: '#10b981', defaultWidth: 80, defaultHeight: 80, shape: 'square' },
      { id: 'tray-rectangle', category: 'tables', label: 'Rect (6)', icon: RectangleHorizontal, color: '#10b981', defaultWidth: 120, defaultHeight: 80, shape: 'rectangle' },
      { id: 'tray-oval', category: 'tables', label: 'Oval (4)', icon: Circle, color: '#10b981', defaultWidth: 110, defaultHeight: 75, shape: 'oval' },
      { id: 'tray-lshape', category: 'tables', label: 'L-Shape (6)', icon: RectangleHorizontal, color: '#10b981', defaultWidth: 120, defaultHeight: 100, shape: 'l-shape' },
      { id: 'tray-ushape', category: 'tables', label: 'U-Shape (6)', icon: RectangleHorizontal, color: '#10b981', defaultWidth: 140, defaultHeight: 120, shape: 'u-shape' },
      { id: 'tray-booth', category: 'tables', label: 'Booth (4)', icon: RectangleHorizontal, color: '#10b981', defaultWidth: 130, defaultHeight: 80, shape: 'booth' },
      { id: 'tray-hightop', category: 'tables', label: 'High-Top (2)', icon: Circle, color: '#10b981', defaultWidth: 50, defaultHeight: 50, shape: 'high-top' },
    ],
  },
  {
    id: 'walls',
    label: 'Walls',
    items: [
      { id: 'tray-wall-thick', category: 'walls', label: 'Thick Wall', icon: RectangleHorizontal, color: '#1f2937', defaultWidth: 200, defaultHeight: 10, wallType: 'thick' },
      { id: 'tray-wall-thin', category: 'walls', label: 'Thin Wall', icon: RectangleHorizontal, color: '#374151', defaultWidth: 200, defaultHeight: 5, wallType: 'thin' },
      { id: 'tray-wall-glass', category: 'walls', label: 'Glass Wall', icon: RectangleHorizontal, color: '#93c5fd', defaultWidth: 200, defaultHeight: 4, wallType: 'glass' },
    ],
  },
  {
    id: 'doors',
    label: 'Doors',
    items: [
      { id: 'tray-door-single', category: 'doors', label: 'Single Door', icon: DoorOpen, color: '#8b5cf6', defaultWidth: 60, defaultHeight: 10, doorType: 'single' },
      { id: 'tray-door-double', category: 'doors', label: 'Double Door', icon: DoorOpen, color: '#8b5cf6', defaultWidth: 100, defaultHeight: 10, doorType: 'double' },
      { id: 'tray-door-sliding', category: 'doors', label: 'Sliding Door', icon: DoorOpen, color: '#8b5cf6', defaultWidth: 80, defaultHeight: 8, doorType: 'sliding' },
    ],
  },
  {
    id: 'windows',
    label: 'Windows',
    items: [
      { id: 'tray-window-standard', category: 'windows', label: 'Window', icon: Square, color: '#0ea5e9', defaultWidth: 80, defaultHeight: 10, windowType: 'standard' },
      { id: 'tray-window-bay', category: 'windows', label: 'Bay Window', icon: Square, color: '#0ea5e9', defaultWidth: 120, defaultHeight: 30, windowType: 'bay' },
    ],
  },
  {
    id: 'rooms',
    label: 'Rooms',
    items: [
      { id: 'tray-kitchen', category: 'rooms', label: 'Kitchen', icon: Coffee, color: '#f97316', defaultWidth: 200, defaultHeight: 150, roomType: 'kitchen' },
      { id: 'tray-bar', category: 'rooms', label: 'Bar', icon: Wine, color: '#8b5cf6', defaultWidth: 180, defaultHeight: 80, roomType: 'bar' },
      { id: 'tray-restroom-m', category: 'rooms', label: 'Restroom M', icon: DoorOpen, color: '#3b82f6', defaultWidth: 100, defaultHeight: 80, roomType: 'restroom-m' },
      { id: 'tray-restroom-f', category: 'rooms', label: 'Restroom F', icon: DoorOpen, color: '#ec4899', defaultWidth: 100, defaultHeight: 80, roomType: 'restroom-f' },
      { id: 'tray-storage', category: 'rooms', label: 'Storage', icon: Square, color: '#78716c', defaultWidth: 120, defaultHeight: 80, roomType: 'storage' },
      { id: 'tray-office', category: 'rooms', label: 'Office', icon: Home, color: '#6366f1', defaultWidth: 120, defaultHeight: 100, roomType: 'office' },
      { id: 'tray-lounge', category: 'rooms', label: 'VIP Lounge', icon: Home, color: '#ec4899', defaultWidth: 200, defaultHeight: 150, roomType: 'lounge' },
      { id: 'tray-stage', category: 'rooms', label: 'Stage', icon: LayoutGrid, color: '#14b8a6', defaultWidth: 200, defaultHeight: 100, roomType: 'stage' },
      { id: 'tray-entrance', category: 'rooms', label: 'Entrance', icon: DoorOpen, color: '#22c55e', defaultWidth: 120, defaultHeight: 60, roomType: 'entrance' },
      { id: 'tray-staff-room', category: 'rooms', label: 'Staff Room', icon: Home, color: '#64748b', defaultWidth: 120, defaultHeight: 80, roomType: 'staff-room' },
    ],
  },
  {
    id: 'outdoor',
    label: 'Outdoor',
    items: [
      { id: 'tray-terrace', category: 'outdoor', label: 'Terrace', icon: TreePine, color: '#84cc16', defaultWidth: 250, defaultHeight: 200, roomType: 'terrace' },
      { id: 'tray-garden', category: 'outdoor', label: 'Garden', icon: TreePine, color: '#22c55e', defaultWidth: 300, defaultHeight: 250, roomType: 'garden' },
      { id: 'tray-patio', category: 'outdoor', label: 'Patio', icon: TreePine, color: '#a3e635', defaultWidth: 200, defaultHeight: 150, roomType: 'patio' },
      { id: 'tray-parking', category: 'outdoor', label: 'Parking', icon: Square, color: '#78716c', defaultWidth: 300, defaultHeight: 200, roomType: 'parking' },
    ],
  },
  {
    id: 'utilities',
    label: 'Utilities',
    items: [
      { id: 'tray-column', category: 'utilities', label: 'Column', icon: Columns3, color: '#78716c', defaultWidth: 30, defaultHeight: 30, utilityType: 'column' },
      { id: 'tray-ac', category: 'utilities', label: 'AC Unit', icon: Snowflake, color: '#0ea5e9', defaultWidth: 60, defaultHeight: 40, utilityType: 'ac-unit' },
      { id: 'tray-fire', category: 'utilities', label: 'Fire Ext.', icon: Flame, color: '#ef4444', defaultWidth: 20, defaultHeight: 30, utilityType: 'fire-extinguisher' },
      { id: 'tray-register', category: 'utilities', label: 'Register', icon: Store, color: '#f59e0b', defaultWidth: 50, defaultHeight: 40, utilityType: 'cash-register' },
      { id: 'tray-plant', category: 'utilities', label: 'Plant', icon: TreePine, color: '#84cc16', defaultWidth: 30, defaultHeight: 30, utilityType: 'plant' },
    ],
  },
];

// ── Default Floor Size ────────────────────────────────────────

export const DEFAULT_FLOOR_WIDTH = 1200;
export const DEFAULT_FLOOR_HEIGHT = 800;

// ── Min/Max Zoom ──────────────────────────────────────────────

export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 4;

// ── Max Undo History ──────────────────────────────────────────

export const MAX_UNDO_HISTORY = 50;

// ── Chair Config ──────────────────────────────────────────────

export const CHAIR_RADIUS = 6;
export const CHAIR_OFFSET = 8;
export const MAX_CHAIRS = 12;

// ── Resize Handle Size ────────────────────────────────────────

export const RESIZE_HANDLE_SIZE = 10;

// ── Rotate Handle Distance ────────────────────────────────────

export const ROTATE_HANDLE_DISTANCE = 28;

// ── Grid Snap Options ─────────────────────────────────────────

export const GRID_SNAP_OPTIONS = [25, 50, 100] as const;

// ── Collision Threshold ───────────────────────────────────────

export const COLLISION_PADDING = 4;

// ── Alignment Threshold ───────────────────────────────────────

export const ALIGNMENT_THRESHOLD = 5;

// ── Floor Plan Templates ──────────────────────────────────────

export const FLOOR_TEMPLATES: FloorTemplate[] = [
  {
    id: 'ethiopian-traditional',
    name: 'Ethiopian Traditional',
    description: 'Mesob circles around a central stage, perfect for traditional dining',
    icon: Circle,
    width: 1200,
    height: 900,
    walls: [
      { id: 'w1', x1: 0, y1: 0, x2: 1200, y2: 0, thickness: 10, type: 'thick' },
      { id: 'w2', x1: 1200, y1: 0, x2: 1200, y2: 900, thickness: 10, type: 'thick' },
      { id: 'w3', x1: 1200, y1: 900, x2: 0, y2: 900, thickness: 10, type: 'thick' },
      { id: 'w4', x1: 0, y1: 900, x2: 0, y2: 0, thickness: 10, type: 'thick' },
      { id: 'w5', x1: 900, y1: 0, x2: 900, y2: 200, thickness: 6, type: 'thin' },
      { id: 'w6', x1: 900, y1: 200, x2: 1200, y2: 200, thickness: 6, type: 'thin' },
    ],
    rooms: [
      { id: 'r1', x: 900, y: 0, width: 300, height: 200, type: 'kitchen', label: 'Kitchen', color: '#f97316' },
      { id: 'r2', x: 0, y: 700, width: 150, height: 200, type: 'restroom-m', label: 'Restroom M', color: '#3b82f6' },
      { id: 'r3', x: 150, y: 700, width: 150, height: 200, type: 'restroom-f', label: 'Restroom F', color: '#ec4899' },
      { id: 'r4', x: 900, y: 700, width: 300, height: 200, type: 'bar', label: 'Bar', color: '#8b5cf6' },
    ],
    columns: [],
    doors: [
      { id: 'd1', x: 500, y: 900, width: 80, height: 10, rotation: 0, type: 'double' },
    ],
    windows: [
      { id: 'win1', x: 200, y: 0, width: 100, height: 10, rotation: 0, type: 'standard' },
      { id: 'win2', x: 600, y: 0, width: 100, height: 10, rotation: 0, type: 'standard' },
    ],
    tableShapes: [
      { shape: 'round', x: 200, y: 250, number: '1', capacity: 4 },
      { shape: 'round', x: 400, y: 250, number: '2', capacity: 4 },
      { shape: 'round', x: 600, y: 250, number: '3', capacity: 4 },
      { shape: 'round', x: 200, y: 500, number: '4', capacity: 4 },
      { shape: 'round', x: 400, y: 500, number: '5', capacity: 4 },
      { shape: 'round', x: 600, y: 500, number: '6', capacity: 4 },
      { shape: 'round', x: 800, y: 400, number: '7', capacity: 4 },
      { shape: 'round', x: 100, y: 400, number: '8', capacity: 4 },
      // Central stage area
    ],
  },
  {
    id: 'modern-coffee',
    name: 'Modern Coffee House',
    description: 'Small tables, bar counter, and cozy lounge area',
    icon: Coffee,
    width: 1100,
    height: 800,
    walls: [
      { id: 'w1', x1: 0, y1: 0, x2: 1100, y2: 0, thickness: 10, type: 'thick' },
      { id: 'w2', x1: 1100, y1: 0, x2: 1100, y2: 800, thickness: 10, type: 'thick' },
      { id: 'w3', x1: 1100, y1: 800, x2: 0, y2: 800, thickness: 10, type: 'thick' },
      { id: 'w4', x1: 0, y1: 800, x2: 0, y2: 0, thickness: 10, type: 'thick' },
      { id: 'w5', x1: 750, y1: 0, x2: 750, y2: 350, thickness: 4, type: 'glass' },
      { id: 'w6', x1: 0, y1: 550, x2: 400, y2: 550, thickness: 6, type: 'thin' },
    ],
    rooms: [
      { id: 'r1', x: 750, y: 0, width: 350, height: 350, type: 'kitchen', label: 'Kitchen', color: '#f97316' },
      { id: 'r2', x: 0, y: 550, width: 400, height: 250, type: 'lounge', label: 'Lounge', color: '#ec4899' },
      { id: 'r3', x: 900, y: 600, width: 200, height: 200, type: 'restroom-f', label: 'Restroom', color: '#ec4899' },
    ],
    columns: [],
    doors: [
      { id: 'd1', x: 400, y: 800, width: 60, height: 10, rotation: 0, type: 'single' },
      { id: 'd2', x: 750, y: 300, width: 60, height: 10, rotation: 90, type: 'single' },
    ],
    windows: [
      { id: 'win1', x: 100, y: 0, width: 120, height: 10, rotation: 0, type: 'standard' },
      { id: 'win2', x: 350, y: 0, width: 120, height: 10, rotation: 0, type: 'standard' },
      { id: 'win3', x: 550, y: 0, width: 120, height: 10, rotation: 0, type: 'bay' },
    ],
    tableShapes: [
      { shape: 'square', x: 80, y: 80, number: '1', capacity: 2 },
      { shape: 'square', x: 220, y: 80, number: '2', capacity: 2 },
      { shape: 'round', x: 380, y: 100, number: '3', capacity: 4 },
      { shape: 'round', x: 530, y: 100, number: '4', capacity: 4 },
      { shape: 'square', x: 80, y: 250, number: '5', capacity: 2 },
      { shape: 'square', x: 220, y: 250, number: '6', capacity: 2 },
      { shape: 'rectangle', x: 420, y: 280, number: '7', capacity: 6 },
      { shape: 'high-top', x: 650, y: 420, number: '8', capacity: 2 },
      { shape: 'high-top', x: 650, y: 500, number: '9', capacity: 2 },
      { shape: 'round', x: 100, y: 630, number: '10', capacity: 4 },
      { shape: 'oval', x: 250, y: 640, number: '11', capacity: 4 },
    ],
  },
  {
    id: 'fine-dining',
    name: 'Fine Dining',
    description: 'Wide spacing, private booths, and elegant layout',
    icon: Wine,
    width: 1400,
    height: 900,
    walls: [
      { id: 'w1', x1: 0, y1: 0, x2: 1400, y2: 0, thickness: 10, type: 'thick' },
      { id: 'w2', x1: 1400, y1: 0, x2: 1400, y2: 900, thickness: 10, type: 'thick' },
      { id: 'w3', x1: 1400, y1: 900, x2: 0, y2: 900, thickness: 10, type: 'thick' },
      { id: 'w4', x1: 0, y1: 900, x2: 0, y2: 0, thickness: 10, type: 'thick' },
      { id: 'w5', x1: 1050, y1: 0, x2: 1050, y2: 300, thickness: 6, type: 'thin' },
      { id: 'w6', x1: 1050, y1: 300, x2: 1400, y2: 300, thickness: 6, type: 'thin' },
    ],
    rooms: [
      { id: 'r1', x: 1050, y: 0, width: 350, height: 300, type: 'kitchen', label: 'Kitchen', color: '#f97316' },
      { id: 'r2', x: 1050, y: 600, width: 350, height: 300, type: 'bar', label: 'Bar', color: '#8b5cf6' },
      { id: 'r3', x: 0, y: 700, width: 200, height: 200, type: 'restroom-m', label: 'Restroom M', color: '#3b82f6' },
      { id: 'r4', x: 200, y: 700, width: 200, height: 200, type: 'restroom-f', label: 'Restroom F', color: '#ec4899' },
    ],
    columns: [
      { id: 'c1', x: 500, y: 450, radius: 15 },
    ],
    doors: [
      { id: 'd1', x: 600, y: 900, width: 80, height: 10, rotation: 0, type: 'double' },
      { id: 'd2', x: 1050, y: 200, width: 60, height: 10, rotation: 90, type: 'single' },
    ],
    windows: [
      { id: 'win1', x: 100, y: 0, width: 150, height: 10, rotation: 0, type: 'bay' },
      { id: 'win2', x: 400, y: 0, width: 150, height: 10, rotation: 0, type: 'bay' },
      { id: 'win3', x: 700, y: 0, width: 150, height: 10, rotation: 0, type: 'standard' },
    ],
    tableShapes: [
      { shape: 'booth', x: 50, y: 100, number: '1', capacity: 4 },
      { shape: 'booth', x: 50, y: 250, number: '2', capacity: 4 },
      { shape: 'booth', x: 50, y: 400, number: '3', capacity: 4 },
      { shape: 'round', x: 300, y: 120, number: '4', capacity: 4 },
      { shape: 'round', x: 500, y: 120, number: '5', capacity: 4 },
      { shape: 'round', x: 700, y: 120, number: '6', capacity: 4 },
      { shape: 'round', x: 300, y: 320, number: '7', capacity: 4 },
      { shape: 'round', x: 500, y: 320, number: '8', capacity: 4 },
      { shape: 'oval', x: 700, y: 320, number: '9', capacity: 6 },
      { shape: 'rectangle', x: 350, y: 530, number: '10', capacity: 8 },
      { shape: 'rectangle', x: 600, y: 530, number: '11', capacity: 6 },
    ],
  },
  {
    id: 'rooftop-bar',
    name: 'Rooftop Bar',
    description: 'Open floor plan with high-tops and DJ booth',
    icon: Wine,
    width: 1200,
    height: 800,
    walls: [
      { id: 'w1', x1: 0, y1: 0, x2: 300, y2: 0, thickness: 4, type: 'glass' },
      { id: 'w2', x1: 500, y1: 0, x2: 900, y2: 0, thickness: 4, type: 'glass' },
      { id: 'w3', x1: 900, y1: 0, x2: 900, y2: 200, thickness: 6, type: 'thin' },
      { id: 'w4', x1: 900, y1: 200, x2: 1200, y2: 200, thickness: 6, type: 'thin' },
    ],
    rooms: [
      { id: 'r1', x: 900, y: 0, width: 300, height: 200, type: 'bar', label: 'Bar', color: '#8b5cf6' },
      { id: 'r2', x: 0, y: 650, width: 250, height: 150, type: 'stage', label: 'DJ Booth', color: '#14b8a6' },
    ],
    columns: [
      { id: 'c1', x: 300, y: 300, radius: 20 },
      { id: 'c2', x: 700, y: 300, radius: 20 },
    ],
    doors: [
      { id: 'd1', x: 1100, y: 200, width: 60, height: 10, rotation: 90, type: 'single' },
    ],
    windows: [],
    tableShapes: [
      { shape: 'high-top', x: 100, y: 80, number: '1', capacity: 2 },
      { shape: 'high-top', x: 200, y: 80, number: '2', capacity: 2 },
      { shape: 'high-top', x: 350, y: 80, number: '3', capacity: 2 },
      { shape: 'high-top', x: 450, y: 80, number: '4', capacity: 2 },
      { shape: 'round', x: 100, y: 250, number: '5', capacity: 4 },
      { shape: 'round', x: 350, y: 250, number: '6', capacity: 4 },
      { shape: 'round', x: 600, y: 250, number: '7', capacity: 4 },
      { shape: 'round', x: 100, y: 450, number: '8', capacity: 4 },
      { shape: 'oval', x: 350, y: 450, number: '9', capacity: 6 },
      { shape: 'rectangle', x: 600, y: 450, number: '10', capacity: 6 },
      { shape: 'high-top', x: 600, y: 80, number: '11', capacity: 2 },
    ],
  },
  {
    id: 'casual-diner',
    name: 'Casual Diner',
    description: 'Dense seating, counter, and family section',
    icon: Coffee,
    width: 1200,
    height: 850,
    walls: [
      { id: 'w1', x1: 0, y1: 0, x2: 1200, y2: 0, thickness: 10, type: 'thick' },
      { id: 'w2', x1: 1200, y1: 0, x2: 1200, y2: 850, thickness: 10, type: 'thick' },
      { id: 'w3', x1: 1200, y1: 850, x2: 0, y2: 850, thickness: 10, type: 'thick' },
      { id: 'w4', x1: 0, y1: 850, x2: 0, y2: 0, thickness: 10, type: 'thick' },
      { id: 'w5', x1: 900, y1: 0, x2: 900, y2: 250, thickness: 6, type: 'thin' },
      { id: 'w6', x1: 900, y1: 250, x2: 1200, y2: 250, thickness: 6, type: 'thin' },
      { id: 'w7', x1: 0, y1: 550, x2: 600, y2: 550, thickness: 4, type: 'glass' },
    ],
    rooms: [
      { id: 'r1', x: 900, y: 0, width: 300, height: 250, type: 'kitchen', label: 'Kitchen', color: '#f97316' },
      { id: 'r2', x: 900, y: 600, width: 300, height: 250, type: 'bar', label: 'Counter', color: '#8b5cf6' },
      { id: 'r3', x: 0, y: 0, width: 200, height: 150, type: 'entrance', label: 'Entrance', color: '#22c55e' },
      { id: 'r4', x: 700, y: 600, width: 200, height: 250, type: 'restroom-m', label: 'Restroom', color: '#3b82f6' },
    ],
    columns: [],
    doors: [
      { id: 'd1', x: 80, y: 0, width: 80, height: 10, rotation: 0, type: 'double' },
      { id: 'd2', x: 900, y: 150, width: 60, height: 10, rotation: 90, type: 'single' },
    ],
    windows: [
      { id: 'win1', x: 300, y: 0, width: 120, height: 10, rotation: 0, type: 'standard' },
      { id: 'win2', x: 550, y: 0, width: 120, height: 10, rotation: 0, type: 'standard' },
    ],
    tableShapes: [
      { shape: 'square', x: 50, y: 180, number: '1', capacity: 4 },
      { shape: 'square', x: 180, y: 180, number: '2', capacity: 4 },
      { shape: 'square', x: 310, y: 180, number: '3', capacity: 4 },
      { shape: 'square', x: 440, y: 180, number: '4', capacity: 4 },
      { shape: 'rectangle', x: 600, y: 180, number: '5', capacity: 6 },
      { shape: 'rectangle', x: 780, y: 180, number: '6', capacity: 6 },
      { shape: 'square', x: 50, y: 350, number: '7', capacity: 4 },
      { shape: 'square', x: 180, y: 350, number: '8', capacity: 4 },
      { shape: 'square', x: 310, y: 350, number: '9', capacity: 4 },
      { shape: 'square', x: 440, y: 350, number: '10', capacity: 4 },
      { shape: 'rectangle', x: 50, y: 600, number: '11', capacity: 8 },
      { shape: 'round', x: 250, y: 620, number: '12', capacity: 6 },
      { shape: 'round', x: 420, y: 620, number: '13', capacity: 6 },
    ],
  },
];
