// ============================================================
// useFloorEditor — Core editor state + actions
// ============================================================

'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { useBranchChange } from '@/hooks/use-branch-change';
import { toast } from 'sonner';
import type {
  TableData, FloorData, BranchData, TableStatus, TableShape,
  EditorMode, WallSegment, DoorElement, WindowElement, RoomZone,
  ColumnElement, StairsElement, UtilityElement, SnapConfig,
  WallType, DoorType, WindowType, RoomType, OutdoorType, UtilityType,
  EditorSnapshot, TrayItem, SelectionInfo,
} from '../types';
import {
  STATUS_CONFIG, TABLE_SHAPE_DEFAULTS, ROOM_TYPE_CONFIG,
  OUTDOOR_TYPE_CONFIG, UTILITY_TYPE_CONFIG, WALL_TYPE_CONFIG,
  DOOR_TYPE_CONFIG, WINDOW_TYPE_CONFIG, DEFAULT_FLOOR_WIDTH, DEFAULT_FLOOR_HEIGHT,
} from '../constants';
import { useUndoRedo } from './use-undo-redo';

let idCounter = 0;
function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${++idCounter}`;
}

export function useFloorEditor() {
  const { selectedTableId, setSelectedTableId, user, selectedBranchId, setSelectedBranchId: setGlobalBranchId, branchChangeVersion } = useAppStore();
  const restaurantId = user?.restaurantId || '';

  // ── Data state ────────────────────────────────────────────
  const [branches, setBranches] = useState<BranchData[]>([]);
  const [allTables, setAllTables] = useState<TableData[]>([]);
  const [floors, setFloors] = useState<FloorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFloorId, setSelectedFloorId] = useState('');

  const fetchDataRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const fetchFloorsRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const handleBranchChange = useCallback((newBranchId: string) => {
    console.log('[useFloorEditor] handleBranchChange called with:', newBranchId);
    setLoading(true);
    setAllTables([]);
    setBranches([]);
    fetchDataRef.current?.();
    fetchFloorsRef.current?.();
  }, []);

  useBranchChange(handleBranchChange);

  // ── Editor state ──────────────────────────────────────────
  const [editorMode, setEditorMode] = useState<EditorMode>('select');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionInfo, setSelectionInfo] = useState<SelectionInfo | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snapConfig, setSnapConfig] = useState<SnapConfig>({
    enabled: true,
    gridSize: 50,
    showGuides: true,
  });

  // ── Local unsaved state ──────────────────────────────────
  const [localTables, setLocalTables] = useState<Map<string, Partial<TableData>>>(new Map());
  const [localWalls, setLocalWalls] = useState<WallSegment[]>([]);
  const [localDoors, setLocalDoors] = useState<DoorElement[]>([]);
  const [localWindows, setLocalWindows] = useState<WindowElement[]>([]);
  const [localRooms, setLocalRooms] = useState<RoomZone[]>([]);
  const [localColumns, setLocalColumns] = useState<ColumnElement[]>([]);
  const [localStairs, setLocalStairs] = useState<StairsElement[]>([]);
  const [localUtilities, setLocalUtilities] = useState<UtilityElement[]>([]);

  // ── Wall drawing state ───────────────────────────────────
  const [wallDrawStart, setWallDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [wallDrawPreview, setWallDrawPreview] = useState<{ x: number; y: number } | null>(null);
  const [wallDrawType, setWallDrawType] = useState<WallType>('thick');

  // ── Dialog state ─────────────────────────────────────────
  const [isAddTableOpen, setIsAddTableOpen] = useState(false);
  const [isEditTableOpen, setIsEditTableOpen] = useState(false);
  const [isAddFloorOpen, setIsAddFloorOpen] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableData | null>(null);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState('4');
  const [newTableShape, setNewTableShape] = useState<TableShape>('square');
  const [newFloorName, setNewFloorName] = useState('');
  const [adding, setAdding] = useState(false);

  // ── Drag/resize/rotate refs ──────────────────────────────
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0, px: 0, py: 0 });
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [rotateCenter, setRotateCenter] = useState({ cx: 0, cy: 0, startAngle: 0, startRotation: 0 });

  // ── Undo/Redo ────────────────────────────────────────────
  const undoRedo = useUndoRedo();

  const captureSnapshot = useCallback((): EditorSnapshot => ({
    tables: Array.from(localTables.entries()),
    walls: [...localWalls],
    doors: [...localDoors],
    windows: [...localWindows],
    rooms: [...localRooms],
    columns: [...localColumns],
    stairs: [...localStairs],
    utilities: [...localUtilities],
  }), [localTables, localWalls, localDoors, localWindows, localRooms, localColumns, localStairs, localUtilities]);

  const restoreSnapshot = useCallback((snapshot: EditorSnapshot) => {
    setLocalTables(new Map(snapshot.tables));
    setLocalWalls([...snapshot.walls]);
    setLocalDoors([...snapshot.doors]);
    setLocalWindows([...snapshot.windows]);
    setLocalRooms([...snapshot.rooms]);
    setLocalColumns([...snapshot.columns]);
    setLocalStairs([...snapshot.stairs]);
    setLocalUtilities([...snapshot.utilities]);
    const hasChanges = snapshot.tables.length > 0 || snapshot.walls.length > 0 ||
      snapshot.doors.length > 0 || snapshot.windows.length > 0 ||
      snapshot.rooms.length > 0 || snapshot.columns.length > 0 ||
      snapshot.stairs.length > 0 || snapshot.utilities.length > 0;
    setHasUnsavedChanges(hasChanges);
  }, []);

  // ── Data fetching ────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const [branchesRes, tablesRes] = await Promise.all([
        api.get<{ data: BranchData[] }>(`/api/restaurants/${restaurantId}/branches`),
        api.get<{ data: TableData[] }>(`/api/restaurants/${restaurantId}/tables`),
      ]);
      const branchData = branchesRes.data || [];
      const tableData = tablesRes.data || [];
      setBranches(branchData);
      setAllTables(tableData);
      const currentBranchId = useAppStore.getState().selectedBranchId;
      if (branchData.length > 0 && !currentBranchId) {
        setGlobalBranchId(branchData[0].id);
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [restaurantId, setGlobalBranchId]);

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchDataRef.current = fetchData; }, [fetchData]);

  const fetchFloors = useCallback(async () => {
    const branchId = useAppStore.getState().selectedBranchId;
    if (!restaurantId || !branchId) return;
    try {
      const res = await api.get<{ data: FloorData[] }>(
        `/api/restaurants/${restaurantId}/floors?branchId=${branchId}`
      );
      setFloors(res.data || []);
      if (res.data && res.data.length > 0 && !selectedFloorId) {
        setSelectedFloorId(res.data[0].id);
      }
    } catch {
      // Silent
    }
  }, [restaurantId, selectedFloorId, setGlobalBranchId]);

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchFloorsRef.current = fetchFloors; }, [fetchFloors]);

  useEffect(() => { fetchData(); }, [fetchData, selectedBranchId, branchChangeVersion]);
  useEffect(() => { fetchFloors(); }, [fetchFloors, selectedBranchId, branchChangeVersion]);

  // ── Computed data ────────────────────────────────────────

  const currentFloor = useMemo(() =>
    floors.find(f => f.id === selectedFloorId) || floors[0] || null
  , [floors, selectedFloorId]);

  const floorWidth = currentFloor?.width || DEFAULT_FLOOR_WIDTH;
  const floorHeight = currentFloor?.height || DEFAULT_FLOOR_HEIGHT;

  const floorTables = useMemo(() => {
    const ft = allTables.filter(t => t.floorId === (currentFloor?.id) && t.isActive);
    return ft.map(t => {
      const local = localTables.get(t.id);
      return local ? { ...t, ...local } : t;
    });
  }, [allTables, currentFloor, localTables]);

  const serverWalls: WallSegment[] = useMemo(() => {
    if (!currentFloor?.walls) return [];
    try {
      const parsed = JSON.parse(currentFloor.walls);
      return parsed.map((w: any, i: number) => ({
        ...w,
        id: w.id || `wall-${i}`,
      }));
    } catch { return []; }
  }, [currentFloor]);

  const serverRooms: RoomZone[] = useMemo(() => {
    if (!currentFloor?.obstacles) return [];
    try {
      const obs = JSON.parse(currentFloor.obstacles);
      return obs.map((o: any, i: number) => ({
        id: o.id || `room-${i}`,
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
        type: o.type || 'other',
        label: o.label || 'Room',
        color: o.color || '#78716c',
      })) as RoomZone[];
    } catch { return []; }
  }, [currentFloor]);

  const floorWalls = useMemo(() =>
    localWalls.length > 0 ? localWalls : serverWalls
  , [localWalls, serverWalls]);

  const floorRooms = useMemo(() =>
    localRooms.length > 0 ? localRooms : serverRooms
  , [localRooms, serverRooms]);

  const stats = useMemo(() => {
    const bt = allTables.filter(t => t.branchId === selectedBranchId);
    return {
      available: bt.filter(t => t.status === 'available').length,
      occupied: bt.filter(t => t.status === 'occupied').length,
      reserved: bt.filter(t => t.status === 'reserved').length,
      cleaning: bt.filter(t => t.status === 'cleaning').length,
      total: bt.length,
    };
  }, [allTables, selectedBranchId]);

  const selectedTable = useMemo(
    () => floorTables.find(t => t.id === selectedTableId) || null,
    [floorTables, selectedTableId]
  );

  // ── Selection ────────────────────────────────────────────

  const selectElement = useCallback((kind: SelectionInfo['kind'], id: string, multiSelect: boolean = false) => {
    if (multiSelect) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      setSelectedIds(new Set([id]));
    }
    setSelectionInfo({ kind, id });
    if (kind === 'table') {
      setSelectedTableId(id);
    }
  }, [setSelectedTableId]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionInfo(null);
    setSelectedTableId(null);
  }, [setSelectedTableId]);

  // ── Table actions ────────────────────────────────────────

  const handleAddTable = useCallback(async () => {
    if (!newTableNumber) { toast.error('Table number is required'); return; }
    try {
      setAdding(true);
      await api.post(`/api/restaurants/${restaurantId}/tables`, {
        number: newTableNumber,
        capacity: parseInt(newTableCapacity) || 4,
        shape: newTableShape,
        branchId: useAppStore.getState().selectedBranchId,
        floorId: selectedFloorId || undefined,
        width: TABLE_SHAPE_DEFAULTS[newTableShape].w,
        height: TABLE_SHAPE_DEFAULTS[newTableShape].h,
      });
      toast.success(`Table ${newTableNumber} added`);
      setIsAddTableOpen(false);
      setNewTableNumber('');
      setNewTableCapacity('4');
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add table';
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  }, [newTableNumber, newTableCapacity, newTableShape, restaurantId, selectedFloorId, fetchData]);

  const handleEditTable = useCallback(async () => {
    if (!editingTable) return;
    try {
      setAdding(true);
      await api.put(`/api/restaurants/${restaurantId}/tables/${editingTable.id}`, {
        number: editingTable.number,
        capacity: editingTable.capacity,
        shape: editingTable.shape,
        notes: editingTable.notes,
      });
      toast.success('Table updated');
      setIsEditTableOpen(false);
      setEditingTable(null);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setAdding(false);
    }
  }, [editingTable, restaurantId, fetchData]);

  const handleDeleteTable = useCallback(async (tableId: string) => {
    if (!confirm('Delete this table?')) return;
    try {
      await api.delete(`/api/restaurants/${restaurantId}/tables/${tableId}`);
      toast.success('Table deleted');
      clearSelection();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  }, [restaurantId, fetchData, clearSelection]);

  const handleStatusChange = useCallback(async (tableId: string, newStatus: TableStatus) => {
    try {
      await api.put(`/api/restaurants/${restaurantId}/tables/${tableId}`, { status: newStatus });
      toast.success(`Table marked as ${STATUS_CONFIG[newStatus].label}`);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  }, [restaurantId, fetchData]);

  // ── Floor actions ────────────────────────────────────────

  const handleAddFloor = useCallback(async () => {
    if (!newFloorName) { toast.error('Floor name is required'); return; }
    try {
      setAdding(true);
      await api.post(`/api/restaurants/${restaurantId}/floors`, {
        branchId: useAppStore.getState().selectedBranchId,
        name: newFloorName,
      });
      toast.success(`Floor "${newFloorName}" added`);
      setIsAddFloorOpen(false);
      setNewFloorName('');
      fetchFloors();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add floor');
    } finally {
      setAdding(false);
    }
  }, [newFloorName, restaurantId, fetchFloors]);

  const handleDeleteFloor = useCallback(async (floorId: string) => {
    if (!confirm('Delete this floor? Tables will be unassigned but not deleted.')) return;
    try {
      await api.delete(`/api/restaurants/${restaurantId}/floors/${floorId}`);
      toast.success('Floor deleted');
      if (selectedFloorId === floorId) setSelectedFloorId('');
      fetchFloors();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete floor');
    }
  }, [restaurantId, selectedFloorId, fetchFloors, fetchData]);

  // ── Add element from tray ────────────────────────────────

  const addElementFromTray = useCallback((item: TrayItem, x: number, y: number) => {
    undoRedo.pushHistory(captureSnapshot());

    if (item.category === 'tables' && item.shape) {
      // Open add table dialog with shape preset
      setNewTableShape(item.shape);
      setNewTableCapacity(String(TABLE_SHAPE_DEFAULTS[item.shape].defaultCapacity));
      setIsAddTableOpen(true);
      return;
    }

    if (item.category === 'walls' && item.wallType) {
      const wallType = item.wallType;
      const cfg = WALL_TYPE_CONFIG[wallType];
      const newWall: WallSegment = {
        id: genId('wall'),
        x1: x,
        y1: y,
        x2: x + item.defaultWidth,
        y2: y,
        thickness: cfg.thickness,
        type: wallType,
      };
      setLocalWalls(prev => [...prev, newWall]);
      setHasUnsavedChanges(true);
      toast.success('Wall added');
      return;
    }

    if (item.category === 'doors' && item.doorType) {
      const cfg = DOOR_TYPE_CONFIG[item.doorType];
      const newDoor: DoorElement = {
        id: genId('door'),
        x: x - cfg.defaultW / 2,
        y: y - cfg.defaultH / 2,
        width: cfg.defaultW,
        height: cfg.defaultH,
        rotation: 0,
        type: item.doorType,
      };
      setLocalDoors(prev => [...prev, newDoor]);
      setHasUnsavedChanges(true);
      toast.success('Door added');
      return;
    }

    if (item.category === 'windows' && item.windowType) {
      const cfg = WINDOW_TYPE_CONFIG[item.windowType];
      const newWindow: WindowElement = {
        id: genId('window'),
        x: x - cfg.defaultW / 2,
        y: y - cfg.defaultH / 2,
        width: cfg.defaultW,
        height: cfg.defaultH,
        rotation: 0,
        type: item.windowType,
      };
      setLocalWindows(prev => [...prev, newWindow]);
      setHasUnsavedChanges(true);
      toast.success('Window added');
      return;
    }

    if (item.category === 'rooms' && item.roomType) {
      const isOutdoor = ['terrace', 'garden', 'patio', 'parking'].includes(item.roomType);
      const cfg = isOutdoor
        ? OUTDOOR_TYPE_CONFIG[item.roomType as OutdoorType]
        : ROOM_TYPE_CONFIG[item.roomType as RoomType];
      const newRoom: RoomZone = {
        id: genId('room'),
        x: x - cfg.defaultW / 2,
        y: y - cfg.defaultH / 2,
        width: cfg.defaultW,
        height: cfg.defaultH,
        type: item.roomType as RoomType | OutdoorType,
        label: cfg.label,
        color: cfg.fill,
      };
      setLocalRooms(prev => [...prev, newRoom]);
      setHasUnsavedChanges(true);
      toast.success(`${cfg.label} added`);
      return;
    }

    if (item.category === 'utilities' && item.utilityType) {
      const cfg = UTILITY_TYPE_CONFIG[item.utilityType];
      if (item.utilityType === 'column') {
        const newCol: ColumnElement = {
          id: genId('col'),
          x: x,
          y: y,
          radius: 15,
        };
        setLocalColumns(prev => [...prev, newCol]);
      } else {
        const newUtil: UtilityElement = {
          id: genId('util'),
          x: x - cfg.defaultW / 2,
          y: y - cfg.defaultH / 2,
          width: cfg.defaultW,
          height: cfg.defaultH,
          type: item.utilityType,
          label: cfg.label,
        };
        setLocalUtilities(prev => [...prev, newUtil]);
      }
      setHasUnsavedChanges(true);
      toast.success(`${cfg.label} added`);
    }
  }, [captureSnapshot, undoRedo]);

  // ── Delete element ───────────────────────────────────────

  const deleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;

    if (selectionInfo?.kind === 'table') {
      const idsToDelete = Array.from(selectedIds);
      if (!confirm(`Delete ${idsToDelete.length} table(s)?`)) return;
      undoRedo.pushHistory(captureSnapshot());
      try {
        await Promise.all(
          idsToDelete.map(id => api.delete(`/api/restaurants/${restaurantId}/tables/${id}`))
        );
        toast.success(`${idsToDelete.length} table(s) deleted`);
        clearSelection();
        fetchData();
      } catch {
        toast.error('Failed to delete some tables');
        fetchData();
      }
      return;
    }

    // For non-table elements, remove locally
    undoRedo.pushHistory(captureSnapshot());
    const id = selectionInfo?.id;
    if (!id) return;

    if (selectionInfo?.kind === 'wall') {
      setLocalWalls(prev => prev.filter(w => w.id !== id));
    } else if (selectionInfo?.kind === 'door') {
      setLocalDoors(prev => prev.filter(d => d.id !== id));
    } else if (selectionInfo?.kind === 'window') {
      setLocalWindows(prev => prev.filter(w => w.id !== id));
    } else if (selectionInfo?.kind === 'room') {
      setLocalRooms(prev => prev.filter(r => r.id !== id));
    } else if (selectionInfo?.kind === 'column') {
      setLocalColumns(prev => prev.filter(c => c.id !== id));
    } else if (selectionInfo?.kind === 'stairs') {
      setLocalStairs(prev => prev.filter(s => s.id !== id));
    } else if (selectionInfo?.kind === 'utility') {
      setLocalUtilities(prev => prev.filter(u => u.id !== id));
    }
    setHasUnsavedChanges(true);
    clearSelection();
    toast.success('Element deleted');
  }, [selectedIds, selectionInfo, undoRedo, captureSnapshot, restaurantId, fetchData, clearSelection]);

  // ── Move table (local) ───────────────────────────────────

  const moveTable = useCallback((tableId: string, x: number, y: number) => {
    setLocalTables(prev => {
      const next = new Map(prev);
      next.set(tableId, {
        ...prev.get(tableId),
        positionX: Math.round(x),
        positionY: Math.round(y),
      });
      return next;
    });
    setHasUnsavedChanges(true);
  }, []);

  // ── Resize table (local) ─────────────────────────────────

  const resizeTable = useCallback((tableId: string, w: number, h: number) => {
    setLocalTables(prev => {
      const next = new Map(prev);
      next.set(tableId, {
        ...prev.get(tableId),
        width: Math.max(30, Math.round(w)),
        height: Math.max(30, Math.round(h)),
      });
      return next;
    });
    setHasUnsavedChanges(true);
  }, []);

  // ── Rotate table (local) ─────────────────────────────────

  const rotateTable = useCallback((tableId: string, rotation: number) => {
    setLocalTables(prev => {
      const next = new Map(prev);
      next.set(tableId, {
        ...prev.get(tableId),
        rotation: Math.round(rotation),
      });
      return next;
    });
    setHasUnsavedChanges(true);
  }, []);

  // ── Move non-table element ───────────────────────────────

  const moveElement = useCallback((kind: string, id: string, x: number, y: number) => {
    const nx = Math.round(x);
    const ny = Math.round(y);
    if (kind === 'door') {
      setLocalDoors(prev => prev.map(d => d.id === id ? { ...d, x: nx, y: ny } : d));
    } else if (kind === 'window') {
      setLocalWindows(prev => prev.map(w => w.id === id ? { ...w, x: nx, y: ny } : w));
    } else if (kind === 'room') {
      setLocalRooms(prev => prev.map(r => r.id === id ? { ...r, x: nx, y: ny } : r));
    } else if (kind === 'stairs') {
      setLocalStairs(prev => prev.map(s => s.id === id ? { ...s, x: nx, y: ny } : s));
    } else if (kind === 'utility') {
      setLocalUtilities(prev => prev.map(u => u.id === id ? { ...u, x: nx, y: ny } : u));
    } else if (kind === 'column') {
      setLocalColumns(prev => prev.map(c => c.id === id ? { ...c, x: nx, y: ny } : c));
    }
    setHasUnsavedChanges(true);
  }, []);

  // ── Wall drawing ─────────────────────────────────────────

  const startWallDraw = useCallback((x: number, y: number) => {
    setWallDrawStart({ x, y });
    setWallDrawPreview(null);
  }, []);

  const updateWallDrawPreview = useCallback((x: number, y: number) => {
    setWallDrawPreview({ x, y });
  }, []);

  const completeWallDraw = useCallback((x: number, y: number) => {
    if (!wallDrawStart) return;
    undoRedo.pushHistory(captureSnapshot());
    const cfg = WALL_TYPE_CONFIG[wallDrawType];
    const newWall: WallSegment = {
      id: genId('wall'),
      x1: wallDrawStart.x,
      y1: wallDrawStart.y,
      x2: x,
      y2: y,
      thickness: cfg.thickness,
      type: wallDrawType,
    };
    setLocalWalls(prev => [...prev, newWall]);
    setHasUnsavedChanges(true);
    setWallDrawStart(null);
    setWallDrawPreview(null);
    toast.success('Wall added');
  }, [wallDrawStart, wallDrawType, undoRedo, captureSnapshot]);

  const cancelWallDraw = useCallback(() => {
    setWallDrawStart(null);
    setWallDrawPreview(null);
  }, []);

  // ── Save layout ──────────────────────────────────────────

  const handleSaveLayout = useCallback(async () => {
    if (localTables.size === 0 && localWalls.length === 0 && localRooms.length === 0 &&
        localDoors.length === 0 && localWindows.length === 0 && localColumns.length === 0 &&
        localStairs.length === 0 && localUtilities.length === 0) {
      toast.info('No changes to save');
      return;
    }
    try {
      setSaving(true);
      if (localTables.size > 0) {
        const updates = Array.from(localTables.entries()).map(([id, data]) => ({
          id,
          positionX: data.positionX,
          positionY: data.positionY,
          width: data.width,
          height: data.height,
          rotation: data.rotation,
        }));
        await api.patch(`/api/restaurants/${restaurantId}/tables/bulk`, { updates });
      }
      if (currentFloor && (localWalls.length > 0 || localRooms.length > 0)) {
        // Merge walls and rooms into floor obstacles format
        const obstaclesToSave = floorRooms.map(r => ({
          x: r.x, y: r.y, width: r.width, height: r.height,
          type: r.type, label: r.label, color: r.color,
        }));
        await api.put(`/api/restaurants/${restaurantId}/floors/${currentFloor.id}`, {
          walls: floorWalls,
          obstacles: obstaclesToSave,
        });
      }
      // Clear local state
      setLocalTables(new Map());
      setLocalWalls([]);
      setLocalDoors([]);
      setLocalWindows([]);
      setLocalRooms([]);
      setLocalColumns([]);
      setLocalStairs([]);
      setLocalUtilities([]);
      setHasUnsavedChanges(false);
      undoRedo.resetHistory();
      toast.success('Floor plan saved');
      fetchData();
      fetchFloors();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [localTables, localWalls, localRooms, localDoors, localWindows, localColumns, localStairs, localUtilities, currentFloor, floorWalls, floorRooms, restaurantId, fetchData, fetchFloors, undoRedo]);

  // ── Undo / Redo handlers ─────────────────────────────────

  const handleUndo = useCallback(() => {
    const snapshot = undoRedo.undo();
    if (snapshot) {
      restoreSnapshot(snapshot);
      toast.info('Undo');
    }
  }, [undoRedo, restoreSnapshot]);

  const handleRedo = useCallback(() => {
    const snapshot = undoRedo.redo();
    if (snapshot) {
      restoreSnapshot(snapshot);
      toast.info('Redo');
    }
  }, [undoRedo, restoreSnapshot]);

  // ── Nudge ────────────────────────────────────────────────

  const handleNudge = useCallback((dx: number, dy: number) => {
    if (selectedIds.size === 0) return;
    undoRedo.pushHistory(captureSnapshot());
    selectedIds.forEach(id => {
      if (selectionInfo?.kind === 'table') {
        const table = floorTables.find(t => t.id === id);
        if (table) {
          const currentX = localTables.get(id)?.positionX ?? table.positionX ?? 0;
          const currentY = localTables.get(id)?.positionY ?? table.positionY ?? 0;
          moveTable(id, currentX + dx, currentY + dy);
        }
      } else {
        // For non-table elements, find and move
        const el = findElementById(id, selectionInfo?.kind || '');
        if (el) {
          moveElement(selectionInfo?.kind || '', id, (el as any).x + dx, (el as any).y + dy);
        }
      }
    });
  }, [selectedIds, selectionInfo, floorTables, localTables, moveTable, moveElement, undoRedo, captureSnapshot]);

  // Helper to find element by id and kind
  const findElementById = useCallback((id: string, kind: string) => {
    switch (kind) {
      case 'door': return localDoors.find(d => d.id === id);
      case 'window': return localWindows.find(w => w.id === id);
      case 'room': return localRooms.find(r => r.id === id);
      case 'column': return localColumns.find(c => c.id === id);
      case 'stairs': return localStairs.find(s => s.id === id);
      case 'utility': return localUtilities.find(u => u.id === id);
      case 'wall': return localWalls.find(w => w.id === id);
      default: return null;
    }
  }, [localDoors, localWindows, localRooms, localColumns, localStairs, localUtilities, localWalls]);

  // ── Apply template ───────────────────────────────────────

  const applyTemplate = useCallback(async (template: typeof import('../constants').FLOOR_TEMPLATES[0]) => {
    undoRedo.pushHistory(captureSnapshot());
    setLocalWalls(template.walls);
    setLocalRooms(template.rooms);
    setLocalColumns(template.columns);
    setLocalDoors(template.doors);
    setLocalWindows(template.windows);
    // Tables from template need to be created via API
    for (const ts of template.tableShapes) {
      try {
        await api.post(`/api/restaurants/${restaurantId}/tables`, {
          number: ts.number,
          capacity: ts.capacity,
          shape: ts.shape,
          branchId: useAppStore.getState().selectedBranchId,
          floorId: selectedFloorId || undefined,
          positionX: ts.x,
          positionY: ts.y,
          width: TABLE_SHAPE_DEFAULTS[ts.shape].w,
          height: TABLE_SHAPE_DEFAULTS[ts.shape].h,
        });
      } catch {
        // Skip failed tables
      }
    }
    setHasUnsavedChanges(true);
    setIsTemplateOpen(false);
    fetchData();
    toast.success(`Template "${template.name}" applied`);
  }, [undoRedo, captureSnapshot, restaurantId, selectedFloorId, fetchData]);

  return {
    // Data
    branches, allTables, floors, loading,
    selectedBranchId, setSelectedBranchId: setGlobalBranchId,
    selectedFloorId, setSelectedFloorId,
    currentFloor, floorWidth, floorHeight,
    floorTables, floorWalls, floorRooms,
    localDoors, localWindows, localColumns, localStairs, localUtilities,
    stats, selectedTable,

    // Editor
    editorMode, setEditorMode,
    selectedIds, selectionInfo,
    selectElement, clearSelection,
    hasUnsavedChanges, saving,
    snapConfig, setSnapConfig,
    wallDrawType, setWallDrawType,

    // Drag/resize/rotate
    draggingId, setDraggingId, dragOffset, setDragOffset,
    resizingId, setResizingId, resizeStart, setResizeStart,
    rotatingId, setRotatingId, rotateCenter, setRotateCenter,

    // Wall drawing
    wallDrawStart, wallDrawPreview,
    startWallDraw, updateWallDrawPreview, completeWallDraw, cancelWallDraw,

    // Actions
    moveTable, resizeTable, rotateTable, moveElement,
    addElementFromTray, deleteSelected,
    handleAddTable, handleEditTable, handleDeleteTable, handleStatusChange,
    handleAddFloor, handleDeleteFloor,
    handleSaveLayout, handleUndo, handleRedo, handleNudge,
    applyTemplate,

    // Dialog state
    isAddTableOpen, setIsAddTableOpen,
    isEditTableOpen, setIsEditTableOpen,
    isAddFloorOpen, setIsAddFloorOpen,
    isTemplateOpen, setIsTemplateOpen,
    editingTable, setEditingTable,
    newTableNumber, setNewTableNumber,
    newTableCapacity, setNewTableCapacity,
    newTableShape, setNewTableShape,
    newFloorName, setNewFloorName,
    adding,

    // Undo/redo
    canUndo: undoRedo.canUndo,
    canRedo: undoRedo.canRedo,
    pushHistory: undoRedo.pushHistory,
    captureSnapshot,
    findElementById,

    // Data refresh
    fetchData, fetchFloors,
  };
}
