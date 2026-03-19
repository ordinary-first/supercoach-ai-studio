import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';
import type { GoalNode, GoalLink } from '../../shared/types';
import { NodeType } from '../../shared/types';

interface VisionBoardViewProps {
  nodes: GoalNode[];
  links: GoalLink[];
  onNodePress: (nodeId: string) => void;
}

const GRID_PADDING = 16;
const CELL_GAP = 8;
const COLUMNS = 3;
const CENTER_INDEX = 4; // center of 3x3 grid (0-indexed)
const TOTAL_CELLS = 9;

/** Resolve link source/target to a string id. */
function resolveId(ref: string | GoalNode): string {
  return typeof ref === 'string' ? ref : ref.id;
}

/** Gradient color palettes for cells without images. */
const GRADIENT_PALETTES: [string, string][] = [
  ['#6366f1', '#8b5cf6'], // indigo -> violet
  ['#ec4899', '#f43f5e'], // pink -> rose
  ['#14b8a6', '#06b6d4'], // teal -> cyan
  ['#f59e0b', '#ef4444'], // amber -> red
  ['#10b981', '#3b82f6'], // emerald -> blue
  ['#8b5cf6', '#ec4899'], // violet -> pink
  ['#06b6d4', '#6366f1'], // cyan -> indigo
  ['#f43f5e', '#f59e0b'], // rose -> amber
];

export const VisionBoardView: React.FC<VisionBoardViewProps> = ({
  nodes,
  links,
  onNodePress,
}) => {
  const screenWidth = Dimensions.get('window').width;
  const cellSize = Math.floor(
    (screenWidth - GRID_PADDING * 2 - CELL_GAP * (COLUMNS - 1)) / COLUMNS,
  );

  // Find root node and its direct children
  const { rootNode, childNodes } = useMemo(() => {
    const root = nodes.find((n) => n.type === NodeType.ROOT) ?? null;
    if (!root) return { rootNode: null, childNodes: [] };

    // Get direct children of root from links
    const childIds = new Set<string>();
    for (const link of links) {
      const sourceId = resolveId(link.source);
      const targetId = resolveId(link.target);
      if (sourceId === root.id) {
        childIds.add(targetId);
      }
    }

    const children = nodes.filter((n) => childIds.has(n.id));
    return { rootNode: root, childNodes: children };
  }, [nodes, links]);

  // Build the 9-cell grid: center = root, surrounding = children, rest = empty ("+")
  const gridCells = useMemo(() => {
    const cells: Array<GoalNode | 'add' | null> = new Array(TOTAL_CELLS).fill(
      'add',
    );

    // Center cell is the ROOT node
    cells[CENTER_INDEX] = rootNode;

    // Fill surrounding cells with children (skip center)
    const surroundingIndices = [0, 1, 2, 3, 5, 6, 7, 8];
    for (let i = 0; i < surroundingIndices.length; i++) {
      if (i < childNodes.length) {
        cells[surroundingIndices[i]] = childNodes[i];
      }
      // else stays 'add'
    }

    return cells;
  }, [rootNode, childNodes]);

  const renderCell = (
    cell: GoalNode | 'add' | null,
    index: number,
  ) => {
    const isCenter = index === CENTER_INDEX;

    // Empty / add cell
    if (cell === 'add' || cell === null) {
      return (
        <TouchableOpacity
          key={`add-${index}`}
          activeOpacity={0.7}
          onPress={() => {
            if (rootNode) onNodePress(rootNode.id);
          }}
          style={{ width: cellSize, height: cellSize }}
          className="rounded-2xl bg-slate-800/60 border border-dashed border-slate-600 items-center justify-center"
        >
          <Plus size={28} color="#64748b" />
        </TouchableOpacity>
      );
    }

    // Node cell (root or child)
    const node = cell;
    const gradientIndex = index % GRADIENT_PALETTES.length;
    const [colorStart, colorEnd] = GRADIENT_PALETTES[gradientIndex];

    return (
      <TouchableOpacity
        key={node.id}
        activeOpacity={0.8}
        onPress={() => onNodePress(node.id)}
        style={{ width: cellSize, height: cellSize }}
        className="rounded-2xl overflow-hidden"
      >
        {node.imageUrl ? (
          // Image background
          <View className="flex-1">
            <Image
              source={{ uri: node.imageUrl }}
              style={{ width: cellSize, height: cellSize }}
              className="absolute inset-0 rounded-2xl"
              resizeMode="cover"
            />
            {/* Dark overlay for text readability */}
            <View className="absolute inset-0 bg-black/40 rounded-2xl" />
            {/* Label */}
            <View className="flex-1 justify-end p-2">
              <Text
                className={`text-white font-semibold ${isCenter ? 'text-base' : 'text-sm'}`}
                numberOfLines={2}
              >
                {node.text}
              </Text>
            </View>
          </View>
        ) : (
          // Gradient fallback
          <LinearGradient
            colors={isCenter ? ['#1e40af', '#7c3aed'] : [colorStart, colorEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1, borderRadius: 16 }}
          >
            <View className="flex-1 items-center justify-center p-2">
              <Text
                className={`text-white font-bold text-center ${isCenter ? 'text-base' : 'text-sm'}`}
                numberOfLines={3}
              >
                {node.text}
              </Text>
              {isCenter && (
                <View className="mt-1 px-2 py-0.5 rounded-full bg-white/20">
                  <Text className="text-white/80 text-xs">Identity</Text>
                </View>
              )}
            </View>
          </LinearGradient>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      className="flex-1 bg-slate-900"
      contentContainerStyle={{
        paddingHorizontal: GRID_PADDING,
        paddingVertical: GRID_PADDING,
      }}
    >
      <View
        className="flex-row flex-wrap"
        style={{ gap: CELL_GAP }}
      >
        {gridCells.map((cell, index) => renderCell(cell, index))}
      </View>
    </ScrollView>
  );
};
