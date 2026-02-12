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
  onGenerateImage?: (nodeId: string) => void;
  onAddSubNode: (parentId: string) => void;
  width: number;
  height: number;
  editingNodeId?: string | null;
  onEditEnd?: () => void;
  imageLoadingNodes?: Set<string>;
}

// --- Status → border color mapping ---
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
  // Custom fields we store in node data
  goalId?: string;
  goalType?: string;
  goalStatus?: string;
  goalProgress?: number;
  goalParentId?: string;
  // Per-node border color baked into data (avoids setStyle infinite loops)
  borderColor?: string;
  borderWidth?: number;
  // Image support
  image?: string;
  imageTitle?: string;
  imageSize?: { width: number; height: number };
}

interface SMMNode {
  data: SMMNodeData;
  children: SMMNode[];
}

/** Convert flat GoalNode[] + GoalLink[] to simple-mind-map tree format.
 *  Border colors are baked into node data based on status + selection. */
function goalNodesToTree(
  nodes: GoalNode[],
  links: GoalLink[],
  selectedNodeId?: string,
): SMMNode | null {
  const root = nodes.find(n => n.type === NodeType.ROOT);
  if (!root) return null;

  // Build parent→children mapping from links
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
    const isSelected = goalNode.id === selectedNodeId;
    const childIds = childrenMap.get(goalNode.id) || [];
    const children = childIds
      .map(id => nodeMap.get(id))
      .filter((n): n is GoalNode => !!n)
      .map(buildNode);

    const statusColor = STATUS_COLORS[goalNode.status] || '#3B82F6';

    const data: SMMNodeData = {
      text: goalNode.text || '',
      uid: goalNode.id,
      expand: !goalNode.collapsed,
      goalId: goalNode.id,
      goalType: goalNode.type,
      goalStatus: goalNode.status,
      goalProgress: goalNode.progress,
      goalParentId: goalNode.parentId,
      // Bake border color into node data so we never need setStyle()
      borderColor: isRoot ? '#CCFF00' : (isSelected ? '#CCFF00' : statusColor),
      borderWidth: isSelected ? 3 : (isRoot ? 3 : 2),
    };

    // Add image if available
    if (goalNode.imageUrl) {
      data.image = goalNode.imageUrl;
      data.imageTitle = goalNode.text;
      data.imageSize = isRoot
        ? { width: 150, height: 100 }
        : { width: 100, height: 70 };
    }

    return { data, children };
  }

  return buildNode(root);
}

/** Compute a structural fingerprint for change detection */
function computeStructureKey(nodes: GoalNode[], links: GoalLink[], selectedNodeId?: string): string {
  return nodes.map(n => `${n.id}:${n.text}:${n.status}:${n.collapsed}:${n.imageUrl || ''}`).join('|')
    + '||' + links.map(l => `${getLinkId(l.source)}-${getLinkId(l.target)}`).join('|')
    + '||' + (selectedNodeId || '');
}

