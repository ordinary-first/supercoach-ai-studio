import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Filter, ArrowUpDown } from 'lucide-react-native';

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

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Done' },
];

const SORT_OPTIONS: { value: SortType; label: string }[] = [
  { value: 'dueDate', label: 'Date' },
  { value: 'priority', label: 'Priority' },
  { value: 'created', label: 'Created' },
];

function getCount(
  filter: FilterType,
  total: number,
  pending: number,
  completed: number,
): number {
  switch (filter) {
    case 'all':
      return total;
    case 'pending':
      return pending;
    case 'completed':
      return completed;
  }
}

const TodoFilters: React.FC<TodoFiltersProps> = ({
  activeFilter,
  onFilterChange,
  activeSort,
  onSortChange,
  totalCount,
  pendingCount,
  completedCount,
}) => {
  const [showSortMenu, setShowSortMenu] = React.useState(false);

  return (
    <View className="px-4 py-2 gap-2">
      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, alignItems: 'center' }}
      >
        <Filter size={14} color="#9CA3AF" />
        {FILTERS.map(({ value, label }) => {
          const active = activeFilter === value;
          const count = getCount(value, totalCount, pendingCount, completedCount);
          return (
            <Pressable
              key={value}
              onPress={() => onFilterChange(value)}
              className={`px-4 py-2 rounded-lg flex-row items-center ${
                active ? 'bg-accent' : 'bg-surface'
              }`}
            >
              <Text
                className={`text-sm font-bold ${
                  active ? 'text-black' : 'text-gray-400'
                }`}
              >
                {label}
              </Text>
              <View
                className={`ml-2 px-1.5 py-0.5 rounded-full ${
                  active ? 'bg-black/20' : 'bg-gray-700'
                }`}
              >
                <Text
                  className={`text-xs ${
                    active ? 'text-black/70' : 'text-gray-500'
                  }`}
                >
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}

        {/* Sort button */}
        <Pressable
          onPress={() => setShowSortMenu(!showSortMenu)}
          className="flex-row items-center gap-1.5 px-3 py-2 rounded-lg bg-surface ml-2"
        >
          <ArrowUpDown size={14} color="#9CA3AF" />
          <Text className="text-xs font-bold text-gray-400">
            {SORT_OPTIONS.find((s) => s.value === activeSort)?.label}
          </Text>
        </Pressable>
      </ScrollView>

      {/* Sort dropdown */}
      {showSortMenu && (
        <View className="absolute right-4 top-14 z-50 bg-surface border border-gray-700 rounded-xl p-2 min-w-[140px] shadow-lg">
          {SORT_OPTIONS.map(({ value, label }) => (
            <Pressable
              key={value}
              onPress={() => {
                onSortChange(value);
                setShowSortMenu(false);
              }}
              className={`px-3 py-2 rounded-lg ${
                activeSort === value ? 'bg-accent' : ''
              }`}
            >
              <Text
                className={`text-sm ${
                  activeSort === value
                    ? 'text-black font-bold'
                    : 'text-gray-400'
                }`}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
};

export default TodoFilters;
