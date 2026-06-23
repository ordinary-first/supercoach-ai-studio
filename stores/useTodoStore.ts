import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ToDoItem } from '../types';

const TODO_STORAGE_NAME = 'secretcoach-todo-storage';

type TodoFilter = 'all' | 'pending' | 'completed';
type TodoSort = 'dueDate' | 'priority' | 'createdAt';

interface PersistedTodoState {
  todos?: ToDoItem[];
  filter?: TodoFilter;
  sortBy?: TodoSort;
  updatedAt?: number;
}

interface PersistedTodoStorage {
  state?: PersistedTodoState;
}

interface TodoState {
  // State
  todos: ToDoItem[];
  filter: TodoFilter;
  sortBy: TodoSort;
  updatedAt: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  setTodos: (todos: ToDoItem[], sourceUpdatedAt?: number) => void;
  addTodo: (todo: ToDoItem) => void;
  updateTodo: (id: string, updates: Partial<ToDoItem>) => void;
  deleteTodo: (id: string) => void;
  toggleComplete: (id: string) => void;
  setFilter: (filter: TodoFilter) => void;
  setSortBy: (sortBy: TodoSort) => void;
  getFilteredTodos: () => ToDoItem[];
  getTodosForGoal: (goalId: string) => ToDoItem[];
  reset: () => void;
}

const initialState = {
  todos: [],
  filter: 'all' as const,
  sortBy: 'createdAt' as const,
  updatedAt: 0,
  isLoading: false,
  error: null,
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const parsePersistedTodoStorage = (raw: string | null): PersistedTodoStorage | null => {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const getPersistedUpdatedAt = (persistedState: unknown): number => {
  if (!isRecord(persistedState)) return 0;
  const updatedAt = persistedState.updatedAt;
  return typeof updatedAt === 'number' && Number.isFinite(updatedAt) ? updatedAt : 0;
};

export const markTodoStoreSavedAt = (updatedAt: number): void => {
  if (typeof window === 'undefined') return;
  const savedAt = Number.isFinite(updatedAt) ? updatedAt : Date.now();
  const stored = parsePersistedTodoStorage(localStorage.getItem(TODO_STORAGE_NAME));
  const nextStorage: PersistedTodoStorage = {
    state: {
      ...(stored?.state ?? {}),
      updatedAt: savedAt,
    },
  };
  localStorage.setItem(TODO_STORAGE_NAME, JSON.stringify(nextStorage));
};

export const useTodoStore = create<TodoState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setTodos: (todos, sourceUpdatedAt = Date.now()) =>
        set((state) => {
          if (sourceUpdatedAt < state.updatedAt) return state;
          return { todos, updatedAt: sourceUpdatedAt, error: null };
        }),

      addTodo: (todo) =>
        set((state) => ({
          todos: [todo, ...state.todos],
          updatedAt: Date.now(),
          error: null,
        })),

      updateTodo: (id, updates) =>
        set((state) => ({
          todos: state.todos.map((todo) =>
            todo.id === id ? { ...todo, ...updates } : todo
          ),
          updatedAt: Date.now(),
          error: null,
        })),

      deleteTodo: (id) =>
        set((state) => ({
          todos: state.todos.filter((todo) => todo.id !== id),
          updatedAt: Date.now(),
          error: null,
        })),

      toggleComplete: (id) =>
        set((state) => ({
          todos: state.todos.map((todo) =>
            todo.id === id ? { ...todo, completed: !todo.completed } : todo
          ),
          updatedAt: Date.now(),
          error: null,
        })),

      setFilter: (filter) => set({ filter }),

      setSortBy: (sortBy) => set({ sortBy }),

      getFilteredTodos: () => {
        const { todos, filter, sortBy } = get();

        // Filter todos
        let filtered = todos;
        if (filter === 'pending') {
          filtered = todos.filter((todo) => !todo.completed);
        } else if (filter === 'completed') {
          filtered = todos.filter((todo) => todo.completed);
        }

        // Sort todos
        const sorted = [...filtered].sort((a, b) => {
          if (sortBy === 'dueDate') {
            const aDate = a.dueDate || Number.MAX_SAFE_INTEGER;
            const bDate = b.dueDate || Number.MAX_SAFE_INTEGER;
            return aDate - bDate;
          } else if (sortBy === 'createdAt') {
            return b.createdAt - a.createdAt;
          }
          return 0;
        });

        return sorted;
      },

      getTodosForGoal: (goalId) => {
        const { todos } = get();
        return todos.filter((todo) => todo.linkedNodeId === goalId);
      },

      reset: () => set(initialState),
    }),
    {
      name: TODO_STORAGE_NAME,
      partialize: (state) => ({
        todos: state.todos,
        filter: state.filter,
        sortBy: state.sortBy,
        updatedAt: state.updatedAt,
      }),
      merge: (persistedState, currentState) => {
        const persistedUpdatedAt = getPersistedUpdatedAt(persistedState);
        if (persistedUpdatedAt <= currentState.updatedAt) return currentState;
        const persisted = persistedState as PersistedTodoState;
        return {
          ...currentState,
          ...persisted,
          updatedAt: persistedUpdatedAt,
        };
      },
    }
  )
);
