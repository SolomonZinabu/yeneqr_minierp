// ============================================================
// TemplateDialog — Pre-built floor plan templates
// ============================================================

'use client';

import React, { memo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FLOOR_TEMPLATES } from './constants';
import type { FloorTemplate } from './types';

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyTemplate: (template: FloorTemplate) => void;
}

function TemplateDialogComponent({ open, onOpenChange, onApplyTemplate }: TemplateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Floor Plan Templates</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FLOOR_TEMPLATES.map((template) => {
            const Icon = template.icon;
            return (
              <Card key={template.id} className="hover:border-primary/50 transition-colors cursor-pointer group">
                <CardContent className="p-4 space-y-3">
                  {/* Template preview area */}
                  <div className="h-28 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg border border-border flex items-center justify-center relative overflow-hidden">
                    <Icon className="h-10 w-10 text-muted-foreground/20" />
                    {/* Mini preview dots for tables */}
                    <div className="absolute inset-2 flex flex-wrap gap-1 justify-center items-center">
                      {template.tableShapes.slice(0, 12).map((ts, i) => (
                        <div
                          key={i}
                          className="rounded-sm bg-emerald-400/30"
                          style={{
                            width: 6, height: 6,
                            borderRadius: ts.shape === 'round' || ts.shape === 'oval' ? '50%' : 1,
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm">{template.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-[10px]">
                      {template.tableShapes.length} tables
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {template.walls.length} walls
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {template.rooms.length} rooms
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {template.width}×{template.height}
                    </Badge>
                  </div>

                  <Button
                    size="sm"
                    className="w-full text-xs h-8"
                    onClick={() => onApplyTemplate(template)}
                  >
                    Apply Template
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const TemplateDialog = memo(TemplateDialogComponent);
