import React, { useCallback, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import Svg, { G } from 'react-native-svg';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
} from 'react-native-reanimated';
import type { GoalNode, GoalLink } from '../../shared/types';
import { NodeStatus } from '../../shared/types';
import { getLinkId } from '../../hooks/useAutoSave';
import { useMindMapLayout } from './useMindMapLayout';
import { useMindMapGestures } from './useMindMapGestures';
import { MindMapNode, getStatusColor } from './MindMapNode';
import { MindMapEdge } from './MindMapEdge';

interface MindMapCanvasProps {
  nodes: GoalNode[];
  links: GoalLink[];
  selectedNodeId: string | null;
  onNodePress: (nodeId: string) => void;
  onNodeLongPress: (nodeId: string) => void;
}

/** Build a map of parentId -> childIds from links (once per render). */
function buildChildrenMap(links: GoalLink[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const link of links) {
    const sourceId = getLinkId(link.source);
    const targetId = getLinkId(link.target);
    if (!map.has(sourceId)) map.set(sourceId, []);
    map.get(sourceId)!.push(targetId);
  }
  return map;
}

/** Compute completion progress for a node based on its direct children. */
function computeProgress(
  nodeId: string,
  childrenMap: Map<string, string[]>,
  nodeMap: Map<string, GoalNode>,
): number | undefined {
  const childIds = childrenMap.get(nodeId);
  if (!childIds || childIds.length === 0) return undefined;
  const completed = childIds.filter((id) => {
    const n = nodeMap.get(id);
    return n?.status === NodeStatus.COMPLETED;
  }).length;
  return Math.round((completed / childIds.length) * 100);
}

export const MindMapCanvas: React.FC<MindMapCanvasProps> = ({
  nodes,
  links,
  selectedNodeId,
  onNodePress,
  onNodeLongPress,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const layout = useMindMapLayout(nodes, links);
  const { gesture, translateX, translateY, scale } = useMindMapGestures();

  const nodeMap = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes],
  );

  const childrenMap = useMemo(() => buildChildrenMap(links), [links]);

  // Compute SVG canvas size from layout
  const canvasSize = useMemo(() => {
    let maxX = screenWidth;
    let maxY = screenHeight;
    for (const pos of layout.values()) {
      maxX = Math.max(maxX, pos.x + pos.width + 100);
      maxY = Math.max(maxY, pos.y + pos.height + 100);
    }
    return { width: maxX, height: maxY };
  }, [layout, screenWidth, screenHeight]);

  // Build edges from links
  const edges = useMemo(() => {
    const result: Array<{
      key: string;
      parentLayout: { x: number; y: number; width: number; height: number };
      childLayout: { x: number; y: number; width: number; height: number };
      color: string;
    }> = [];

    for (const link of links) {
      const sourceId = getLinkId(link.source);
      const targetId = getLinkId(link.target);
      const parentPos = layout.get(sourceId);
      const childPos = layout.get(targetId);
      const parentNode = nodeMap.get(sourceId);
      if (!parentPos || !childPos || !parentNode) continue;

      result.push({
        key: `${sourceId}-${targetId}`,
        parentLayout: parentPos,
        childLayout: childPos,
        color: getStatusColor(parentNode.status),
      });
    }
    return result;
  }, [links, layout, nodeMap]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleNodePress = useCallback(
    (nodeId: string) => onNodePress(nodeId),
    [onNodePress],
  );

  const handleNodeLongPress = useCallback(
    (nodeId: string) => onNodeLongPress(nodeId),
    [onNodeLongPress],
  );

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        <Svg
          width={canvasSize.width}
          height={canvasSize.height}
          viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
        >
          <G>
            {/* Edges first (behind nodes) */}
            {edges.map((edge) => (
              <MindMapEdge
                key={edge.key}
                parentLayout={edge.parentLayout}
                childLayout={edge.childLayout}
                color={edge.color}
              />
            ))}

            {/* Nodes */}
            {nodes.map((node) => {
              const pos = layout.get(node.id);
              if (!pos) return null;
              return (
                <MindMapNode
                  key={node.id}
                  node={node}
                  layout={pos}
                  isSelected={node.id === selectedNodeId}
                  onPress={handleNodePress}
                  onLongPress={handleNodeLongPress}
                  progress={computeProgress(node.id, childrenMap, nodeMap)}
                />
              );
            })}
          </G>
        </Svg>
      </Animated.View>
    </GestureDetector>
  );
};
