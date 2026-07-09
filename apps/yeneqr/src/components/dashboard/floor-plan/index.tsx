// ============================================================
// Yene QR — Next-Gen Floor Plan Editor
// Main orchestrator — replaces tables-view.tsx
// ============================================================

'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, List, LayoutGrid, Search, Users, Edit3, Trash2, ClipboardList, Star, MapPin, Plus, GitMerge } from 'lucide-react';
import { MergeTablesDialog } from '@/components/dashboard/merge-tables-dialog';
import { useAppStore } from '@/lib/store';

import type {
  TableData, TableStatus, TableShape, EditorMode,
  AlignmentGuide, TrayItem, SelectionInfo,
} from './types';
import { useFloorEditor } from './hooks/use-floor-editor';
import { useCanvas } from './hooks/use-canvas';
import { useSnap } from './hooks/use-snap';
import { useCollision } from './hooks/use-collision';
import { useKeyboard } from './hooks/use-keyboard';
import { STATUS_CONFIG, TABLE_SHAPE_DEFAULTS } from './constants';

import { Canvas } from './canvas';
import { ElementTray } from './element-tray';
import { PropertyPanel } from './property-panel';
import { Toolbar } from './toolbar';
import { FloorManager } from './floor-manager';
import { StatsBar } from './stats-bar';
import { TableDialog } from './table-dialog';
import { FloorDialog } from './floor-dialog';
import { TemplateDialog } from './template-dialog';

