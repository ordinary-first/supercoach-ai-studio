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
  { value: '#007AFF', bg: 'bg-[#007AFF]' },
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
  initialColor = '#007AFF',
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
    <div className="fixed inset-0 bg-th-overlay/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
      <div className="apple-glass-panel w-full max-w-sm rounded-[24px] flex flex-col shadow-2xl border border-th-border/20 overflow-hidden">
        <div className="apple-glass-header flex items-center justify-between px-6 pt-6 pb-4 border-b border-th-border/10">
          <h2 className="font-display font-bold tracking-tight text-th-text text-xl">
            {initialName ? ui.editTitle : ui.createTitle}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-th-surface-hover text-th-text-tertiary hover:text-th-text transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            <label className="text-[10px] font-bold text-th-text-tertiary tracking-widest uppercase px-1">
              {ui.nameLabel}
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={ui.namePlaceholder}
              autoFocus
              className="w-full bg-th-surface border border-th-border rounded-xl px-4 py-3 text-sm
                text-th-text placeholder:text-th-text-muted focus:outline-none focus:border-th-accent-border
                focus:ring-2 focus:ring-th-accent/10 transition-all shadow-sm"
            />
          </div>

          <div className="flex flex-col gap-2.5">
            <label className="text-[10px] font-bold text-th-text-tertiary tracking-widest uppercase px-1">
              {ui.colorLabel}
            </label>
            <div className="flex gap-2.5 flex-wrap px-1">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setColor(preset.value)}
                  className={`w-7 h-7 rounded-full ${preset.bg} transition-all hover:scale-110 shadow-sm ${color === preset.value
                      ? 'ring-2 ring-th-accent ring-offset-2 ring-offset-th-elevated scale-110'
                      : 'opacity-80 hover:opacity-100'
                    }`}
                />
              ))}
            </div>
          </div>

          {groups.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <label className="text-[10px] font-bold text-th-text-tertiary tracking-widest uppercase px-1">
                {ui.groupLabel}
              </label>
              <select
                value={groupId}
                onChange={(event) => setGroupId(event.target.value)}
                className="w-full bg-th-surface border border-th-border rounded-xl px-4 py-3 text-sm
                  text-th-text focus:outline-none focus:border-th-accent-border transition-all
                  appearance-none cursor-pointer shadow-sm"
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
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-th-text-secondary hover:text-th-text
              hover:bg-th-surface-hover transition-all"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-7 py-2.5 rounded-xl text-sm font-bold bg-th-accent text-th-text-inverse
              hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
          >
            {t.common.save}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateListModal;