// --- Dark Theme Config ---
const DARK_THEME_CONFIG = {
  backgroundColor: '#050B14',
  lineColor: '#CCFF0066',
  lineWidth: 2,
  lineDasharray: 'none',
  lineStyle: 'curve' as const,
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

const RAINBOW_COLORS = [
  '#CCFF00', '#00D4FF', '#FF6B6B', '#A78BFA',
  '#34D399', '#FBBF24', '#F472B6', '#60A5FA',
];

const layoutOptions: { mode: LayoutMode; label: string }[] = [
  { mode: 'mindMap', label: '마인드맵' },
  { mode: 'logicalStructure', label: '논리 구조' },
  { mode: 'logicalStructureLeft', label: '왼쪽 구조' },
  { mode: 'organizationStructure', label: '조직도' },
];

// --- Component ---
const MindMap: React.FC<MindMapProps> = ({
  nodes, links, selectedNodeId, onNodeClick, onUpdateNode, onDeleteNode,
  onReparentNode, onConvertNodeToTask, onGenerateImage, onAddSubNode,
  width, height, editingNodeId, onEditEnd, imageLoadingNodes
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mindMapRef = useRef<any>(null);
  const [layout, setLayout] = useState<LayoutMode>('mindMap');
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; nodeId: string;
  } | null>(null);

  // Timestamp of last setData call — used to ignore data_change events that we caused
  const lastSetDataTimeRef = useRef(0);
  // Track the last structure key we pushed to simple-mind-map
  const lastStructureKeyRef = useRef('');
  // Refs for latest values (avoids stale closures in event handlers)
  const nodesRef = useRef(nodes);
  const linksRef = useRef(links);
  const selectedNodeIdRef = useRef(selectedNodeId);
  nodesRef.current = nodes;
  linksRef.current = links;
  selectedNodeIdRef.current = selectedNodeId;

  const onNodeClickRef = useRef(onNodeClick);
  const onUpdateNodeRef = useRef(onUpdateNode);
  const setContextMenuRef = useRef(setContextMenu);
  onNodeClickRef.current = onNodeClick;
  onUpdateNodeRef.current = onUpdateNode;
  setContextMenuRef.current = setContextMenu;

  // --- Initialize MindMap (once) ---
  useEffect(() => {
    if (!containerRef.current) return;

    const treeData = goalNodesToTree(nodes, links, selectedNodeId);
    if (!treeData) return;

    lastStructureKeyRef.current = computeStructureKey(nodes, links, selectedNodeId);

    const mindMap = new (MindMapSDK as any)({
      el: containerRef.current,
      data: treeData,
      layout: layout,
      theme: 'default',
      themeConfig: DARK_THEME_CONFIG,
      rainbowLinesConfig: {
        open: true,
        colorsList: RAINBOW_COLORS,
      },
      enableFreeDrag: false,
      mousewheelAction: 'zoom',
      scaleRatio: 0.1,
      readonly: false,
      enableShortcutOnlyWhenMouseInSvg: true,
      createNewNodeBehavior: 'notActive',
      expandBtnStyle: {
        color: '#CCFF00',
        fill: '#0a1a2f',
        fontSize: 12,
        strokeColor: '#CCFF0088',
      },
      fit: true,
      enableNodeTransitionMove: true,
      nodeTransitionMoveDuration: 300,
    });

    mindMapRef.current = mindMap;

    // Disable built-in keyboard shortcuts that conflict with our app
    // (We handle add/delete through App.tsx UI buttons)
    mindMap.keyCommand.removeShortcut('Tab');
    mindMap.keyCommand.removeShortcut('Insert');
    mindMap.keyCommand.removeShortcut('Enter');
    mindMap.keyCommand.removeShortcut('Shift+Tab');
    mindMap.keyCommand.removeShortcut('Delete');
    mindMap.keyCommand.removeShortcut('Backspace');

    // --- Event: Node click → selection + close context menu ---
    mindMap.on('node_click', (node: any, _e: any) => {
      setContextMenuRef.current(null);
      const goalId = node?.nodeData?.data?.goalId || node?.nodeData?.data?.uid;
      if (!goalId) return;
      const goalNode = nodesRef.current.find(n => n.id === goalId);
      if (goalNode) onNodeClickRef.current(goalNode);
    });

    // --- Event: Right-click / contextmenu → show context menu ---
    mindMap.on('node_contextmenu', (e: any, node: any) => {
      e.preventDefault?.();
      e.e?.preventDefault?.();
      const evt = e.e || e;
      const goalId = node?.nodeData?.data?.goalId || node?.nodeData?.data?.uid;
      if (!goalId) return;
      const rect = containerRef.current?.getBoundingClientRect();
      const x = (evt.clientX || evt.pageX || 0) - (rect?.left || 0);
      const y = (evt.clientY || evt.pageY || 0) - (rect?.top || 0);
      setContextMenuRef.current({ x, y, nodeId: goalId });
    });

    // --- Long-press for mobile → show context menu ---
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let longPressNode: string | null = null;

    mindMap.on('node_mousedown', (node: any, e: any) => {
      const goalId = node?.nodeData?.data?.goalId || node?.nodeData?.data?.uid;
      if (!goalId) return;
      longPressNode = goalId;
      longPressTimer = setTimeout(() => {
        const evt = e.e || e;
        const rect = containerRef.current?.getBoundingClientRect();
        const x = (evt.clientX || evt.touches?.[0]?.clientX || 0) - (rect?.left || 0);
        const y = (evt.clientY || evt.touches?.[0]?.clientY || 0) - (rect?.top || 0);
        setContextMenuRef.current({ x, y, nodeId: goalId });
        longPressNode = null;
      }, 600);
    });

    mindMap.on('node_mouseup', () => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      longPressNode = null;
    });

    // --- Event: data_change → sync text edits back to React ---
    // ONLY syncs text changes from in-place editing. Ignores changes we caused.
    mindMap.on('data_change', (data: SMMNode) => {
      // Ignore if we caused this change via setData/updateData
      if (Date.now() - lastSetDataTimeRef.current < 500) return;

      // Walk the tree and check for text differences
      const syncTextChanges = (smmNode: SMMNode) => {
        const goalId = smmNode.data?.goalId || smmNode.data?.uid;
        if (goalId) {
          const current = nodesRef.current.find(n => n.id === goalId);
          if (current && smmNode.data.text !== current.text) {
            onUpdateNodeRef.current(goalId, { text: smmNode.data.text });
          }
        }
        for (const child of smmNode.children || []) {
          syncTextChanges(child);
        }
      };
      syncTextChanges(data);
    });

    // Close context menu on background click
    mindMap.on('draw_click', () => { setContextMenuRef.current(null); });

    // --- Event: mindmap-center (from other components) ---
    const handleCenter = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.nodeId) {
        mindMap.execCommand('GO_TARGET_NODE', detail.nodeId);
      } else {
        mindMap.view?.reset?.();
      }
    };
    window.addEventListener('mindmap-center', handleCenter);

    return () => {
      if (longPressTimer) clearTimeout(longPressTimer);
      window.removeEventListener('mindmap-center', handleCenter);
      mindMap.destroy?.();
      mindMapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Init once

  // --- Sync data from React → simple-mind-map when props change ---
  useEffect(() => {
    const mindMap = mindMapRef.current;
    if (!mindMap) return;

    const newKey = computeStructureKey(nodes, links, selectedNodeId);
    if (newKey === lastStructureKeyRef.current) return;
    lastStructureKeyRef.current = newKey;

    const treeData = goalNodesToTree(nodes, links, selectedNodeId);
    if (!treeData) return;

    lastSetDataTimeRef.current = Date.now();
    mindMap.setData(treeData);
  }, [nodes, links, selectedNodeId]);

  // --- Layout changes ---
  const handleLayoutChange = useCallback((newLayout: LayoutMode) => {
    setLayout(newLayout);
    mindMapRef.current?.setLayout(newLayout);
  }, []);

  // --- Resize ---
  useEffect(() => {
    mindMapRef.current?.resize();
  }, [width, height]);

  // --- Trigger text editing when editingNodeId is set ---
  useEffect(() => {
    if (!editingNodeId || !mindMapRef.current) return;
    const mindMap = mindMapRef.current;
    const allNodes = mindMap.renderer?.root
      ? getAllRenderedNodes(mindMap.renderer.root)
      : [];
    const target = allNodes.find(
      (n: any) => n.nodeData?.data?.goalId === editingNodeId || n.nodeData?.data?.uid === editingNodeId
    );
    if (target) {
      mindMap.execCommand('SET_NODE_ACTIVE', target, true);
      setTimeout(() => {
        mindMap.renderer?.textEdit?.show?.(target);
      }, 50);
    }
  }, [editingNodeId]);

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

      {/* Context Menu (right-click / long-press) */}
      {contextMenu && (
        <div
          className="absolute z-50 bg-[#0d1b30]/95 backdrop-blur-md border border-white/15 rounded-xl shadow-2xl py-1.5 min-w-[180px] animate-fade-in"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => { onGenerateImage?.(contextMenu.nodeId); setContextMenu(null); }}
            className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2.5 transition-colors"
          >
            <span className="w-5 h-5 flex items-center justify-center text-neon-lime text-xs">&#x1f3a8;</span>
            이미지 생성하기
          </button>
          <div className="mx-3 border-t border-white/10" />
          <button
            onClick={() => { onConvertNodeToTask?.(contextMenu.nodeId); setContextMenu(null); }}
            className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2.5 transition-colors"
          >
            <span className="w-5 h-5 flex items-center justify-center text-emerald-400 text-xs">&#x2705;</span>
            투두로 추가하기
          </button>
          {nodes.find(n => n.id === contextMenu.nodeId)?.type !== NodeType.ROOT && (
            <>
              <div className="mx-3 border-t border-white/10" />
              <button
                onClick={() => { onDeleteNode(contextMenu.nodeId); setContextMenu(null); }}
                className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/15 flex items-center gap-2.5 transition-colors"
              >
                <span className="w-5 h-5 flex items-center justify-center text-xs">&#x1f5d1;</span>
                노드 삭제하기
              </button>
            </>
          )}
        </div>
      )}
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
