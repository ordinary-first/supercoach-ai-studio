import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronDown, ChevronRight, Circle, CheckCircle2 } from 'lucide-react-native';
import type { GoalNode, GoalLink } from '../shared/types';
import { NodeType, NodeStatus } from '../shared/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_WIDTH * 0.75;

/**
 * Placeholder: In production this would read from a Zustand store or navigation params.
 * For now we accept nodeId and render a demo structure.
 */
function resolveId(ref: string | GoalNode): string {
  return typeof ref === 'string' ? ref : ref.id;
}

interface TreeNode {
  node: GoalNode;
  children: TreeNode[];
}

function buildSubtree(
  nodeId: string,
  nodes: GoalNode[],
  links: GoalLink[],
): TreeNode | null {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const childIds: string[] = [];
  for (const link of links) {
    if (resolveId(link.source) === nodeId) {
      childIds.push(resolveId(link.target));
    }
  }

  const children = childIds
    .map((id) => buildSubtree(id, nodes, links))
    .filter((t): t is TreeNode => t !== null);

  return { node, children };
}

// --- Demo data (will be replaced by store data) ---
const DEMO_NODES: GoalNode[] = [
  { id: 'root', text: 'My Goals', type: NodeType.ROOT, status: NodeStatus.PENDING, progress: 0 },
  { id: 'g1', text: '건강한 몸', type: NodeType.SUB, status: NodeStatus.PENDING, progress: 0, parentId: 'root', imageUrl: undefined },
  { id: 'g1-1', text: '체중 관리', type: NodeType.SUB, status: NodeStatus.PENDING, progress: 0, parentId: 'g1' },
  { id: 'g1-1-1', text: '식단 기록 앱 설치', type: NodeType.SUB, status: NodeStatus.COMPLETED, progress: 100, parentId: 'g1-1' },
  { id: 'g1-1-2', text: '주 3회 운동', type: NodeType.SUB, status: NodeStatus.PENDING, progress: 0, parentId: 'g1-1' },
  { id: 'g1-1-3', text: '야식 끊기', type: NodeType.SUB, status: NodeStatus.PENDING, progress: 0, parentId: 'g1-1' },
  { id: 'g1-2', text: '마라톤 도전', type: NodeType.SUB, status: NodeStatus.PENDING, progress: 0, parentId: 'g1' },
  { id: 'g1-2-1', text: '5km 러닝 시작', type: NodeType.SUB, status: NodeStatus.PENDING, progress: 0, parentId: 'g1-2' },
  { id: 'g1-2-2', text: '러닝 크루 가입', type: NodeType.SUB, status: NodeStatus.PENDING, progress: 0, parentId: 'g1-2' },
];

const DEMO_LINKS: GoalLink[] = [
  { source: 'root', target: 'g1' },
  { source: 'g1', target: 'g1-1' },
  { source: 'g1-1', target: 'g1-1-1' },
  { source: 'g1-1', target: 'g1-1-2' },
  { source: 'g1-1', target: 'g1-1-3' },
  { source: 'g1', target: 'g1-2' },
  { source: 'g1-2', target: 'g1-2-1' },
  { source: 'g1-2', target: 'g1-2-2' },
];

interface TreeItemProps {
  treeNode: TreeNode;
  depth: number;
  collapsedIds: Set<string>;
  onToggleCollapse: (id: string) => void;
  onToggleComplete: (id: string) => void;
}

const TreeItem: React.FC<TreeItemProps> = ({
  treeNode,
  depth,
  collapsedIds,
  onToggleCollapse,
  onToggleComplete,
}) => {
  const { node, children } = treeNode;
  const isCollapsed = collapsedIds.has(node.id);
  const hasChildren = children.length > 0;
  const isCompleted = node.status === NodeStatus.COMPLETED;

  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          if (hasChildren) onToggleCollapse(node.id);
        }}
        className="flex-row items-center py-3 border-b border-slate-700/30"
        style={{ paddingLeft: 16 + depth * 24 }}
      >
        {/* Expand/collapse chevron */}
        <View className="w-5 mr-1">
          {hasChildren ? (
            isCollapsed ? (
              <ChevronRight size={16} color="#64748b" />
            ) : (
              <ChevronDown size={16} color="#64748b" />
            )
          ) : null}
        </View>

        {/* Completion toggle */}
        <TouchableOpacity
          onPress={() => onToggleComplete(node.id)}
          hitSlop={8}
          className="mr-3"
        >
          {isCompleted ? (
            <CheckCircle2 size={20} color="#4DE8E0" />
          ) : (
            <Circle size={20} color="#475569" />
          )}
        </TouchableOpacity>

        {/* Text */}
        <Text
          className={`flex-1 text-sm ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-200'}`}
          numberOfLines={2}
        >
          {node.text}
        </Text>
      </TouchableOpacity>

      {/* Children (if expanded) */}
      {!isCollapsed &&
        children.map((child) => (
          <TreeItem
            key={child.node.id}
            treeNode={child}
            depth={depth + 1}
            collapsedIds={collapsedIds}
            onToggleCollapse={onToggleCollapse}
            onToggleComplete={onToggleComplete}
          />
        ))}
    </View>
  );
};

export default function GoalDetailScreen() {
  const { nodeId } = useLocalSearchParams<{ nodeId: string }>();
  const router = useRouter();

  // TODO: Replace with Zustand store data
  const nodes = DEMO_NODES;
  const links = DEMO_LINKS;

  const targetNode = nodes.find((n) => n.id === (nodeId || 'g1'));
  const tree = useMemo(
    () => (targetNode ? buildSubtree(targetNode.id, nodes, links) : null),
    [targetNode, nodes, links],
  );

  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const onToggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onToggleComplete = useCallback((id: string) => {
    // TODO: update Zustand store
  }, []);

  if (!targetNode || !tree) {
    return (
      <View className="flex-1 bg-slate-900 items-center justify-center">
        <Text className="text-slate-400">목표를 찾을 수 없습니다</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-900">
      <StatusBar barStyle="light-content" />
      <ScrollView className="flex-1" bounces={false}>
        {/* Hero image section */}
        <View style={{ height: HERO_HEIGHT }}>
          {targetNode.imageUrl ? (
            <Image
              source={{ uri: targetNode.imageUrl }}
              style={{ width: SCREEN_WIDTH, height: HERO_HEIGHT }}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={['#1e40af', '#7c3aed', '#4c1d95']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: SCREEN_WIDTH, height: HERO_HEIGHT }}
            />
          )}

          {/* Dark overlay */}
          <View
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
          />

          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="absolute top-14 left-4 w-10 h-10 rounded-full bg-black/30 items-center justify-center"
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color="#fff" />
          </TouchableOpacity>

          {/* Title */}
          <View className="absolute bottom-6 left-5 right-5">
            <Text className="text-white text-2xl font-bold">
              {targetNode.text}
            </Text>
          </View>
        </View>

        {/* Tree list */}
        <View className="bg-slate-900 min-h-screen pb-20">
          {tree.children.map((child) => (
            <TreeItem
              key={child.node.id}
              treeNode={child}
              depth={0}
              collapsedIds={collapsedIds}
              onToggleCollapse={onToggleCollapse}
              onToggleComplete={onToggleComplete}
            />
          ))}

          {tree.children.length === 0 && (
            <View className="items-center py-12">
              <Text className="text-slate-500">하위 목표가 없습니다</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
