import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { TodoGroup } from '../../types';

interface CreateListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, color: string, groupId?: string) => void;
  groups: TodoGroup[];
  initialName?: string;
  initialColor?: string;
  initialGroupId?: string;
}

const PRESET_COLORS = [
  { value: '#CCFF00', label: '네온 라임', bg: 'bg-[#CCFF00]' },
  { value: '#60a5fa', label: '블루', bg: 'bg-blue-400' },
  { value: '#f87171', label: '레드', bg: 'bg-red-400' },
  { value: '#facc15', label: '옐로우', bg: 'bg-yellow-400' },
  { value: '#c084fc', label: '퍼플', bg: 'bg-purple-400' },
  { value: '#f472b6', label: '핑크', bg: 'bg-pink-400' },
  { value: '#fb923c', label: '오렌지', bg: 'bg-orange-400' },
  { value: '#22d3ee', label: '시안', bg: 'bg-cyan-400' },
];

const CreateListModal: React.FC<CreateListModalProps> = ({
  isOpen,
  onClose,
  onSave,
  groups,
  initialName = '',
  initialColor = '#CCFF00',
  initialGroupId,
}) => {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [groupId, setGroupId] = useState(initialGroupId ?? '');

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setColor(initialColor);
      setGroupId(initialGroupId ?? '');
    }
  }, [isOpen, initialName, initialColor, initialGroupId]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, color, groupId || undefined);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-deep-space border border-white/20 rounded-2xl shadow-[0_0_40px_rgba(204,255,0,0.05)] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/10">
          <h2 className="font-display font-bold tracking-wider text-white text-lg">
            {initialName ? '목록 편집' : '새 목록'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 본문 */}
        <div className="px-6 py-5 flex flex-col gap-5">
          {/* 목록 이름 */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-body text-gray-400 tracking-wider uppercase">목록 이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="예: 업무, 쇼핑, 독서..."
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-lime/50 transition-colors"
            />
          </div>

          {/* 색상 선택 */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-body text-gray-400 tracking-wider uppercase">색상</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  title={c.label}
                  className={`w-8 h-8 rounded-full ${c.bg} transition-transform hover:scale-110 ${
                    color === c.value
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-deep-space scale-110'
                      : ''
                  }`}
                />
              ))}
            </div>
          </div>

          {/* 그룹 배정 */}
          {groups.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-body text-gray-400 tracking-wider uppercase">그룹 배정</label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-neon-lime/50 transition-colors appearance-none cursor-pointer"
              >
                <option value="">없음</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-body text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-5 py-2 rounded-xl text-sm font-body font-semibold bg-neon-lime text-deep-space hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateListModal;
