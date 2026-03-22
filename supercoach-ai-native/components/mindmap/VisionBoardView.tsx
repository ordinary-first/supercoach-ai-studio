import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Dimensions,
  Pressable,
  RefreshControl,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { GoalNode, GoalLink } from '../../shared/types';
import { NodeType } from '../../shared/types';

interface VisionBoardViewProps {
  nodes: GoalNode[];
  links: GoalLink[];
  onNodePress: (nodeId: string) => void;
  onRefresh?: () => Promise<void>;
}

const GRID_PADDING = 16;
const CELL_GAP = 8;
const COLUMNS = 3;
const CENTER_INDEX = 4;
const TOTAL_CELLS = 9;

function resolveId(ref: string | GoalNode): string {
  return typeof ref === 'string' ? ref : ref.id;
}

const GRADIENT_PALETTES: [string, string][] = [
  ['#6366f1', '#8b5cf6'],
  ['#ec4899', '#f43f5e'],
  ['#14b8a6', '#06b6d4'],
  ['#f59e0b', '#ef4444'],
  ['#10b981', '#3b82f6'],
  ['#8b5cf6', '#ec4899'],
  ['#06b6d4', '#6366f1'],
  ['#f43f5e', '#f59e0b'],
];

/** Animated cell wrapper with staggered entrance */
const AnimatedCell: React.FC<{
  index: number;
  cellSize: number;
  onPress: () => void;
  children: React.ReactNode;
}> = ({ index, cellSize, onPress, children }) => {
  const progress = useSharedValue(0);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    // Staggered entrance: center first, then surrounding
    const delay = index === CENTER_INDEX ? 0 : 80 + index * 60;
    progress.value = withDelay(
      delay,
      withSpring(1, { damping: 14, stiffness: 90 }),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
    transform: [
      { scale: interpolate(progress.value, [0, 1], [0.85, 1]) * pressScale.value },
      { translateY: interpolate(progress.value, [0, 1], [14, 0]) },
    ],
  }));

  const handlePressIn = () => {
    pressScale.value = withTiming(0.95, { duration: 100, easing: Easing.out(Easing.cubic) });
  };

  const handlePressOut = () => {
    pressScale.value = withSpring(1, { damping: 12, stiffness: 200 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Animated.View style={[{ width: cellSize, height: cellSize }, animStyle]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{ flex: 1 }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

export const VisionBoardView: React.FC<VisionBoardViewProps> = ({
  nodes,
  links,
  onNodePress,
  onRefresh,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh?.();
    setRefreshing(false);
  }, [onRefresh]);
  const screenWidth = Dimensions.get('window').width;
  const cellSize = Math.floor(
    (screenWidth - GRID_PADDING * 2 - CELL_GAP * (COLUMNS - 1)) / COLUMNS,
  );

  const { rootNode, childNodes } = useMemo(() => {
    const root = nodes.find((n) => n.type === NodeType.ROOT) ?? null;
    if (!root) return { rootNode: null, childNodes: [] };

    const childIds = new Set<string>();
    for (const link of links) {
      const sourceId = resolveId(link.source);
      const targetId = resolveId(link.target);
      if (sourceId === root.id) childIds.add(targetId);
    }

    const children = nodes.filter((n) => childIds.has(n.id));
    return { rootNode: root, childNodes: children };
  }, [nodes, links]);

  const gridCells = useMemo(() => {
    const cells: Array<GoalNode | 'add' | null> = new Array(TOTAL_CELLS).fill('add');
    cells[CENTER_INDEX] = rootNode;

    const surroundingIndices = [0, 1, 2, 3, 5, 6, 7, 8];
    for (let i = 0; i < surroundingIndices.length; i++) {
      if (i < childNodes.length) {
        cells[surroundingIndices[i]] = childNodes[i];
      }
    }
    return cells;
  }, [rootNode, childNodes]);

  const renderCell = (cell: GoalNode | 'add' | null, index: number) => {
    const isCenter = index === CENTER_INDEX;

    // Empty / add cell
    if (cell === 'add' || cell === null) {
      return (
        <AnimatedCell
          key={`add-${index}`}
          index={index}
          cellSize={cellSize}
          onPress={() => { if (rootNode) onNodePress(rootNode.id); }}
        >
          <View
            className="flex-1 rounded-2xl border border-dashed border-neutral-600 items-center justify-center"
            style={{ backgroundColor: 'rgba(30,41,59,0.6)' }}
          >
            <Plus size={28} color="#64748b" />
          </View>
        </AnimatedCell>
      );
    }

    // Node cell
    const node = cell;
    const gradientIndex = index % GRADIENT_PALETTES.length;
    const [colorStart, colorEnd] = GRADIENT_PALETTES[gradientIndex];

    return (
      <AnimatedCell
        key={node.id}
        index={index}
        cellSize={cellSize}
        onPress={() => onNodePress(node.id)}
      >
        <View className="flex-1 rounded-2xl overflow-hidden"
          style={{
            shadowColor: isCenter ? '#7c3aed' : colorStart,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          {node.imageUrl ? (
            <View className="flex-1">
              <Image
                source={{ uri: node.imageUrl }}
                style={{ width: cellSize, height: cellSize, position: 'absolute' }}
                resizeMode="cover"
              />
              {/* Vignette gradient overlay */}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)']}
                style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: cellSize * 0.6 }}
              />
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
        </View>
      </AnimatedCell>
    );
  };

  return (
    <ScrollView
      className="flex-1 bg-[#0A0E1A]"
      contentContainerStyle={{
        paddingHorizontal: GRID_PADDING,
        paddingVertical: GRID_PADDING,
      }}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#71B7FF"
            colors={['#71B7FF']}
            progressBackgroundColor="#1A1F2E"
          />
        ) : undefined
      }
    >
      <View className="flex-row flex-wrap" style={{ gap: CELL_GAP }}>
        {gridCells.map((cell, index) => renderCell(cell, index))}
      </View>
    </ScrollView>
  );
};