export function TablesView() {
  const editor = useFloorEditor();
  const containerRef = useRef<HTMLDivElement>(null);

  // View mode: 'list' = simple card grid (default), 'floorplan' = advanced canvas
  const [viewMode, setViewMode] = useState<'list' | 'floorplan'>('list');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'occupied' | 'reserved' | 'cleaning'>('all');
  const [tableSearch, setTableSearch] = useState('');
  const [isMergeTablesOpen, setIsMergeTablesOpen] = useState(false);
  // Canvas hook
  const canvas = useCanvas({
    containerRef,
    floorWidth: editor.floorWidth,
    floorHeight: editor.floorHeight,
  });

  // Collision detection
  const { collisionMap, hasCollision } = useCollision(editor.floorTables, editor.floorRooms);

  // Snap hook
  const snap = useSnap(
    editor.snapConfig,
    editor.floorTables,
    editor.floorRooms,
    editor.floorWidth,
    editor.floorHeight,
  );

  // UI state
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);

  // Auto-fit on floor change
  useEffect(() => {
    canvas.handleZoomFit();
  }, [editor.currentFloor?.id]);

  // ── Selection handlers ────────────────────────────────────

  const handleSelectTable = useCallback((id: string, multiSelect: boolean) => {
    editor.selectElement('table', id, multiSelect);
  }, [editor]);

  const handleSelectElement = useCallback((kind: string, id: string) => {
    editor.selectElement(kind as SelectionInfo['kind'], id, false);
  }, [editor]);

  // ── Drag handlers (tables) ────────────────────────────────

  const handleTableDragStart = useCallback((id: string, clientX: number, clientY: number, px: number, py: number) => {
    if (editor.editorMode !== 'select') return;
    editor.pushHistory(editor.captureSnapshot());
    const svgPos = canvas.screenToSvg(clientX, clientY);
    editor.setDraggingId(id);
    editor.setDragOffset({
      x: svgPos.x - px,
      y: svgPos.y - py,
    });
  }, [editor, canvas]);

  // ── Resize handler ────────────────────────────────────────

  const handleTableResizeStart = useCallback((id: string, clientX: number, clientY: number) => {
    if (editor.editorMode !== 'select') return;
    editor.pushHistory(editor.captureSnapshot());
    const table = editor.floorTables.find(t => t.id === id);
    if (!table) return;
    editor.setResizingId(id);
    editor.setResizeStart({
      x: clientX,
      y: clientY,
      w: table.width,
      h: table.height,
      px: table.positionX || 0,
      py: table.positionY || 0,
    });
  }, [editor]);

  // ── Rotate handler ────────────────────────────────────────

  const handleTableRotateStart = useCallback((id: string, clientX: number, clientY: number, cx: number, cy: number, startAngle: number, startRotation: number) => {
    if (editor.editorMode !== 'select') return;
    editor.pushHistory(editor.captureSnapshot());
    editor.setRotatingId(id);
    editor.setRotateCenter({ cx, cy, startAngle, startRotation });
  }, [editor]);

  // ── Element drag handlers (non-table) ─────────────────────

  const handleElementDragStart = useCallback((kind: string, id: string, clientX: number, clientY: number) => {
    if (editor.editorMode !== 'select') return;
    editor.pushHistory(editor.captureSnapshot());
    editor.setDraggingId(id);
    // Store offset for the element
    const el = editor.findElementById(id, kind);
    if (el) {
      const svgPos = canvas.screenToSvg(clientX, clientY);
      editor.setDragOffset({
        x: svgPos.x - ((el as any).x || 0),
        y: svgPos.y - ((el as any).y || 0),
      });
    }
  }, [editor, canvas]);

  // ── Canvas pointer events ─────────────────────────────────

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    // Middle click or Alt+click = pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      canvas.startPanning(e.clientX, e.clientY);
      e.preventDefault();
      return;
    }

    const pos = canvas.screenToSvg(e.clientX, e.clientY);

    // Draw wall mode
    if (editor.editorMode === 'draw-wall') {
      if (!editor.wallDrawStart) {
        editor.startWallDraw(pos.x, pos.y);
      } else {
        editor.completeWallDraw(pos.x, pos.y);
      }
      return;
    }

    // Select mode — deselect if clicking on empty space
    if (editor.editorMode === 'select' && !e.defaultPrevented) {
      editor.clearSelection();
    }
  }, [canvas, editor]);

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    // Panning
    if (canvas.isPanning) {
      canvas.updatePanning(e.clientX, e.clientY);
      return;
    }

    // Wall drawing preview
    if (editor.wallDrawStart) {
      const pos = canvas.screenToSvg(e.clientX, e.clientY);
      editor.updateWallDrawPreview(pos.x, pos.y);
      return;
    }

    // Table dragging
    if (editor.draggingId) {
      const pos = canvas.screenToSvg(e.clientX, e.clientY);
      const newX = pos.x - editor.dragOffset.x;
      const newY = pos.y - editor.dragOffset.y;

      // Check if it's a table
      const isTable = editor.floorTables.some(t => t.id === editor.draggingId);
      if (isTable) {
        const table = editor.floorTables.find(t => t.id === editor.draggingId);
        if (table) {
          const snapResult = snap.computeSnap(newX, newY, table.width, table.height, editor.draggingId);
          editor.moveTable(editor.draggingId, snapResult.x, snapResult.y);
          setAlignmentGuides(snapResult.guides);
        }
      } else {
        // Non-table element drag
        const kind = editor.selectionInfo?.kind;
        if (kind) {
          editor.moveElement(kind, editor.draggingId, newX, newY);
        }
      }
      return;
    }

    // Table resizing
    if (editor.resizingId) {
      const dx = (e.clientX - editor.resizeStart.x) / canvas.zoom;
      const dy = (e.clientY - editor.resizeStart.y) / canvas.zoom;
      const newW = Math.max(30, editor.resizeStart.w + dx);
      const newH = Math.max(30, editor.resizeStart.h + dy);
      editor.resizeTable(editor.resizingId, newW, newH);
      return;
    }

    // Table rotating
    if (editor.rotatingId) {
      const table = editor.floorTables.find(t => t.id === editor.rotatingId);
      if (table) {
        const cx = (table.positionX || 0) + table.width / 2;
        const cy = (table.positionY || 0) + table.height / 2;
        const svgPos = canvas.screenToSvg(e.clientX, e.clientY);
        const angle = Math.atan2(svgPos.y - cy, svgPos.x - cx) * (180 / Math.PI);
        const delta = angle - editor.rotateCenter.startAngle;
        const newRotation = editor.rotateCenter.startRotation + delta;
        editor.rotateTable(editor.rotatingId, newRotation);
      }
      return;
    }
  }, [canvas, editor, snap]);

  const handleCanvasPointerUp = useCallback((e: React.PointerEvent) => {
    // Stop panning
    if (canvas.isPanning) {
      canvas.stopPanning();
      return;
    }

    // End dragging
    if (editor.draggingId) {
      editor.setDraggingId(null);
      editor.setDragOffset({ x: 0, y: 0 });
      setAlignmentGuides([]);
      return;
    }

    // End resizing
    if (editor.resizingId) {
      editor.setResizingId(null);
      return;
    }

    // End rotating
    if (editor.rotatingId) {
      editor.setRotatingId(null);
      return;
    }
  }, [canvas, editor]);

  // ── Tray drop ─────────────────────────────────────────────

  const handleDropFromTray = useCallback((item: TrayItem, x: number, y: number) => {
    editor.addElementFromTray(item, x, y);
  }, [editor]);

  // ── Navigation (from minimap) ─────────────────────────────

  const handleNavigate = useCallback((panX: number, panY: number) => {
    canvas.setPanX(panX);
    canvas.setPanY(panY);
  }, [canvas]);

  // ── Keyboard shortcuts ────────────────────────────────────

  useKeyboard({
    onUndo: editor.handleUndo,
    onRedo: editor.handleRedo,
    onSave: editor.handleSaveLayout,
    onDelete: editor.deleteSelected,
    onEscape: () => {
      if (editor.wallDrawStart) {
        editor.cancelWallDraw();
      } else if (editor.editorMode !== 'select') {
        editor.setEditorMode('select');
      } else {
        editor.clearSelection();
      }
    },
    onNudge: editor.handleNudge,
    onModeChange: editor.setEditorMode,
    hasSelection: editor.selectedIds.size > 0,
    editorMode: editor.editorMode,
  });

  // ── Selected room info (for property panel) ───────────────

  const selectedRoomInfo = useMemo(() => {
    if (!editor.selectionInfo || editor.selectionInfo.kind === 'table') return null;
    const { kind, id } = editor.selectionInfo;
    switch (kind) {
      case 'room': {
        const room = editor.floorRooms.find(r => r.id === id);
        return room || null;
      }
      case 'door': {
        const door = editor.localDoors.find(d => d.id === id);
        return door ? { type: door.type, label: `Door (${door.type})`, color: '#8b5cf6', x: door.x, y: door.y, width: door.width, height: door.height } : null;
      }
      case 'window': {
        const win = editor.localWindows.find(w => w.id === id);
        return win ? { type: win.type, label: `Window (${win.type})`, color: '#0284c7', x: win.x, y: win.y, width: win.width, height: win.height } : null;
      }
      case 'column': {
        const col = editor.localColumns.find(c => c.id === id);
        return col ? { type: 'column', label: 'Column', color: '#78716c', x: col.x, y: col.y, width: col.radius * 2, height: col.radius * 2 } : null;
      }
      case 'utility': {
        const util = editor.localUtilities.find(u => u.id === id);
        return util ? { type: util.type, label: util.label, color: '#78716c', x: util.x, y: util.y, width: util.width, height: util.height } : null;
      }
      case 'wall': {
        const wall = editor.floorWalls.find(w => w.id === id);
        return wall ? { type: wall.type, label: `Wall (${wall.type})`, color: '#374151', x: wall.x1, y: wall.y1, width: Math.abs(wall.x2 - wall.x1), height: Math.abs(wall.y2 - wall.y1) } : null;
      }
      default: return null;
    }
  }, [editor.selectionInfo, editor.floorRooms, editor.localDoors, editor.localWindows, editor.localColumns, editor.localUtilities, editor.floorWalls]);

  // ── Loading state ─────────────────────────────────────────

  if (editor.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <span className="ml-2 text-muted-foreground">Loading tables...</span>
      </div>
    );
  }

  // ── Main Render ───────────────────────────────────────────

  return (
    <div className="space-y-3 h-full flex flex-col">
      {/* Header row — branch selector is in the sidebar, not duplicated here */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {editor.branches.length > 1 && (
            <Badge variant="outline" className="text-xs">
              {editor.branches.find(b => b.id === editor.selectedBranchId)?.name || 'All Branches'}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editor.hasUnsavedChanges && viewMode === 'floorplan' && (
            <Badge variant="destructive" className="text-[10px]">Unsaved changes</Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setIsMergeTablesOpen(true)}
            title="Combine two tables into one party"
          >
            <GitMerge className="h-3.5 w-3.5" />
            Merge Tables
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => editor.setIsAddTableOpen(true)}>
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
      <StatsBar stats={editor.stats} />

      {/* ── Simple List View (primary) ── */}
      {viewMode === 'list' && (
        <SimpleTableView
          tables={editor.allTables.filter(t => t.branchId === editor.selectedBranchId)}
          floors={editor.floors}
          selectedBranchId={editor.selectedBranchId}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          tableSearch={tableSearch}
          setTableSearch={setTableSearch}
          stats={editor.stats}
          onEdit={(t) => { editor.setEditingTable({ ...t }); editor.setIsEditTableOpen(true); }}
          onDelete={editor.handleDeleteTable}
        />
      )}

      {/* ── Floor Plan View (advanced) ── */}
      {viewMode === 'floorplan' && (
        <>

      {/* Floor tabs */}
      <FloorManager
        floors={editor.floors}
        selectedFloorId={editor.selectedFloorId}
        onSelectFloor={(id) => { editor.setSelectedFloorId(id); editor.clearSelection(); }}
        onDeleteFloor={editor.handleDeleteFloor}
        onAddFloor={() => editor.setIsAddFloorOpen(true)}
      />

      {/* Editor toolbar */}
      <Toolbar
        editorMode={editor.editorMode}
        onModeChange={editor.setEditorMode}
        zoom={canvas.zoom}
        onZoomIn={canvas.handleZoomIn}
        onZoomOut={canvas.handleZoomOut}
        onZoomFit={canvas.handleZoomFit}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onUndo={editor.handleUndo}
        onRedo={editor.handleRedo}
        hasUnsavedChanges={editor.hasUnsavedChanges}
        saving={editor.saving}
        onSave={editor.handleSaveLayout}
        snapConfig={editor.snapConfig}
        onSnapConfigChange={editor.setSnapConfig}
        onAddTable={() => editor.setIsAddTableOpen(true)}
        onOpenTemplates={() => editor.setIsTemplateOpen(true)}
      />

      {/* Keyboard shortcuts hint */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground px-1 py-0.5 overflow-x-auto">
        <span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px] font-mono">Ctrl+Z</kbd> Undo</span>
        <span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px] font-mono">Ctrl+Y</kbd> Redo</span>
        <span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px] font-mono">Ctrl+S</kbd> Save</span>
        <span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px] font-mono">Del</kbd> Delete</span>
        <span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px] font-mono">Esc</kbd> Deselect</span>
        <span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px] font-mono">V</kbd> Select</span>
        <span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px] font-mono">W</kbd> Draw Wall</span>
        <span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px] font-mono">Arrow</kbd> Nudge 1px</span>
        <span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px] font-mono">Shift+Arrow</kbd> Nudge 10px</span>
        <span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px] font-mono">Alt+Drag</kbd> Pan</span>
      </div>

      {/* Main canvas area with sidebars */}
      <div className="flex gap-0 flex-1 min-h-0 border border-border rounded-xl overflow-hidden">
        {/* Left sidebar — Element Tray */}
        <ElementTray
          collapsed={leftSidebarCollapsed}
          onToggleCollapse={() => setLeftSidebarCollapsed(!leftSidebarCollapsed)}
          onAddTable={(shape) => {
            editor.setNewTableShape(shape);
            editor.setNewTableCapacity(String(TABLE_SHAPE_DEFAULTS[shape].defaultCapacity));
            editor.setIsAddTableOpen(true);
          }}
        />

        {/* Canvas */}
        <Canvas
          floorTables={editor.floorTables}
          floorWalls={editor.floorWalls}
          floorRooms={editor.floorRooms}
          doors={editor.localDoors}
          windows={editor.localWindows}
          columns={editor.localColumns}
          stairs={editor.localStairs}
          utilities={editor.localUtilities}
          currentFloor={editor.currentFloor}
          floorWidth={editor.floorWidth}
          floorHeight={editor.floorHeight}
          zoom={canvas.zoom}
          panX={canvas.panX}
          panY={canvas.panY}
          isPanning={canvas.isPanning}
          editorMode={editor.editorMode}
          selectedIds={editor.selectedIds}
          selectionInfo={editor.selectionInfo}
          snapConfig={editor.snapConfig}
          collisionMap={collisionMap}
          guides={alignmentGuides}
          wallDrawStart={editor.wallDrawStart}
          wallDrawPreview={editor.wallDrawPreview}
          wallDrawType={editor.wallDrawType}
          containerRef={containerRef}
          screenToSvg={canvas.screenToSvg}
          onCanvasPointerDown={handleCanvasPointerDown}
          onCanvasPointerMove={handleCanvasPointerMove}
          onCanvasPointerUp={handleCanvasPointerUp}
          onWheelZoom={canvas.handleWheelZoom}
          startPanning={canvas.startPanning}
          updatePanning={canvas.updatePanning}
          stopPanning={canvas.stopPanning}
          onNavigate={handleNavigate}
          onSelectTable={handleSelectTable}
          onTableDragStart={handleTableDragStart}
          onTableResizeStart={handleTableResizeStart}
          onTableRotateStart={handleTableRotateStart}
          onSelectElement={handleSelectElement}
          onElementDragStart={handleElementDragStart}
          onDropFromTray={handleDropFromTray}
        />

        {/* Right sidebar — Property Panel */}
        <PropertyPanel
          selectedTable={editor.selectedTable}
          currentFloor={editor.currentFloor}
          selectionInfo={editor.selectionInfo}
          selectedRoom={selectedRoomInfo}
          onStatusChange={editor.handleStatusChange}
          onEditTable={(table) => {
            editor.setEditingTable({ ...table });
            editor.setIsEditTableOpen(true);
          }}
          onDeleteTable={editor.handleDeleteTable}
          onClearSelection={editor.clearSelection}
        />
      </div>
        </>
      )}

      {/* Dialogs */}
      <TableDialog
        mode="add"
        open={editor.isAddTableOpen}
        onOpenChange={editor.setIsAddTableOpen}
        tableNumber={editor.newTableNumber}
        setTableNumber={editor.setNewTableNumber}
        tableCapacity={editor.newTableCapacity}
        setTableCapacity={editor.setNewTableCapacity}
        tableShape={editor.newTableShape}
        setTableShape={editor.setNewTableShape}
        editingTable={null}
        setEditingTable={() => {}}
        adding={editor.adding}
        onAdd={editor.handleAddTable}
        onEdit={() => {}}
      />

      <TableDialog
        mode="edit"
        open={editor.isEditTableOpen}
        onOpenChange={editor.setIsEditTableOpen}
        tableNumber=""
        setTableNumber={() => {}}
        tableCapacity=""
        setTableCapacity={() => {}}
        tableShape={editor.editingTable?.shape || 'square'}
        setTableShape={() => {}}
        editingTable={editor.editingTable}
        setEditingTable={editor.setEditingTable}
        adding={editor.adding}
        onAdd={() => {}}
        onEdit={editor.handleEditTable}
      />

      <FloorDialog
        open={editor.isAddFloorOpen}
        onOpenChange={editor.setIsAddFloorOpen}
        floorName={editor.newFloorName}
        setFloorName={editor.setNewFloorName}
        adding={editor.adding}
        onAdd={editor.handleAddFloor}
      />

      <TemplateDialog
        open={editor.isTemplateOpen}
        onOpenChange={editor.setIsTemplateOpen}
        onApplyTemplate={editor.applyTemplate}
      />

      {/* Merge Tables Dialog */}
      <MergeTablesDialog
        open={isMergeTablesOpen}
        onClose={() => setIsMergeTablesOpen(false)}
        restaurantId={useAppStore.getState().user?.restaurantId || ''}
        tables={editor.allTables
          .filter(t => t.branchId === editor.selectedBranchId)
          .map(t => ({
            id: t.id,
            number: t.number,
            capacity: t.capacity,
            status: t.status,
            branchId: t.branchId,
            branchName: editor.branches.find(b => b.id === t.branchId)?.name,
            floorName: editor.floors.find(f => f.id === t.floorId)?.name,
          }))}
        onMerged={editor.fetchData}
      />
    </div>
  );
}

