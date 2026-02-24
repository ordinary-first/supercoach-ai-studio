import React, { useEffect, useRef, useCallback, useState } from 'react';
import MindMapSDK from 'simple-mind-map';
import Drag from 'simple-mind-map/src/plugins/Drag.js';
import RainbowLines from 'simple-mind-map/src/plugins/RainbowLines.js';
import Select from 'simple-mind-map/src/plugins/Select.js';
import TouchEvent from 'simple-mind-map/src/plugins/TouchEvent.js';
import { GoalNode, GoalLink, NodeType, NodeStatus } from '../types';
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
  onAddSubNode: (parentId: string, text?: string) => void;
  onDecomposeGoal?: (nodeId: string) => void;
  previewNodeIds?: string[];
  confirmedPreviewIds?: string[];
  onTogglePreviewConfirm?: (nodeId: string) => void;
  onFinalizePreview?: () => void;
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
  borderDasharray?: string;
  color?: string;
  fillColor?: string;
  // Image support
  image?: string;
  imageTitle?: string;
  imageSize?: { width: number; height: number };
  // Ghost template nodes (Phase 2 onboarding)
  isGhost?: boolean;
  fillColor?: string;
  color?: string;
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
  confirmedPreviewIds?: string[],
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

    const nodeStyle: { borderColor: string; borderWidth: number; borderDasharray?: string; color?: string } = {
      borderColor: isRoot ? '#CCFF00' : (isSelected ? '#CCFF00' : statusColor),
      borderWidth: isSelected ? 3 : (isRoot ? 3 : 2),
    };

    // Preview node styling (반투명 미리보기)
    if (goalNode.isPreview) {
      const isConfirmed = confirmedPreviewIds?.includes(goalNode.id);
      if (isConfirmed) {
        // 확정됨 — 밝은 neon-lime 두꺼운 border + 정상 텍스트
        Object.assign(nodeStyle, {
          borderColor: '#CCFF00',
          borderWidth: 3,
        });
      } else {
        // 미확정 — 어두운 회색 얇은 border
        Object.assign(nodeStyle, {
          borderColor: '#444444',
          borderWidth: 1,
          color: 'rgba(255, 255, 255, 0.4)',
        });
      }
    }

    // Selected node override (after preview so selection still shows)
    if (isSelected && !goalNode.isPreview) {
      nodeStyle.borderColor = '#CCFF00';
      nodeStyle.borderWidth = 3;
    }

    const data: SMMNodeData = {
      text: goalNode.text || '나의 인생 비전',
      uid: goalNode.id,
      expand: !goalNode.collapsed,
      goalId: goalNode.id,
      goalType: goalNode.type,
      goalStatus: goalNode.status,
      goalProgress: goalNode.progress,
      goalParentId: goalNode.parentId,
      // Bake border color into node data so we never need setStyle()
      borderColor: nodeStyle.borderColor,
      borderWidth: nodeStyle.borderWidth,
      ...(nodeStyle.borderDasharray && { borderDasharray: nodeStyle.borderDasharray }),
      ...(nodeStyle.color && { color: nodeStyle.color }),
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
function computeStructureKey(
  nodes: GoalNode[], links: GoalLink[],
  selectedNodeId?: string, confirmedPreviewIds?: string[],
): string {
  return nodes.map(n => `${n.id}:${n.text}:${n.status}:${n.collapsed}:${n.imageUrl || ''}`).join('|')
    + '||' + links.map(l => `${getLinkId(l.source)}-${getLinkId(l.target)}`).join('|')
    + '||' + (selectedNodeId || '')
    + '||' + (confirmedPreviewIds?.join(',') || '');
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
  { mode: 'mindMap', label: '마인드' },
  { mode: 'logicalStructure', label: '논리' },
  { mode: 'logicalStructureLeft', label: '논리(좌)' },
  { mode: 'organizationStructure', label: '조직도' },
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
    decompose: 'Decompose',
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
    decompose: '분해',
  },
} as const;

