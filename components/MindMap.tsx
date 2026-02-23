import React, { useEffect, useRef, useCallback, useState } from 'react';
import MindMapSDK from 'simple-mind-map';
import Drag from 'simple-mind-map/src/plugins/Drag.js';
import RainbowLines from 'simple-mind-map/src/plugins/RainbowLines.js';
import Select from 'simple-mind-map/src/plugins/Select.js';
import TouchEvent from 'simple-mind-map/src/plugins/TouchEvent.js';
import { GoalNode, GoalLink, NodeType, NodeStatus } from '../types';
import { Target, Lightbulb, ArrowRight, ChevronDown, Sparkles } from 'lucide-react';
import { getLinkId } from '../hooks/useAutoSave';

// Register plugins once
MindMapSDK.usePlugin(Drag);
MindMapSDK.usePlugin(RainbowLines);
MindMapSDK.usePlugin(Select);
MindMapSDK.usePlugin(TouchEvent);

// --- Types ---
type LayoutMode = 'mindMap' | 'logicalStructure' | 'logicalStructureLeft' | 'organizationStructure';

interface MindMapProps {
  nodes: GoalNode[];
  links: GoalLink[];
  language: 'en' | 'ko';
  selectedNodeId?: string;
  onNodeClick: (node: GoalNode) => void;
  onEditNode?: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, updates: Partial<GoalNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  onReparentNode: (childId: string, newParentId: string) => void;
  onConvertNodeToTask?: (nodeId: string) => void;
  onGenerateImage?: (nodeId: string) => void;
  onInsertImage?: (nodeId: string) => void;
  onAddSubNode: (parentId: string) => void;
  width: number;
  height: number;
  editingNodeId?: string | null;
  onEditEnd?: () => void;
  imageLoadingNodes?: Set<string>;
}

// --- Status ??border color mapping ---
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

interface ActionBarState {
  x: number;
  y: number;
  nodeId: string;
  scale: number;
  placement: 'top' | 'bottom';
  isMoreOpen: boolean;
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

  // Build parent?뭖hildren mapping from links
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
  { mode: 'mindMap', label: 'Mind' },
  { mode: 'logicalStructure', label: 'Logical' },
  { mode: 'logicalStructureLeft', label: 'Logical Left' },
  { mode: 'organizationStructure', label: 'Org' },
];

const ACTION_BAR_LABELS = {
  en: {
    child: 'Child',
    sibling: 'Sibling',
    todo: 'Todo',
    generate: 'Generate',
    insert: 'Insert',
    more: 'More',
    insertImage: 'Insert image',
    delete: 'Delete',
  },
  ko: {
    child: '자식',
    sibling: '형제',
    todo: '투두',
    generate: '이미지 생성',
    insert: '이미지 삽입',
    more: '더보기',
    insertImage: '이미지 삽입',
    delete: '삭제',
  },
} as const;

