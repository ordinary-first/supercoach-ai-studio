import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Sparkles } from 'lucide-react';
import MindMapSDK from 'simple-mind-map';
import { useThemeStore } from '../stores/useThemeStore';
import Drag from 'simple-mind-map/src/plugins/Drag.js';
import RainbowLines from 'simple-mind-map/src/plugins/RainbowLines.js';
import Select from 'simple-mind-map/src/plugins/Select.js';
import TouchEvent from 'simple-mind-map/src/plugins/TouchEvent.js';
import { GoalNode, GoalLink, NodeType, NodeStatus } from '../types';
import { getLinkId } from '../hooks/useAutoSave';
import { useTranslation } from '../i18n/useTranslation';

// Register plugins once
MindMapSDK.usePlugin(Drag);
MindMapSDK.usePlugin(RainbowLines);
MindMapSDK.usePlugin(Select);
MindMapSDK.usePlugin(TouchEvent);

// --- Node Action SVG Icons ---
const AddChildIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="5" cy="4" r="2.5" />
    <circle cx="13" cy="13" r="2.5" />
    <path d="M5 6.5V9h4.5V13" strokeLinecap="round" />
  </svg>
);

const AddSiblingIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="5" cy="13" r="2.5" />
    <circle cx="13" cy="13" r="2.5" />
    <circle cx="9" cy="4" r="2.5" />
    <path d="M9 6.5V9M5 10.5V9h8v1.5" strokeLinecap="round" />
  </svg>
);

const AddParentIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="9" cy="4" r="2.5" strokeDasharray="3 2" />
    <circle cx="9" cy="14" r="2.5" />
    <path d="M9 6.5V11.5" strokeLinecap="round" />
  </svg>
);

// --- Types ---
export type LayoutMode = 'mindMap' | 'logicalStructure' | 'logicalStructureLeft' | 'organizationStructure';

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
  onAddParentNode?: (nodeId: string) => void;
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
  layout?: LayoutMode;
  onLayoutChange?: (layout: LayoutMode) => void;
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
  defaultRootText?: string,
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
      text: goalNode.text || defaultRootText || 'My Life Vision',
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
    fontFamily: 'SF Pro Display, SF Pro Text, -apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Pretendard, sans-serif',
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
    fontFamily: 'SF Pro Display, SF Pro Text, -apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Pretendard, sans-serif',
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
    fontFamily: 'SF Pro Display, SF Pro Text, -apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Pretendard, sans-serif',
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
    fontFamily: 'SF Pro Display, SF Pro Text, -apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Pretendard, sans-serif',
  },
};

const LIGHT_THEME_CONFIG = {
  backgroundColor: '#F8FAFC',
  lineColor: '#94A3B8',
  lineWidth: 2,
  lineDasharray: 'none',
  lineStyle: 'curve' as const,
  generalizationLineColor: '#64748B',
  root: {
    fillColor: '#FFFFFF',
    color: '#0F172A',
    borderColor: '#4D7C0F',
    borderWidth: 3,
    borderRadius: 24,
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'SF Pro Display, SF Pro Text, -apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Pretendard, sans-serif',
    shape: 'roundedRectangle',
    paddingX: 30,
    paddingY: 20,
  },
  second: {
    fillColor: '#F1F5F9',
    color: '#1E293B',
    borderColor: '#64748B',
    borderWidth: 2,
    borderRadius: 12,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'SF Pro Display, SF Pro Text, -apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Pretendard, sans-serif',
    shape: 'roundedRectangle',
    marginX: 80,
    marginY: 30,
    paddingX: 20,
    paddingY: 12,
  },
  node: {
    fillColor: '#FFFFFF',
    color: '#334155',
    borderColor: '#94A3B8',
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'SF Pro Display, SF Pro Text, -apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Pretendard, sans-serif',
    shape: 'roundedRectangle',
    marginX: 60,
    marginY: 20,
    paddingX: 16,
    paddingY: 10,
  },
  generalization: {
    fillColor: '#F1F5F9',
    color: '#475569',
    borderColor: '#94A3B8',
    borderWidth: 1,
    borderRadius: 6,
    fontSize: 12,
    fontFamily: 'SF Pro Display, SF Pro Text, -apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Pretendard, sans-serif',
  },
};

