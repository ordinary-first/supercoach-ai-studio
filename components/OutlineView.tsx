import React, { useState, useCallback, useMemo, useRef, useEffect, KeyboardEvent } from 'react';
import { GoalNode, GoalLink, NodeType, NodeStatus } from '../types';
import {
  ChevronRight, ChevronDown, Plus, Trash2, Pencil,
  MoveUp, MoveDown, CornerDownRight, CornerUpLeft, GitBranchPlus,
} from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

/* ───────────────────────── Types ───────────────────────── */

interface OutlineViewProps {
  nodes: GoalNode[];
  links: GoalLink[];
  onNodeClick: (node: GoalNode) => void;
  onUpdateNode: (nodeId: string, updates: Partial<GoalNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  onAddSubNode: (parentId: string, text?: string) => void;
  onReparentNode?: (childId: string, newParentId: string) => void;
  onAddParentNode?: (nodeId: string) => void;
}

interface TreeNode {
  node: GoalNode;
  children: TreeNode[];
}

/* ──────────────────────── Helpers ──────────────────────── */

function buildTree(nodes: GoalNode[]): TreeNode | null {
  const root = nodes.find(n => n.type === NodeType.ROOT);
  if (!root) return null;
  const childrenMap = new Map<string, GoalNode[]>();
  for (const n of nodes) {
    if (n.parentId) {
      const arr = childrenMap.get(n.parentId) || [];
      arr.push(n);
      childrenMap.set(n.parentId, arr);
    }
  }
  function build(node: GoalNode): TreeNode {
    const children = (childrenMap.get(node.id) || [])
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(child => build(child));
    return { node, children };
  }
  return build(root);
}

/** Flatten tree into ordered list for keyboard navigation */
function flattenTree(tree: TreeNode, collapsedSet: Set<string>): GoalNode[] {
  const result: GoalNode[] = [];
  function walk(tn: TreeNode) {
    result.push(tn.node);
    if (!collapsedSet.has(tn.node.id)) {
      for (const child of tn.children) walk(child);
    }
  }
  walk(tree);
  return result;
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

/* ─────────────────── Single Outline Row ────────────────── */

function OutlineItem({
  treeNode,
  depth,
  focusedId,
  onFocus,
  onNodeClick,
  onUpdateNode,
  onDeleteNode,
  onAddSubNode,
  onReparentNode,
  onAddParentNode,
  onMoveUp,
  onMoveDown,
  onIndent,
  onOutdent,
  allNodes,
}: {
  treeNode: TreeNode;
  depth: number;
  focusedId: string | null;
  onFocus: (id: string) => void;
  onNodeClick: (node: GoalNode) => void;
  onUpdateNode: (nodeId: string, updates: Partial<GoalNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  onAddSubNode: (parentId: string, text?: string) => void;
  onReparentNode?: (childId: string, newParentId: string) => void;
  onAddParentNode?: (nodeId: string) => void;
  onMoveUp: (nodeId: string) => void;
  onMoveDown: (nodeId: string) => void;
  onIndent: (nodeId: string) => void;
  onOutdent: (nodeId: string) => void;
  allNodes: GoalNode[];
}) {
  const { node, children } = treeNode;
  const isRoot = node.type === NodeType.ROOT;
  const hasChildren = children.length > 0;
  const [collapsed, setCollapsed] = useState(!!node.collapsed);
  const [editing, setEditing] = useState(false);
  const isFocused = focusedId === node.id;
  const rowRef = useRef<HTMLDivElement>(null);

  const toggleCollapse = useCallback(() => {
    const v = !collapsed;
    setCollapsed(v);
    onUpdateNode(node.id, { collapsed: v });
  }, [collapsed, node.id, onUpdateNode]);

  // Keyboard shortcuts on focused row
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (editing) return;
    const { key, altKey, shiftKey } = e;

    if (key === 'Enter' && !altKey && !shiftKey) {
      e.preventDefault();
      setEditing(true);
    }
    if (key === 'Tab' && !altKey) {
      e.preventDefault();
      if (shiftKey) onOutdent(node.id);
      else onIndent(node.id);
    }
    if (key === 'ArrowUp' && altKey) { e.preventDefault(); onMoveUp(node.id); }
    if (key === 'ArrowDown' && altKey) { e.preventDefault(); onMoveDown(node.id); }
    if (key === 'Delete' || (key === 'Backspace' && !editing)) {
      if (!isRoot) { e.preventDefault(); onDeleteNode(node.id); }
    }
    if (key === 'ArrowRight' && hasChildren && collapsed) { e.preventDefault(); toggleCollapse(); }
    if (key === 'ArrowLeft' && hasChildren && !collapsed) { e.preventDefault(); toggleCollapse(); }
  }, [editing, node.id, isRoot, hasChildren, collapsed, onMoveUp, onMoveDown, onIndent, onOutdent, onDeleteNode, toggleCollapse]);

  useEffect(() => {
    if (isFocused && rowRef.current) {
      rowRef.current.focus();
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isFocused]);

  // Progress display
  const progressPct = hasChildren && node.progress > 0 ? Math.round(node.progress * 100) : 0;

  /* ── Root ── */
  if (isRoot) {
    return (
      <div className="outline-root">
        <div
          ref={rowRef}
          tabIndex={0}
          onFocus={() => onFocus(node.id)}
          onKeyDown={handleKeyDown}
          className={`group flex items-center gap-3 py-3.5 px-4 mb-3 rounded-xl
            transition-all duration-200 outline-none
            ${isFocused ? 'ring-1 ring-th-accent/30 bg-th-accent/[0.04]' : 'hover:bg-white/[0.02]'}`}
        >
          {hasChildren && (
            <button onClick={toggleCollapse}
              className="w-6 h-6 flex items-center justify-center rounded-md
                text-th-text-muted hover:text-th-text transition-colors flex-shrink-0">
              {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
            </button>
          )}

          {editing ? (
            <InlineEdit
              value={node.text}
              className="text-lg font-semibold text-th-text"
              onSave={(v) => { onUpdateNode(node.id, { text: v }); setEditing(false); }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <span
              className="flex-1 text-lg font-semibold text-th-text cursor-text
                hover:text-th-accent transition-colors truncate"
              onClick={() => onFocus(node.id)}
              onDoubleClick={() => setEditing(true)}
            >
              {node.text || 'My Vision'}
            </span>
          )}

          {hasChildren && (
            <span className="text-[10px] text-th-text-muted tabular-nums">
              {children.length}
            </span>
          )}

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setEditing(true)}
              className="p-1 rounded-md text-th-text-muted hover:text-th-text hover:bg-white/[0.06] transition-colors">
              <Pencil size={12} />
            </button>
            <button onClick={() => onAddSubNode(node.id)}
              className="p-1 rounded-md text-th-text-muted hover:text-th-accent hover:bg-th-accent/10 transition-colors">
              <Plus size={13} />
            </button>
          </div>
        </div>

        {!collapsed && children.map(child => (
          <OutlineItem
            key={child.node.id} treeNode={child} depth={1}
            focusedId={focusedId} onFocus={onFocus}
            onNodeClick={onNodeClick} onUpdateNode={onUpdateNode}
            onDeleteNode={onDeleteNode} onAddSubNode={onAddSubNode}
            onReparentNode={onReparentNode} onAddParentNode={onAddParentNode}
            onMoveUp={onMoveUp} onMoveDown={onMoveDown}
            onIndent={onIndent} onOutdent={onOutdent}
            allNodes={allNodes}
          />
        ))}
      </div>
    );
  }

  /* ── Sub node ── */
  const isCompleted = node.status === NodeStatus.COMPLETED;
  const isStuck = node.status === NodeStatus.STUCK;

  return (
    <div className="outline-sub">
      <div
        ref={rowRef}
        tabIndex={0}
        onFocus={() => onFocus(node.id)}
        onKeyDown={handleKeyDown}
        className={`group flex items-center gap-1.5 py-[7px] pr-3 rounded-lg
          transition-all duration-150 outline-none cursor-default
          ${isFocused
            ? 'bg-th-accent/[0.06] ring-1 ring-th-accent/20'
            : 'hover:bg-white/[0.025]'
          }
          ${isCompleted ? 'opacity-45' : ''}`}
        style={{ paddingLeft: `${depth * 22 + 12}px` }}
      >
        {/* Collapse / bullet */}
        {hasChildren ? (
          <button onClick={(e) => { e.stopPropagation(); toggleCollapse(); }}
            className="w-5 h-5 flex items-center justify-center rounded
              text-th-text-muted hover:text-th-text transition-colors flex-shrink-0">
            {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
        ) : (
          <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            <span className={`w-[5px] h-[5px] rounded-full ${
              isCompleted ? 'bg-emerald-400' : isStuck ? 'bg-red-400' : 'bg-th-text-muted/50'
            }`} />
          </span>
        )}

        {/* Text */}
        {editing ? (
          <InlineEdit
            value={node.text}
            className={`text-[13px] ${hasChildren ? 'font-medium' : 'font-normal'} text-th-text`}
            onSave={(v) => { onUpdateNode(node.id, { text: v }); setEditing(false); }}
            onCancel={() => setEditing(false)}
            onNewSibling={() => {
              if (node.parentId) onAddSubNode(node.parentId);
            }}
          />
        ) : (
          <span
            className={`flex-1 min-w-0 text-[13px] leading-relaxed cursor-text truncate
              ${hasChildren ? 'font-medium text-th-text' : 'text-th-text-secondary'}
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
              : 'bg-white/[0.04] text-th-text-muted'
            }`}>
            {progressPct}%
          </span>
        )}

        {/* Collapsed child count */}
        {hasChildren && collapsed && (
          <span className="text-[9px] text-th-text-muted bg-white/[0.04] rounded px-1.5 py-px flex-shrink-0">
            +{children.length}
          </span>
        )}

        {/* Actions — revealed on hover or focus */}
        <div className={`flex items-center gap-px flex-shrink-0 transition-opacity
          ${isFocused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <button onClick={(e) => { e.stopPropagation(); onMoveUp(node.id); }}
            className="p-0.5 rounded text-th-text-muted hover:text-th-text hover:bg-white/[0.06] transition-colors"
            title="Move up (Alt+↑)">
            <MoveUp size={11} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onMoveDown(node.id); }}
            className="p-0.5 rounded text-th-text-muted hover:text-th-text hover:bg-white/[0.06] transition-colors"
            title="Move down (Alt+↓)">
            <MoveDown size={11} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onIndent(node.id); }}
            className="p-0.5 rounded text-th-text-muted hover:text-th-text hover:bg-white/[0.06] transition-colors"
            title="Indent (Tab)">
            <CornerDownRight size={11} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onOutdent(node.id); }}
            className="p-0.5 rounded text-th-text-muted hover:text-th-text hover:bg-white/[0.06] transition-colors"
            title="Outdent (Shift+Tab)">
            <CornerUpLeft size={11} />
          </button>
          {onAddParentNode && (
            <button onClick={(e) => { e.stopPropagation(); onAddParentNode(node.id); }}
              className="p-0.5 rounded text-th-text-muted hover:text-purple-400 hover:bg-purple-400/10 transition-colors"
              title="Insert parent">
              <GitBranchPlus size={11} />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onAddSubNode(node.id); }}
            className="p-0.5 rounded text-th-text-muted hover:text-th-accent hover:bg-th-accent/10 transition-colors"
            title="Add child">
            <Plus size={11} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDeleteNode(node.id); }}
            className="p-0.5 rounded text-th-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
            title="Delete">
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Children */}
      {!collapsed && children.map(child => (
        <OutlineItem
          key={child.node.id} treeNode={child} depth={depth + 1}
          focusedId={focusedId} onFocus={onFocus}
          onNodeClick={onNodeClick} onUpdateNode={onUpdateNode}
          onDeleteNode={onDeleteNode} onAddSubNode={onAddSubNode}
          onReparentNode={onReparentNode} onAddParentNode={onAddParentNode}
          onMoveUp={onMoveUp} onMoveDown={onMoveDown}
          onIndent={onIndent} onOutdent={onOutdent}
          allNodes={allNodes}
        />
      ))}
    </div>
  );
}

/* ──────────────────── Main Component ───────────────────── */

const OutlineView: React.FC<OutlineViewProps> = ({
  nodes, links, onNodeClick, onUpdateNode, onDeleteNode, onAddSubNode,
  onReparentNode, onAddParentNode,
}) => {
  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const { t } = useTranslation();
  const [focusedId, setFocusedId] = useState<string | null>(null);

  /* ── Move up/down among siblings ── */
  const handleMoveUp = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node?.parentId) return;
    const siblings = getSiblings(nodes, node);
    const idx = siblings.findIndex(s => s.id === nodeId);
    if (idx <= 0) return;
    // Swap sortOrders
    const prev = siblings[idx - 1];
    const curOrder = node.sortOrder ?? idx;
    const prevOrder = prev.sortOrder ?? (idx - 1);
    onUpdateNode(nodeId, { sortOrder: prevOrder });
    onUpdateNode(prev.id, { sortOrder: curOrder });
  }, [nodes, onUpdateNode]);

  const handleMoveDown = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node?.parentId) return;
    const siblings = getSiblings(nodes, node);
    const idx = siblings.findIndex(s => s.id === nodeId);
    if (idx < 0 || idx >= siblings.length - 1) return;
    const next = siblings[idx + 1];
    const curOrder = node.sortOrder ?? idx;
    const nextOrder = next.sortOrder ?? (idx + 1);
    onUpdateNode(nodeId, { sortOrder: nextOrder });
    onUpdateNode(next.id, { sortOrder: curOrder });
  }, [nodes, onUpdateNode]);

  /* ── Indent: make child of the sibling above ── */
  const handleIndent = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node?.parentId || !onReparentNode) return;
    const siblings = getSiblings(nodes, node);
    const idx = siblings.findIndex(s => s.id === nodeId);
    if (idx <= 0) return;
    const newParent = siblings[idx - 1];
    // Count existing children of newParent to set sortOrder at end
    const newSiblings = nodes.filter(n => n.parentId === newParent.id);
    onUpdateNode(nodeId, { sortOrder: newSiblings.length });
    onReparentNode(nodeId, newParent.id);
  }, [nodes, onUpdateNode, onReparentNode]);

  /* ── Outdent: promote to parent's sibling ── */
  const handleOutdent = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node?.parentId || !onReparentNode) return;
    const parent = nodes.find(n => n.id === node.parentId);
    if (!parent?.parentId) return; // Can't outdent beyond root
    // Place after parent among parent's siblings
    const parentSiblings = getSiblings(nodes, parent);
    const parentIdx = parentSiblings.findIndex(s => s.id === parent.id);
    onUpdateNode(nodeId, { sortOrder: (parent.sortOrder ?? parentIdx) + 0.5 });
    onReparentNode(nodeId, parent.parentId);
  }, [nodes, onUpdateNode, onReparentNode]);

  if (!tree) {
    return (
      <div className="flex-1 flex items-center justify-center text-th-text-muted">
        <p>{t.mindmap.defaultRootText}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-th-base scrollbar-hide">
      {/* Keyboard hints */}
      <div className="max-w-2xl mx-auto pt-3 px-4">
        <div className="flex items-center gap-3 text-[10px] text-th-text-muted/50 mb-2 select-none">
          <span>Enter: edit</span>
          <span>Tab/⇧Tab: indent</span>
          <span>Alt+↑↓: reorder</span>
          <span>Del: delete</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto pb-8 px-3 md:px-4">
        <OutlineItem
          treeNode={tree} depth={0}
          focusedId={focusedId} onFocus={setFocusedId}
          onNodeClick={onNodeClick} onUpdateNode={onUpdateNode}
          onDeleteNode={onDeleteNode} onAddSubNode={onAddSubNode}
          onReparentNode={onReparentNode} onAddParentNode={onAddParentNode}
          onMoveUp={handleMoveUp} onMoveDown={handleMoveDown}
          onIndent={handleIndent} onOutdent={handleOutdent}
          allNodes={nodes}
        />
      </div>
    </div>
  );
};

export default OutlineView;
