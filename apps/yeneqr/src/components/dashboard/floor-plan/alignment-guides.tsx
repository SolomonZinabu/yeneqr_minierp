// ============================================================
// AlignmentGuides — Smart alignment guides like Figma
// ============================================================

'use client';

import React, { memo } from 'react';
import type { AlignmentGuide } from './types';

interface AlignmentGuidesProps {
  guides: AlignmentGuide[];
}

function AlignmentGuidesComponent({ guides }: AlignmentGuidesProps) {
  if (guides.length === 0) return null;

  return (
    <g>
      {guides.map((guide, i) => {
        if (guide.type === 'vertical') {
          return (
            <line
              key={`v-${i}`}
              x1={guide.position}
              y1={guide.start}
              x2={guide.position}
              y2={guide.end}
              stroke="#f472b6"
              strokeWidth={1}
              strokeDasharray="4,2"
              opacity={0.8}
            />
          );
        } else {
          return (
            <line
              key={`h-${i}`}
              x1={guide.start}
              y1={guide.position}
              x2={guide.end}
              y2={guide.position}
              stroke="#f472b6"
              strokeWidth={1}
              strokeDasharray="4,2"
              opacity={0.8}
            />
          );
        }
      })}
    </g>
  );
}

export const AlignmentGuides = memo(AlignmentGuidesComponent);
