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
      <div className="flex items-center gap-2 p-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl">
        <div className="flex items-center gap-1 px-2 text-gray-500">
          <Filter size={14} />
        </div>
        {filters.map(({ value, label, count }) => (
          <button
            key={value}
            onClick={() => onFilterChange(value)}
            className={`relative px-4 py-2 rounded-lg text-sm font-bold tracking-wider transition-all ${
              activeFilter === value
                ? 'bg-neon-lime text-black shadow-[0_0_10px_rgba(204,255,0,0.3)]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {label}
            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
              activeFilter === value
                ? 'bg-black/20'
                : 'bg-white/10'
            }`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Sort Dropdown */}
      <div className="relative group">
        <button className="flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl text-sm font-bold tracking-wider text-gray-300 hover:text-white hover:border-white/20 transition-all">
          <SortAsc size={16} />
          <span>Sort: {sortOptions.find(s => s.value === activeSort)?.label}</span>
          <svg className="w-4 h-4 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        <div className="absolute right-0 top-full mt-2 w-48 bg-black/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
          <div className="p-2 space-y-1">
            {sortOptions.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onSortChange(value)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                  activeSort === value
                    ? 'bg-neon-lime text-black font-bold'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
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
