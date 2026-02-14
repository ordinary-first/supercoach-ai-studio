import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ToDoItem } from '../types';

interface TodoState {
  // State
  todos: ToDoItem[];
  filter: 'all' | 'pending' | 'completed';
  sortBy: 'dueDate' | 'priority' | 'createdAt';
  isLoading: boolean;
  error: string | null;

  // Actions
  setTodos: (todos: ToDoItem[]) => void;
  addTodo: (todo: ToDoItem) => void;
  updateTodo: (id: string, updates: Partial<ToDoItem>) => void;
  deleteTodo: (id: string) => void;
  toggleComplete: (id: string) => void;
  setFilter: (filter: 'all' | 'pending' | 'completed') => void;
  setSortBy: (sortBy: 'dueDate' | 'priority' | 'createdAt') => void;
  getFilteredTodos: () => ToDoItem[];
  getTodosForGoal: (goalId: string) => ToDoItem[];
  reset: () => void;
}

const initialState = {
  todos: [],
  filter: 'all' as const,
  sortBy: 'createdAt' as const,
  isLoading: false,
  error: null,
};

export const useTodoStore = create<TodoState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setTodos: (todos) => set({ todos, error: null }),

      addTodo: (todo) =>
        set((state) => ({
          todos: [todo, ...state.todos],
          error: null,
        })),

      updateTodo: (id, updates) =>
        set((state) => ({
          todos: state.todos.map((todo) =>
            todo.id === id ? { ...todo, ...updates } : todo
          ),
          error: null,
        })),

      deleteTodo: (id) =>
        set((state) => ({
          todos: state.todos.filter((todo) => todo.id !== id),
          error: null,
        })),

      toggleComplete: (id) =>
        set((state) => ({
          todos: state.todos.map((todo) =>
            todo.id === id ? { ...todo, completed: !todo.completed } : todo
          ),
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
      name: 'secretcoach-todo-storage',
      partialize: (state) => ({
        todos: state.todos,
        filter: state.filter,
        sortBy: state.sortBy,
      }),
    }
  )
);
