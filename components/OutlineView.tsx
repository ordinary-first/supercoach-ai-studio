import React, { useState, useCallback, useMemo, useRef, useEffect, KeyboardEvent } from 'react';
import { GoalNode, GoalLink, NodeType, NodeStatus } from '../types';
import {
  ChevronRight, ChevronDown, Plus, Trash2, Pencil,
  GitBranchPlus, GripVertical, MessageCircle, ListTodo, GitBranch, Loader2,
} from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
  DragStartEvent, DragMoveEvent, DragEndEvent, MeasuringStrategy,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from '../i18n/useTranslation';

/* ───────────────────────── Types ───────────────────────── */

interface OutlineViewProps {
  nodes: GoalNode[];
  links: GoalLink[];
  onUpdateNode: (nodeId: string, updates: Partial<GoalNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  onAddSubNode: (parentId: string, text?: string) => void;
  onReparentNode?: (childId: string, newParentId: string) => void;
  onAddParentNode?: (nodeId: string) => void;
  onExploreWithAI?: (nodeId: string) => void;
  onConvertNodeToTask?: (nodeId: string) => void;
  onDecomposeGoal?: (nodeId: string) => void;
  decomposingNodeId?: string | null;
}

/** A node flattened into the visible, ordered list (root excluded) */
interface FlatItem {
  id: string;
  node: GoalNode;
  depth: number;        // root's direct children = 1
  parentId: string;     // always set (root id at minimum)
  hasChildren: boolean;
  childCount: number;
}

const INDENT = 22;
const BASE = 12;

/* ──────────────────────── Helpers ──────────────────────── */

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

/** Flatten visible descendants of root into a depth-first ordered list. */
function flattenVisible(rootId: string, childrenMap: Map<string, GoalNode[]>): FlatItem[] {
  const out: FlatItem[] = [];
  const walk = (parentId: string, depth: number) => {
    for (const node of childrenMap.get(parentId) || []) {
      const kids = childrenMap.get(node.id) || [];
      out.push({
        id: node.id, node, depth, parentId,
        hasChildren: kids.length > 0, childCount: kids.length,
      });
      if (kids.length > 0 && !node.collapsed) walk(node.id, depth + 1);
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

/** dnd-kit "sortable tree" projection, adapted: single forced root, min depth 1. */
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

function getSiblings(nodes: GoalNode[], node: GoalNode): GoalNode[] {
  if (!node.parentId) return [];
  return nodes
    .filter(n => n.parentId === node.parentId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/* ────────────────────── Inline Edit ───────────────────── */

function InlineEdit({ value, onSave, onCancel, onNewSibling, className }: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
  onNewSibling?: () => void;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (text.trim()) {
        onSave(text.trim());
        onNewSibling?.();
      } else {
        onCancel();
      }
    }
  };

  return (
    <input
      ref={ref}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { if (text.trim()) onSave(text.trim()); else onCancel(); }}
      onKeyDown={handleKeyDown}
      className={`flex-1 bg-transparent border-b border-th-accent/50
        focus:outline-none focus:border-th-accent
        transition-colors ${className || 'text-sm text-th-text'}`}
    />
  );
}

/* ─────────────────── Sub-node Row (sortable) ────────────────── */

interface RowHandlers {
  focusedId: string | null;
  onFocus: (id: string) => void;
  onUpdateNode: (nodeId: string, updates: Partial<GoalNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  onAddSubNode: (parentId: string, text?: string) => void;
  onAddParentNode?: (nodeId: string) => void;
  onToggleCollapse: (node: GoalNode) => void;
  onMoveUp: (nodeId: string) => void;
  onMoveDown: (nodeId: string) => void;
  onIndent: (nodeId: string) => void;
  onOutdent: (nodeId: string) => void;
  onExploreWithAI?: (nodeId: string) => void;
  onConvertNodeToTask?: (nodeId: string) => void;
  onDecomposeGoal?: (nodeId: string) => void;
  decomposingId?: string | null;
}

function OutlineRow({
  item, renderDepth, isActiveDrag, handlers,
}: {
  item: FlatItem;
  renderDepth: number;
  isActiveDrag: boolean;
  handlers: RowHandlers;
}) {
  const { node, hasChildren, childCount } = item;
  const {
    focusedId, onFocus, onUpdateNode, onDeleteNode, onAddSubNode,
    onAddParentNode, onToggleCollapse, onMoveUp, onMoveDown, onIndent, onOutdent,
    onExploreWithAI, onConvertNodeToTask, onDecomposeGoal, decomposingId,
  } = handlers;
  const { t } = useTranslation();

  const [editing, setEditing] = useState(false);
  const isFocused = focusedId === node.id;
  const rowRef = useRef<HTMLDivElement>(null);

  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: node.id });

  const isCompleted = node.status === NodeStatus.COMPLETED;
  const isStuck = node.status === NodeStatus.STUCK;
  const collapsed = !!node.collapsed;
  const progressPct = hasChildren && node.progress > 0 ? Math.round(node.progress * 100) : 0;

  // Depth-based typography
  const textSize = renderDepth === 1 ? 'text-[15px]' : renderDepth === 2 ? 'text-[14px]' : 'text-[13px]';
  const textWeight = renderDepth === 1
    ? 'font-semibold'
    : (renderDepth === 2 || hasChildren) ? 'font-medium' : 'font-normal';
  const textColor = renderDepth <= 2 || hasChildren ? 'text-th-text' : 'text-th-text-secondary';

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (editing) return;
    const { key, altKey, shiftKey } = e;
    if (key === 'Enter' && !altKey && !shiftKey) { e.preventDefault(); setEditing(true); }
    if (key === 'Tab' && !altKey) {
      e.preventDefault();
      if (shiftKey) onOutdent(node.id); else onIndent(node.id);
    }
    if (key === 'ArrowUp' && altKey) { e.preventDefault(); onMoveUp(node.id); }
    if (key === 'ArrowDown' && altKey) { e.preventDefault(); onMoveDown(node.id); }
    if ((key === 'Delete' || key === 'Backspace')) { e.preventDefault(); onDeleteNode(node.id); }
    if (key === 'ArrowRight' && hasChildren && collapsed) { e.preventDefault(); onToggleCollapse(node); }
    if (key === 'ArrowLeft' && hasChildren && !collapsed) { e.preventDefault(); onToggleCollapse(node); }
  }, [editing, node, hasChildren, collapsed, onMoveUp, onMoveDown, onIndent, onOutdent, onDeleteNode, onToggleCollapse]);