// ============================================================
// SimpleTableView — clean card grid for everyday table management
// ============================================================

const SIMPLE_STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; bg: string }> = {
  available: { label: 'Available', color: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900' },
  occupied: { label: 'Occupied', color: 'text-red-700 dark:text-red-400', dot: 'bg-red-500', bg: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900' },
  reserved: { label: 'Reserved', color: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900' },
  cleaning: { label: 'Cleaning', color: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900' },
};

function SimpleTableView({
  tables, floors, selectedBranchId,
  statusFilter, setStatusFilter, tableSearch, setTableSearch, stats,
  onEdit, onDelete,
}: {
  tables: TableData[];
  floors: { id: string; name: string }[];
  selectedBranchId: string;
  statusFilter: 'all' | 'available' | 'occupied' | 'reserved' | 'cleaning';
  setStatusFilter: (s: 'all' | 'available' | 'occupied' | 'reserved' | 'cleaning') => void;
  tableSearch: string;
  setTableSearch: (s: string) => void;
  stats: { available: number; occupied: number; reserved: number; cleaning: number };
  onEdit: (t: TableData) => void;
  onDelete: (id: string) => void;
}) {
  const filtered = tables.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (tableSearch && !t.number.toLowerCase().includes(tableSearch.toLowerCase())) return false;
    return true;
  });

  const statusOrder: Record<string, number> = { available: 0, occupied: 1, reserved: 2, cleaning: 3 };
  const sorted = [...filtered].sort((a, b) => {
    const so = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
    if (so !== 0) return so;
    return a.number.localeCompare(b.number, undefined, { numeric: true });
  });

  const floorName = (floorId?: string) => floors.find(f => f.id === floorId)?.name || 'Unassigned';

  const filterTabs: { key: 'all' | string; label: string; count: number }[] = [
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
        <div className="flex items-center gap-1 flex-wrap">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key as typeof statusFilter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === tab.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 ${statusFilter === tab.key ? 'text-primary-foreground/70' : 'text-muted-foreground/60'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
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
          <p className="text-sm text-muted-foreground">
            {tables.length === 0 ? 'No tables found. Click "Add Table" to create one.' : 'No tables match your filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {sorted.map(table => {
            const cfg = SIMPLE_STATUS_CONFIG[table.status] || SIMPLE_STATUS_CONFIG.available;
            return (
              <div
                key={table.id}
                className={`group relative rounded-xl border-2 p-3 transition-all hover:shadow-md cursor-pointer ${cfg.bg}`}
                onClick={() => onEdit(table)}
              >
                {table.isVip && (
                  <div className="absolute -top-1.5 -right-1.5 z-10">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 text-white">
                      <Star className="h-2.5 w-2.5 fill-white" />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`h-2 w-2 rounded-full ${cfg.dot} ${table.status === 'available' ? 'animate-pulse' : ''}`} />
                  <span className={`text-[10px] font-medium uppercase tracking-wide ${cfg.color}`}>{cfg.label}</span>
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-2xl font-bold tracking-tight">{table.number}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-2">
                  <Users className="h-3 w-3" />
                  <span>Seats {table.capacity}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                  <MapPin className="h-2.5 w-2.5" />
                  <span className="truncate">{floorName(table.floorId)}</span>
                </div>
                {/* Quick actions on hover */}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 p-1.5 bg-background/90 backdrop-blur-sm rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity border-t">
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1"
                    onClick={(e) => { e.stopPropagation(); onEdit(table); }}>
                    <Edit3 className="h-3 w-3" /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); onDelete(table.id); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary footer */}
      {sorted.length > 0 && (
        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
          <span>Showing {sorted.length} of {tables.length} tables{tableSearch && ` matching "${tableSearch}"`}</span>
          <span>{floors.length} floor{floors.length !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}
