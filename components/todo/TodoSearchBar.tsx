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
          focus-within:border-neon-lime/50 transition-colors"
      >
        <Search size={16} className="ml-3 text-gray-500 flex-shrink-0" />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent py-2.5 px-3 text-sm text-white placeholder-gray-500
            focus:outline-none"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="mr-2 p-1 rounded-full hover:bg-white/10 text-gray-500 hover:text-white
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
