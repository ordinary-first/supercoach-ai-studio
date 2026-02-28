import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  initialName?: string;
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialName = '',
}) => {
  const { language, t } = useTranslation();
  const [name, setName] = useState(initialName);

  const ui = useMemo(() => {
    if (language === 'ko') {
      return {
        createTitle: '새 그룹',
        editTitle: '그룹 이름 변경',
        nameLabel: '그룹 이름',
        namePlaceholder: '예: 개인, 업무, 프로젝트',
      };
    }

    return {
      createTitle: 'New Group',
      editTitle: 'Rename Group',
      nameLabel: 'Group name',
      namePlaceholder: 'ex: Personal, Work, Projects',
    };
  }, [language]);

  useEffect(() => {
    if (isOpen) setName(initialName);
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
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

        <div className="px-6 py-6">
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

export default CreateGroupModal;
