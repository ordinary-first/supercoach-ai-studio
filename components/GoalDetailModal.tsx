import React, { useState, useMemo, useRef, useCallback } from 'react';
import { GoalNode, NodeType, NodeStatus } from '../types';
import {
  ChevronDown, ChevronRight, X, Check, Circle, Plus, Trash2,
  Sparkles, ImagePlus, MessageCircle, ListTodo, Loader2, GitBranch, Move,
  GripVertical,
} from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
  DragStartEvent, DragMoveEvent, DragEndEvent, MeasuringStrategy,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from '../i18n/useTranslation';

/* ── DnD: flatten / projection helpers (mirrors OutlineView) ── */

/** A node flattened into the visible, ordered list (subtree root excluded). */
interface FlatItem {
  id: string;
  node: GoalNode;
  depth: number;        // subtree root's direct children = 1
  parentId: string;     // always set (subtree root id at minimum)
  hasChildren: boolean;
  childCount: number;
  doneChildCount: number;
}

const INDENT = 24;
const BASE = 16;

function buildChildrenMap(nodes: GoalNode[]): Map<string, GoalNode[]> {
  const map = new Map<string, GoalNode[]>();
  for (const n of nodes) {
    if (n.parentId) {
      const arr = map.get(n.parentId) || [];
      arr.push(n);
      map.set(n.parentId, arr);
    }
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }
  return map;
}

/** Flatten visible descendants of root depth-first. Uses collapsedIds (modal
 *  tracks collapse in local state, not on node.collapsed). */
function flattenVisible(
  rootId: string, childrenMap: Map<string, GoalNode[]>, collapsedIds: Set<string>,
): FlatItem[] {
  const out: FlatItem[] = [];
  const walk = (parentId: string, depth: number) => {
    for (const node of childrenMap.get(parentId) || []) {
      const kids = childrenMap.get(node.id) || [];
      const done = kids.filter(k => k.status === NodeStatus.COMPLETED).length;
      out.push({
        id: node.id, node, depth, parentId,
        hasChildren: kids.length > 0, childCount: kids.length, doneChildCount: done,
      });
      if (kids.length > 0 && !collapsedIds.has(node.id)) walk(node.id, depth + 1);
    }
  };
  walk(rootId, 1);
  return out;
}

function collectDescendants(rootId: string, childrenMap: Map<string, GoalNode[]>): Set<string> {
  const set = new Set<string>();
  const walk = (id: string) => {
    for (const child of childrenMap.get(id) || []) {
      set.add(child.id);
      walk(child.id);
    }
  };
  walk(rootId);
  return set;
}

interface Projection { depth: number; parentId: string; }

/** dnd-kit "sortable tree" projection: single forced root, min depth 1. */
function getProjection(
  items: FlatItem[], activeId: string, overId: string,
  dragOffsetX: number, rootId: string,
): Projection | null {
  const overIndex = items.findIndex(i => i.id === overId);
  const activeIndex = items.findIndex(i => i.id === activeId);
  if (overIndex < 0 || activeIndex < 0) return null;
  const activeItem = items[activeIndex];
  const newItems = arrayMove(items, activeIndex, overIndex);
  const previousItem = newItems[overIndex - 1];
  const nextItem = newItems[overIndex + 1];

  const dragDepth = Math.round(dragOffsetX / INDENT);
  const projectedDepth = activeItem.depth + dragDepth;
  const maxDepth = previousItem ? previousItem.depth + 1 : 1;
  const minDepth = nextItem ? nextItem.depth : 1;

  let depth = projectedDepth;
  if (depth > maxDepth) depth = maxDepth;
  else if (depth < minDepth) depth = minDepth;
  if (depth < 1) depth = 1;

  const parentId = (() => {
    if (depth <= 1 || !previousItem) return rootId;
    if (depth === previousItem.depth) return previousItem.parentId;
    if (depth > previousItem.depth) return previousItem.id;
    const ancestor = newItems
      .slice(0, overIndex)
      .reverse()
      .find(i => i.depth === depth);
    return ancestor?.parentId ?? rootId;
  })();

  return { depth, parentId };
}

