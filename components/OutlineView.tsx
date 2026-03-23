import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { GoalNode, GoalLink, NodeType, NodeStatus } from '../types';
import { ChevronRight, ChevronDown, Plus, Trash2, GripVertical, Pencil, Check, X } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

interface OutlineViewProps {
  nodes: GoalNode[];
  links: GoalLink[];
  onNodeClick: (node: GoalNode) => void;
  onUpdateNode: (nodeId: string, updates: Partial<GoalNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  onAddSubNode: (parentId: string, text?: string) => void;
}

interface TreeNode {
  node: GoalNode;
  children: TreeNode[];
}

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

// Status indicator dot
function StatusDot({ status }: { status: NodeStatus }) {
  const color = status === NodeStatus.COMPLETED
    ? 'bg-emerald-500'
    : status === NodeStatus.STUCK
      ? 'bg-red-400'
      : 'bg-th-text-tertiary/40';
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />;
}

// Inline edit input
function InlineEdit({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (text.trim()) onSave(text.trim()); else onCancel(); }}
      className="flex-1 flex items-center gap-1"
    >
      <input
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => { if (text.trim()) onSave(text.trim()); else onCancel(); }}
        onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
        className="flex-1 bg-th-surface border border-th-accent/50 rounded px-2 py-1 text-sm text-th-text focus:outline-none focus:ring-1 focus:ring-th-accent/30"
      />
    </form>
  );
}

// Single outline row
function OutlineItem({
  treeNode,
  depth,
  onNodeClick,
  onUpdateNode,
  onDeleteNode,
  onAddSubNode,
}: {
  treeNode: TreeNode;
  depth: number;
  onNodeClick: (node: GoalNode) => void;
  onUpdateNode: (nodeId: string, updates: Partial<GoalNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  onAddSubNode: (parentId: string, text?: string) => void;
}) {
  const { node, children } = treeNode;
  const isRoot = node.type === NodeType.ROOT;
  const hasChildren = children.length > 0;
  const [collapsed, setCollapsed] = useState(!!node.collapsed);
  const [editing, setEditing] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const toggleCollapse = useCallback(() => {
    const newVal = !collapsed;
    setCollapsed(newVal);
    onUpdateNode(node.id, { collapsed: newVal });
  }, [collapsed, node.id, onUpdateNode]);

  // Root node renders as title
  if (isRoot) {
    return (
      <div>
        <div className="group flex items-center gap-2 py-3 px-4 border-b border-th-border/30">
          {hasChildren && (
            <button onClick={toggleCollapse} className="text-th-text-tertiary hover:text-th-text transition-colors">
              {collapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
            </button>
          )}
          {editing ? (
            <InlineEdit
              value={node.text}
              onSave={(v) => { onUpdateNode(node.id, { text: v }); setEditing(false); }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <h2
              className="text-lg font-bold text-th-text cursor-pointer hover:text-th-accent transition-colors flex-1"
              onClick={() => onNodeClick(node)}
              onDoubleClick={() => setEditing(true)}
            >
              {node.text || 'My Life Vision'}
            </h2>
          )}
          <button
            onClick={() => onAddSubNode(node.id)}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-th-surface-hover text-th-text-tertiary hover:text-th-accent transition-all"
            title="Add child"
          >
            <Plus size={16} />
          </button>
        </div>
        {!collapsed && (
          <div>
            {children.map(child => (
              <OutlineItem
                key={child.node.id}
                treeNode={child}
                depth={1}
                onNodeClick={onNodeClick}
                onUpdateNode={onUpdateNode}
                onDeleteNode={onDeleteNode}
                onAddSubNode={onAddSubNode}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Sub nodes
  return (
    <div>
      <div
        className="group flex items-center gap-1.5 py-2 pr-3 hover:bg-th-surface/50 transition-colors cursor-pointer"
        style={{ paddingLeft: `${depth * 24 + 16}px` }}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {/* Collapse toggle or bullet */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); toggleCollapse(); }}
            className="w-5 h-5 flex items-center justify-center text-th-text-tertiary hover:text-th-text transition-colors flex-shrink-0"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
        ) : (
          <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            <StatusDot status={node.status} />
          </span>
        )}

        {/* Text */}
        {editing ? (
          <InlineEdit
            value={node.text}
            onSave={(v) => { onUpdateNode(node.id, { text: v }); setEditing(false); }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <span
            className={`flex-1 text-sm ${
              node.status === NodeStatus.COMPLETED
                ? 'text-th-text-tertiary line-through'
                : 'text-th-text'
            } ${hasChildren ? 'font-semibold' : ''}`}
            onClick={() => onNodeClick(node)}
            onDoubleClick={() => setEditing(true)}
          >
            {node.text}
          </span>
        )}

        {/* Progress badge */}
        {hasChildren && node.progress > 0 && (
          <span className="text-[10px] text-th-text-tertiary bg-th-surface rounded-full px-1.5 py-0.5 font-mono">
            {Math.round(node.progress * 100)}%
          </span>
        )}

        {/* Action buttons */}
        <div className={`flex items-center gap-0.5 transition-opacity ${showActions ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
            className="p-1 rounded hover:bg-th-surface-hover text-th-text-tertiary hover:text-th-text transition-colors"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onAddSubNode(node.id); }}
            className="p-1 rounded hover:bg-th-surface-hover text-th-text-tertiary hover:text-th-accent transition-colors"
          >
            <Plus size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteNode(node.id); }}
            className="p-1 rounded hover:bg-red-500/10 text-th-text-tertiary hover:text-red-400 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Children */}
      {!collapsed && children.length > 0 && (
        <div>
          {children.map(child => (
            <OutlineItem
              key={child.node.id}
              treeNode={child}
              depth={depth + 1}
              onNodeClick={onNodeClick}
              onUpdateNode={onUpdateNode}
              onDeleteNode={onDeleteNode}
              onAddSubNode={onAddSubNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const OutlineView: React.FC<OutlineViewProps> = ({
  nodes,
  links,
  onNodeClick,
  onUpdateNode,
  onDeleteNode,
  onAddSubNode,
}) => {
  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const { t } = useTranslation();

  if (!tree) {
    return (
      <div className="flex-1 flex items-center justify-center text-th-text-tertiary">
        <p>{t.mindmap.defaultRootText}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-th-base">
      <div className="max-w-2xl mx-auto py-6">
        <OutlineItem
          treeNode={tree}
          depth={0}
          onNodeClick={onNodeClick}
          onUpdateNode={onUpdateNode}
          onDeleteNode={onDeleteNode}
          onAddSubNode={onAddSubNode}
        />
      </div>
    </div>
  );
};

export default OutlineView;