// --- Guidance Content ---
const GUIDANCE_CONTENT = {
  en: {
    emptyTitle: 'Start Your Goal Journey',
    emptySubtitle: 'Tap on your life vision to begin setting goals',
    steps: [
      { icon: '1', text: 'Tap the center node to select it' },
      { icon: '2', text: 'Press "Child" to add your first goal' },
      { icon: '3', text: 'Break goals down into smaller sub-goals' },
    ],
    smartTitle: 'Set SMART Goals',
    smartItems: [
      { letter: 'S', label: 'Specific', desc: 'What exactly do you want to achieve?' },
      { letter: 'M', label: 'Measurable', desc: 'How will you know when it\'s done?' },
      { letter: 'A', label: 'Achievable', desc: 'Is this realistically possible?' },
      { letter: 'R', label: 'Relevant', desc: 'Does this align with your vision?' },
      { letter: 'T', label: 'Time-bound', desc: 'When will you achieve this by?' },
    ],
    tipTitle: 'Quick Tips',
    tips: [
      'Double-tap a node to edit its text',
      'Use "Todo" to turn a goal into an action item',
      'Ask your AI Coach for goal-setting advice',
    ],
    gotIt: 'Got it!',
    smartCta: 'Try asking your AI Coach for help!',
  },
  ko: {
    emptyTitle: '목표 여정을 시작하세요',
    emptySubtitle: '인생 비전을 탭하여 목표를 설정해보세요',
    steps: [
      { icon: '1', text: '중앙의 비전 노드를 탭하세요' },
      { icon: '2', text: '"자식" 버튼을 눌러 첫 번째 목표를 추가하세요' },
      { icon: '3', text: '큰 목표를 작은 하위 목표로 나누세요' },
    ],
    smartTitle: 'SMART 목표 설정법',
    smartItems: [
      { letter: 'S', label: '구체적', desc: '정확히 무엇을 달성하고 싶나요?' },
      { letter: 'M', label: '측정 가능', desc: '달성 여부를 어떻게 알 수 있나요?' },
      { letter: 'A', label: '달성 가능', desc: '현실적으로 가능한 목표인가요?' },
      { letter: 'R', label: '관련성', desc: '당신의 비전과 연결되나요?' },
      { letter: 'T', label: '기한 설정', desc: '언제까지 달성할 건가요?' },
    ],
    tipTitle: '빠른 팁',
    tips: [
      '노드를 두 번 탭하면 텍스트를 편집할 수 있어요',
      '"투두" 버튼으로 목표를 실행 항목으로 전환하세요',
      'AI 코치에게 목표 설정 도움을 요청하세요',
    ],
    gotIt: '알겠어요!',
    smartCta: 'AI 코치에게 도움을 요청해보세요!',
  },
} as const;

