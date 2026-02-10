import React, { useEffect, useRef, useCallback, useState } from 'react';
import MindMapSDK from 'simple-mind-map';
import Drag from 'simple-mind-map/src/plugins/Drag.js';
import RainbowLines from 'simple-mind-map/src/plugins/RainbowLines.js';
import Select from 'simple-mind-map/src/plugins/Select.js';
import { GoalNode, GoalLink, NodeType, NodeStatus } from '../types';
import { getLinkId } from '../hooks/useAutoSave';

// Register plugins once
MindMapSDK.usePlugin(Drag);
MindMapSDK.usePlugin(RainbowLines);
MindMapSDK.usePlugin(Select);

// --- Types ---
type LayoutMode = 'mindMap' | 'logicalStructure' | 'logicalStructureLeft' | 'organizationStructure';

interface MindMapProps {
  nodes: GoalNode[];
  links: GoalLink[];
  selectedNodeId?: string;
  onNodeClick: (node: GoalNode) => void;
  onUpdateNode: (nodeId: string, updates: Partial<GoalNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  onReparentNode: (childId: string, newParentId: string) => void;
  onConvertNodeToTask?: (nodeId: string) => void;
  onAddSubNode: (parentId: string) => void;
  width: number;
  height: number;
  editingNodeId?: string | null;
  onEditEnd?: () => void;
  imageLoadingNodes?: Set<string>;
}

// --- Status color mapping ---
const STATUS_COLORS: Record<string, string> = {
  [NodeStatus.PENDING]: '#3B82F6',
  [NodeStatus.COMPLETED]: '#10B981',
  [NodeStatus.STUCK]: '#EF4444',
};

// --- Data Conversion ---

interface SMMNodeData {
  text: string;
  uid?: string;
  expand?: boolean;
  image?: string;
  imageSize?: { width: number; height: number };
  // Custom fields stored alongside
  goalId?: string;
  goalType?: string;
  goalStatus?: string;
  goalProgress?: number;
  goalParentId?: string;
  goalCollapsed?: boolean;
  // Styling
  borderColor?: string;
  borderWidth?: number;
  fillColor?: string;
}

interface SMMNode {
  data: SMMNodeData;
  children: SMMNode[];
}

/** Convert flat GoalNode[] + GoalLink[] to simple-mind-map tree format */
function goalNodesToTree(nodes: GoalNode[], links: GoalLink[]): SMMNode | null {
  const root = nodes.find(n => n.type === NodeType.ROOT);
  if (!root) return null;

  // Build parent-children mapping from links
  const childrenMap = new Map<string, string[]>();
  for (const link of links) {
    const sourceId = getLinkId(link.source);
    const targetId = getLinkId(link.target);
    if (!childrenMap.has(sourceId)) childrenMap.set(sourceId, []);
    childrenMap.get(sourceId)!.push(targetId);
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  function buildNode(goalNode: GoalNode): SMMNode {
    const isRoot = goalNode.type === NodeType.ROOT;
    const childIds = childrenMap.get(goalNode.id) || [];
    const children = childIds
      .map(id => nodeMap.get(id))
      .filter((n): n is GoalNode => !!n)
      .map(buildNode);

    const data: SMMNodeData = {
      text: goalNode.text || '',
      uid: goalNode.id,
      expand: !goalNode.collapsed,
      goalId: goalNode.id,
      goalType: goalNode.type,
      goalStatus: goalNode.status,
      goalProgress: goalNode.progress,
      goalParentId: goalNode.parentId,
      goalCollapsed: goalNode.collapsed,
    };

    // Node image
    if (goalNode.imageUrl) {
      data.image = goalNode.imageUrl;
      data.imageSize = { width: isRoot ? 100 : 60, height: isRoot ? 100 : 60 };
    }

    return { data, children };
  }

  return buildNode(root);
}

/** Walk simple-mind-map tree and extract flat GoalNode[] */
function treeToGoalNodes(tree: SMMNode): { nodes: GoalNode[]; links: GoalLink[] } {
  const nodes: GoalNode[] = [];
  const links: GoalLink[] = [];

  function walk(smmNode: SMMNode, parentId?: string) {
    const d = smmNode.data;
    const id = d.goalId || d.uid || Date.now().toString();
    const isRoot = !parentId;

    nodes.push({
      id,
      text: d.text || '',
      type: isRoot ? NodeType.ROOT : NodeType.SUB,
      status: (d.goalStatus as NodeStatus) || NodeStatus.PENDING,
      progress: d.goalProgress ?? 0,
      parentId: parentId,
      imageUrl: d.image,
      collapsed: d.expand === false,
    });

    if (parentId) {
      links.push({ source: parentId, target: id });
    }

    for (const child of smmNode.children || []) {
      walk(child, id);
    }
  }

  walk(tree);
  return { nodes, links };
}

/** Compute a structural fingerprint for change detection */
function computeStructureKey(nodes: GoalNode[], links: GoalLink[]): string {
  return nodes.map(n => `${n.id}:${n.text}:${n.status}:${n.collapsed}:${n.imageUrl || ''}`).join('|')
    + '||' + links.map(l => `${getLinkId(l.source)}-${getLinkId(l.target)}`).join('|');
}

// --- Dark Theme Config ---
const DARK_THEME_CONFIG = {
  // Background
  backgroundColor: '#050B14',
  // Lines
  lineColor: '#CCFF0066',
  lineWidth: 2,
  lineDasharray: 'none',
  lineStyle: 'curve' as const,
  // Root node
  root: {
    fillColor: '#0a1a2f',
    color: '#ffffff',
    borderColor: '#CCFF00',
    borderWidth: 3,
    borderRadius: 24,
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Inter, system-ui, sans-serif',
    shape: 'roundedRectangle',
    paddingX: 30,
    paddingY: 20,
  },
  // Second-level nodes
  second: {
    fillColor: '#0f2340',
    color: '#e2e8f0',
    borderColor: '#3B82F6',
    borderWidth: 2,
    borderRadius: 12,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter, system-ui, sans-serif',
    shape: 'roundedRectangle',
    marginX: 80,
    marginY: 30,
    paddingX: 20,
    paddingY: 12,
  },
  // Third-level+ nodes
  node: {
    fillColor: '#0d1b30',
    color: '#cbd5e1',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'Inter, system-ui, sans-serif',
    shape: 'roundedRectangle',
    marginX: 60,
    marginY: 20,
    paddingX: 16,
    paddingY: 10,
  },
  // Generalization node
  generalization: {
    fillColor: '#1e293b',
    color: '#94a3b8',
    borderColor: '#475569',
    borderWidth: 1,
    borderRadius: 6,
    fontSize: 12,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
};

// --- Rainbow line colors (neon palette) ---
const RAINBOW_COLORS = [
  '#CCFF00',  // neon lime
  '#00D4FF',  // cyan
  '#FF6B6B',  // coral
  '#A78BFA',  // violet
  '#34D399',  // emerald
  '#FBBF24',  // amber
  '#F472B6',  // pink
  '#60A5FA',  // blue
];

// --- Layout Options ---
const layoutOptions: { mode: LayoutMode; label: string }[] = [
  { mode: 'mindMap', label: '마인드맵' },
  { mode: 'logicalStructure', label: '논리 구조' },
  { mode: 'logicalStructureLeft', label: '왼쪽 구조' },
  { mode: 'organizationStructure', label: '조직도' },
];

// --- Component ---
const MindMap: React.FC<MindMapProps> = ({
  nodes, links, selectedNodeId, onNodeClick, onUpdateNode, onDeleteNode,
  onReparentNode, onAddSubNode, width, height, editingNodeId, onEditEnd, imageLoadingNodes
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mindMapRef = useRef<any>(null);
  const [layout, setLayout] = useState<LayoutMode>('mindMap');

  // Guard flag to prevent update loops
  const isInternalUpdateRef = useRef(false);
  // Track the last structure key we set
  const lastStructureKeyRef = useRef('');
  // Track the nodes/links for callbacks
  const nodesRef = useRef(nodes);
  const linksRef = useRef(links);
  nodesRef.current = nodes;
  linksRef.current = links;

  // Callback refs to avoid stale closures
  const onNodeClickRef = useRef(onNodeClick);
  const onUpdateNodeRef = useRef(onUpdateNode);
  const onDeleteNodeRef = useRef(onDeleteNode);
  const onAddSubNodeRef = useRef(onAddSubNode);
  const onReparentNodeRef = useRef(onReparentNode);
  const onEditEndRef = useRef(onEditEnd);
  onNodeClickRef.current = onNodeClick;
  onUpdateNodeRef.current = onUpdateNode;
  onDeleteNodeRef.current = onDeleteNode;
  onAddSubNodeRef.current = onAddSubNode;
  onReparentNodeRef.current = onReparentNode;
  onEditEndRef.current = onEditEnd;

  // --- Initialize MindMap ---
  useEffect(() => {
    if (!containerRef.current) return;

    const treeData = goalNodesToTree(nodes, links);
    if (!treeData) return;

    lastStructureKeyRef.current = computeStructureKey(nodes, links);

    const mindMap = new (MindMapSDK as any)({
      el: containerRef.current,
      data: treeData,
      layout: layout,
      theme: 'default',
      themeConfig: DARK_THEME_CONFIG,
      // Rainbow lines for color-coded branches
      rainbowLinesConfig: {
        open: true,
        colorsList: RAINBOW_COLORS,
      },
      // Behavior
      enableFreeDrag: false,
      mousewheelAction: 'zoom',
      scaleRatio: 0.1,
      readonly: false,
      enableShortcutOnlyWhenMouseInSvg: true,
      // Node behavior
      createNewNodeBehavior: 'default',
      // Expand/collapse button
      expandBtnStyle: {
        color: '#CCFF00',
        fill: '#0a1a2f',
        fontSize: 12,
        strokeColor: '#CCFF0088',
      },
      // Fit on init
      fit: true,
      // Enable node text editing
      customInnerElsAppendTo: null,
      // Smoother animations
      enableNodeTransitionMove: true,
      nodeTransitionMoveDuration: 300,
    });

    mindMapRef.current = mindMap;

    // --- Event Handlers ---

    // Node click → select node
    mindMap.on('node_click', (node: any, _e: any) => {
      const goalId = node?.nodeData?.data?.goalId || node?.nodeData?.data?.uid;
      if (!goalId) return;
      const goalNode = nodesRef.current.find(n => n.id === goalId);
      if (goalNode) {
        onNodeClickRef.current(goalNode);
      }
    });

    // Node active → could also track selection
    mindMap.on('node_active', (node: any, _activeList: any) => {
      if (!node) return;
      const goalId = node?.nodeData?.data?.goalId || node?.nodeData?.data?.uid;
      if (!goalId) return;
      const goalNode = nodesRef.current.find(n => n.id === goalId);
      if (goalNode) {
        onNodeClickRef.current(goalNode);
      }
    });

    // Data changed (from internal edits: text edit, drag, add, remove)
    mindMap.on('data_change', (data: SMMNode) => {
      if (isInternalUpdateRef.current) return;

      // Convert tree back to flat format
      const { nodes: newNodes, links: newLinks } = treeToGoalNodes(data);
      const newKey = computeStructureKey(newNodes, newLinks);

      if (newKey === lastStructureKeyRef.current) return;
      lastStructureKeyRef.current = newKey;

      // Sync changes back to App.tsx
      isInternalUpdateRef.current = true;

      // Find differences and apply updates
      const oldNodeMap = new Map(nodesRef.current.map(n => [n.id, n]));
      const newNodeMap = new Map(newNodes.map(n => [n.id, n]));

      // Detect deleted nodes
      for (const oldNode of nodesRef.current) {
        if (!newNodeMap.has(oldNode.id) && oldNode.type !== NodeType.ROOT) {
          onDeleteNodeRef.current(oldNode.id);
        }
      }

      // Detect added/updated nodes
      for (const newNode of newNodes) {
        const oldNode = oldNodeMap.get(newNode.id);
        if (!oldNode) {
          // New node added via simple-mind-map — add to parent
          if (newNode.parentId) {
            onAddSubNodeRef.current(newNode.parentId, newNode.text || undefined);
          }
        } else {
          // Check for text or other changes
          const updates: Partial<GoalNode> = {};
          if (newNode.text !== oldNode.text) updates.text = newNode.text;
          if (newNode.collapsed !== oldNode.collapsed) updates.collapsed = newNode.collapsed;
          if (newNode.parentId !== oldNode.parentId && newNode.parentId) {
            onReparentNodeRef.current(newNode.id, newNode.parentId);
          }
          if (Object.keys(updates).length > 0) {
            onUpdateNodeRef.current(newNode.id, updates);
          }
        }
      }

      setTimeout(() => { isInternalUpdateRef.current = false; }, 100);
    });

    // Handle mindmap-center event
    const handleCenter = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.nodeId) {
        // Find node in the mind map and focus on it
        mindMap.execCommand('GO_TARGET_NODE', detail.nodeId);
      } else {
        mindMap.view?.reset?.();
      }
    };
    window.addEventListener('mindmap-center', handleCenter);

    return () => {
      window.removeEventListener('mindmap-center', handleCenter);
      mindMap.destroy?.();
      mindMapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only init once

  // --- Update data when nodes/links change from outside ---
  useEffect(() => {
    const mindMap = mindMapRef.current;
    if (!mindMap || isInternalUpdateRef.current) return;

    const newKey = computeStructureKey(nodes, links);
    if (newKey === lastStructureKeyRef.current) return;
    lastStructureKeyRef.current = newKey;

    const treeData = goalNodesToTree(nodes, links);
    if (!treeData) return;

    isInternalUpdateRef.current = true;
    mindMap.setData(treeData);
    setTimeout(() => { isInternalUpdateRef.current = false; }, 100);
  }, [nodes, links]);

  // --- Handle layout changes ---
  const handleLayoutChange = useCallback((newLayout: LayoutMode) => {
    setLayout(newLayout);
    const mindMap = mindMapRef.current;
    if (mindMap) {
      mindMap.setLayout(newLayout);
    }
  }, []);

  // --- Handle resize ---
  useEffect(() => {
    const mindMap = mindMapRef.current;
    if (mindMap) {
      mindMap.resize();
    }
  }, [width, height]);

  // --- Handle editing state ---
  useEffect(() => {
    if (!editingNodeId || !mindMapRef.current) return;
    // Find the node in the mind map and trigger text edit
    const mindMap = mindMapRef.current;
    // Use renderer's node list to find the target
    const allNodes = mindMap.renderer?.root
      ? getAllRenderedNodes(mindMap.renderer.root)
      : [];
    const target = allNodes.find(
      (n: any) => n.nodeData?.data?.goalId === editingNodeId || n.nodeData?.data?.uid === editingNodeId
    );
    if (target) {
      mindMap.execCommand('SET_NODE_ACTIVE', target, true);
      // Small delay to ensure node is active before triggering edit
      setTimeout(() => {
        mindMap.renderer?.textEdit?.show?.(target);
      }, 50);
    }
  }, [editingNodeId]);

  // --- Update node styles based on status ---
  useEffect(() => {
    const mindMap = mindMapRef.current;
    if (!mindMap) return;

    // After tree renders, apply status-based border colors
    const applyStatusColors = () => {
      const allNodes = mindMap.renderer?.root
        ? getAllRenderedNodes(mindMap.renderer.root)
        : [];

      for (const renderedNode of allNodes) {
        const goalId = renderedNode.nodeData?.data?.goalId;
        if (!goalId) continue;
        const goalNode = nodesRef.current.find(n => n.id === goalId);
        if (!goalNode) continue;

        const color = STATUS_COLORS[goalNode.status] || '#3B82F6';
        const isSelected = goalNode.id === selectedNodeId;

        // Apply border color based on status
        renderedNode.setStyle?.('borderColor', isSelected ? '#CCFF00' : color);
        renderedNode.setStyle?.('borderWidth', isSelected ? 3 : 2);
      }
    };

    mindMap.on('node_tree_render_end', applyStatusColors);
    // Apply immediately too
    applyStatusColors();

    return () => {
      mindMap.off('node_tree_render_end', applyStatusColors);
    };
  }, [nodes, selectedNodeId]);

  return (
    <div className="w-full h-full bg-deep-space relative overflow-hidden">
      {/* Header */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none select-none">
        <h1 className="text-2xl font-display text-white tracking-widest drop-shadow-[0_0_10px_rgba(204,255,0,0.5)]">
          SUPER COACH <span className="text-neon-lime text-xs align-top">{__APP_VERSION__}</span>
        </h1>
        <p className="text-gray-400 text-xs font-body">Neural Interface Active</p>
      </div>

      {/* Layout Switcher */}
      <div className="absolute top-16 right-4 z-10 flex bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-1 py-0.5 gap-0.5">
        {layoutOptions.map(opt => (
          <button
            key={opt.mode}
            onClick={() => handleLayoutChange(opt.mode)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all duration-200 ${
              layout === opt.mode
                ? 'bg-neon-lime text-black shadow-[0_0_8px_rgba(204,255,0,0.5)]'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Mind Map Container */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        style={{ width, height }}
      />
    </div>
  );
};

/** Recursively collect all rendered node instances from the tree */
function getAllRenderedNodes(node: any): any[] {
  const result: any[] = [node];
  if (node.children) {
    for (const child of node.children) {
      result.push(...getAllRenderedNodes(child));
    }
  }
  return result;
}

export default React.memo(MindMap, (prev, next) => {
  return (
    prev.nodes === next.nodes &&
    prev.links === next.links &&
    prev.selectedNodeId === next.selectedNodeId &&
    prev.width === next.width &&
    prev.height === next.height &&
    prev.editingNodeId === next.editingNodeId &&
    prev.imageLoadingNodes === next.imageLoadingNodes
  );
});
