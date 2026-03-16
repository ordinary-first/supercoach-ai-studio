import React, { memo } from 'react';
import { Path } from 'react-native-svg';
import type { LayoutNode } from './useMindMapLayout';

interface MindMapEdgeProps {
  parentLayout: LayoutNode;
  childLayout: LayoutNode;
  color: string;
}

const MindMapEdgeComponent: React.FC<MindMapEdgeProps> = ({
  parentLayout,
  childLayout,
  color,
}) => {
  // Start from bottom-center of parent
  const x1 = parentLayout.x + parentLayout.width / 2;
  const y1 = parentLayout.y + parentLayout.height;

  // End at top-center of child
  const x2 = childLayout.x + childLayout.width / 2;
  const y2 = childLayout.y;

  // Cubic bezier control points for smooth curve
  const midY = (y1 + y2) / 2;
  const cp1x = x1;
  const cp1y = midY;
  const cp2x = x2;
  const cp2y = midY;

  const d = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;

  return (
    <Path
      d={d}
      stroke={color}
      strokeWidth={2}
      fill="none"
      opacity={0.7}
    />
  );
};

export const MindMapEdge = memo(MindMapEdgeComponent);
