// ============================================================
// Toolbar — TOP: mode, zoom, undo/redo, save
// ============================================================

'use client';

import React, { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Move, PenLine, Eye, ZoomIn, ZoomOut, Maximize2,
  Save, Undo2, Redo2, Plus, Magnet, Grid3X3,
  Loader2,
} from 'lucide-react';
import type { EditorMode, SnapConfig } from './types';
import { GRID_SNAP_OPTIONS } from './constants';

interface ToolbarProps {
  editorMode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  hasUnsavedChanges: boolean;
  saving: boolean;
  onSave: () => void;
  snapConfig: SnapConfig;
  onSnapConfigChange: (config: SnapConfig) => void;
  onAddTable: () => void;
  onOpenTemplates: () => void;
}

function ToolbarComponent({
  editorMode, onModeChange,
  zoom, onZoomIn, onZoomOut, onZoomFit,
  canUndo, canRedo, onUndo, onRedo,
  hasUnsavedChanges, saving, onSave,
  snapConfig, onSnapConfigChange,
  onAddTable, onOpenTemplates,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-1 p-1.5 bg-background border border-border rounded-lg shadow-sm flex-wrap">
      <TooltipProvider delayDuration={200}>
        {/* Mode buttons */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={editorMode === 'select' ? 'default' : 'ghost'}
              size="sm" className="h-8 gap-1 px-2"
              onClick={() => onModeChange('select')}
            >
              <Move className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Select</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Select & Move (V)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={editorMode === 'draw-wall' ? 'default' : 'ghost'}
              size="sm" className="h-8 gap-1 px-2"
              onClick={() => onModeChange('draw-wall')}
            >
              <PenLine className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Draw Wall</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Draw Wall (W)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={editorMode === 'operations' ? 'default' : 'ghost'}
              size="sm" className="h-8 gap-1 px-2"
              onClick={() => onModeChange('operations')}
            >
              <Eye className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Operations</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Operations Mode</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Add Table / Template */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2" onClick={onAddTable}>
              <Plus className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Table</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add Table</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2" onClick={onOpenTemplates}>
              <Grid3X3 className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Template</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Floor Templates</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Zoom controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom Out</TooltipContent>
        </Tooltip>

        <span className="text-xs text-muted-foreground w-12 text-center tabular-nums">
          {Math.round(zoom * 100)}%
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom In</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onZoomFit}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Fit to View</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Snap controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={snapConfig.enabled ? 'secondary' : 'ghost'}
              size="sm" className="h-8 w-8 p-0"
              onClick={() => onSnapConfigChange({ ...snapConfig, enabled: !snapConfig.enabled })}
            >
              <Magnet className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Snap to Grid ({snapConfig.enabled ? 'ON' : 'OFF'})</TooltipContent>
        </Tooltip>

        <Select
          value={String(snapConfig.gridSize)}
          onValueChange={(v) => onSnapConfigChange({ ...snapConfig, gridSize: Number(v) as SnapConfig['gridSize'] })}
        >
          <SelectTrigger className="h-8 w-16 text-xs border-0 p-0 px-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GRID_SNAP_OPTIONS.map(size => (
              <SelectItem key={size} value={String(size)}>{size}px</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Undo / Redo */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onUndo} disabled={!canUndo}>
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onRedo} disabled={!canRedo}>
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Save */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={hasUnsavedChanges ? 'default' : 'ghost'}
              size="sm" className="h-8 gap-1 px-2"
              onClick={onSave}
              disabled={saving || !hasUnsavedChanges}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span className="text-xs">Save</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Save Layout (Ctrl+S)</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export const Toolbar = memo(ToolbarComponent);
