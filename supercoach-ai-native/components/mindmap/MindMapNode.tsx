import React, { memo, useCallback } from 'react';
import { G, Rect, Text as SvgText } from 'react-native-svg';
import type { GoalNode } from '../../shared/types';
import { NodeStatus } from '../../shared/types';
import type { LayoutNode } from './useMindMapLayout';

const STATUS_COLORS: Record<NodeStatus, string> = {
  [NodeStatus.PENDING]: '#5AA9FF',
  [NodeStatus.COMPLETED]: '#4DE8E0',
  [NodeStatus.STUCK]: '#FF7B72',
};

// IN_PROGRESS is not in the enum but referenced in spec as yellow
const IN_PROGRESS_COLOR = '#FFD166';

function getStatusColor(status: NodeStatus | string): string {
  if (status === 'IN_PROGRESS') return IN_PROGRESS_COLOR;
  return STATUS_COLORS[status as NodeStatus] ?? STATUS_COLORS[NodeStatus.PENDING];
}

interface MindMapNodeProps {
  node: GoalNode;
  layout: LayoutNode;
  isSelected: boolean;
  onPress: (nodeId: string) => void;
  onLongPress: (nodeId: string) => void;
  progress?: number;
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '\u2026';
}

const MindMapNodeComponent: React.FC<MindMapNodeProps> = ({
  node,
  layout,
  isSelected,
  onPress,
  onLongPress,
  progress,
}) => {
  const borderColor = getStatusColor(node.status);
  const fillColor = node.status === NodeStatus.COMPLETED
    ? 'rgba(17, 89, 94, 0.9)'
    : node.status === NodeStatus.STUCK
      ? 'rgba(96, 28, 38, 0.9)'
      : 'rgba(24, 52, 92, 0.9)';
  const textColor = '#F8FBFF';

  const handlePress = useCallback(() => {
    onPress(node.id);
  }, [onPress, node.id]);

  const handleLongPress = useCallback(() => {
    onLongPress(node.id);
  }, [onLongPress, node.id]);

  const displayText = truncateText(node.text, 18);
  const showProgress = progress !== undefined && progress > 0 && progress < 100;

  return (
    <G
      x={layout.x}
      y={layout.y}
      onPress={handlePress}
      onLongPress={handleLongPress}
    >
      {/* Selection highlight */}
      {isSelected && (
        <Rect
          x={-3}
          y={-3}
          width={layout.width + 6}
          height={layout.height + 6}
          rx={12}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={2}
          strokeDasharray="6,3"
          opacity={0.6}
        />
      )}

      {/* Node background */}
      <Rect
        x={0}
        y={0}
        width={layout.width}
        height={layout.height}
        rx={10}
        fill={fillColor}
        stroke={borderColor}
        strokeWidth={isSelected ? 2.5 : 1.5}
      />

      {/* Progress bar background */}
      {showProgress && (
        <>
          <Rect
            x={4}
            y={layout.height - 8}
            width={layout.width - 8}
            height={4}
            rx={2}
            fill="rgba(255,255,255,0.15)"
          />
          <Rect
            x={4}
            y={layout.height - 8}
            width={(layout.width - 8) * (progress / 100)}
            height={4}
            rx={2}
            fill={borderColor}
          />
        </>
      )}

      {/* Node text */}
      <SvgText
        x={layout.width / 2}
        y={showProgress ? layout.height / 2 - 2 : layout.height / 2 + 1}
        textAnchor="middle"
        alignmentBaseline="central"
        fill={textColor}
        fontSize={13}
        fontWeight={node.type === 'ROOT' ? '700' : '500'}
      >
        {displayText}
      </SvgText>
    </G>
  );
};

export const MindMapNode = memo(MindMapNodeComponent);
export { getStatusColor };
