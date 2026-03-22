import React, { useState, useMemo, useRef } from 'react';
import { GoalNode, NodeType, NodeStatus } from '../types';
import { ChevronDown, ChevronRight, X, Check, Circle, Plus, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

interface GoalDetailModalProps {
  nodeId: string;
  nodes: GoalNode[];
  onClose: () => void;
  onUpdateNode: (nodeId: string, updates: Partial<GoalNode>) => void;
  onAddSubNode: (parentId: string, text: string) => void;
  onDeleteNode?: (nodeId: string) => void;
}

interface TreeNode {
  node: GoalNode;
  children: TreeNode[];
  depth: number;
}

const GoalDetailModal: React.FC<GoalDetailModalProps> = ({
  nodeId,
  nodes,
  onClose,
  onUpdateNode,
  onAddSubNode,
  onDeleteNode,
}) => {
  const { t } = useTranslation();
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [addingToId, setAddingToId] = useState<string | null>(null);
  const [newSubText, setNewSubText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
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
      style={{ paddingLeft: `${depth * 24 + 16 + 24}px` }}
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

  const renderTreeNode = (treeNode: TreeNode, idx: number): React.ReactNode => {
    const { node, children, depth } = treeNode;
    const isCompleted = node.status === NodeStatus.COMPLETED;
    const hasChildren = children.length > 0;
    const isCollapsed = collapsedIds.has(node.id);
    const isEditing = editingId === node.id;
    const isAddingHere = addingToId === node.id;
    const delay = idx * 30;

    return (
      <div key={node.id} className="animate-[treeItemIn_0.3s_ease-out_both]" style={{ animationDelay: `${delay}ms` }}>
        <div
          className="flex items-center gap-2.5 py-2 px-3 rounded-xl
            hover:bg-white/[0.04] transition-colors duration-200 group cursor-default"
          style={{ paddingLeft: `${depth * 24 + 16}px` }}
        >
          {/* 접기/펼치기 */}
          {hasChildren ? (
            <button
              onClick={() => toggleCollapse(node.id)}
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
            onClick={() => toggleComplete(node.id)}
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
              onSubmit={(e) => { e.preventDefault(); commitEdit(); }}
            >
              <input
                ref={editInputRef}
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => { if (e.key === 'Escape') { setEditingId(null); setEditText(''); } }}
                className="w-full bg-white/[0.06] border border-th-accent/40 rounded-lg px-2 py-1
                  text-[13px] text-white/90
                  focus:outline-none focus:border-th-accent/60
                  transition-all duration-200"
              />
            </form>
          ) : (
            <span
              onDoubleClick={() => startEditing(node)}
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
              {children.filter(c => c.node.status === NodeStatus.COMPLETED).length}/{children.length}
            </span>
          )}

          {/* 호버 액션 버튼 */}
          {!isEditing && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                onClick={() => startAddingChild(node.id)}
                className="w-6 h-6 rounded-md flex items-center justify-center
                  text-white/20 hover:text-white/60 hover:bg-white/[0.06]
                  transition-all duration-200"
                title="하위 추가"
              >
                <Plus size={12} strokeWidth={2} />
              </button>
              <button
                onClick={() => startEditing(node)}
                className="w-6 h-6 rounded-md flex items-center justify-center
                  text-white/20 hover:text-white/60 hover:bg-white/[0.06]
                  transition-all duration-200"
                title="편집"
              >
                <Pencil size={11} strokeWidth={2} />
              </button>
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

        {/* 자식 노드 */}
        {hasChildren && !isCollapsed && (
          <div>{children.map((child, i) => renderTreeNode(child, idx + i + 1))}</div>
        )}

        {/* 인라인 하위 추가 입력 (이 노드 아래) */}
        {isAddingHere && renderInlineAddInput(depth + 1)}
      </div>
    );
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

        {/* 트리 리스트 */}
        <div className="flex-1 overflow-y-auto py-3 px-2
          scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
          {tree.length === 0 && addingToId !== nodeId ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Circle size={32} className="text-white/10" strokeWidth={1} />
              <p className="text-[13px] text-white/20">{t.mindmap.noSubGoals}</p>
            </div>
          ) : (
            tree.map((treeNode, i) => renderTreeNode(treeNode, i))
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
