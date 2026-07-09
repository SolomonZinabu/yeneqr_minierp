'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { useBranchChange } from '@/hooks/use-branch-change';
import {
  Armchair,
  Users,
  Clock,
  SprayCan,
  Plus,
  Loader2,
  Trash2,
  Edit3,
  Move,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Save,
  Undo2,
  Redo2,
  Square,
  Circle,
  RectangleHorizontal,
  LayoutGrid,
  Eye,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  Copy,
  ArrowUpDown,
  Home,
  Wine,
  Coffee,
  DoorOpen,
  ClipboardList,
  List,
  Search,
  QrCode,
  Star,
  MapPin,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { hasPermission, PERMISSIONS } from '@/lib/auth';
import { StaffOrderForm } from '@/components/dashboard/staff-order-form';
import { MergeTablesDialog } from '@/components/dashboard/merge-tables-dialog';
import { GitMerge } from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning';
type TableShape = 'round' | 'square' | 'rectangle' | 'oval';
type EditorMode = 'select' | 'add-table' | 'draw-wall' | 'add-obstacle';
type ObstacleType = 'bar' | 'kitchen' | 'restroom' | 'lounge' | 'stage' | 'entrance' | 'plant' | 'other';

interface MenuData {
  id: string;
  name: string;
  nameAm?: string | null;
  isActive: boolean;
}

interface TableData {
  id: string;
  number: string;
  capacity: number;
  status: TableStatus;
  shape: TableShape;
  floorId?: string;
  branchId: string;
  menuId?: string | null;
  positionX: number | null;
  positionY: number | null;
  width: number;
  height: number;
  rotation: number;
  notes?: string | null;
  isActive: boolean;
  floor?: { id: string; name: string; sortOrder: number } | null;
  branch?: { id: string; name: string } | null;
  menu?: { id: string; name: string; nameAm?: string | null; isActive: boolean } | null;
  _count?: { orders: number; sessions: number };
}

interface FloorData {
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

interface BranchData {
  id: string;
  name: string;
  floors: FloorData[];
}

interface WallSegment {
  x1: number; y1: number;
  x2: number; y2: number;
  thickness: number;
}

interface ObstacleRect {
  x: number; y: number;
  width: number; height: number;
  type: ObstacleType;
  label: string;
}

// ============================================================
// STATUS CONFIG
// ============================================================

const statusConfig: Record<TableStatus, {
  label: string;
  color: string;
  fill: string;
  stroke: string;
  glow: string;
  icon: LucideIcon;
}> = {
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

const obstacleIcons: Record<ObstacleType, { icon: LucideIcon; fill: string; label: string }> = {
  bar: { icon: Wine, fill: '#8b5cf6', label: 'Bar' },
  kitchen: { icon: Coffee, fill: '#f97316', label: 'Kitchen' },
  restroom: { icon: DoorOpen, fill: '#6366f1', label: 'Restroom' },
  lounge: { icon: Home, fill: '#ec4899', label: 'VIP Lounge' },
  stage: { icon: LayoutGrid, fill: '#14b8a6', label: 'Stage' },
  entrance: { icon: DoorOpen, fill: '#22c55e', label: 'Entrance' },
  plant: { icon: Circle, fill: '#84cc16', label: 'Plant' },
  other: { icon: Square, fill: '#78716c', label: 'Other' },
};

const defaultTableSizes: Record<TableShape, { w: number; h: number }> = {
  round: { w: 70, h: 70 },
  square: { w: 80, h: 80 },
  rectangle: { w: 120, h: 80 },
  oval: { w: 110, h: 75 },
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export function TablesView() {
  const { selectedTableId, setSelectedTableId, user, selectedBranchId, setSelectedBranchId: setGlobalBranchId, branchChangeVersion } = useAppStore();
  const restaurantId = user?.restaurantId || '';

  // Data state
  const [branches, setBranches] = useState<BranchData[]>([]);
  const [allTables, setAllTables] = useState<TableData[]>([]);
  const [floors, setFloors] = useState<FloorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [localSelectedFloorId, setLocalSelectedFloorId] = useState('');
  const [menus, setMenus] = useState<MenuData[]>([]);

  const fetchDataRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const fetchFloorsRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const handleBranchChange = useCallback((newBranchId: string) => {
    console.log('[TablesView] handleBranchChange called with:', newBranchId);
    setLoading(true);
    setAllTables([]);
    fetchDataRef.current?.();
    fetchFloorsRef.current?.();
  }, []);

  useBranchChange(handleBranchChange);

  // Editor state
  const [editorMode, setEditorMode] = useState<EditorMode>('select');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [wallDrawing, setWallDrawing] = useState<{ x1: number; y1: number } | null>(null);
  const [wallPreview, setWallPreview] = useState<{ x2: number; y2: number } | null>(null);
  const [obstaclePlacing, setObstaclePlacing] = useState<ObstacleType>('bar');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Dialogs
  const [isAddTableOpen, setIsAddTableOpen] = useState(false);
  const [isMergeTablesOpen, setIsMergeTablesOpen] = useState(false);
  // View mode: 'list' = simple card grid (default), 'floorplan' = advanced canvas
  const [viewMode, setViewMode] = useState<'list' | 'floorplan'>('list');
  // Simple view filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'occupied' | 'reserved' | 'cleaning'>('all');
  const [tableSearch, setTableSearch] = useState('');
  const [isEditTableOpen, setIsEditTableOpen] = useState(false);
  const [isAddFloorOpen, setIsAddFloorOpen] = useState(false);
  const [isFloorManagerOpen, setIsFloorManagerOpen] = useState(false);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [editingTable, setEditingTable] = useState<TableData | null>(null);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState('4');
  const [newTableShape, setNewTableShape] = useState<TableShape>('square');
  const [newTableMenuId, setNewTableMenuId] = useState<string>('');
  const [newFloorName, setNewFloorName] = useState('');
  const [adding, setAdding] = useState(false);

  // Local state for unsaved table positions
  const [localTables, setLocalTables] = useState<Map<string, Partial<TableData>>>(new Map());

  // Local state for unsaved walls & obstacles (instead of immediate API save)
  const [localWalls, setLocalWalls] = useState<WallSegment[]>([]);
  const [localObstacles, setLocalObstacles] = useState<ObstacleRect[]>([]);

  // ============================================================
  // UNDO / REDO HISTORY
  // ============================================================

  type EditorSnapshot = {
    tables: Array<[string, Partial<TableData>]>;
    walls: WallSegment[];
    obstacles: ObstacleRect[];
  };

  const historyRef = useRef<EditorSnapshot[]>([]);
  const historyIndexRef = useRef(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateUndoRedoState = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  const captureSnapshot = useCallback((): EditorSnapshot => ({
    tables: Array.from(localTables.entries()),
    walls: [...localWalls],
    obstacles: [...localObstacles],
  }), [localTables, localWalls, localObstacles]);

  const pushHistory = useCallback(() => {
    const snapshot = captureSnapshot();
    // Truncate any redo history beyond current index
    const newStack = historyRef.current.slice(0, historyIndexRef.current + 1);
    newStack.push(snapshot);
    // Limit history to 50 entries
    if (newStack.length > 50) newStack.shift();
    historyRef.current = newStack;
    historyIndexRef.current = newStack.length - 1;
    updateUndoRedoState();
  }, [captureSnapshot, updateUndoRedoState]);

  const restoreSnapshot = useCallback((snapshot: EditorSnapshot) => {
    setLocalTables(new Map(snapshot.tables));
    setLocalWalls([...snapshot.walls]);
    setLocalObstacles([...snapshot.obstacles]);
    // If any local changes exist, mark as unsaved
    const hasTables = snapshot.tables.length > 0;
    const hasWalls = snapshot.walls.length > 0;
    const hasObstacles = snapshot.obstacles.length > 0;
    setHasUnsavedChanges(hasTables || hasWalls || hasObstacles);
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    restoreSnapshot(historyRef.current[historyIndexRef.current]);
    updateUndoRedoState();
    toast.info('Undo');
  }, [restoreSnapshot, updateUndoRedoState]);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    restoreSnapshot(historyRef.current[historyIndexRef.current]);
    updateUndoRedoState();
    toast.info('Redo');
  }, [restoreSnapshot, updateUndoRedoState]);

  // Push initial empty snapshot on mount
  useEffect(() => {
    if (historyRef.current.length === 0) {
      const emptySnapshot: EditorSnapshot = { tables: [], walls: [], obstacles: [] };
      historyRef.current = [emptySnapshot];
      historyIndexRef.current = 0;
    }
  }, []);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ============================================================
  // DATA FETCHING
  // ============================================================

  const fetchData = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const branchId = useAppStore.getState().selectedBranchId;
      const tablesParams = branchId ? `?branchId=${branchId}` : '';
      const [branchesRes, tablesRes, menusRes] = await Promise.all([
        api.get<{ data: BranchData[] }>(`/api/restaurants/${restaurantId}/branches`),
        api.get<{ data: TableData[] }>(`/api/restaurants/${restaurantId}/tables${tablesParams}`),
        api.get<{ data: MenuData[] }>(`/api/restaurants/${restaurantId}/menus`),
      ]);

      const branchData = branchesRes.data || [];
      const tableData = tablesRes.data || [];
      const menuData = menusRes.data || [];
      setBranches(branchData);
      setAllTables(tableData);
      setMenus(menuData);

      if (branchData.length > 0 && !branchId) {
        setGlobalBranchId(branchData[0]?.id);
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

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
      if (res.data && res.data.length > 0 && !localSelectedFloorId) {
        setLocalSelectedFloorId(res.data[0]?.id);
      }
    } catch {
      // Silent
    }
  }, [restaurantId, localSelectedFloorId]);

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchFloorsRef.current = fetchFloors; }, [fetchFloors]);

  useEffect(() => { fetchData(); }, [fetchData, selectedBranchId, branchChangeVersion]);
  useEffect(() => { fetchFloors(); }, [fetchFloors, selectedBranchId, branchChangeVersion]);

  // ============================================================
  // COMPUTED DATA
  // ============================================================

  const currentFloor = useMemo(() => floors.find(f => f.id === localSelectedFloorId) || floors[0] || null, [floors, localSelectedFloorId]);

  const floorTables = useMemo(() => {
    const ft = allTables.filter(t => t.floorId === (currentFloor?.id) && t.isActive);
    // Apply local unsaved changes
    return ft.map(t => {
      const local = localTables.get(t.id);
      return local ? { ...t, ...local } : t;
    });
  }, [allTables, currentFloor, localTables]);

  const serverWalls: WallSegment[] = useMemo(() => {
    if (!currentFloor?.walls) return [];
    try { return JSON.parse(currentFloor.walls); } catch { return []; }
  }, [currentFloor]);

  const serverObstacles: ObstacleRect[] = useMemo(() => {
    if (!currentFloor?.obstacles) return [];
    try { return JSON.parse(currentFloor.obstacles); } catch { return []; }
  }, [currentFloor]);

  // Merge server data with local unsaved changes
  const floorWalls: WallSegment[] = useMemo(() =>
    localWalls.length > 0 ? localWalls : serverWalls
  , [localWalls, serverWalls]);

  const floorObstacles: ObstacleRect[] = useMemo(() =>
    localObstacles.length > 0 ? localObstacles : serverObstacles
  , [localObstacles, serverObstacles]);

  const stats = useMemo(() => {
    const bt = allTables.filter(t => t.branchId === selectedBranchId);
    return {
      available: bt.filter(t => t.status === 'available').length,
      occupied: bt.filter(t => t.status === 'occupied').length,
      reserved: bt.filter(t => t.status === 'reserved').length,
      cleaning: bt.filter(t => t.status === 'cleaning').length,
    };
  }, [allTables, selectedBranchId]);

  const selectedTable = useMemo(
    () => floorTables.find(t => t.id === selectedTableId) || null,
    [floorTables, selectedTableId]
  );

  // ============================================================
  // SVG COORDINATE HELPERS
  // ============================================================

  const screenToSvg = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }, [zoom, pan]);

  // ============================================================
  // TABLE ACTIONS
  // ============================================================

  const handleAddTable = async () => {
    if (!newTableNumber) { toast.error('Table number is required'); return; }
    try {
      setAdding(true);
      await api.post(`/api/restaurants/${restaurantId}/tables`, {
        number: newTableNumber,
        capacity: parseInt(newTableCapacity) || 4,
        shape: newTableShape,
        branchId: useAppStore.getState().selectedBranchId,
        floorId: localSelectedFloorId || undefined,
        menuId: newTableMenuId || null,
        width: defaultTableSizes[newTableShape].w,
        height: defaultTableSizes[newTableShape].h,
      });
      toast.success(`Table ${newTableNumber} added`);
      setIsAddTableOpen(false);
      setNewTableNumber('');
      setNewTableCapacity('4');
      setNewTableMenuId('');
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add table';
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleAddFloor = async () => {
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
      const msg = err instanceof Error ? err.message : 'Failed to add floor';
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteFloor = async (floorId: string) => {
    if (!confirm('Delete this floor? Tables will be unassigned but not deleted.')) return;
    try {
      await api.delete(`/api/restaurants/${restaurantId}/floors/${floorId}`);
      toast.success('Floor deleted');
      if (localSelectedFloorId === floorId) setLocalSelectedFloorId('');
      fetchFloors();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete floor');
    }
  };

  const handleStatusChange = async (tableId: string, newStatus: TableStatus) => {
    try {
      await api.put(`/api/restaurants/${restaurantId}/tables/${tableId}`, { status: newStatus });
      toast.success(`Table marked as ${statusConfig[newStatus].label}`);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    if (!confirm('Delete this table?')) return;
    try {
      await api.delete(`/api/restaurants/${restaurantId}/tables/${tableId}`);
      toast.success('Table deleted');
      setSelectedTableId(null);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleEditTable = async () => {
    if (!editingTable) return;
    try {
      setAdding(true);
      await api.put(`/api/restaurants/${restaurantId}/tables/${editingTable.id}`, {
        number: editingTable.number,
        capacity: editingTable.capacity,
        shape: editingTable.shape,
        notes: editingTable.notes,
        menuId: editingTable.menuId || null,
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
  };

  // ============================================================
  // SAVE LAYOUT
  // ============================================================

  const handleSaveLayout = async () => {
    if (localTables.size === 0 && localWalls.length === 0 && localObstacles.length === 0) {
      toast.info('No changes to save');
      return;
    }
    try {
      setSaving(true);
      // Save table positions
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
      // Save walls & obstacles to floor
      if (currentFloor && (localWalls.length > 0 || localObstacles.length > 0)) {
        await api.put(`/api/restaurants/${restaurantId}/floors/${currentFloor.id}`, {
          walls: floorWalls,
          obstacles: floorObstacles,
        });
      }
      // Clear local state
      setLocalTables(new Map());
      setLocalWalls([]);
      setLocalObstacles([]);
      setHasUnsavedChanges(false);
      // Reset undo history after save
      historyRef.current = [{ tables: [], walls: [], obstacles: [] }];
      historyIndexRef.current = 0;
      updateUndoRedoState();
      toast.success('Floor plan saved');
      fetchData();
      fetchFloors();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFloorLayout = async () => {
    if (!currentFloor) return;
    try {
      setSaving(true);
      await api.put(`/api/restaurants/${restaurantId}/floors/${currentFloor.id}`, {
        walls: floorWalls,
        obstacles: floorObstacles,
      });
      toast.success('Floor layout saved');
      fetchFloors();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save floor');
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // CANVAS EVENT HANDLERS
  // ============================================================

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle click or Alt+click = pan
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
      return;
    }

    const pos = screenToSvg(e.clientX, e.clientY);

    if (editorMode === 'add-table') {
      // Place a new table at click position
      setIsAddTableOpen(true);
      setEditorMode('select');
      return;
    }

    if (editorMode === 'draw-wall') {
      if (!wallDrawing) {
        setWallDrawing({ x1: pos.x, y1: pos.y });
      } else {
        // Complete wall — push history first, then update local state
        pushHistory();
        const newWall: WallSegment = {
          x1: wallDrawing.x1, y1: wallDrawing.y1,
          x2: pos.x, y2: pos.y,
          thickness: 6,
        };
        const updatedWalls = [...floorWalls, newWall];
        setLocalWalls(updatedWalls);
        setHasUnsavedChanges(true);
        toast.success('Wall added (unsaved)');
        setWallDrawing(null);
        setWallPreview(null);
      }
      return;
    }

    if (editorMode === 'add-obstacle') {
      // Push history before adding obstacle
      pushHistory();
      const newObstacle: ObstacleRect = {
        x: pos.x - 60, y: pos.y - 30,
        width: 120, height: 60,
        type: obstaclePlacing,
        label: obstacleIcons[obstaclePlacing].label,
      };
      const updatedObstacles = [...floorObstacles, newObstacle];
      setLocalObstacles(updatedObstacles);
      setHasUnsavedChanges(true);
      toast.success('Obstacle added (unsaved)');
      return;
    }

    // Select mode — deselect if clicking on empty space
    if (!e.defaultPrevented) {
      setSelectedIds(new Set());
      setSelectedTableId(null);
    }
  }, [editorMode, pan, screenToSvg, wallDrawing, floorWalls, floorObstacles, currentFloor, restaurantId, obstaclePlacing, fetchFloors, pushHistory]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    if (wallDrawing) {
      const pos = screenToSvg(e.clientX, e.clientY);
      setWallPreview(pos);
      return;
    }

    if (draggingId) {
      const pos = screenToSvg(e.clientX, e.clientY);
      setLocalTables(prev => {
        const next = new Map(prev);
        next.set(draggingId, {
          ...prev.get(draggingId),
          positionX: Math.round(pos.x - dragOffset.x),
          positionY: Math.round(pos.y - dragOffset.y),
        });
        return next;
      });
      setHasUnsavedChanges(true);
    }
  }, [isPanning, panStart, wallDrawing, draggingId, dragOffset, screenToSvg]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingId(null);
  }, []);

  const handleTableMouseDown = useCallback((e: React.MouseEvent, table: TableData) => {
    e.stopPropagation();
    if (editorMode !== 'select') return;

    const pos = screenToSvg(e.clientX, e.clientY);
    const px = (localTables.get(table.id)?.positionX ?? table.positionX) || 0;
    const py = (localTables.get(table.id)?.positionY ?? table.positionY) || 0;

    setSelectedTableId(table.id);
    setSelectedIds(new Set([table.id]));

    if (e.shiftKey) {
      // Multi-select with shift
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(table.id)) next.delete(table.id);
        else next.add(table.id);
        return next;
      });
      return;
    }

    // Push history before drag starts so we can undo the position change
    pushHistory();
    setDraggingId(table.id);
    setDragOffset({ x: pos.x - px, y: pos.y - py });
  }, [editorMode, screenToSvg, localTables, pushHistory]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.min(Math.max(z * delta, 0.3), 3));
  }, []);

  const handleZoomFit = useCallback(() => {
    if (!currentFloor || !containerRef.current) return;
    const cw = containerRef.current.clientWidth - 40;
    const ch = containerRef.current.clientHeight - 40;
    const fw = currentFloor.width || 1200;
    const fh = currentFloor.height || 800;
    const scale = Math.min(cw / fw, ch / fh);
    setZoom(scale);
    setPan({ x: 20, y: 20 });
  }, [currentFloor]);

  // Auto-fit on floor change
  useEffect(() => { handleZoomFit(); }, [currentFloor?.id]);

  // ============================================================
  // KEYBOARD SHORTCUTS
  // ============================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs/textareas/dialogs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;

      // Ctrl+Z → Undo
      if (isCtrl && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl+Shift+Z or Ctrl+Y → Redo
      if ((isCtrl && e.shiftKey && e.key === 'z') || (isCtrl && e.key === 'y')) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Ctrl+S → Save
      if (isCtrl && e.key === 's') {
        e.preventDefault();
        handleSaveLayout();
        return;
      }

      // Escape → Deselect / Cancel drawing mode
      if (e.key === 'Escape') {
        if (wallDrawing) {
          setWallDrawing(null);
          setWallPreview(null);
        } else if (editorMode !== 'select') {
          setEditorMode('select');
        } else {
          setSelectedIds(new Set());
          setSelectedTableId(null);
        }
        return;
      }

      // Delete / Backspace → Delete selected tables
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) {
          e.preventDefault();
          const idsToDelete = Array.from(selectedIds);
          if (confirm(`Delete ${idsToDelete.length} table(s)?`)) {
            pushHistory();
            Promise.all(
              idsToDelete.map(id => api.delete(`/api/restaurants/${restaurantId}/tables/${id}`))
            ).then(() => {
              toast.success(`${idsToDelete.length} table(s) deleted`);
              setSelectedIds(new Set());
              setSelectedTableId(null);
              fetchData();
            }).catch(() => {
              toast.error('Failed to delete some tables');
              fetchData();
            });
          }
        }
        return;
      }

      // Arrow keys → Nudge selected tables
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (selectedIds.size > 0) {
          e.preventDefault();
          const nudge = e.shiftKey ? 10 : 1; // Shift+Arrow = 10px nudge
          pushHistory();
          setLocalTables(prev => {
            const next = new Map(prev);
            selectedIds.forEach(id => {
              const existing = next.get(id) || {};
              const table = allTables.find(t => t.id === id);
              const currentX = existing.positionX ?? table?.positionX ?? 0;
              const currentY = existing.positionY ?? table?.positionY ?? 0;
              let newX = currentX;
              let newY = currentY;
              switch (e.key) {
                case 'ArrowUp': newY -= nudge; break;
                case 'ArrowDown': newY += nudge; break;
                case 'ArrowLeft': newX -= nudge; break;
                case 'ArrowRight': newX += nudge; break;
              }
              next.set(id, { ...existing, positionX: Math.round(newX), positionY: Math.round(newY) });
            });
            return next;
          });
          setHasUnsavedChanges(true);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleSaveLayout, wallDrawing, editorMode, selectedIds, restaurantId, allTables, pushHistory]);

  // ============================================================
  // TABLE SHAPE SVG RENDERER
  // ============================================================

  const renderTableShape = (table: TableData, isSelected: boolean, isHovered: boolean) => {
    const config = statusConfig[table.status] || statusConfig.available;
    const px = (localTables.get(table.id)?.positionX ?? table.positionX) || 0;
    const py = (localTables.get(table.id)?.positionY ?? table.positionY) || 0;
    const w = localTables.get(table.id)?.width ?? table.width;
    const h = localTables.get(table.id)?.height ?? table.height;
    const rot = localTables.get(table.id)?.rotation ?? table.rotation;

    const statusFill = config.fill;
    const statusStroke = config.stroke;

    // Table fill based on status with gradient feel
    const tableFill = isSelected ? statusFill : `${statusFill}cc`;
    const tableStroke = isSelected ? statusStroke : `${statusStroke}aa`;

    // Pulse animation for occupied
    const shouldPulse = table.status === 'occupied';

    const getShapePath = () => {
      switch (table.shape) {
        case 'round':
          return <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2 - 2} />;
        case 'oval':
          return <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 2} ry={h / 2 - 2} />;
        case 'square':
          return <rect x={2} y={2} width={w - 4} height={h - 4} rx={6} />;
        case 'rectangle':
          return <rect x={2} y={2} width={w - 4} height={h - 4} rx={6} />;
        default:
          return <rect x={2} y={2} width={w - 4} height={h - 4} rx={6} />;
      }
    };

    // Chair indicators around the table
    const renderChairs = () => {
      const chairs: React.ReactNode[] = [];
      const chairR = 6;
      const chairOffset = 8;
      const numChairs = Math.min(table.capacity, 12);

      if (table.shape === 'round' || table.shape === 'oval') {
        const cx = w / 2;
        const cy = h / 2;
        const rx = w / 2 + chairOffset;
        const ry = h / 2 + chairOffset;
        for (let i = 0; i < numChairs; i++) {
          const angle = (2 * Math.PI * i) / numChairs - Math.PI / 2;
          const x = cx + rx * Math.cos(angle);
          const y = cy + ry * Math.sin(angle);
          chairs.push(
            <circle key={i} cx={x} cy={y} r={chairR} fill={`${statusFill}40`} stroke={`${statusStroke}60`} strokeWidth={1} />
          );
        }
      } else {
        // For square/rectangle — distribute along edges
        const perSide = Math.ceil(numChairs / 4);
        let chairIdx = 0;
        const sides = [
          // Top
          ...Array.from({ length: Math.min(perSide, numChairs - chairIdx) }, (_, i) => ({
            x: (w / (perSide + 1)) * (i + 1), y: -chairOffset
          })),
          // Bottom
          ...Array.from({ length: Math.min(perSide, numChairs - chairIdx - perSide) }, (_, i) => ({
            x: (w / (perSide + 1)) * (i + 1), y: h + chairOffset
          })),
          // Left
          ...Array.from({ length: Math.min(Math.ceil((numChairs - 2 * perSide) / 2), numChairs - chairIdx - 2 * perSide) }, (_, i) => ({
            x: -chairOffset, y: (h / (Math.ceil((numChairs - 2 * perSide) / 2) + 1)) * (i + 1)
          })),
          // Right
          ...Array.from({ length: Math.min(Math.floor((numChairs - 2 * perSide) / 2), numChairs - chairIdx) }, (_, i) => ({
            x: w + chairOffset, y: (h / (Math.floor((numChairs - 2 * perSide) / 2) + 1)) * (i + 1)
          })),
        ].flat().slice(0, numChairs);

        for (const pos of sides) {
          chairs.push(
            <circle key={chairIdx++} cx={pos.x} cy={pos.y} r={chairR} fill={`${statusFill}40`} stroke={`${statusStroke}60`} strokeWidth={1} />
          );
        }
      }
      return chairs;
    };

    return (
      <g
        key={table.id}
        transform={`translate(${px}, ${py}) rotate(${rot}, ${w / 2}, ${h / 2})`}
        onMouseDown={(e) => handleTableMouseDown(e, table)}
        style={{ cursor: editorMode === 'select' ? 'grab' : 'default' }}
      >
        {/* Glow effect for selected */}
        {isSelected && (
          <rect x={-6} y={-6} width={w + 12} height={h + 12} rx={12}
            fill="none" stroke={config.glow} strokeWidth={3} opacity={0.6}>
            {shouldPulse && (
              <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite" />
            )}
          </rect>
        )}

        {/* Pulse ring for occupied */}
        {shouldPulse && !isSelected && (
          <rect x={-4} y={-4} width={w + 8} height={h + 8} rx={10}
            fill="none" stroke={config.glow} strokeWidth={2}>
            <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
          </rect>
        )}

        {/* Shadow */}
        <rect x={2} y={3} width={w - 2} height={h - 2} rx={8}
          fill="rgba(0,0,0,0.08)" />

        {/* Chairs */}
        {renderChairs()}

        {/* Table shape */}
        {getShapePath()}

        {/* Table body with gradient */}
        <defs>
          <linearGradient id={`grad-${table.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={`${statusFill}dd`} />
            <stop offset="100%" stopColor={`${statusFill}99`} />
          </linearGradient>
        </defs>

        {table.shape === 'round' ? (
          <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2 - 2}
            fill={`url(#grad-${table.id})`} stroke={tableStroke} strokeWidth={2} />
        ) : table.shape === 'oval' ? (
          <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 2} ry={h / 2 - 2}
            fill={`url(#grad-${table.id})`} stroke={tableStroke} strokeWidth={2} />
        ) : (
          <rect x={2} y={2} width={w - 4} height={h - 4} rx={6}
            fill={`url(#grad-${table.id})`} stroke={tableStroke} strokeWidth={2} />
        )}

        {/* Table number */}
        <text x={w / 2} y={h / 2 - 4} textAnchor="middle" dominantBaseline="middle"
          fill="white" fontSize={Math.min(w, h) > 80 ? 16 : 12} fontWeight="700"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
          T{table.number}
        </text>

        {/* Capacity */}
        <text x={w / 2} y={h / 2 + 12} textAnchor="middle" dominantBaseline="middle"
          fill="rgba(255,255,255,0.8)" fontSize={9} fontWeight="500">
          {table.capacity} seats
        </text>

        {/* Resize handle */}
        {isSelected && editorMode === 'select' && (
          <rect x={w - 8} y={h - 8} width={10} height={10} rx={2}
            fill="white" stroke={statusStroke} strokeWidth={1.5}
            style={{ cursor: 'nwse-resize' }} />
        )}

        {/* Rotate handle */}
        {isSelected && editorMode === 'select' && (
          <g style={{ cursor: 'grab' }}>
            <line x1={w / 2} y1={-4} x2={w / 2} y2={-20} stroke={statusStroke} strokeWidth={1.5} strokeDasharray="3,2" />
            <circle cx={w / 2} cy={-24} r={6} fill="white" stroke={statusStroke} strokeWidth={1.5} />
            <RotateCw x={w / 2 - 4} y={-28} width={8} height={8} color={statusStroke} />
          </g>
        )}
      </g>
    );
  };

  // ============================================================
  // WALLS RENDERER
  // ============================================================

  const renderWalls = () => (
    <g>
      {floorWalls.map((wall, i) => (
        <line key={i} x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2}
          stroke="#374151" strokeWidth={wall.thickness} strokeLinecap="round" />
      ))}
      {/* Wall drawing preview */}
      {wallDrawing && wallPreview && (
        <line x1={wallDrawing.x1} y1={wallDrawing.y1} x2={wallPreview.x2} y2={wallPreview.y2}
          stroke="#6366f1" strokeWidth={6} strokeLinecap="round" strokeDasharray="8,4" opacity={0.7} />
      )}
    </g>
  );

  // ============================================================
  // OBSTACLES RENDERER
  // ============================================================

  const renderObstacles = () => (
    <g>
      {floorObstacles.map((obs, i) => {
        const cfg = obstacleIcons[obs.type] || obstacleIcons.other;
        return (
          <g key={i}>
            <rect x={obs.x} y={obs.y} width={obs.width} height={obs.height}
              rx={6} fill={`${cfg.fill}22`} stroke={`${cfg.fill}66`} strokeWidth={1.5} strokeDasharray="4,2" />
            <text x={obs.x + obs.width / 2} y={obs.y + obs.height / 2 + 2}
              textAnchor="middle" dominantBaseline="middle"
              fill={cfg.fill} fontSize={11} fontWeight="600">
              {obs.label}
            </text>
          </g>
        );
      })}
    </g>
  );

  // ============================================================
  // GRID PATTERN
  // ============================================================

  const renderGrid = () => {
    const gridSize = 50;

    return (
      <>
        <defs>
          <pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
            <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth={0.5} />
          </pattern>
        </defs>
        <rect width={fw} height={fh} fill="url(#grid)" />
      </>
    );
  };

  // ============================================================
  // TOOLBAR
  // ============================================================

  const renderToolbar = () => (
    <div className="flex items-center gap-1 p-1.5 bg-background border border-border rounded-lg shadow-sm">
      <TooltipProvider delayDuration={200}>
        {/* Mode buttons */}
        <Tooltip><TooltipTrigger asChild>
          <Button variant={editorMode === 'select' ? 'default' : 'ghost'} size="sm" className="h-8 w-8 p-0"
            onClick={() => setEditorMode('select')}>
            <Move className="h-4 w-4" />
          </Button>
        </TooltipTrigger><TooltipContent>Select & Move</TooltipContent></Tooltip>

        <Tooltip><TooltipTrigger asChild>
          <Button variant={editorMode === 'add-table' ? 'default' : 'ghost'} size="sm" className="h-8 w-8 p-0"
            onClick={() => setEditorMode('add-table')}>
            <Plus className="h-4 w-4" />
          </Button>
        </TooltipTrigger><TooltipContent>Add Table</TooltipContent></Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Tooltip><TooltipTrigger asChild>
          <Button variant={editorMode === 'draw-wall' ? 'default' : 'ghost'} size="sm" className="h-8 w-8 p-0"
            onClick={() => setEditorMode('draw-wall')}>
            <Edit3 className="h-4 w-4" />
          </Button>
        </TooltipTrigger><TooltipContent>Draw Wall</TooltipContent></Tooltip>

        <Tooltip><TooltipTrigger asChild>
          <Button variant={editorMode === 'add-obstacle' ? 'default' : 'ghost'} size="sm" className="h-8 px-2"
            onClick={() => setEditorMode('add-obstacle')}>
            <LayoutGrid className="h-4 w-4 mr-1" />
            <span className="text-xs">Room</span>
          </Button>
        </TooltipTrigger><TooltipContent>Add Room Element</TooltipContent></Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Obstacle type selector (when in add-obstacle mode) */}
        {editorMode === 'add-obstacle' && (
          <>
            {(Object.entries(obstacleIcons) as [ObstacleType, typeof obstacleIcons.bar][]).map(([type, cfg]) => (
              <Tooltip key={type}><TooltipTrigger asChild>
                <Button variant={obstaclePlacing === type ? 'secondary' : 'ghost'} size="sm" className="h-8 px-2"
                  onClick={() => setObstaclePlacing(type)}>
                  <cfg.icon className="h-3.5 w-3.5 mr-1" style={{ color: cfg.fill }} />
                  <span className="text-[10px]">{cfg.label}</span>
                </Button>
              </TooltipTrigger><TooltipContent>{cfg.label}</TooltipContent></Tooltip>
            ))}
            <Separator orientation="vertical" className="h-6 mx-1" />
          </>
        )}

        {/* Zoom controls */}
        <Tooltip><TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
            onClick={() => setZoom(z => Math.max(z * 0.9, 0.3))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
        </TooltipTrigger><TooltipContent>Zoom Out</TooltipContent></Tooltip>

        <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>

        <Tooltip><TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
            onClick={() => setZoom(z => Math.min(z * 1.1, 3))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </TooltipTrigger><TooltipContent>Zoom In</TooltipContent></Tooltip>

        <Tooltip><TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleZoomFit}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger><TooltipContent>Fit to View</TooltipContent></Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Undo / Redo */}
        <Tooltip><TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
            onClick={handleUndo} disabled={!canUndo}>
            <Undo2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger><TooltipContent>Undo (Ctrl+Z)</TooltipContent></Tooltip>

        <Tooltip><TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
            onClick={handleRedo} disabled={!canRedo}>
            <Redo2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger><TooltipContent>Redo (Ctrl+Y)</TooltipContent></Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Save */}
        <Tooltip><TooltipTrigger asChild>
          <Button variant={hasUnsavedChanges ? 'default' : 'ghost'} size="sm" className="h-8 gap-1 px-2"
            onClick={handleSaveLayout} disabled={saving || !hasUnsavedChanges}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span className="text-xs">Save</span>
          </Button>
        </TooltipTrigger><TooltipContent>Save Layout (Ctrl+S)</TooltipContent></Tooltip>
      </TooltipProvider>
    </div>
  );

  // ============================================================
  // FLOOR MANAGER PANEL
  // ============================================================

  const renderFloorManager = () => (
    <div className="flex items-center gap-2 flex-wrap">
      {floors.map((floor) => (
        <div key={floor.id} className="flex items-center gap-1">
          <Button
            variant={localSelectedFloorId === floor.id ? 'default' : 'outline'}
            size="sm" className="text-xs h-8 gap-1"
            onClick={() => { setLocalSelectedFloorId(floor.id); setSelectedTableId(null); }}
          >
            <Home className="h-3 w-3" />
            {floor.name}
            <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">
              {floor._count?.tables || 0}
            </Badge>
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => handleDeleteFloor(floor.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="text-xs h-8 gap-1"
        onClick={() => setIsAddFloorOpen(true)}>
        <Plus className="h-3 w-3" />
        Add Floor
      </Button>
    </div>
  );

  // ============================================================
  // TABLE DETAIL PANEL
  // ============================================================

  const renderDetailPanel = () => {
    if (!selectedTable) return null;

    const config = statusConfig[selectedTable.status] || statusConfig.available;

    return (
      <Card className="w-72 shrink-0 border shadow-lg">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-4 w-4 rounded-full ${config.color}`} />
              <span className="font-bold text-lg">T{selectedTable.number}</span>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                onClick={() => { setEditingTable({ ...selectedTable }); setIsEditTableOpen(true); }}>
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleDeleteTable(selectedTable.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                onClick={() => setSelectedTableId(null)}>
                ✕
              </Button>
            </div>
          </div>

          <Badge className={`${config.color} text-white text-xs`}>{config.label}</Badge>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Capacity</p>
              <p className="font-medium">{selectedTable.capacity} seats</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Shape</p>
              <p className="font-medium capitalize">{selectedTable.shape}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Floor</p>
              <p className="font-medium text-xs">{currentFloor?.name || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Position</p>
              <p className="font-medium text-xs">{Math.round(selectedTable.positionX || 0)}, {Math.round(selectedTable.positionY || 0)}</p>
            </div>
          </div>

          {selectedTable.menu && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs">📋</span>
              <Badge variant="secondary" className="text-xs">{selectedTable.menu.name}</Badge>
            </div>
          )}

          {selectedTable.notes && (
            <div className="rounded-lg bg-muted p-2">
              <p className="text-xs text-muted-foreground">{selectedTable.notes}</p>
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <p className="text-xs font-medium">Change Status</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(statusConfig) as TableStatus[]).map((status) => {
                const sc = statusConfig[status];
                return (
                  <Button key={status}
                    variant={selectedTable.status === status ? 'default' : 'outline'}
                    size="sm" className="text-xs h-7 gap-1"
                    onClick={() => handleStatusChange(selectedTable.id, status)}
                    disabled={selectedTable.status === status}>
                    <div className={`h-2 w-2 rounded-full ${sc.color}`} />
                    {sc.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <p className="text-xs font-medium">Quick Actions</p>
            {hasPermission(user?.role || '', PERMISSIONS.ORDER_CREATE.key) && (
              <Button
                variant="default"
                size="sm"
                className="w-full text-xs h-7 gap-1"
                onClick={() => setShowCreateOrder(true)}
              >
                <ClipboardList className="h-3 w-3" /> Create Order for Table {selectedTable.number}
              </Button>
            )}
            <Button variant="outline" size="sm" className="w-full text-xs h-7 gap-1">
              <Copy className="h-3 w-3" /> Duplicate Table
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ============================================================
  // STATS BAR
  // ============================================================

  const renderStats = () => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {(Object.entries(stats) as [TableStatus, number][]).map(([status, count]) => {
        const config = statusConfig[status];
        const Icon = config.icon;
        return (
          <Card key={status} className="py-0">
            <CardContent className="p-2.5 flex items-center gap-2.5">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                status === 'available' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                status === 'occupied' ? 'bg-red-100 dark:bg-red-900/30' :
                status === 'reserved' ? 'bg-amber-100 dark:bg-amber-900/30' :
                'bg-slate-100 dark:bg-slate-900/30'
              }`}>
                <Icon className={`h-4 w-4 ${
                  status === 'available' ? 'text-emerald-600' :
                  status === 'occupied' ? 'text-red-600' :
                  status === 'reserved' ? 'text-amber-600' :
                  'text-slate-600'
                }`} />
              </div>
              <div>
                <p className="text-lg font-bold leading-none">{count}</p>
                <p className="text-[10px] text-muted-foreground">{config.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  // ============================================================
  // LOADING STATE
  // ============================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <span className="ml-2 text-muted-foreground">Loading tables...</span>
      </div>
    );
  }

  // ============================================================
  // MAIN RENDER
  // ============================================================

  const fw = currentFloor?.width || 1200;
  const fh = currentFloor?.height || 800;

  return (
    <div className="space-y-3 h-full flex flex-col">
      {/* Header row — branch selector is in the sidebar, not duplicated here */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Current branch label (read-only, not a selector — selector is in sidebar) */}
          {branches.length > 1 && (
            <Badge variant="outline" className="text-xs">
              {branches.find(b => b.id === selectedBranchId)?.name || 'All Branches'}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <Badge variant="destructive" className="text-[10px]">Unsaved changes</Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setIsMergeTablesOpen(true)}
            title="Combine two tables into one party (transfers items from secondary to primary)"
          >
            <GitMerge className="h-3.5 w-3.5" />
            Merge Tables
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setIsAddTableOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add Table
          </Button>
        </div>
      </div>

      {/* View mode toggle */}
      <div className="flex items-center gap-1 rounded-lg border p-0.5 w-fit">
        <button
          onClick={() => setViewMode('list')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
          }`}
        >
          <List className="h-3.5 w-3.5" />
          Table List
        </button>
        <button
          onClick={() => setViewMode('floorplan')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            viewMode === 'floorplan' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Floor Plan
        </button>
      </div>

      {/* Stats */}
      {renderStats()}

      {/* ── Simple List View (primary) ── */}
      {viewMode === 'list' && (
        <SimpleTableView
          tables={allTables.filter(t => t.branchId === selectedBranchId)}
          floors={floors}
          branches={branches}
          selectedBranchId={selectedBranchId}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          tableSearch={tableSearch}
          setTableSearch={setTableSearch}
          stats={stats}
          onEdit={(t) => { setEditingTable({ ...t }); setIsEditTableOpen(true); }}
          onDelete={handleDeleteTable}
          onCreateOrder={(t) => { setSelectedTableId(t.id); setShowCreateOrder(true); }}
          canManage={hasPermission(userRole, PERMISSIONS.TABLE_MANAGE.key)}
        />
      )}

      {/* ── Floor Plan View (advanced) ── */}
      {viewMode === 'floorplan' && (
        <>
      {/* Floor tabs */}
      {renderFloorManager()}

      {/* Editor toolbar */}
      {renderToolbar()}

      {/* Keyboard shortcuts hint */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground px-1 py-0.5">
        <span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px] font-mono">Ctrl+Z</kbd> Undo</span>
        <span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px] font-mono">Ctrl+Y</kbd> Redo</span>
        <span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px] font-mono">Ctrl+S</kbd> Save</span>
        <span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px] font-mono">Del</kbd> Delete</span>
        <span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px] font-mono">Esc</kbd> Deselect</span>
        <span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px] font-mono">Arrow</kbd> Nudge 1px</span>
        <span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px] font-mono">Shift+Arrow</kbd> Nudge 10px</span>
      </div>

      {/* Main canvas area */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* Canvas */}
        <div ref={containerRef} className="flex-1 rounded-xl border border-border bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 overflow-hidden relative"
          style={{ minHeight: 500 }}>
          {/* Mode indicator */}
          {editorMode !== 'select' && (
            <div className="absolute top-3 left-3 z-10">
              <Badge className="bg-primary text-primary-foreground text-xs gap-1">
                {editorMode === 'add-table' && <><Plus className="h-3 w-3" /> Click to place table</>}
                {editorMode === 'draw-wall' && <><Edit3 className="h-3 w-3" /> {wallDrawing ? 'Click to complete wall' : 'Click to start wall'}</>}
                {editorMode === 'add-obstacle' && <><LayoutGrid className="h-3 w-3" /> Click to place {obstacleIcons[obstaclePlacing].label}</>}
                <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] text-primary-foreground hover:bg-primary/80"
                  onClick={() => { setEditorMode('select'); setWallDrawing(null); setWallPreview(null); }}>
                  Cancel
                </Button>
              </Badge>
            </div>
          )}

          {/* Floor name */}
          <div className="absolute top-3 right-3 z-10">
            <Badge variant="outline" className="text-xs bg-background/80 backdrop-blur-sm">
              {currentFloor?.name || 'No Floor Selected'}
            </Badge>
          </div>

          {currentFloor ? (
            <svg
              ref={svgRef}
              className="w-full h-full"
              style={{ cursor: isPanning ? 'grabbing' : editorMode === 'select' ? 'default' : 'crosshair' }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              onWheel={handleWheel}
            >
              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {/* Floor background */}
                <rect width={fw} height={fh} fill="white" rx={4}
                  className="dark:fill-slate-900" />

                {/* Grid */}
                {renderGrid()}

                {/* Walls */}
                {renderWalls()}

                {/* Obstacles */}
                {renderObstacles()}

                {/* Tables */}
                {floorTables.map(table => renderTableShape(table, selectedTableId === table.id, false))}

                {/* Floor boundary border */}
                <rect width={fw} height={fh} fill="none" stroke="#e2e8f0" strokeWidth={2} rx={4}
                  className="dark:stroke-slate-700" />

                {/* Floor label */}
                <text x={fw - 10} y={fh - 10} textAnchor="end" fontSize={12}
                  fill="#94a3b8" fontWeight="500" fontStyle="italic">
                  {currentFloor.name} — {floorTables.length} tables
                </text>
              </g>
            </svg>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <Home className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <p className="text-sm text-muted-foreground mb-2">No floor selected</p>
              <Button size="sm" onClick={() => setIsAddFloorOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />Add a Floor
              </Button>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedTable && renderDetailPanel()}
      </div>
        </>
      )}

      {/* Add Table Dialog */}
      <Dialog open={isAddTableOpen} onOpenChange={setIsAddTableOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Table Number</Label>
                <Input value={newTableNumber} onChange={(e) => setNewTableNumber(e.target.value)} placeholder="1" />
              </div>
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input type="number" value={newTableCapacity} onChange={(e) => setNewTableCapacity(e.target.value)} placeholder="4" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Shape</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  { shape: 'round' as TableShape, icon: Circle, label: 'Round' },
                  { shape: 'square' as TableShape, icon: Square, label: 'Square' },
                  { shape: 'rectangle' as TableShape, icon: RectangleHorizontal, label: 'Rect' },
                  { shape: 'oval' as TableShape, icon: Circle, label: 'Oval' },
                ]).map(({ shape, icon: Icon, label }) => (
                  <Button key={shape} variant={newTableShape === shape ? 'default' : 'outline'}
                    size="sm" className="flex-col h-auto py-2 gap-1"
                    onClick={() => setNewTableShape(shape)}>
                    <Icon className="h-5 w-5" />
                    <span className="text-[10px]">{label}</span>
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Default Menu</Label>
              <Select value={newTableMenuId} onValueChange={(v) => setNewTableMenuId(v === '__none__' ? '' : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Default (restaurant)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Default (restaurant)</SelectItem>
                  {menus.filter(m => m.isActive).map((menu) => (
                    <SelectItem key={menu.id} value={menu.id}>{menu.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddTableOpen(false)}>Cancel</Button>
            <Button onClick={handleAddTable} disabled={adding}>
              {adding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Add Table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Table Dialog */}
      <Dialog open={isEditTableOpen} onOpenChange={setIsEditTableOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Table T{editingTable?.number}</DialogTitle>
          </DialogHeader>
          {editingTable && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Table Number</Label>
                  <Input value={editingTable.number}
                    onChange={(e) => setEditingTable({ ...editingTable, number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Capacity</Label>
                  <Input type="number" value={editingTable.capacity}
                    onChange={(e) => setEditingTable({ ...editingTable, capacity: parseInt(e.target.value) || 4 })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Shape</Label>
                <Select value={editingTable.shape} onValueChange={(v) => setEditingTable({ ...editingTable, shape: v as TableShape })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round">Round</SelectItem>
                    <SelectItem value="square">Square</SelectItem>
                    <SelectItem value="rectangle">Rectangle</SelectItem>
                    <SelectItem value="oval">Oval</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={editingTable.notes || ''}
                  onChange={(e) => setEditingTable({ ...editingTable, notes: e.target.value })}
                  placeholder="Optional notes..." />
              </div>
              <div className="space-y-2">
                <Label>Default Menu</Label>
                <Select value={editingTable.menuId || '__none__'} onValueChange={(v) => setEditingTable({ ...editingTable, menuId: v === '__none__' ? null : v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Default (restaurant)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Default (restaurant)</SelectItem>
                    {menus.filter(m => m.isActive).map((menu) => (
                      <SelectItem key={menu.id} value={menu.id}>{menu.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditTableOpen(false)}>Cancel</Button>
            <Button onClick={handleEditTable} disabled={adding}>
              {adding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Floor Dialog */}
      <Dialog open={isAddFloorOpen} onOpenChange={setIsAddFloorOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add New Floor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Floor Name</Label>
              <Input value={newFloorName} onChange={(e) => setNewFloorName(e.target.value)}
                placeholder="e.g. Terrace, Mezzanine..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddFloorOpen(false)}>Cancel</Button>
            <Button onClick={handleAddFloor} disabled={adding}>
              {adding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Add Floor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff Order Form — Create order on behalf of customer for this table */}
      <StaffOrderForm
        open={showCreateOrder}
        onClose={() => setShowCreateOrder(false)}
        onOrderCreated={fetchData}
        restaurantId={restaurantId}
        userRole={user?.role || ''}
        preselectedTableId={selectedTableId}
      />

      {/* Merge Tables Dialog */}
      <MergeTablesDialog
        open={isMergeTablesOpen}
        onClose={() => setIsMergeTablesOpen(false)}
        restaurantId={restaurantId}
        tables={allTables.map((t) => ({
          id: t.id,
          number: t.number,
          capacity: t.capacity,
          status: t.status,
          branchId: t.branchId,
          branchName: t.branch?.name,
          floorName: t.floor?.name,
        }))}
        onMerged={fetchData}
      />
    </div>
  );
}

// ============================================================
// SimpleTableView — clean card grid for everyday table management
// ============================================================

interface SimpleTableViewProps {
  tables: TableData[];
  floors: FloorData[];
  branches: BranchData[];
  selectedBranchId: string;
  statusFilter: 'all' | 'available' | 'occupied' | 'reserved' | 'cleaning';
  setStatusFilter: (s: 'all' | 'available' | 'occupied' | 'reserved' | 'cleaning') => void;
  tableSearch: string;
  setTableSearch: (s: string) => void;
  stats: { available: number; occupied: number; reserved: number; cleaning: number };
  onEdit: (t: TableData) => void;
  onDelete: (id: string) => void;
  onCreateOrder: (t: TableData) => void;
  canManage: boolean;
}

const STATUS_CONFIG: Record<TableStatus, { label: string; color: string; dot: string; bg: string }> = {
  available: { label: 'Available', color: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900' },
  occupied: { label: 'Occupied', color: 'text-red-700 dark:text-red-400', dot: 'bg-red-500', bg: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900' },
  reserved: { label: 'Reserved', color: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900' },
  cleaning: { label: 'Cleaning', color: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900' },
};

function SimpleTableView({
  tables, floors, branches, selectedBranchId,
  statusFilter, setStatusFilter, tableSearch, setTableSearch, stats,
  onEdit, onDelete, onCreateOrder, canManage,
}: SimpleTableViewProps) {
  // Filter tables by status + search
  const filtered = tables.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (tableSearch && !t.number.toLowerCase().includes(tableSearch.toLowerCase())) return false;
    return true;
  });

  // Sort: available first, then occupied, then reserved, then cleaning, then by number
  const statusOrder: Record<string, number> = { available: 0, occupied: 1, reserved: 2, cleaning: 3 };
  const sorted = [...filtered].sort((a, b) => {
    const so = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
    if (so !== 0) return so;
    return a.number.localeCompare(b.number, undefined, { numeric: true });
  });

  const floorName = (floorId?: string) => floors.find(f => f.id === floorId)?.name || 'Unassigned';
  const branchName = branches.find(b => b.id === selectedBranchId)?.name || '';

  const filterTabs: { key: 'all' | TableStatus; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: tables.length },
    { key: 'available', label: 'Available', count: stats.available },
    { key: 'occupied', label: 'Occupied', count: stats.occupied },
    { key: 'reserved', label: 'Reserved', count: stats.reserved },
    { key: 'cleaning', label: 'Cleaning', count: stats.cleaning },
  ];

  return (
    <div className="space-y-3 flex-1">
      {/* Filter bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Status filter tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 ${statusFilter === tab.key ? 'text-primary-foreground/70' : 'text-muted-foreground/60'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            placeholder="Search table..."
            className="pl-8 h-8 w-40 text-xs"
          />
        </div>
      </div>

      {/* Table cards grid */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed">
          <Armchair className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">
            {tables.length === 0
              ? `No tables at ${branchName}. Click "Add Table" to create one.`
              : 'No tables match your filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {sorted.map(table => {
            const cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG.available;
            return (
              <div
                key={table.id}
                className={`group relative rounded-xl border-2 p-3 transition-all hover:shadow-md cursor-pointer ${cfg.bg}`}
                onClick={() => onEdit(table)}
              >
                {/* VIP badge */}
                {table.isVip && (
                  <div className="absolute -top-1.5 -right-1.5 z-10">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 text-white">
                      <Star className="h-2.5 w-2.5 fill-white" />
                    </div>
                  </div>
                )}

                {/* Status dot */}
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`h-2 w-2 rounded-full ${cfg.dot} ${table.status === 'available' ? 'animate-pulse' : ''}`} />
                  <span className={`text-[10px] font-medium uppercase tracking-wide ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>

                {/* Table number */}
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-2xl font-bold tracking-tight">{table.number}</span>
                </div>

                {/* Capacity */}
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-2">
                  <Users className="h-3 w-3" />
                  <span>Seats {table.capacity}</span>
                </div>

                {/* Floor */}
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                  <MapPin className="h-2.5 w-2.5" />
                  <span className="truncate">{floorName(table.floorId)}</span>
                </div>

                {/* Quick actions (appear on hover) */}
                {canManage && (
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 p-1.5 bg-background/90 backdrop-blur-sm rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity border-t">
                    <Button
                      variant="ghost" size="sm"
                      className="h-6 px-2 text-[10px] gap-1"
                      onClick={(e) => { e.stopPropagation(); onEdit(table); }}
                      title="Edit"
                    >
                      <Edit3 className="h-3 w-3" /> Edit
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="h-6 px-2 text-[10px] gap-1 text-blue-600"
                      onClick={(e) => { e.stopPropagation(); onCreateOrder(table); }}
                      title="Create Order"
                    >
                      <ClipboardList className="h-3 w-3" /> Order
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); onDelete(table.id); }}
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary footer */}
      {sorted.length > 0 && (
        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
          <span>
            Showing {sorted.length} of {tables.length} tables
            {tableSearch && ` matching "${tableSearch}"`}
          </span>
          <span>
            {branchName} · {floors.length} floor{floors.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