const RAINBOW_COLORS = [
  '#CCFF00', '#00D4FF', '#FF6B6B', '#A78BFA',
  '#34D399', '#FBBF24', '#F472B6', '#60A5FA',
];

const LAYOUT_MODES: LayoutMode[] = [
  'mindMap', 'logicalStructure', 'logicalStructureLeft', 'organizationStructure',
];

// Action bar labels are now in t.mindmap.* via useTranslation

// --- Component ---
const MindMap: React.FC<MindMapProps> = ({
  nodes, links, language, selectedNodeId, onNodeClick, onEditNode, onUpdateNode, onDeleteNode,
  onReparentNode, onConvertNodeToTask, onGenerateImage, onInsertImage, onAddSubNode, onAddParentNode,
  onDecomposeGoal, previewNodeIds, confirmedPreviewIds, onTogglePreviewConfirm, onFinalizePreview,
  width, height, editingNodeId, onEditEnd, imageLoadingNodes,
  layout: layoutProp = 'mindMap', onLayoutChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mindMapRef = useRef<any>(null);
  const [actionBar, setActionBar] = useState<ActionBarState | null>(null);
  const [viewScale, setViewScale] = useState(1);
  const [identitySkipped, setIdentitySkipped] = useState(false);
  const [templatesSkipped, setTemplatesSkipped] = useState(false);
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const currentThemeConfig = useThemeStore((s) => s.resolved === 'light' ? LIGHT_THEME_CONFIG : DARK_THEME_CONFIG);
  const isLight = useThemeStore((s) => s.resolved === 'light');
  const { t } = useTranslation();

  // --- Onboarding: Ghost templates ---
  const GHOST_TEMPLATES = t.mindmap.ghostTemplates;
  const [usedGhosts, setUsedGhosts] = useState<Set<number>>(new Set());

  // --- Onboarding Phase Computation ---
  type OnboardingPhase = 'identity' | 'templates' | 'tooltips' | 'done';

  const rootNode = nodes.find(n => n.type === NodeType.ROOT);
  const rootText = rootNode?.text || '';
  const isRootDefault = rootText === '' || rootText === '나의 인생 비전' || rootText === 'My Life Vision';
  const childCount = nodes.filter(n => n.type === NodeType.SUB).length;
  const allGhostsUsed = usedGhosts.size >= GHOST_TEMPLATES.length;

  const onboardingPhase: OnboardingPhase =
    isRootDefault && childCount === 0 && !identitySkipped ? 'identity' :
    !templatesSkipped && !allGhostsUsed && childCount <= usedGhosts.size ? 'templates' :
    (childCount > 0 || templatesSkipped) && !tooltipDismissed ? 'tooltips' :
    'done';

  const labels = t.mindmap;

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
  const tRef = useRef(t);
  tRef.current = t;

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

    const treeData = goalNodesToTree(nodes, links, selectedNodeId, confirmedPreviewIds, t.mindmap.defaultRootText);
    if (!treeData) return;

    lastStructureKeyRef.current = computeStructureKey(nodes, links, selectedNodeId, confirmedPreviewIds);

    const mindMap = new (MindMapSDK as any)({
      el: containerRef.current,
      data: treeData,
      layout: layoutProp,
      theme: 'default',
      themeConfig: currentThemeConfig,
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
      defaultInsertSecondLevelNodeText: 'New node',
      defaultInsertBelowSecondLevelNodeText: 'New node',
      defaultGeneralizationText: 'Summary',
      defaultAssociativeLineText: '',
      // Hook the built-in "+" quick-create button so node creation goes through React state.
      // This avoids Chinese placeholder text and allows immediate text editing via editingNodeId.
      customQuickCreateChildBtnClick: (nodeIns: any) => {
        const goalId = nodeIns?.nodeData?.data?.goalId || nodeIns?.nodeData?.data?.uid;
        if (!goalId || goalId.startsWith('ghost-')) return;
        onAddSubNodeRef.current?.(goalId);
      },
      expandBtnStyle: {
        color: isLight ? '#4D7C0F' : '#CCFF00',
        fill: isLight ? '#F8FAFC' : '#050B14',
        fontSize: 12,
        strokeColor: isLight ? '#4D7C0F' : '#CCFF00',
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

    // --- Identity node placeholder on edit ---
    const DEFAULT_TEXTS = ['My Life Vision', '나의 인생 비전', ''];
    mindMap.on('node_dblclick', (node: any) => {
      const goalId = node?.nodeData?.data?.goalId || node?.nodeData?.data?.uid;
      const root = nodesRef.current.find(n => n.type === NodeType.ROOT);
      if (!root || goalId !== root.id) return;
      const nodeText = node.getData('text') || '';
      if (!DEFAULT_TEXTS.includes(nodeText)) return;
      // Clear default text after edit box appears, so CSS placeholder shows
      setTimeout(() => {
        const editBox = document.querySelector('.smm-node-edit-wrap') as HTMLElement | null;
        if (editBox && editBox.style.display !== 'none') {
          editBox.innerHTML = '';
          editBox.setAttribute(
            'data-placeholder',
            tRef.current.mindmap.onboarding.identityPlaceholder,
          );
        }
      }, 60);
    });
    mindMap.on('hide_text_edit', (_el: any, _list: any, editedNode: any) => {
      const goalId = editedNode?.nodeData?.data?.goalId || editedNode?.nodeData?.data?.uid;
      const root = nodesRef.current.find(n => n.type === NodeType.ROOT);
      if (!root || goalId !== root.id) return;
      const text = (editedNode.getData?.('text') || '').trim();
      if (!text) {
        // Restore default text when user leaves empty
        editedNode.setText?.(tRef.current.mindmap.defaultRootText);
        mindMap.render?.();
      }
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

    const treeData = goalNodesToTree(nodes, links, selectedNodeId, confirmedPreviewIds, t.mindmap.defaultRootText);
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

  // --- Sync layout prop → SDK ---
  useEffect(() => {
    const mm = mindMapRef.current;
    if (!mm) return;
    mm.setLayout(layoutProp);
    // Re-center view after layout repositions nodes
    setTimeout(() => mm.view?.reset?.(), 300);
  }, [layoutProp]);

  // --- Resize ---
  useEffect(() => {
    mindMapRef.current?.resize();
  }, [width, height]);

  // --- Runtime theme switching ---
  useEffect(() => {
    const mindMap = mindMapRef.current;
    if (!mindMap) return;
    mindMap.setThemeConfig(currentThemeConfig);
  }, [currentThemeConfig]);

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
    <div className="apple-tab-shell w-full h-full relative overflow-hidden">
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        .smm-node-edit-wrap:empty::before {
          content: attr(data-placeholder);
          opacity: 0.35;
          font-style: italic;
          pointer-events: none;
        }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fadeInUp 0.6s ease-out forwards; }
      `}</style>

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
          <div className="flex items-center gap-1 rounded-full border border-th-border bg-th-elevated/95 p-1 shadow-2xl backdrop-blur-md">
            <button
              onClick={() => {
                onAddSubNode(actionBar.nodeId);
                setActionBar(null);
              }}
              className="rounded-full p-2 text-th-text-secondary hover:text-th-text hover:bg-th-surface-hover transition-colors"
              title={t.mindmap.onboarding.addChildTitle}
            >
              <AddChildIcon />
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
                  className="rounded-full p-2 text-th-text-secondary hover:text-th-text hover:bg-th-surface-hover transition-colors"
                  title={t.mindmap.onboarding.addSiblingTitle}
                >
                  <AddSiblingIcon />
                </button>
                <button
                  onClick={() => {
                    onAddParentNode?.(actionBar.nodeId);
                    setActionBar(null);
                  }}
                  className="rounded-full p-2 text-th-text-secondary hover:text-th-text hover:bg-th-surface-hover transition-colors"
                  title={t.mindmap.onboarding.addParentTitle}
                >
                  <AddParentIcon />
                </button>
                <button
                  onClick={() => {
                    onConvertNodeToTask?.(actionBar.nodeId);
                    setActionBar(null);
                  }}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-th-text hover:bg-th-surface-hover"
                >
                  {labels.todo}
                </button>
              </>
            )}

            {!isRootActionNode && (
              <button
                onClick={() => { onDecomposeGoal?.(actionBar.nodeId); setActionBar(null); }}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-th-accent/10 text-th-accent hover:bg-th-accent/20 transition-colors whitespace-nowrap"
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
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-th-text hover:bg-th-surface-hover"
            >
              {labels.generate}
            </button>

            {isRootActionNode ? (
              <button
                onClick={() => {
                  onInsertImage?.(actionBar.nodeId);
                  setActionBar(null);
                }}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-th-text hover:bg-th-surface-hover"
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
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-th-text hover:bg-th-surface-hover"
              >
                {labels.more}
              </button>
            )}
          </div>

          {!isRootActionNode && actionBar.isMoreOpen && (
            <div className="mt-2 min-w-[150px] rounded-xl border border-th-border bg-th-elevated/95 p-1 shadow-2xl backdrop-blur-md">
              <button
                onClick={() => {
                  onInsertImage?.(actionBar.nodeId);
                  setActionBar(null);
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-th-text hover:bg-th-surface-hover"
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
              <span className="text-[10px] text-th-text-secondary uppercase tracking-[0.2em] font-mono">
                {t.mindmap.onboarding.identityLabel}
              </span>
            </div>
          )}

          {/* Popup message below root node */}
          {rootNodeCenter && (
            <div
              className="absolute z-40 pointer-events-none"
              style={{ left: rootNodeCenter.x, top: rootNodeCenter.y + 60, transform: 'translate(-50%, 0)' }}
            >
              <div className="bg-th-elevated/95 border border-th-border rounded-2xl px-4 py-3 max-w-[260px] backdrop-blur-md shadow-2xl">
                <p className="text-th-text text-xs leading-relaxed text-center">
                  {t.mindmap.onboarding.identityPrompt}
                  <br />
                  <span className="text-th-accent/80 font-semibold">{t.mindmap.onboarding.identityMotivation}</span>
                </p>
                <div className="mt-2 flex justify-center">
                  <span className="text-[10px] text-th-text-tertiary animate-pulse">{t.mindmap.onboarding.doubleTapToEdit}</span>
                </div>
              </div>
            </div>
          )}

          {/* Skip button */}
          <button
            onClick={() => setIdentitySkipped(true)}
            className="absolute bottom-6 right-4 z-40 text-th-text-tertiary text-xs hover:text-th-text-secondary transition-colors"
          >
            {t.mindmap.onboarding.skip}
          </button>
        </>
      )}

      {/* Phase 2: Ghost Templates (rendered by SDK, skip button only) */}
      {onboardingPhase === 'templates' && (
        <button
          onClick={() => setTemplatesSkipped(true)}
          className="absolute bottom-6 right-4 z-40 text-th-text-tertiary text-xs hover:text-th-text-secondary transition-colors"
        >
          {t.mindmap.onboarding.skip}
        </button>
      )}

      {/* Phase 3: Contextual Tooltip — removed */}

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
    prev.imageLoadingNodes === next.imageLoadingNodes &&
    prev.layout === next.layout
  );
});