// --- Component ---
const MindMap: React.FC<MindMapProps> = ({
  nodes, links, language, selectedNodeId, onNodeClick, onEditNode, onUpdateNode, onDeleteNode,
  onReparentNode, onConvertNodeToTask, onGenerateImage, onInsertImage, onAddSubNode,
  onDecomposeGoal, previewNodeIds, confirmedPreviewIds, onTogglePreviewConfirm, onFinalizePreview,
  width, height, editingNodeId, onEditEnd, imageLoadingNodes
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mindMapRef = useRef<any>(null);
  const [layout, setLayout] = useState<LayoutMode>('mindMap');
  const [actionBar, setActionBar] = useState<ActionBarState | null>(null);
  const [viewScale, setViewScale] = useState(1);
  const [identitySkipped, setIdentitySkipped] = useState(false);
  const [templatesSkipped, setTemplatesSkipped] = useState(false);
  const [tooltipDismissed, setTooltipDismissed] = useState(false);

  // --- Onboarding: Ghost templates ---
  const GHOST_TEMPLATES = [
    '나는 매달 100만원의 부수입이 생겼다',
    '나는 슬림하고 탄탄한 몸을 가졌다',
    '나는 누구에게나 호감을 주는 유머감각을 가졌다',
  ];
  const [usedGhosts, setUsedGhosts] = useState<Set<number>>(new Set());

  // --- Onboarding Phase Computation ---
  type OnboardingPhase = 'identity' | 'templates' | 'tooltips' | 'done';

  const rootNode = nodes.find(n => n.type === NodeType.ROOT);
  const rootText = rootNode?.text || '';
  const isRootDefault = rootText === '' || rootText === '나의 인생 비전';
  const childCount = nodes.filter(n => n.type === NodeType.SUB).length;
  const allGhostsUsed = usedGhosts.size >= GHOST_TEMPLATES.length;

  const onboardingPhase: OnboardingPhase =
    isRootDefault && childCount === 0 && !identitySkipped ? 'identity' :
    !templatesSkipped && !allGhostsUsed && childCount <= usedGhosts.size ? 'templates' :
    (childCount > 0 || templatesSkipped) && !tooltipDismissed ? 'tooltips' :
    'done';

  const languageByDom = document.documentElement.lang.toLowerCase().startsWith('ko') ? 'ko' : 'en';
  const resolvedLanguage: 'en' | 'ko' = (
    language === 'ko'
    || languageByDom === 'ko'
  ) ? 'ko' : 'en';
  const labels = ACTION_BAR_LABELS[resolvedLanguage];

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
  const onTogglePreviewConfirmRef = useRef(onTogglePreviewConfirm);
  const onFinalizePreviewRef = useRef(onFinalizePreview);
  const previewNodeIdsRef = useRef(previewNodeIds);
  const setActionBarRef = useRef(setActionBar);
  const actionBarRef = useRef<ActionBarState | null>(null);
  const lastTapRef = useRef<{ nodeId: string; ts: number }>({
    nodeId: '',
    ts: 0,
  });
  const setUsedGhostsRef = useRef(setUsedGhosts);
  onNodeClickRef.current = onNodeClick;
  onEditNodeRef.current = onEditNode;
  onUpdateNodeRef.current = onUpdateNode;
  onAddSubNodeRef.current = onAddSubNode;
  onTogglePreviewConfirmRef.current = onTogglePreviewConfirm;
  onFinalizePreviewRef.current = onFinalizePreview;
  previewNodeIdsRef.current = previewNodeIds;
  setActionBarRef.current = setActionBar;
  actionBarRef.current = actionBar;
  setUsedGhostsRef.current = setUsedGhosts;

  // --- Onboarding: Root node position tracking ---
  const [rootNodeCenter, setRootNodeCenter] = useState<{x: number; y: number} | null>(null);

  useEffect(() => {
    if (onboardingPhase === 'done') return;
    const timer = setTimeout(() => {
      const renderedRoot = getRenderedNodeByGoalId('root');
      if (!renderedRoot || typeof renderedRoot.getRectInSvg !== 'function') return;
      const rect = renderedRoot.getRectInSvg();
      if (!rect) return;
      setRootNodeCenter({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    }, 500);
    return () => clearTimeout(timer);
  }, [nodes, onboardingPhase, getRenderedNodeByGoalId]);

  // --- Onboarding: Phase 3 auto-dismiss ---
  useEffect(() => {
    if (onboardingPhase !== 'tooltips') return;
    const timer = setTimeout(() => setTooltipDismissed(true), 5000);
    return () => clearTimeout(timer);
  }, [onboardingPhase]);

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

    const treeData = goalNodesToTree(nodes, links, selectedNodeId, confirmedPreviewIds);
    if (!treeData) return;

    lastStructureKeyRef.current = computeStructureKey(nodes, links, selectedNodeId, confirmedPreviewIds);

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
        if (!goalId || goalId.startsWith('ghost-')) return;
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

      // Ghost node interception
      if (goalId.startsWith('ghost-')) {
        const idx = parseInt(goalId.split('-')[1]);
        if (!isNaN(idx) && GHOST_TEMPLATES[idx]) {
          onAddSubNodeRef.current('root', GHOST_TEMPLATES[idx]);
          setUsedGhostsRef.current(prev => new Set(prev).add(idx));
        }
        return;
      }

      // If in preview mode and clicked node is a preview node → toggle confirm
      const isPreviewMode = previewNodeIdsRef.current && previewNodeIdsRef.current.length > 0;
      if (isPreviewMode) {
        if (previewNodeIdsRef.current?.includes(goalId)) {
          onTogglePreviewConfirmRef.current?.(goalId);
          return; // Don't show action bar for preview nodes
        }
        // Clicking a non-preview node during preview mode → also don't show action bar
        return;
      }

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
        if (goalId?.startsWith('ghost-')) return;
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
    mindMap.on('draw_click', () => {
      if (previewNodeIdsRef.current && previewNodeIdsRef.current.length > 0) {
        onFinalizePreviewRef.current?.();
      }
      setActionBarRef.current(null);
    });

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

  // --- Sync data from React -> simple-mind-map when props change ---
  useEffect(() => {
    const mindMap = mindMapRef.current;
    if (!mindMap) return;

    const baseKey = computeStructureKey(nodes, links, selectedNodeId, confirmedPreviewIds);
    const ghostSuffix = onboardingPhase === 'templates'
      ? `|ghosts:${GHOST_TEMPLATES.length - usedGhosts.size}`
      : '';
    const newKey = baseKey + ghostSuffix;
    if (newKey === lastStructureKeyRef.current) return;
    lastStructureKeyRef.current = newKey;

    const treeData = goalNodesToTree(nodes, links, selectedNodeId, confirmedPreviewIds);
    if (!treeData) return;

    // Inject ghost nodes for Phase 2
    if (onboardingPhase === 'templates') {
      GHOST_TEMPLATES.forEach((text, i) => {
        if (usedGhosts.has(i)) return;
        treeData.children.push({
          data: {
            text,
            uid: `ghost-${i}`,
            goalId: `ghost-${i}`,
            isGhost: true,
            fillColor: '#0f2340',
            color: '#ffffffbb',
            borderColor: '#CCFF0088',
            borderWidth: 2,
          },
          children: [],
        });
      });
    }

    lastSetDataTimeRef.current = Date.now();
    mindMap.setData(treeData);

    // CSS-based ghost styling fallback (in case SDK doesn't honor alpha colors)
    if (onboardingPhase === 'templates') {
      requestAnimationFrame(() => {
        setTimeout(() => {
          GHOST_TEMPLATES.forEach((_, i) => {
            if (usedGhosts.has(i)) return;
            const nodeIns = getRenderedNodeByGoalId(`ghost-${i}`);
            if (nodeIns?.group?.node) {
              const el = nodeIns.group.node as HTMLElement;
              el.style.opacity = '0.65';
              el.style.transition = 'opacity 0.2s ease';
              el.style.cursor = 'pointer';
              el.onmouseenter = () => { el.style.opacity = '1'; };
              el.onmouseleave = () => { el.style.opacity = '0.65'; };
            }
          });
        }, 300);
      });
    }
  }, [nodes, links, selectedNodeId, confirmedPreviewIds, onboardingPhase, usedGhosts, getRenderedNodeByGoalId]);

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
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fadeInUp 0.6s ease-out forwards; }
      `}</style>

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

            {!isRootActionNode && (
              <button
                onClick={() => { onDecomposeGoal?.(actionBar.nodeId); setActionBar(null); }}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-neon-lime/10 text-neon-lime hover:bg-neon-lime/20 transition-colors whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {labels.decompose}
              </button>
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

      {/* Phase 1: Identity Node Awakening */}
      {onboardingPhase === 'identity' && (
        <>
          {/* Dim overlay with radial cutout for root node */}
          <div
            className="absolute inset-0 z-30 pointer-events-none"
            style={{
              background: rootNodeCenter
                ? `radial-gradient(ellipse 180px 120px at ${rootNodeCenter.x}px ${rootNodeCenter.y}px, transparent 0%, rgba(0,0,0,0.7) 100%)`
                : 'rgba(0,0,0,0.7)',
            }}
          />

          {/* "정체성 노드" label above root node */}
          {rootNodeCenter && (
            <div
              className="absolute z-40 pointer-events-none"
              style={{ left: rootNodeCenter.x, top: rootNodeCenter.y - 70, transform: 'translate(-50%, 0)' }}
            >
              <span className="text-[10px] text-gray-400 uppercase tracking-[0.2em] font-mono">
                정체성 노드
              </span>
            </div>
          )}

          {/* Placeholder text on root node */}
          {rootNodeCenter && (
            <div
              className="absolute z-40 pointer-events-none"
              style={{ left: rootNodeCenter.x, top: rootNodeCenter.y, transform: 'translate(-50%, -50%)' }}
            >
              <span className="text-white/30 text-sm font-body whitespace-nowrap">
                나는 ~ 한 사람이다
              </span>
            </div>
          )}

          {/* Popup message below root node */}
          {rootNodeCenter && (
            <div
              className="absolute z-40 pointer-events-none"
              style={{ left: rootNodeCenter.x, top: rootNodeCenter.y + 60, transform: 'translate(-50%, 0)' }}
            >
              <div className="bg-[#0d1b30]/95 border border-white/15 rounded-2xl px-4 py-3 max-w-[260px] backdrop-blur-md shadow-2xl">
                <p className="text-white/90 text-xs leading-relaxed text-center">
                  당신이 원하는 궁극적인 모습을 여기에 적어보세요.
                  <br />
                  <span className="text-neon-lime/80 font-semibold">모든 변화는 여기서 시작됩니다.</span>
                </p>
                <div className="mt-2 flex justify-center">
                  <span className="text-[10px] text-gray-500 animate-pulse">더블탭으로 수정</span>
                </div>
              </div>
            </div>
          )}

          {/* Skip button */}
          <button
            onClick={() => setIdentitySkipped(true)}
            className="absolute bottom-6 right-4 z-40 text-gray-500 text-xs hover:text-gray-300 transition-colors"
          >
            건너뛰기 →
          </button>
        </>
      )}

      {/* Phase 2: Ghost Templates (rendered by SDK, skip button only) */}
      {onboardingPhase === 'templates' && (
        <button
          onClick={() => setTemplatesSkipped(true)}
          className="absolute bottom-6 right-4 z-40 text-gray-500 text-xs hover:text-gray-300 transition-colors"
        >
          건너뛰기 →
        </button>
      )}

      {/* Phase 3: Contextual Tooltip */}
      {onboardingPhase === 'tooltips' && (
        <div
          onClick={() => setTooltipDismissed(true)}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 animate-fade-in cursor-pointer"
        >
          <div className="bg-[#0d1b30]/95 border border-white/15 rounded-2xl px-5 py-3 backdrop-blur-md shadow-2xl">
            <div className="flex items-center gap-4 text-white/80 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-neon-lime">◉</span>
                <span>더블탭: 이름 수정</span>
              </div>
              <div className="w-px h-4 bg-white/20" />
              <div className="flex items-center gap-1.5">
                <span className="text-neon-lime">◎</span>
                <span>탭: 하위 목표 추가</span>
              </div>
            </div>
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
    prev.previewNodeIds === next.previewNodeIds &&
    prev.confirmedPreviewIds === next.confirmedPreviewIds &&
    prev.width === next.width &&
    prev.height === next.height &&
    prev.editingNodeId === next.editingNodeId &&
    prev.imageLoadingNodes === next.imageLoadingNodes
  );
});

