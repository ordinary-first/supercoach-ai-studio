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

        <div className="px-6 py-5">
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
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white
                placeholder-gray-500 focus:outline-none focus:border-neon-lime/50 transition-colors"
            />
          </div>
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

export default CreateGroupModal;