interface GoalDetailModalProps {
  nodeId: string;
  nodes: GoalNode[];
  onClose: () => void;
  onUpdateNode: (nodeId: string, updates: Partial<GoalNode>) => void;
  onAddSubNode: (parentId: string, text: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onGenerateImage?: (nodeId: string) => void;
  onInsertImage?: (nodeId: string) => void;
  onConvertNodeToTask?: (nodeId: string) => void;
  onExploreWithAI?: (nodeId: string) => void;
  onDecomposeGoal?: (nodeId: string) => void;
  onReparentNode?: (childId: string, newParentId: string) => void;
  decomposingNodeId?: string | null;
  imageLoadingNodes?: Set<string>;
}

interface TreeNode {
  node: GoalNode;
  children: TreeNode[];
  depth: number;
}

/* ── Sortable tree row (modal styling) ── */

interface RowHandlers {
  collapsedIds: Set<string>;
  editingId: string | null;
  addingToId: string | null;
  editText: string;
  editInputRef: React.RefObject<HTMLInputElement>;
  todoTitle: string;
  onToggleCollapse: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onStartEditing: (node: GoalNode) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onChangeEditText: (v: string) => void;
  onStartAddingChild: (parentId: string) => void;
  onConvertNodeToTask?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  renderInlineAddInput: (depth: number) => React.ReactNode;
}

function SortableTreeRow({
  item, renderDepth, isActiveDrag, handlers,
}: {
  item: FlatItem;
  renderDepth: number;
  isActiveDrag: boolean;
  handlers: RowHandlers;
}) {
  const { node, hasChildren, childCount, doneChildCount } = item;
  const {
    collapsedIds, editingId, addingToId, editText, editInputRef, todoTitle,
    onToggleCollapse, onToggleComplete, onStartEditing, onCommitEdit, onCancelEdit,
    onChangeEditText, onStartAddingChild, onConvertNodeToTask, onDeleteNode,
    renderInlineAddInput,
  } = handlers;

  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: node.id });

  const isCompleted = node.status === NodeStatus.COMPLETED;
  const isCollapsed = collapsedIds.has(node.id);
  const isEditing = editingId === node.id;
  const isAddingHere = addingToId === node.id;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-50' : ''}>
      <div
        className={`flex items-center gap-2.5 py-2 px-3 rounded-xl
          transition-colors duration-200 group cursor-default
          ${isActiveDrag
            ? 'bg-white/[0.06] shadow-lg ring-1 ring-th-accent/40'
            : 'hover:bg-white/[0.04]'}`}
        style={{ paddingLeft: `${renderDepth * INDENT + BASE}px` }}
      >
        {/* 드래그 그립 — 호버 시 노출 */}
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-5 -ml-1 flex items-center justify-center shrink-0
            cursor-grab active:cursor-grabbing touch-none
            text-white/20 hover:text-th-accent transition-opacity duration-200
            opacity-0 group-hover:opacity-100"
        >
          <GripVertical size={13} />
        </button>

        {/* 접기/펼치기 */}
        {hasChildren ? (
          <button
            onClick={() => onToggleCollapse(node.id)}
            className="w-5 h-5 flex items-center justify-center rounded-md
              text-white/25 hover:text-white/60 hover:bg-white/[0.06]
              transition-all duration-200 shrink-0"
          >
            {isCollapsed
              ? <ChevronRight size={13} strokeWidth={2.5} />
              : <ChevronDown size={13} strokeWidth={2.5} />
            }
          </button>
        ) : (
          <div className="w-5 shrink-0" />
        )}

        {/* 체크 */}
        <button
          onClick={() => onToggleComplete(node.id)}
          className={`w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0
            transition-all duration-300 ${
            isCompleted
              ? 'bg-emerald-500/90 shadow-[0_0_12px_rgba(52,211,153,0.3)]'
              : 'border-[1.5px] border-white/20 hover:border-white/40 hover:shadow-[0_0_8px_rgba(255,255,255,0.05)]'
          }`}
        >
          {isCompleted && <Check size={10} className="text-white" strokeWidth={3} />}
        </button>

        {/* 텍스트 또는 편집 입력 */}
        {isEditing ? (
          <form
            className="flex-1"
            onSubmit={(e) => { e.preventDefault(); onCommitEdit(); }}
          >
            <input
              ref={editInputRef}
              type="text"
              value={editText}
              onChange={(e) => onChangeEditText(e.target.value)}
              onBlur={onCommitEdit}
              onKeyDown={(e) => { if (e.key === 'Escape') onCancelEdit(); }}
              className="w-full bg-white/[0.06] border border-th-accent/40 rounded-lg px-2 py-1
                text-[13px] text-white/90
                focus:outline-none focus:border-th-accent/60
                transition-all duration-200"
            />
          </form>
        ) : (
          <span
            onDoubleClick={() => onStartEditing(node)}
            className={`text-[13px] flex-1 leading-relaxed transition-all duration-300 ${
              isCompleted
                ? 'text-white/25 line-through decoration-white/15'
                : 'text-white/80 group-hover:text-white/95'
            }`}
          >
            {node.text}
          </span>
        )}

        {/* 자식 카운트 배지 */}
        {hasChildren && !isEditing && (
          <span className="text-[10px] text-white/20 font-mono tabular-nums">
            {doneChildCount}/{childCount}
          </span>
        )}

        {/* 호버 액션 버튼 */}
        {!isEditing && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={() => onStartAddingChild(node.id)}
              className="w-6 h-6 rounded-md flex items-center justify-center
                text-white/20 hover:text-white/60 hover:bg-white/[0.06]
                transition-all duration-200"
              title="하위 추가"
            >
              <Plus size={12} strokeWidth={2} />
            </button>
            {onConvertNodeToTask && (
              <button
                onClick={() => onConvertNodeToTask(node.id)}
                className="w-6 h-6 rounded-md flex items-center justify-center
                  text-white/20 hover:text-th-accent hover:bg-th-accent/10
                  transition-all duration-200"
                title={todoTitle}
              >
                <ListTodo size={12} strokeWidth={2} />
              </button>
            )}
            {onDeleteNode && (
              <button
                onClick={() => onDeleteNode(node.id)}
                className="w-6 h-6 rounded-md flex items-center justify-center
                  text-white/20 hover:text-red-400/80 hover:bg-red-400/[0.06]
                  transition-all duration-200"
                title="삭제"
              >
                <Trash2 size={11} strokeWidth={2} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 인라인 하위 추가 입력 (이 노드 아래) */}
      {isAddingHere && renderInlineAddInput(renderDepth + 1)}
    </div>
  );
}

