import React from 'react';
import { Search, X } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

interface TodoSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

const TodoSearchBar: React.FC<TodoSearchBarProps> = ({ value, onChange }) => {
  const { language } = useTranslation();
  const placeholder = language === 'ko' ? '검색' : 'Search';

  return (
    <div className="px-3 py-2">
      <div
        className="apple-glass-panel relative flex items-center rounded-xl overflow-hidden
          focus-within:border-th-accent-border focus-within:ring-1 focus-within:ring-th-accent/20 transition-all shadow-sm"
      >
        <Search size={16} className="ml-3 text-th-text-tertiary flex-shrink-0" />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent py-2.5 px-3 text-sm text-th-text placeholder:text-th-text-muted
            focus:outline-none"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="mr-2 p-1 rounded-full hover:bg-th-surface-hover text-th-text-tertiary hover:text-th-text
              transition-colors flex-shrink-0"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

export default TodoSearchBar;
