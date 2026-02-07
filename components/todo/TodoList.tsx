import React, { useMemo } from 'react';
import { ToDoItem } from '../../types';
import TodoItem from './TodoItem';

interface TodoListProps {
  todos: ToDoItem[];
  onToggle: (id: string) => void;
  onEdit: (todo: ToDoItem) => void;
  onDelete: (id: string) => void;
  selectedTodoId?: string;
}

type DateSection = 'overdue' | 'today' | 'tomorrow' | 'thisWeek' | 'later' | 'noDueDate';

const TodoList: React.FC<TodoListProps> = ({
  todos,
  onToggle,
  onEdit,
  onDelete,
  selectedTodoId
}) => {
  const groupedTodos = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tomorrow = today + 86400000;
    const weekEnd = today + 7 * 86400000;

    const groups: Record<DateSection, ToDoItem[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: [],
      noDueDate: []
    };

    todos.forEach(todo => {
      if (!todo.dueDate) {
        groups.noDueDate.push(todo);
      } else if (todo.dueDate < today && !todo.completed) {
        groups.overdue.push(todo);
      } else if (todo.dueDate >= today && todo.dueDate < tomorrow) {
        groups.today.push(todo);
      } else if (todo.dueDate >= tomorrow && todo.dueDate < tomorrow + 86400000) {
        groups.tomorrow.push(todo);
      } else if (todo.dueDate < weekEnd) {
        groups.thisWeek.push(todo);
      } else {
        groups.later.push(todo);
      }
    });

    return groups;
  }, [todos]);

  const sections: { key: DateSection; title: string; count: number }[] = [
    { key: 'overdue', title: 'OVERDUE', count: groupedTodos.overdue.length },
    { key: 'today', title: 'TODAY', count: groupedTodos.today.length },
    { key: 'tomorrow', title: 'TOMORROW', count: groupedTodos.tomorrow.length },
    { key: 'thisWeek', title: 'THIS WEEK', count: groupedTodos.thisWeek.length },
    { key: 'later', title: 'LATER', count: groupedTodos.later.length },
    { key: 'noDueDate', title: 'NO DUE DATE', count: groupedTodos.noDueDate.length },
  ];

  const getSectionColor = (key: DateSection) => {
    switch (key) {
      case 'overdue': return 'text-red-400 border-red-400/20';
      case 'today': return 'text-neon-lime border-neon-lime/20';
      case 'tomorrow': return 'text-blue-400 border-blue-400/20';
      default: return 'text-gray-400 border-white/10';
    }
  };

  return (
    <div className="space-y-8">
      {sections.map(({ key, title, count }) => {
        if (count === 0) return null;

        return (
          <div key={key} className="space-y-3">
            {/* Section Header */}
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border ${getSectionColor(key)} bg-black/40 backdrop-blur-sm`}>
                <span className="text-xs font-display font-bold tracking-widest">
                  {title}
                </span>
                <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded-full font-mono">
                  {count}
                </span>
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
            </div>

            {/* Todos in Section */}
            <div className="space-y-2">
              {groupedTodos[key].map(todo => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onToggle={onToggle}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  isSelected={selectedTodoId === todo.id}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TodoList;
