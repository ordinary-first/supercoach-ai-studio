import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { TodoGroup } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';

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
  { value: '#CCFF00', bg: 'bg-[#CCFF00]' },
  { value: '#60a5fa', bg: 'bg-blue-400' },
  { value: '#f87171', bg: 'bg-red-400' },
  { value: '#facc15', bg: 'bg-yellow-400' },
  { value: '#c084fc', bg: 'bg-purple-400' },
  { value: '#f472b6', bg: 'bg-pink-400' },
  { value: '#fb923c', bg: 'bg-orange-400' },
  { value: '#22d3ee', bg: 'bg-cyan-400' },
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
  const { language, t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [groupId, setGroupId] = useState(initialGroupId ?? '');

  const ui = useMemo(() => {
    if (language === 'ko') {
      return {
        createTitle: '새 목록',
        editTitle: '목록 편집',
        nameLabel: '목록 이름',
        namePlaceholder: '예: 업무, 쇼핑, 독서',
        colorLabel: '색상',
        groupLabel: '그룹 배정',
        none: '없음',
      };
    }

    return {
      createTitle: 'New List',
      editTitle: 'Edit List',
      nameLabel: 'List name',
      namePlaceholder: 'ex: Work, Shopping, Reading',
      colorLabel: 'Color',
      groupLabel: 'Assign group',
      none: 'None',
    };
  }, [language]);

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

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') handleSave();
    if (event.key === 'Escape') onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
      <div className="apple-glass-panel w-full max-w-md rounded-2xl flex flex-col">
        <div className="apple-glass-header flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="font-display font-bold tracking-wide text-white text-lg">
            {initialName ? ui.editTitle : ui.createTitle}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-body text-gray-400 tracking-wider uppercase">
              {ui.nameLabel}
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={ui.namePlaceholder}
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm
                text-white placeholder-gray-500 focus:outline-none focus:border-neon-lime/50
                transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-body text-gray-400 tracking-wider uppercase">
              {ui.colorLabel}
            </label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setColor(preset.value)}
                  className={`w-8 h-8 rounded-full ${preset.bg} transition-transform hover:scale-110 ${
                    color === preset.value
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-deep-space scale-110'
                      : ''
                  }`}
                />
              ))}
            </div>
          </div>

          {groups.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-body text-gray-400 tracking-wider uppercase">
                {ui.groupLabel}
              </label>
              <select
                value={groupId}
                onChange={(event) => setGroupId(event.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm
                  text-white focus:outline-none focus:border-neon-lime/50 transition-colors
                  appearance-none cursor-pointer"
              >
                <option value="">{ui.none}</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-body text-gray-400 hover:text-white
              hover:bg-white/10 transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-5 py-2 rounded-xl text-sm font-body font-semibold bg-neon-lime text-deep-space
              hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {t.common.save}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateListModal;