  useEffect(() => {
    if (isFocused && rowRef.current) {
      rowRef.current.focus();
      rowRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isFocused]);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft: `${renderDepth * INDENT + BASE}px`,
  };

  // Ancestor guide rails (one per ancestor level above this row)
  const rails = [];
  for (let lvl = 1; lvl < renderDepth; lvl += 1) {
    rails.push(
      <span
        key={lvl}
        aria-hidden
        className="absolute top-0 bottom-0 w-px"
        style={{ left: `${lvl * INDENT + BASE + 6}px`, backgroundColor: 'var(--border-subtle)' }}
      />,
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`outline-sub relative ${isDragging ? 'opacity-50' : ''}`}
    >
      {rails}
      <div
        ref={rowRef}
        tabIndex={0}
        onFocus={() => onFocus(node.id)}
        onKeyDown={handleKeyDown}
        className={`group flex items-center gap-1 py-[10px] pr-3 rounded-lg
          transition-colors duration-150 outline-none cursor-default
          ${isActiveDrag
            ? 'bg-th-surface shadow-lg ring-1 ring-th-accent/40'
            : isFocused
              ? 'bg-th-accent/[0.06] ring-1 ring-th-accent/20'
              : 'hover:bg-white/[0.025]'}
          ${isCompleted ? 'opacity-45' : ''}`}
      >
        {/* Drag grip — reveals on hover/focus */}
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className={`w-4 h-5 -ml-1 flex items-center justify-center flex-shrink-0
            cursor-grab active:cursor-grabbing touch-none
            text-th-text-muted/70 hover:text-th-accent transition-opacity
            ${isFocused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={13} />
        </button>

        {/* Collapse toggle / bullet */}
        {hasChildren ? (
          <button onClick={(e) => { e.stopPropagation(); onToggleCollapse(node); }}
            className="w-5 h-5 flex items-center justify-center rounded
              text-th-text-muted hover:text-th-text transition-colors flex-shrink-0">
            {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
        ) : (
          <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            <span className={`w-[5px] h-[5px] rounded-full transition-colors ${
              isCompleted ? 'bg-emerald-400'
                : isStuck ? 'bg-red-400'
                : 'bg-th-text-muted/50 group-hover:bg-th-accent'
            }`} />
          </span>
        )}

        {/* Text */}
        {editing ? (
          <InlineEdit
            value={node.text}
            className={`${textSize} ${textWeight} text-th-text`}
            onSave={(v) => { onUpdateNode(node.id, { text: v }); setEditing(false); }}
            onCancel={() => setEditing(false)}
            onNewSibling={() => { if (node.parentId) onAddSubNode(node.parentId); }}
          />
        ) : (
          <span
            className={`flex-1 min-w-0 ${textSize} ${textWeight} ${textColor}
              leading-relaxed cursor-text truncate
              ${isCompleted ? 'line-through' : ''}
              hover:text-th-accent transition-colors`}
            onClick={() => onFocus(node.id)}
            onDoubleClick={() => setEditing(true)}
          >
            {node.text}
          </span>
        )}

        {/* Progress */}
        {progressPct > 0 && (
          <span className={`text-[9px] font-mono px-1.5 py-px rounded-full flex-shrink-0
            ${progressPct >= 100
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-white/[0.04] text-th-text-muted'}`}>
            {progressPct}%
          </span>
        )}

        {/* Collapsed child count */}
        {hasChildren && collapsed && (
          <span className="flex items-center gap-0.5 text-[9px] text-th-text-muted
            bg-white/[0.04] rounded px-1.5 py-px flex-shrink-0">
            <ChevronRight size={8} />{childCount}
          </span>
        )}

        {/* Hover/focus actions */}
        <div className={`flex items-center gap-px flex-shrink-0 transition-opacity
          ${isFocused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          {onAddParentNode && (
            <button onClick={(e) => { e.stopPropagation(); onAddParentNode(node.id); }}
              className="p-0.5 rounded text-th-text-muted hover:text-purple-400 hover:bg-purple-400/10 transition-colors"
              title={t.mindmap.addParent}><GitBranchPlus size={11} /></button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onAddSubNode(node.id); }}
            className="p-0.5 rounded text-th-text-muted hover:text-th-accent hover:bg-th-accent/10 transition-colors"
            title={t.mindmap.addChild}><Plus size={11} /></button>
          {onExploreWithAI && (
            <button onClick={(e) => { e.stopPropagation(); onExploreWithAI(node.id); }}
              className="p-0.5 rounded text-th-text-muted hover:text-th-accent hover:bg-th-accent/10 transition-colors"
              title={t.mindmap.exploreWithAI}><MessageCircle size={11} /></button>
          )}
          {onConvertNodeToTask && (
            <button onClick={(e) => { e.stopPropagation(); onConvertNodeToTask(node.id); }}
              className="p-0.5 rounded text-th-text-muted hover:text-th-accent hover:bg-th-accent/10 transition-colors"
              title={t.mindmap.todo}><ListTodo size={11} /></button>
          )}
          {onDecomposeGoal && (
            <button onClick={(e) => { e.stopPropagation(); onDecomposeGoal(node.id); }}
              disabled={decomposingId === node.id}
              className="p-0.5 rounded text-th-text-muted hover:text-th-accent hover:bg-th-accent/10 disabled:opacity-50 transition-colors"
              title={t.mindmap.decompose}>
              {decomposingId === node.id
                ? <Loader2 size={11} className="animate-spin" />
                : <GitBranch size={11} />}
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onDeleteNode(node.id); }}
            className="p-0.5 rounded text-th-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
            title={t.mindmap.delete}><Trash2 size={11} /></button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────── Main Component ───────────────────── */

const OutlineView: React.FC<OutlineViewProps> = ({
  nodes, onUpdateNode, onDeleteNode, onAddSubNode,
  onReparentNode, onAddParentNode,
  onExploreWithAI, onConvertNodeToTask, onDecomposeGoal, decomposingNodeId,
}) => {
  const { t } = useTranslation();
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [rootEditing, setRootEditing] = useState(false);

  const root = useMemo(() => nodes.find(n => n.type === NodeType.ROOT) || null, [nodes]);
  const childrenMap = useMemo(() => buildChildrenMap(nodes), [nodes]);
  const flatItems = useMemo(
    () => (root ? flattenVisible(root.id, childrenMap) : []),
    [root, childrenMap],
  );

  /* ── Drag state ── */
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
    () => (root && activeId && overId
      ? getProjection(visibleItems, activeId, overId, offsetLeft, root.id)
      : null),
    [root, activeId, overId, offsetLeft, visibleItems],
  );

  // Mirror for the (sync) drag-end handler
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
    setFocusedId(String(e.active.id));
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
    if (!proj || !overNodeId || !root) return;

    const overIndex = items.findIndex(i => i.id === overNodeId);
    const activeIndex = items.findIndex(i => i.id === activeNodeId);
    if (overIndex < 0 || activeIndex < 0) return;

    const activeNode = nodes.find(n => n.id === activeNodeId);
    if (!activeNode) return;
    const { parentId } = proj;

    // Full existing children of the target parent — read from childrenMap so we
    // include children that are hidden under a collapsed node. Renumbering only
    // the *visible* subset would collide sortOrders with the hidden ones.
    const existing = (childrenMap.get(parentId) || []).filter(n => n.id !== activeNodeId);

    // Insertion index: position among visible siblings when the target is
    // expanded; append to the end when it's collapsed (children not on screen).
    const parentNode = parentId === root.id ? root : nodes.find(n => n.id === parentId);
    let insertIdx: number;
    if (parentNode?.collapsed) {
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
  }, [nodes, root, childrenMap, onReparentNode, onUpdateNode, resetDrag]);

  /* ── Reorder / reparent (buttons + keyboard) ── */
  const handleMoveUp = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node?.parentId) return;
    const siblings = getSiblings(nodes, node);
    const idx = siblings.findIndex(s => s.id === nodeId);
    if (idx <= 0) return;
    const prev = siblings[idx - 1];
    onUpdateNode(nodeId, { sortOrder: prev.sortOrder ?? (idx - 1) });
    onUpdateNode(prev.id, { sortOrder: node.sortOrder ?? idx });
  }, [nodes, onUpdateNode]);

  const handleMoveDown = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node?.parentId) return;
    const siblings = getSiblings(nodes, node);
    const idx = siblings.findIndex(s => s.id === nodeId);
    if (idx < 0 || idx >= siblings.length - 1) return;
    const next = siblings[idx + 1];
    onUpdateNode(nodeId, { sortOrder: next.sortOrder ?? (idx + 1) });
    onUpdateNode(next.id, { sortOrder: node.sortOrder ?? idx });
  }, [nodes, onUpdateNode]);

  const handleIndent = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node?.parentId || !onReparentNode) return;
    const siblings = getSiblings(nodes, node);
    const idx = siblings.findIndex(s => s.id === nodeId);
    if (idx <= 0) return;
    const newParent = siblings[idx - 1];
    const newSiblings = nodes.filter(n => n.parentId === newParent.id);
    onUpdateNode(nodeId, { sortOrder: newSiblings.length });
    onReparentNode(nodeId, newParent.id);
  }, [nodes, onUpdateNode, onReparentNode]);

  const handleOutdent = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node?.parentId || !onReparentNode) return;
    const parent = nodes.find(n => n.id === node.parentId);
    if (!parent?.parentId) return; // can't outdent past root
    const grandParentId = parent.parentId;
    // Place the node right after its old parent among the grandparent's children
    // and renumber to clean integers — avoids fractional/duplicate sortOrders.
    const gpChildren = (childrenMap.get(grandParentId) || []).filter(n => n.id !== nodeId);
    const parentIdx = gpChildren.findIndex(n => n.id === parent.id);
    const insertIdx = parentIdx < 0 ? gpChildren.length : parentIdx + 1;
    const newOrder = [...gpChildren];
    newOrder.splice(insertIdx, 0, node);
    onReparentNode(nodeId, grandParentId);
    newOrder.forEach((child, idx) => {
      if ((child.sortOrder ?? -1) !== idx) onUpdateNode(child.id, { sortOrder: idx });
    });
  }, [nodes, childrenMap, onUpdateNode, onReparentNode]);

  const handleToggleCollapse = useCallback((node: GoalNode) => {
    onUpdateNode(node.id, { collapsed: !node.collapsed });
  }, [onUpdateNode]);

  const rowHandlers: RowHandlers = {
    focusedId, onFocus: setFocusedId,
    onUpdateNode, onDeleteNode, onAddSubNode, onAddParentNode,
    onToggleCollapse: handleToggleCollapse,
    onMoveUp: handleMoveUp, onMoveDown: handleMoveDown,
    onIndent: handleIndent, onOutdent: handleOutdent,
    onExploreWithAI, onConvertNodeToTask, onDecomposeGoal, decomposingId: decomposingNodeId,
  };

  if (!root) {
    return (
      <div className="flex-1 flex items-center justify-center text-th-text-muted">
        <p>{t.mindmap.defaultRootText}</p>
      </div>
    );
  }

  const rootChildCount = (childrenMap.get(root.id) || []).length;
  const rootCollapsed = !!root.collapsed;

  return (
    <div className="flex-1 overflow-y-auto bg-th-base scrollbar-hide">
      <div className="max-w-2xl mx-auto pt-16 pb-8 px-3 md:px-4">
        {/* Root row */}
        <div
          tabIndex={0}
          onFocus={() => setFocusedId(root.id)}
          className={`group flex items-center gap-3 py-3.5 px-4 mb-2 rounded-xl
            transition-colors duration-200 outline-none
            ${focusedId === root.id ? 'ring-1 ring-th-accent/30 bg-th-accent/[0.04]' : 'hover:bg-white/[0.02]'}`}
        >
          {rootChildCount > 0 && (
            <button onClick={() => handleToggleCollapse(root)}
              className="w-6 h-6 flex items-center justify-center rounded-md
                text-th-text-muted hover:text-th-text transition-colors flex-shrink-0">
              {rootCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
            </button>
          )}
          {rootEditing ? (
            <InlineEdit
              value={root.text}
              className="text-lg font-semibold text-th-text"
              onSave={(v) => { onUpdateNode(root.id, { text: v }); setRootEditing(false); }}
              onCancel={() => setRootEditing(false)}
            />
          ) : (
            <span
              className="flex-1 text-lg font-semibold text-th-text cursor-text
                hover:text-th-accent transition-colors truncate"
              onClick={() => setFocusedId(root.id)}
              onDoubleClick={() => setRootEditing(true)}
            >
              {root.text || 'My Vision'}
            </span>
          )}
          {rootChildCount > 0 && (
            <span className="text-[10px] text-th-text-muted tabular-nums">{rootChildCount}</span>
          )}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setRootEditing(true)}
              className="p-1 rounded-md text-th-text-muted hover:text-th-text hover:bg-white/[0.06] transition-colors">
              <Pencil size={12} />
            </button>
            <button onClick={() => onAddSubNode(root.id)}
              className="p-1 rounded-md text-th-text-muted hover:text-th-accent hover:bg-th-accent/10 transition-colors">
              <Plus size={13} />
            </button>
          </div>
        </div>

        {/* Sortable descendants */}
        {!rootCollapsed && (
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
                <OutlineRow
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
      </div>
    </div>
  );
};

export default OutlineView;