// --- Component ---
const MindMap: React.FC<MindMapProps> = ({
  nodes, links, language, selectedNodeId, onNodeClick, onEditNode, onUpdateNode, onDeleteNode,
  onReparentNode, onConvertNodeToTask, onGenerateImage, onInsertImage, onAddSubNode,
  width, height, editingNodeId, onEditEnd, imageLoadingNodes
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mindMapRef = useRef<any>(null);
  const [layout, setLayout] = useState<LayoutMode>('mindMap');
  const [actionBar, setActionBar] = useState<ActionBarState | null>(null);
  const [viewScale, setViewScale] = useState(1);
  const [guideDismissed, setGuideDismissed] = useState(false);
  const [smartExpanded, setSmartExpanded] = useState(false);
  const languageByDom = document.documentElement.lang.toLowerCase().startsWith('ko') ? 'ko' : 'en';
  const resolvedLanguage: 'en' | 'ko' = (
    language === 'ko'
    || languageByDom === 'ko'
  ) ? 'ko' : 'en';
  const labels = ACTION_BAR_LABELS[resolvedLanguage];
  const guidance = GUIDANCE_CONTENT[resolvedLanguage];
  const hasSubNodes = nodes.some(n => n.type === NodeType.SUB);
  const subNodeCount = nodes.filter(n => n.type === NodeType.SUB).length;
  const showEmptyGuide = !hasSubNodes && !guideDismissed;
  const showSmartHint = hasSubNodes && subNodeCount <= 3 && !guideDismissed;

  const getCurrentMindMapScale = useCallback(() => {
    const mindMap = mindMapRef.current;

    const direct = mindMap?.view?.scale;
    if (typeof direct === 'number' && Number.isFinite(direct)) return direct;

    const transform = mindMap?.draw?.transform?.();
    const fromDraw = transform?.scaleX;
    if (typeof fromDraw === 'number' && Number.isFinite(fromDraw)) return fromDraw;

    return 1;
  }, []);

  const getRenderedNodeByGoalId = useCallback((goalId: string) => {
    const mindMap = mindMapRef.current;
    const root = mindMap?.renderer?.root;
    if (!root) return null;
    const allNodes = getAllRenderedNodes(root);
    return allNodes.find(
      (n: any) => n?.nodeData?.data?.goalId === goalId || n?.nodeData?.data?.uid === goalId,
    ) || null;
  }, []);

  const computeActionBarFromRenderedNode = useCallback((node: any): Omit<ActionBarState, 'nodeId' | 'isMoreOpen'> | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !node || typeof node.getRectInSvg !== 'function') return null;
    const nodeRect = node.getRectInSvg();
    if (!nodeRect) return null;

    const centerX = nodeRect.left + nodeRect.width / 2;
    const minTopForAbove = 110;
    const placement: 'top' | 'bottom' = nodeRect.top > minTopForAbove ? 'top' : 'bottom';
    const targetY = placement === 'top' ? nodeRect.top - 10 : nodeRect.bottom + 10;
    const margin = 12;
    const x = Math.max(margin, Math.min(rect.width - margin, centerX));
    const y = Math.max(margin, Math.min(rect.height - margin, targetY));

    return {
      x,
      y,
      scale: getCurrentMindMapScale(),
      placement,
    };
  }, [getCurrentMindMapScale]);

  const syncActionBarToNode = useCallback((nodeId: string) => {
    const renderedNode = getRenderedNodeByGoalId(nodeId);
    const next = renderedNode ? computeActionBarFromRenderedNode(renderedNode) : null;
    if (!next) {
      setActionBarRef.current(null);
      return;
    }
    setActionBarRef.current((prev) => {
      if (!prev || prev.nodeId !== nodeId) return prev;
      return { ...prev, ...next };
    });
  }, [computeActionBarFromRenderedNode, getRenderedNodeByGoalId]);

  // Timestamp of last setData call ??used to ignore data_change events that we caused
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
  const onEditNodeRef = useRef(onEditNode);
  const onUpdateNodeRef = useRef(onUpdateNode);
  const onAddSubNodeRef = useRef(onAddSubNode);
  const setActionBarRef = useRef(setActionBar);
  const actionBarRef = useRef<ActionBarState | null>(null);
  const lastTapRef = useRef<{ nodeId: string; ts: number }>({
    nodeId: '',
    ts: 0,
  });
  onNodeClickRef.current = onNodeClick;
  onEditNodeRef.current = onEditNode;
  onUpdateNodeRef.current = onUpdateNode;
  onAddSubNodeRef.current = onAddSubNode;
  setActionBarRef.current = setActionBar;
  actionBarRef.current = actionBar;

  // Block native page pinch/gesture handling inside the map container.
  // simple-mind-map's touch plugin still receives touch events and handles map zoom.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventMultiTouchDefault = (event: Event) => {
      const touchEvent = event as globalThis.TouchEvent;
      if (touchEvent.touches && touchEvent.touches.length >= 2) {
        event.preventDefault();
      }
    };
    const preventGestureDefault = (event: Event) => {
      event.preventDefault();
    };

    container.addEventListener('touchstart', preventMultiTouchDefault, { passive: false });
    container.addEventListener('touchmove', preventMultiTouchDefault, { passive: false });
    container.addEventListener('gesturestart', preventGestureDefault, { passive: false });
    container.addEventListener('gesturechange', preventGestureDefault, { passive: false });
    container.addEventListener('gestureend', preventGestureDefault, { passive: false });

    return () => {
      container.removeEventListener('touchstart', preventMultiTouchDefault);
      container.removeEventListener('touchmove', preventMultiTouchDefault);
      container.removeEventListener('gesturestart', preventGestureDefault);
      container.removeEventListener('gesturechange', preventGestureDefault);
      container.removeEventListener('gestureend', preventGestureDefault);
    };
  }, []);

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
      minZoomRatio: 5,
      maxZoomRatio: 400,
      minTouchZoomScale: 5,
      maxTouchZoomScale: 400,
      readonly: false,
      enableShortcutOnlyWhenMouseInSvg: true,
      createNewNodeBehavior: 'notActive',
      // Prevent Chinese default text when the library inserts nodes internally.
      defaultInsertSecondLevelNodeText: '???몃뱶',
      defaultInsertBelowSecondLevelNodeText: '???몃뱶',
      defaultGeneralizationText: '?붿빟',
      defaultAssociativeLineText: '',
      // Hook the built-in "+" quick-create button so node creation goes through React state.
      // This avoids Chinese placeholder text and allows immediate text editing via editingNodeId.
      customQuickCreateChildBtnClick: (nodeIns: any) => {
        const goalId = nodeIns?.nodeData?.data?.goalId || nodeIns?.nodeData?.data?.uid;
        if (!goalId) return;
        onAddSubNodeRef.current?.(goalId);
      },
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

    // Track current zoom scale so overlay UI can match mind-map zoom level.
    const handleScale = (scale: number) => {
      if (typeof scale === 'number' && Number.isFinite(scale)) {
        setViewScale(scale);
      }
      const current = actionBarRef.current;
      if (!current) return;
      syncActionBarToNode(current.nodeId);
    };
    const handleTranslate = () => {
      const current = actionBarRef.current;
      if (!current) return;
      syncActionBarToNode(current.nodeId);
    };
    const handleViewDataChange = () => {
      const current = actionBarRef.current;
      if (!current) return;
      syncActionBarToNode(current.nodeId);
    };
    mindMap.on('scale', handleScale);
    mindMap.on('translate', handleTranslate);
    mindMap.on('view_data_change', handleViewDataChange);
    handleScale(mindMap.view?.scale ?? 1);

    // Disable built-in keyboard shortcuts that conflict with our app
    // (We handle add/delete through App.tsx UI buttons)
    mindMap.keyCommand.removeShortcut('Tab');
    mindMap.keyCommand.removeShortcut('Insert');
    mindMap.keyCommand.removeShortcut('Enter');
    mindMap.keyCommand.removeShortcut('Shift+Tab');
    mindMap.keyCommand.removeShortcut('Delete');
    mindMap.keyCommand.removeShortcut('Backspace');

    // --- Event: Node click -> selection + action bar ---
    mindMap.on('node_click', (node: any, e: any) => {
      const goalId = node?.nodeData?.data?.goalId || node?.nodeData?.data?.uid;
      if (!goalId) return;
      const goalNode = nodesRef.current.find(n => n.id === goalId);
      if (goalNode) onNodeClickRef.current(goalNode);

      const now = Date.now();
      if (
        lastTapRef.current.nodeId === goalId
        && now - lastTapRef.current.ts <= 320
      ) {
        onEditNodeRef.current?.(goalId);
        lastTapRef.current = { nodeId: '', ts: 0 };
        setActionBarRef.current(null);
        return;
      }
      lastTapRef.current = { nodeId: goalId, ts: now };

      const position = computeActionBarFromRenderedNode(node);
      if (!position) return;
      setViewScale(position.scale);
      setActionBarRef.current({
        x: position.x,
        y: position.y,
        nodeId: goalId,
        scale: position.scale,
        placement: position.placement,
        isMoreOpen: false,
      });
    });

    // --- Event: data_change ??sync text edits back to React ---
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
    mindMap.on('draw_click', () => { setActionBarRef.current(null); });

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
      window.removeEventListener('mindmap-center', handleCenter);
      mindMap.off?.('scale', handleScale);
      mindMap.off?.('translate', handleTranslate);
      mindMap.off?.('view_data_change', handleViewDataChange);
      mindMap.destroy?.();
      mindMapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Init once

  // --- Sync data from React ??simple-mind-map when props change ---
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
  // setData() 후 라이브러리 내부 렌더가 비동기이므로, 노드가 나타날 때까지 폴링
  useEffect(() => {
    if (!editingNodeId || !mindMapRef.current) return;
    const mindMap = mindMapRef.current;
    let attempts = 0;
    const maxAttempts = 20; // 20 × 50ms = 최대 1초
    let cancelled = false;

    const tryActivateEdit = () => {
      if (cancelled) return;
      const allNodes = mindMap.renderer?.root
        ? getAllRenderedNodes(mindMap.renderer.root)
        : [];
      const target = allNodes.find(
        (n: any) =>
          n.nodeData?.data?.goalId === editingNodeId ||
          n.nodeData?.data?.uid === editingNodeId
      );
      if (target) {
        mindMap.execCommand('SET_NODE_ACTIVE', target, true);
        setTimeout(() => {
          if (!cancelled) {
            mindMap.renderer?.textEdit?.show?.({
              node: target,
              isInserting: true,
            });
          }
        }, 50);
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(tryActivateEdit, 50);
      }
    };

    tryActivateEdit();

    return () => { cancelled = true; };
  }, [editingNodeId]);

  const actionNode = actionBar
    ? nodes.find((node) => node.id === actionBar.nodeId) || null
    : null;
  const isRootActionNode = actionNode?.type === NodeType.ROOT;

  return (
    <div className="w-full h-full bg-deep-space relative overflow-hidden">
      {/* Header */}
      <div className="absolute top-3 left-3 z-10 pointer-events-none select-none max-w-[calc(100%-72px)]">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h1 className="text-lg sm:text-xl md:text-2xl font-display text-white tracking-[0.22em] md:tracking-widest leading-none drop-shadow-[0_0_10px_rgba(204,255,0,0.5)]">
            SECRET COACH
          </h1>
          <span className="text-neon-lime text-[10px] md:text-xs font-mono tracking-wide">
            {__APP_VERSION__}
          </span>
        </div>
        <p className="text-gray-400 text-[10px] md:text-xs font-body">Neural Interface Active</p>
      </div>

      {/* Layout Switcher */}
      <div className="absolute top-14 right-3 md:top-16 md:right-4 z-10 flex bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-1 py-0.5 gap-0.5">
        {layoutOptions.map(opt => (
          <button
            key={opt.mode}
            onClick={() => handleLayoutChange(opt.mode)}
            className={`px-2 py-1 rounded-full text-[9px] md:text-[10px] font-semibold transition-all duration-200 ${
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
        style={{ width, height, touchAction: 'none' }}
      />

      {/* Node Action Bar (single tap selection) */}
      {actionBar && actionNode && (
        <div
          className="absolute z-50"
          style={{
            left: actionBar.x,
            top: actionBar.y,
            transform: actionBar.placement === 'top'
              ? `translate(-50%, -100%) scale(${actionBar.scale || viewScale})`
              : `translate(-50%, 12px) scale(${actionBar.scale || viewScale})`,
            transformOrigin: 'top center',
          }}
        >
          <div className="flex items-center gap-1 rounded-full border border-white/15 bg-[#0d1b30]/95 p-1 shadow-2xl backdrop-blur-md">
            <button
              onClick={() => {
                onAddSubNode(actionBar.nodeId);
                setActionBar(null);
              }}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
            >
              {labels.child}
            </button>

            {!isRootActionNode && (
              <>
                <button
                  onClick={() => {
                    const parentId = actionNode.parentId;
                    if (parentId) {
                      onAddSubNode(parentId);
                    }
                    setActionBar(null);
                  }}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                >
                  {labels.sibling}
                </button>
                <button
                  onClick={() => {
                    onConvertNodeToTask?.(actionBar.nodeId);
                    setActionBar(null);
                  }}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                >
                  {labels.todo}
                </button>
              </>
            )}

            <button
              onClick={() => {
                onGenerateImage?.(actionBar.nodeId);
                setActionBar(null);
              }}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
            >
              {labels.generate}
            </button>

            {isRootActionNode ? (
              <button
                onClick={() => {
                  onInsertImage?.(actionBar.nodeId);
                  setActionBar(null);
                }}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
              >
                {labels.insert}
              </button>
            ) : (
              <button
                onClick={() => {
                  setActionBar((prev) => (
                    prev ? { ...prev, isMoreOpen: !prev.isMoreOpen } : prev
                  ));
                }}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
              >
                {labels.more}
              </button>
            )}
          </div>

          {!isRootActionNode && actionBar.isMoreOpen && (
            <div className="mt-2 min-w-[150px] rounded-xl border border-white/15 bg-[#0d1b30]/95 p-1 shadow-2xl backdrop-blur-md">
              <button
                onClick={() => {
                  onInsertImage?.(actionBar.nodeId);
                  setActionBar(null);
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-white hover:bg-white/10"
              >
                {labels.insertImage}
              </button>
              <button
                onClick={() => {
                  onDeleteNode(actionBar.nodeId);
                  setActionBar(null);
                }}
                className="mt-1 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-400 hover:bg-red-500/15"
              >
                {labels.delete}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty State Guidance Overlay */}
      {showEmptyGuide && (
        <div className="absolute inset-0 z-30 pointer-events-none flex flex-col items-center justify-end pb-28 sm:pb-32">
          {/* Pulsing ring around center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-40 h-40 rounded-full border-2 border-neon-lime/30 animate-ping" style={{ animationDuration: '2.5s' }} />
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[calc(50%-70px)] sm:-translate-y-[calc(50%-80px)] pointer-events-none">
            <div className="flex flex-col items-center gap-1 animate-bounce" style={{ animationDuration: '2s' }}>
              <ChevronDown size={20} className="text-neon-lime/70" />
              <span className="text-[10px] text-neon-lime/60 font-bold tracking-wider">TAP</span>
            </div>
          </div>

          {/* Guide Card */}
          <div className="pointer-events-auto mx-4 max-w-sm w-full">
            <div className="bg-[#0a1a2f]/95 backdrop-blur-xl border border-neon-lime/20 rounded-2xl p-5 shadow-[0_0_40px_rgba(204,255,0,0.08)]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-neon-lime/10 border border-neon-lime/30 flex items-center justify-center">
                  <Target size={16} className="text-neon-lime" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{guidance.emptyTitle}</h3>
                  <p className="text-[11px] text-gray-400">{guidance.emptySubtitle}</p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {guidance.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-neon-lime/20 border border-neon-lime/40 flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-bold text-neon-lime">{step.icon}</span>
                    </div>
                    <p className="text-[12px] text-gray-300">{step.text}</p>
                  </div>
                ))}
              </div>

              {/* SMART Expandable */}
              <button
                onClick={() => setSmartExpanded(!smartExpanded)}
                className="w-full flex items-center justify-between text-left py-2 px-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all mb-2"
              >
                <div className="flex items-center gap-2">
                  <Lightbulb size={14} className="text-yellow-400" />
                  <span className="text-[12px] font-semibold text-white">{guidance.smartTitle}</span>
                </div>
                <ChevronDown
                  size={14}
                  className={`text-gray-400 transition-transform duration-200 ${smartExpanded ? 'rotate-180' : ''}`}
                />
              </button>
              {smartExpanded && (
                <div className="space-y-1.5 mb-3 pl-1">
                  {guidance.smartItems.map((item) => (
                    <div key={item.letter} className="flex items-start gap-2">
                      <span className="text-[11px] font-black text-neon-lime w-4 shrink-0">{item.letter}</span>
                      <div>
                        <span className="text-[11px] font-semibold text-white">{item.label}</span>
                        <span className="text-[11px] text-gray-400"> — {item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setGuideDismissed(true)}
                className="w-full py-2.5 bg-neon-lime text-black text-[12px] font-bold rounded-xl hover:bg-white transition-all flex items-center justify-center gap-1.5"
              >
                {guidance.gotIt}
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMART Hint - shown after first few nodes */}
      {showSmartHint && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 pointer-events-auto animate-fade-in">
          <div className="bg-[#0a1a2f]/90 backdrop-blur-xl border border-neon-lime/15 rounded-full px-4 py-2 shadow-lg flex items-center gap-2 max-w-xs">
            <Sparkles size={13} className="text-neon-lime shrink-0" />
            <p className="text-[11px] text-gray-300 leading-tight">
              {resolvedLanguage === 'ko'
                ? '목표를 더 구체적으로 나눠보세요. 큰 목표 → 중간 목표 → 실행 가능한 작은 목표'
                : 'Break your goals down further. Big goal → Mid goal → Small actionable steps'}
            </p>
            <button
              onClick={() => setGuideDismissed(true)}
              className="text-[10px] text-gray-500 hover:text-white shrink-0 ml-1"
            >
              ✕
            </button>
          </div>
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
    prev.language === next.language &&
    prev.selectedNodeId === next.selectedNodeId &&
    prev.width === next.width &&
    prev.height === next.height &&
    prev.editingNodeId === next.editingNodeId &&
    prev.imageLoadingNodes === next.imageLoadingNodes
  );
});

