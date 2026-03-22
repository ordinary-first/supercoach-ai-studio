import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { MindMapCanvas } from '../../components/mindmap/MindMapCanvas';
import { MindMapControls } from '../../components/mindmap/MindMapControls';
import { VisionBoardView } from '../../components/mindmap/VisionBoardView';
import CoachBubble, { type CoachBubbleRef } from '../../components/CoachBubble';
import type { GoalNode, GoalLink } from '../../shared/types';
import { NodeType, NodeStatus } from '../../shared/types';
import { getLinkId } from '../../hooks/useAutoSave';

const INITIAL_NODES: GoalNode[] = [
  {
    id: 'root',
    text: 'My Goals',
    type: NodeType.ROOT,
    status: NodeStatus.PENDING,
    progress: 0,
  },
];

const INITIAL_LINKS: GoalLink[] = [];

function generateId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createSubNode(parentId: string): { node: GoalNode; link: GoalLink } {
  const newId = generateId();
  return {
    node: {
      id: newId,
      text: 'New Goal',
      type: NodeType.SUB,
      status: NodeStatus.PENDING,
      progress: 0,
      parentId,
    },
    link: { source: parentId, target: newId },
  };
}

export default function GoalsScreen() {
  const router = useRouter();
  const coachRef = useRef<CoachBubbleRef>(null);
  const [viewMode, setViewMode] = useState<'visionboard' | 'mindmap'>('visionboard');
  const [nodes, setNodes] = useState<GoalNode[]>(INITIAL_NODES);
  const [links, setLinks] = useState<GoalLink[]>(INITIAL_LINKS);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  const addNodeUnder = useCallback((parentId: string) => {
    const { node, link } = createSubNode(parentId);
    setNodes((prev) => [...prev, node]);
    setLinks((prev) => [...prev, link]);
    setSelectedNodeId(node.id);
    setEditingNodeId(node.id);
    setEditText('New Goal');
  }, []);

  const handleNodePress = useCallback((nodeId: string) => {
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  const handleNodeLongPress = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      setEditingNodeId(nodeId);
      setEditText(node.text);
    },
    [nodes],
  );

  const handleAddChild = useCallback(() => {
    if (!selectedNodeId) return;
    addNodeUnder(selectedNodeId);
  }, [selectedNodeId, addNodeUnder]);

  const handleAddSibling = useCallback(() => {
    if (!selectedNodeId) return;
    const parentLink = links.find(
      (l) => getLinkId(l.target) === selectedNodeId,
    );
    if (!parentLink) return;
    addNodeUnder(getLinkId(parentLink.source));
  }, [selectedNodeId, links, addNodeUnder]);

  const handleEdit = useCallback(() => {
    if (!selectedNodeId) return;
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node) return;
    setEditingNodeId(selectedNodeId);
    setEditText(node.text);
  }, [selectedNodeId, nodes]);

  const handleEditSubmit = useCallback(() => {
    if (!editingNodeId || !editText.trim()) {
      setEditingNodeId(null);
      return;
    }
    setNodes((prev) =>
      prev.map((n) =>
        n.id === editingNodeId ? { ...n, text: editText.trim() } : n,
      ),
    );
    setEditingNodeId(null);
    setEditText('');
  }, [editingNodeId, editText]);

  const handleDelete = useCallback(() => {
    if (!selectedNodeId) return;
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node || node.type === NodeType.ROOT) return;

    Alert.alert('Delete Node', `Delete "${node.text}" and all its children?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const toDelete = new Set<string>();
          const queue = [selectedNodeId];
          while (queue.length > 0) {
            const id = queue.pop()!;
            toDelete.add(id);
            for (const link of links) {
              const sourceId = getLinkId(link.source);
              const targetId = getLinkId(link.target);
              if (sourceId === id && !toDelete.has(targetId)) {
                queue.push(targetId);
              }
            }
          }
          setNodes((prev) => prev.filter((n) => !toDelete.has(n.id)));
          setLinks((prev) =>
            prev.filter((l) => {
              const s = getLinkId(l.source);
              const t = getLinkId(l.target);
              return !toDelete.has(s) && !toDelete.has(t);
            }),
          );
          setSelectedNodeId(null);
        },
      },
    ]);
  }, [selectedNodeId, nodes, links]);

  const handleToggleComplete = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes((prev) =>
      prev.map((n) =>
        n.id === selectedNodeId
          ? {
              ...n,
              status:
                n.status === NodeStatus.COMPLETED
                  ? NodeStatus.PENDING
                  : NodeStatus.COMPLETED,
            }
          : n,
      ),
    );
  }, [selectedNodeId]);

  const handleCreateTodo = useCallback(() => {
    if (!selectedNode) return;
    Alert.alert('Create Todo', `Todo created from "${selectedNode.text}"`);
  }, [selectedNode]);

  const handleGenerateImage = useCallback(() => {
    if (!selectedNode) return;
    Alert.alert('Generate Image', `AI image generation for "${selectedNode.text}"`);
  }, [selectedNode]);

  const handleDecompose = useCallback(() => {
    if (!selectedNode) return;
    Alert.alert('Decompose', `AI decomposition for "${selectedNode.text}"`);
  }, [selectedNode]);

  const handleAddRootChild = useCallback(() => {
    const rootNode = nodes.find((n) => n.type === NodeType.ROOT);
    if (!rootNode) return;
    addNodeUnder(rootNode.id);
  }, [nodes, addNodeUnder]);

  const handleVisionNodePress = useCallback((nodeId: string) => {
    router.push({ pathname: '/goal-detail', params: { nodeId } });
  }, [router]);

  const handleExploreWithAI = useCallback(() => {
    if (!selectedNode) return;
    coachRef.current?.openWithContext({
      nodeId: selectedNode.id,
      nodeText: selectedNode.text,
    });
  }, [selectedNode]);

  return (
    <SafeAreaView className="flex-1 bg-[#0A0E1A]" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-white/5">
        <Text className="text-lg font-bold text-white">Goals</Text>
        <View className="flex-row items-center">
          {/* View mode toggle */}
          <View className="flex-row rounded-full overflow-hidden mr-2">
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); setViewMode('visionboard'); }}
              className={`px-3 py-1.5 rounded-l-full ${viewMode === 'visionboard' ? 'bg-[#71B7FF]' : 'bg-[#1A1F2E]'}`}
              activeOpacity={0.7}
            >
              <Text className={`text-xs font-medium ${viewMode === 'visionboard' ? 'text-white' : 'text-neutral-400'}`}>
                비전보드
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); setViewMode('mindmap'); }}
              className={`px-3 py-1.5 rounded-r-full ${viewMode === 'mindmap' ? 'bg-[#71B7FF]' : 'bg-[#1A1F2E]'}`}
              activeOpacity={0.7}
            >
              <Text className={`text-xs font-medium ${viewMode === 'mindmap' ? 'text-white' : 'text-neutral-400'}`}>
                마인드맵
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleAddRootChild(); }}
            className="w-9 h-9 rounded-full bg-[#71B7FF]/20 items-center justify-center"
            activeOpacity={0.7}
          >
            <Plus size={20} color="#71B7FF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Inline edit input */}
      {editingNodeId && (
        <View className="absolute top-16 left-4 right-4 z-50 rounded-xl px-4 py-3 border border-white/10"
          style={{ backgroundColor: 'rgba(26,31,46,0.95)' }}>
          <Text className="text-neutral-400 text-xs mb-1">Edit node name</Text>
          <TextInput
            value={editText}
            onChangeText={setEditText}
            onSubmitEditing={handleEditSubmit}
            onBlur={handleEditSubmit}
            autoFocus
            className="text-white text-base rounded-lg px-3 py-2"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
            placeholderTextColor="#64748b"
            returnKeyType="done"
          />
        </View>
      )}

      {/* Canvas */}
      <View className="flex-1">
        {viewMode === 'visionboard' ? (
          <VisionBoardView
            nodes={nodes}
            links={links}
            onNodePress={handleVisionNodePress}
          />
        ) : (
          <MindMapCanvas
            nodes={nodes}
            links={links}
            selectedNodeId={selectedNodeId}
            onNodePress={handleNodePress}
            onNodeLongPress={handleNodeLongPress}
          />
        )}
      </View>

      {/* Controls bar — only in mindmap mode */}
      {viewMode === 'mindmap' && (
        <MindMapControls
          visible={selectedNodeId !== null}
          onAddChild={handleAddChild}
          onAddSibling={handleAddSibling}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleComplete={handleToggleComplete}
          onCreateTodo={handleCreateTodo}
          onGenerateImage={handleGenerateImage}
          onDecompose={handleDecompose}
          onExploreWithAI={handleExploreWithAI}
          isRoot={selectedNode?.type === NodeType.ROOT}
        />
      )}

      {/* Coach bubble */}
      <CoachBubble ref={coachRef} sourceTab="goals" />
    </SafeAreaView>
  );
}
