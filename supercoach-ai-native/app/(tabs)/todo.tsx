import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Plus, Search, X, ListTodo } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { ToDoItem, GoalNode } from '../../shared/types';
import TodoItem from '../../components/todo/TodoItem';
import TodoFilters, {
  FilterType,
  SortType,
} from '../../components/todo/TodoFilters';
import TodoEditModal from '../../components/todo/TodoEditModal';

// ---------------------------------------------------------------------------
// Sample data for development / demonstration
// ---------------------------------------------------------------------------
function createSampleTodos(): ToDoItem[] {
  const now = Date.now();
  return [
    {
      id: '1',
      text: 'Review project requirements',
      completed: false,
      createdAt: now - 86400000 * 3,
      priority: 'high',
      dueDate: now + 86400000,
      isMyDay: true,
      tags: ['work'],
    },
    {
      id: '2',
      text: 'Design mobile UI mockups',
      completed: false,
      createdAt: now - 86400000 * 2,
      priority: 'medium',
      dueDate: now + 86400000 * 3,
      linkedNodeText: 'App Redesign',
      linkedGoalId: 'goal-1',
    },
    {
      id: '3',
      text: 'Write unit tests',
      completed: true,
      createdAt: now - 86400000 * 5,
      priority: 'low',
    },
    {
      id: '4',
      text: 'Team standup meeting',
      completed: false,
      createdAt: now - 86400000,
      repeat: 'weekdays',
      isMyDay: true,
    },
    {
      id: '5',
      text: 'Update documentation',
      completed: false,
      createdAt: now,
      priority: 'medium',
      dueDate: now - 86400000, // overdue
      tags: ['docs', 'important'],
    },
  ];
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function TodoScreen() {
  const [todos, setTodos] = useState<ToDoItem[]>(createSampleTodos);
  const [goals] = useState<GoalNode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [activeSort, setActiveSort] = useState<SortType>('created');
  const [editingTodo, setEditingTodo] = useState<ToDoItem | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [quickAddText, setQuickAddText] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // ---- Derived counts (single pass) ----
  const { pendingCount, completedCount } = useMemo(() => {
    let completed = 0;
    for (const t of todos) {
      if (t.completed) completed++;
    }
    return { pendingCount: todos.length - completed, completedCount: completed };
  }, [todos]);

  // ---- Filter + sort ----
  const displayedTodos = useMemo(() => {
    let list = [...todos];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.text.toLowerCase().includes(q) ||
          t.note?.toLowerCase().includes(q) ||
          t.tags?.some((tag) => tag.toLowerCase().includes(q)),
      );
    }

    // Filter
    if (activeFilter === 'pending') list = list.filter((t) => !t.completed);
    if (activeFilter === 'completed') list = list.filter((t) => t.completed);

    // Sort
    list.sort((a, b) => {
      switch (activeSort) {
        case 'priority': {
          const order: Record<string, number> = {
            high: 0,
            medium: 1,
            low: 2,
          };
          return (
            (order[a.priority ?? 'low'] ?? 3) -
            (order[b.priority ?? 'low'] ?? 3)
          );
        }
        case 'dueDate': {
          const ad = a.dueDate ?? Infinity;
          const bd = b.dueDate ?? Infinity;
          return ad - bd;
        }
        case 'created':
        default:
          return b.createdAt - a.createdAt;
      }
    });

    return list;
  }, [todos, searchQuery, activeFilter, activeSort]);

  // ---- Handlers ----
  const handleToggle = useCallback((id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );
  }, []);

  const handleDelete = useCallback((id: string) => {
    Alert.alert('Delete Task', 'Are you sure you want to delete this task?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => setTodos((prev) => prev.filter((t) => t.id !== id)),
      },
    ]);
  }, []);

  const handleSave = useCallback((data: Partial<ToDoItem>) => {
    setTodos((prev) => {
      const existing = prev.find((t) => t.id === data.id);
      if (existing) {
        return prev.map((t) => (t.id === data.id ? { ...t, ...data } : t));
      }
      return [data as ToDoItem, ...prev];
    });
  }, []);

  const handleQuickAdd = useCallback(() => {
    const text = quickAddText.trim();
    if (!text) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newTodo: ToDoItem = {
      id: Date.now().toString(),
      text,
      completed: false,
      createdAt: Date.now(),
    };
    setTodos((prev) => [newTodo, ...prev]);
    setQuickAddText('');
  }, [quickAddText]);

  const handleDragEnd = useCallback(
    ({ data }: { data: ToDoItem[] }) => {
      setTodos(data.map((item, idx) => ({ ...item, sortOrder: idx })));
    },
    [],
  );

  const openEdit = useCallback((todo: ToDoItem) => {
    setEditingTodo(todo);
    setIsModalVisible(true);
  }, []);

  const openCreate = useCallback(() => {
    setEditingTodo(null);
    setIsModalVisible(true);
  }, []);

  // ---- Render item ----
  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<ToDoItem>) => (
      <ScaleDecorator>
        <TodoItem
          todo={item}
          onToggle={handleToggle}
          onPress={openEdit}
          drag={drag}
          isActive={isActive}
        />
      </ScaleDecorator>
    ),
    [handleToggle, openEdit],
  );

  const keyExtractor = useCallback((item: ToDoItem) => item.id, []);

  // ---- Empty state (stable reference) ----
  const ListEmpty = useMemo(
    () => (
      <View className="flex-1 items-center justify-center py-20">
        <ListTodo size={48} color="#4B5563" />
        <Text className="text-gray-500 text-base mt-4">No tasks yet</Text>
        <Text className="text-gray-600 text-sm mt-1">
          Tap + to create your first task
        </Text>
      </View>
    ),
    [],
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
          <Text className="text-2xl font-bold text-white tracking-wider">
            Tasks
          </Text>
          <Pressable
            onPress={() => setShowSearch(!showSearch)}
            className="p-2 rounded-lg"
          >
            {showSearch ? (
              <X size={22} color="#9CA3AF" />
            ) : (
              <Search size={22} color="#9CA3AF" />
            )}
          </Pressable>
        </View>

        {/* Search bar */}
        {showSearch && (
          <View className="px-4 pb-2">
            <View className="flex-row items-center bg-surface border border-gray-700 rounded-xl overflow-hidden">
              <Search size={16} color="#6B7280" style={{ marginLeft: 12 }} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search tasks..."
                placeholderTextColor="#4B5563"
                className="flex-1 py-2.5 px-3 text-sm text-white"
                autoFocus
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery('')}
                  className="p-2"
                >
                  <X size={14} color="#6B7280" />
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Filters */}
        <TodoFilters
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          activeSort={activeSort}
          onSortChange={setActiveSort}
          totalCount={todos.length}
          pendingCount={pendingCount}
          completedCount={completedCount}
        />

        {/* Quick add bar */}
        <View className="flex-row items-center gap-2 mx-4 mb-2">
          <View className="flex-1 flex-row items-center bg-surface border border-gray-700 rounded-xl overflow-hidden">
            <Plus size={18} color="#6B7280" style={{ marginLeft: 12 }} />
            <TextInput
              value={quickAddText}
              onChangeText={setQuickAddText}
              onSubmitEditing={handleQuickAdd}
              placeholder="Quick add task..."
              placeholderTextColor="#4B5563"
              className="flex-1 py-2.5 px-3 text-sm text-white"
              returnKeyType="done"
            />
          </View>
        </View>

        {/* Todo list */}
        <DraggableFlatList
          data={displayedTodos}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          onDragEnd={handleDragEnd}
          containerStyle={styles.listContainer}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={ListEmpty}
          activationDistance={10}
        />

        {/* FAB */}
        <Pressable
          onPress={openCreate}
          className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-accent items-center justify-center shadow-lg"
          style={styles.fab}
        >
          <Plus size={28} color="#000" />
        </Pressable>

        {/* Edit Modal */}
        <TodoEditModal
          visible={isModalVisible}
          onClose={() => setIsModalVisible(false)}
          todo={editingTodo}
          goals={goals}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0E1A' },
  listContainer: { flex: 1 },
  listContent: { paddingBottom: 100 },
  fab: {
    shadowColor: '#71B7FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
