import React from 'react';
import { Filter, SortAsc } from 'lucide-react';

export type FilterType = 'all' | 'pending' | 'completed';
export type SortType = 'dueDate' | 'priority' | 'created';

interface TodoFiltersProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  activeSort: SortType;
  onSortChange: (sort: SortType) => void;
  totalCount: number;
  pendingCount: number;
  completedCount: number;
}

const TodoFilters: React.FC<TodoFiltersProps> = ({
  activeFilter,
  onFilterChange,
  activeSort,
  onSortChange,
  totalCount,
  pendingCount,
  completedCount
}) => {
  const filters: { value: FilterType; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: totalCount },
    { value: 'pending', label: 'Pending', count: pendingCount },
    { value: 'completed', label: 'Completed', count: completedCount },
  ];

  const sortOptions: { value: SortType; label: string }[] = [
    { value: 'dueDate', label: 'Due Date' },
    { value: 'priority', label: 'Priority' },
    { value: 'created', label: 'Created' },
  ];

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      {/* Filter Tabs */}
      <div className="flex items-center gap-2 p-1 bg-th-header backdrop-blur-md border border-th-border rounded-xl">
        <div className="flex items-center gap-1 px-2 text-th-text-tertiary">
          <Filter size={14} />
        </div>
        {filters.map(({ value, label, count }) => (
          <button
            key={value}
            onClick={() => onFilterChange(value)}
            className={`relative px-4 py-2 rounded-lg text-sm font-bold tracking-wider transition-all ${
              activeFilter === value
                ? 'bg-th-accent text-th-text-inverse shadow-[0_0_10px_var(--shadow-glow)]'
                : 'text-th-text-secondary hover:text-th-text hover:bg-th-surface'
            }`}
          >
            {label}
            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
              activeFilter === value
                ? 'bg-black/20'
                : 'bg-th-surface-hover'
            }`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Sort Dropdown */}
      <div className="relative group">
        <button className="flex items-center gap-2 px-4 py-2 bg-th-header backdrop-blur-md border border-th-border rounded-xl text-sm font-bold tracking-wider text-th-text-secondary hover:text-th-text hover:border-th-border-strong transition-all">
          <SortAsc size={16} />
          <span>Sort: {sortOptions.find(s => s.value === activeSort)?.label}</span>
          <svg className="w-4 h-4 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        <div className="absolute right-0 top-full mt-2 w-48 bg-th-elevated backdrop-blur-xl border border-th-border-strong rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
          <div className="p-2 space-y-1">
            {sortOptions.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onSortChange(value)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                  activeSort === value
                    ? 'bg-th-accent text-th-text-inverse font-bold'
                    : 'text-th-text-secondary hover:bg-th-surface-hover hover:text-th-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TodoFilters;