const GoalDetailModal: React.FC<GoalDetailModalProps> = ({
  nodeId,
  nodes,
  onClose,
  onUpdateNode,
  onAddSubNode,
  onDeleteNode,
  onGenerateImage,
  onInsertImage,
  onConvertNodeToTask,
  onExploreWithAI,
  onDecomposeGoal,
  onReparentNode,
  decomposingNodeId,
  imageLoadingNodes,
}) => {
  const { t } = useTranslation();
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [addingToId, setAddingToId] = useState<string | null>(null);
  const [newSubText, setNewSubText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [moveOpen, setMoveOpen] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const targetNode = nodes.find(n => n.id === nodeId);
  if (!targetNode) return null;

  const tree = useMemo(() => {
    const buildTree = (parentId: string, depth: number): TreeNode[] => {
      return nodes
        .filter(n => n.parentId === parentId)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map(n => ({
          node: n,
          children: buildTree(n.id, depth + 1),
          depth,
        }));
    };
    return buildTree(nodeId, 0);
  }, [nodes, nodeId]);

  // 이동 대상: 자기 자신과 자손을 제외한 노드 (현재 부모는 무의미하므로 제외)
  const descendantIds = useMemo(() => {
    const set = new Set<string>([nodeId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of nodes) {
        if (n.parentId && set.has(n.parentId) && !set.has(n.id)) {
          set.add(n.id);
          changed = true;
        }
      }
    }
    return set;
  }, [nodes, nodeId]);

  const moveTargets = useMemo(
    () => nodes.filter(n =>
      !descendantIds.has(n.id)
      && n.id !== targetNode.parentId
      && (n.type === NodeType.ROOT || !!n.text)
    ),
    [nodes, descendantIds, targetNode.parentId],
  );

  /* ── DnD: flattened visible descendants of the opened node ── */
  const childrenMap = useMemo(() => buildChildrenMap(nodes), [nodes]);
  const flatItems = useMemo(
    () => flattenVisible(nodeId, childrenMap, collapsedIds),
    [nodeId, childrenMap, collapsedIds],
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);

  const descendantsOfActive = useMemo(
    () => (activeId ? collectDescendants(activeId, childrenMap) : new Set<string>()),
    [activeId, childrenMap],
  );
  const visibleItems = useMemo(
    () => (activeId
      ? flatItems.filter(i => i.id === activeId || !descendantsOfActive.has(i.id))
      : flatItems),
    [flatItems, activeId, descendantsOfActive],
  );

  const projected = useMemo(
    () => (activeId && overId
      ? getProjection(visibleItems, activeId, overId, offsetLeft, nodeId)
      : null),
    [activeId, overId, offsetLeft, visibleItems, nodeId],
  );

  // Mirrors for the (sync) drag-end handler
  const projectedRef = useRef<Projection | null>(null);
  const visibleItemsRef = useRef<FlatItem[]>(visibleItems);
  projectedRef.current = projected;
  visibleItemsRef.current = visibleItems;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const resetDrag = useCallback(() => {
    setActiveId(null);
    setOverId(null);
    setOffsetLeft(0);
  }, []);

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setOverId(String(e.active.id));
  }, []);

  const handleDragMove = useCallback((e: DragMoveEvent) => {
    setOffsetLeft(e.delta.x);
    setOverId(e.over ? String(e.over.id) : null);
  }, []);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    const proj = projectedRef.current;
    const items = visibleItemsRef.current;
    const activeNodeId = String(e.active.id);
    const overNodeId = e.over ? String(e.over.id) : null;
    resetDrag();
    if (!proj || !overNodeId) return;

    const overIndex = items.findIndex(i => i.id === overNodeId);
    const activeIndex = items.findIndex(i => i.id === activeNodeId);
    if (overIndex < 0 || activeIndex < 0) return;

    const activeNode = nodes.find(n => n.id === activeNodeId);
    if (!activeNode) return;
    const { parentId } = proj;

    // Full existing children of the target parent — read from childrenMap so we
    // include children hidden under a collapsed node. Renumbering only the
    // visible subset would collide sortOrders with the hidden ones.
    const existing = (childrenMap.get(parentId) || []).filter(n => n.id !== activeNodeId);

    // Insertion index: position among visible siblings when the target is
    // expanded; append to the end when it's collapsed (children off-screen).
    const parentCollapsed = parentId !== nodeId && collapsedIds.has(parentId);
    let insertIdx: number;
    if (parentCollapsed) {
      insertIdx = existing.length;
    } else {
      const moved = arrayMove(items, activeIndex, overIndex);
      const activeSlot = moved.findIndex(i => i.id === activeNodeId);
      insertIdx = moved
        .slice(0, activeSlot)
        .filter(i => i.id !== activeNodeId && i.parentId === parentId).length;
    }

    const newOrder = [...existing];
    newOrder.splice(insertIdx, 0, activeNode);

    if (activeNode.parentId !== parentId && onReparentNode) {
      onReparentNode(activeNodeId, parentId);
    }
    newOrder.forEach((child, idx) => {
      if ((child.sortOrder ?? -1) !== idx) onUpdateNode(child.id, { sortOrder: idx });
    });
  }, [nodes, childrenMap, collapsedIds, nodeId, onReparentNode, onUpdateNode, resetDrag]);

  const toggleCollapse = (id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleComplete = (id: string) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    onUpdateNode(id, {
      status: node.status === NodeStatus.COMPLETED ? NodeStatus.PENDING : NodeStatus.COMPLETED,
    });
  };

  const startEditing = (node: GoalNode) => {
    setEditingId(node.id);
    setEditText(node.text);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const commitEdit = () => {
    if (editingId && editText.trim()) {
      onUpdateNode(editingId, { text: editText.trim() });
    }
    setEditingId(null);
    setEditText('');
  };

  const startAddingChild = (parentId: string) => {
    setAddingToId(parentId);
    setNewSubText('');
    // 펼치기
    setCollapsedIds(prev => {
      const next = new Set(prev);
      next.delete(parentId);
      return next;
    });
    setTimeout(() => addInputRef.current?.focus(), 50);
  };

  const commitAdd = () => {
    if (addingToId && newSubText.trim()) {
      onAddSubNode(addingToId, newSubText.trim());
      setNewSubText('');
      // 포커스 유지해서 연속 입력
      setTimeout(() => addInputRef.current?.focus(), 50);
    }
  };

  const cancelAdd = () => {
    setAddingToId(null);
    setNewSubText('');
  };

  // 완료 카운트
  const countAll = (treeNodes: TreeNode[]): { total: number; done: number } => {
    let total = 0, done = 0;
    for (const tn of treeNodes) {
      total++;
      if (tn.node.status === NodeStatus.COMPLETED) done++;
      const sub = countAll(tn.children);
      total += sub.total;
      done += sub.done;
    }
    return { total, done };
  };
  const stats = countAll(tree);

  const renderInlineAddInput = (depth: number) => (
    <div
      className="flex items-center gap-2 py-1.5 px-3 animate-[treeItemIn_0.2s_ease-out_both]"
      style={{ paddingLeft: `${depth * INDENT + BASE + INDENT}px` }}
    >
      <div className="w-5 shrink-0" />
      <form
        className="flex-1 flex items-center gap-1.5"
        onSubmit={(e) => { e.preventDefault(); commitAdd(); }}
      >
        <input
          ref={addInputRef}
          type="text"
          value={newSubText}
          onChange={(e) => setNewSubText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') cancelAdd(); }}
          placeholder="하위 목표 입력..."
          className="flex-1 bg-white/[0.04] border border-white/[0.12] rounded-lg px-2.5 py-1.5
            text-[13px] text-white/80 placeholder-white/20
            focus:outline-none focus:border-th-accent/50 focus:bg-white/[0.06]
            transition-all duration-200"
        />
        <button
          type="submit"
          disabled={!newSubText.trim()}
          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0
            bg-th-accent/80 text-white text-xs
            disabled:opacity-20 disabled:cursor-default
            hover:bg-th-accent transition-all duration-200"
        >
          <Plus size={12} strokeWidth={2.5} />
        </button>
      </form>
    </div>
  );

  const rowHandlers: RowHandlers = {
    collapsedIds, editingId, addingToId, editText, editInputRef,
    todoTitle: t.mindmap.todo,
    onToggleCollapse: toggleCollapse,
    onToggleComplete: toggleComplete,
    onStartEditing: startEditing,
    onCommitEdit: commitEdit,
    onCancelEdit: () => { setEditingId(null); setEditText(''); },
    onChangeEditText: setEditText,
    onStartAddingChild: startAddingChild,
    onConvertNodeToTask,
    onDeleteNode,
    renderInlineAddInput,
  };

  const bgStyle = targetNode.imageUrl
    ? { backgroundImage: `url(${targetNode.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: 'linear-gradient(135deg, #312e81 0%, #5b21b6 40%, #7c3aed 100%)' };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center animate-[fadeIn_0.2s_ease-out]">
      {/* 배경 */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* 모달 */}
      <div className="relative w-full max-w-lg mx-4 max-h-[85vh]
        bg-[#0d0f14] rounded-[28px] overflow-hidden
        shadow-[0_32px_80px_-20px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.06)]
        flex flex-col
        animate-[modalIn_0.35s_cubic-bezier(0.16,1,0.3,1)_both]">

        {/* 히어로 이미지 영역 */}
        <div className="relative w-full h-56 shrink-0" style={bgStyle}>
          {/* 시네마틱 비네트 */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(0,0,0,0.4)_100%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0f14] via-transparent to-black/20" />

          {/* 닫기 */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full
              bg-black/30 backdrop-blur-md border border-white/10
              flex items-center justify-center text-white/60 hover:text-white
              hover:bg-black/50 transition-all duration-200"
          >
            <X size={14} strokeWidth={2.5} />
          </button>

          {/* 이미지 액션 (히어로 좌상단) */}
          {(onGenerateImage || onInsertImage) && (
            <div className="absolute top-4 left-4 flex items-center gap-2">
              {onGenerateImage && (
                <button
                  onClick={() => onGenerateImage(nodeId)}
                  disabled={imageLoadingNodes?.has(nodeId)}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-semibold
                    bg-th-accent/85 text-white backdrop-blur-md border border-white/15
                    hover:bg-th-accent disabled:opacity-60 transition-all duration-200"
                >
                  {imageLoadingNodes?.has(nodeId)
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Sparkles size={13} />}
                  {t.mindmap.generate}
                </button>
              )}
              {onInsertImage && (
                <button
                  onClick={() => onInsertImage(nodeId)}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-semibold
                    bg-black/35 text-white/80 backdrop-blur-md border border-white/15
                    hover:text-white hover:bg-black/55 transition-all duration-200"
                >
                  <ImagePlus size={13} />
                  {t.mindmap.insertImage}
                </button>
              )}
            </div>
          )}

          {/* 제목 영역 */}
          <div className="absolute bottom-0 left-0 right-0 px-6 pb-5">
            <h2 className="text-[22px] font-bold text-white tracking-tight
              drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
              {targetNode.text}
            </h2>
            {stats.total > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <div className="h-[3px] flex-1 max-w-[120px] bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400/80 rounded-full transition-all duration-700"
                    style={{ width: `${stats.total > 0 ? (stats.done / stats.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-[10px] text-white/30 font-mono tabular-nums">
                  {stats.done}/{stats.total}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 액션 툴바 — 어느 뷰에서든 동일한 노드 컨트롤 */}
        {(onExploreWithAI || onConvertNodeToTask
          || (onDeleteNode && targetNode.type !== NodeType.ROOT)) && (
          <div className="shrink-0 flex items-center gap-2 px-4 py-2.5
            border-b border-white/[0.06] overflow-x-auto scrollbar-hide">
            {onExploreWithAI && (
              <button
                onClick={() => onExploreWithAI(nodeId)}
                className="flex items-center gap-1.5 shrink-0 h-9 px-3.5 rounded-xl text-[13px]
                  bg-white/[0.04] border border-white/[0.08] text-white/75
                  hover:text-white hover:bg-white/[0.08] transition-all duration-200"
              >
                <MessageCircle size={15} /> {t.mindmap.exploreWithAI}
              </button>
            )}
            {onConvertNodeToTask && (
              <button
                onClick={() => onConvertNodeToTask(nodeId)}
                className="flex items-center gap-1.5 shrink-0 h-9 px-3.5 rounded-xl text-[13px]
                  bg-white/[0.04] border border-white/[0.08] text-white/75
                  hover:text-white hover:bg-white/[0.08] transition-all duration-200"
              >
                <ListTodo size={15} /> {t.mindmap.todo}
              </button>
            )}
            {onDecomposeGoal && (
              <button
                onClick={() => onDecomposeGoal(nodeId)}
                disabled={decomposingNodeId === nodeId}
                className="flex items-center gap-1.5 shrink-0 h-9 px-3.5 rounded-xl text-[13px]
                  bg-white/[0.04] border border-white/[0.08] text-white/75
                  hover:text-white hover:bg-white/[0.08] disabled:opacity-50 transition-all duration-200"
              >
                {decomposingNodeId === nodeId
                  ? <Loader2 size={15} className="animate-spin" />
                  : <GitBranch size={15} />}
                {t.mindmap.decompose}
              </button>
            )}
            {onReparentNode && targetNode.type !== NodeType.ROOT && moveTargets.length > 0 && (
              <button
                onClick={() => setMoveOpen(v => !v)}
                className={`flex items-center gap-1.5 shrink-0 h-9 px-3.5 rounded-xl text-[13px]
                  border transition-all duration-200 ${moveOpen
                    ? 'bg-th-accent-muted border-th-accent-border text-th-accent'
                    : 'bg-white/[0.04] border-white/[0.08] text-white/75 hover:text-white hover:bg-white/[0.08]'
                  }`}
              >
                <Move size={15} /> {t.mindmap.move}
              </button>
            )}
            {onDeleteNode && targetNode.type !== NodeType.ROOT && (
              <button
                onClick={() => { onDeleteNode(nodeId); onClose(); }}
                className="flex items-center gap-1.5 shrink-0 h-9 px-3.5 rounded-xl text-[13px]
                  bg-red-500/[0.08] border border-red-400/20 text-red-300/90
                  hover:text-red-200 hover:bg-red-500/[0.14] transition-all duration-200"
              >
                <Trash2 size={15} /> {t.mindmap.delete}
              </button>
            )}
          </div>
        )}

        {/* 이동 대상 선택 (이동 토글) */}
        {moveOpen && onReparentNode && (
          <div className="shrink-0 max-h-[42%] overflow-y-auto px-3 py-3
            border-b border-white/[0.06] bg-white/[0.02]
            scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
            <p className="text-[11px] text-white/35 px-2 pb-1.5 uppercase tracking-wider">
              {t.mindmap.move}
            </p>
            {moveTargets.map(n => (
              <button
                key={n.id}
                onClick={() => { onReparentNode(nodeId, n.id); setMoveOpen(false); }}
                className="w-full text-left px-3 py-2.5 rounded-lg text-[13px] text-white/80
                  hover:bg-th-accent-muted hover:text-th-accent transition-colors duration-150"
              >
                {n.text || t.mindmap.defaultRootText}
              </button>
            ))}
          </div>
        )}

        {/* 트리 리스트 */}
        <div className="flex-1 overflow-y-auto py-3 px-2
          scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
          {tree.length === 0 && addingToId !== nodeId ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Circle size={32} className="text-white/10" strokeWidth={1} />
              <p className="text-[13px] text-white/20">{t.mindmap.noSubGoals}</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onDragCancel={resetDrag}
            >
              <SortableContext
                items={visibleItems.map(i => i.id)}
                strategy={verticalListSortingStrategy}
              >
                {visibleItems.map(item => (
                  <SortableTreeRow
                    key={item.id}
                    item={item}
                    renderDepth={item.id === activeId && projected ? projected.depth : item.depth}
                    isActiveDrag={item.id === activeId}
                    handlers={rowHandlers}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}

          {/* 루트 레벨 인라인 추가 (addingToId가 모달 루트일 때) */}
          {addingToId === nodeId && renderInlineAddInput(0)}
        </div>

        {/* 하위 목표 추가 버튼 (하단 고정) */}
        <div className="shrink-0 px-4 py-3 border-t border-white/[0.06]">
          <button
            onClick={() => startAddingChild(nodeId)}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl
              text-white/30 hover:text-white/60 hover:bg-white/[0.04]
              transition-all duration-200 text-[13px]"
          >
            <Plus size={14} strokeWidth={2} />
            <span>하위 목표 추가</span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.94) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes treeItemIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default GoalDetailModal;
