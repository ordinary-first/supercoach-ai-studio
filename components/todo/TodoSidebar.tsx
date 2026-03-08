import React, { useMemo, useState } from 'react';
import {
  Sun,
  Star,
  CalendarDays,
  Home,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Trash2,
  Pencil,
  ListPlus,
  FolderPlus,
  MoreHorizontal,
} from 'lucide-react';
import { ToDoItem, TodoList, TodoGroup, SmartListId, UserPrinciple } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';
import TodoSearchBar from './TodoSearchBar';

interface TodoSidebarProps {
  todos: ToDoItem[];
  lists: TodoList[];
  groups: TodoGroup[];
  activeListId: string;
  searchQuery: string;
  principles: UserPrinciple[];
  showPrinciplesEditor: boolean;
  onSelectList: (listId: string) => void;
  onSearchChange: (query: string) => void;
  onCreateList: () => void;
  onCreateGroup: () => void;
  onDeleteList: (id: string) => void;
  onDeleteGroup: (id: string) => void;
  onRenameList: (id: string) => void;
  onRenameGroup: (id: string) => void;
  onToggleGroupCollapse: (id: string) => void;
  onOpenPrinciples: () => void;
}

export default function TodoSidebar({
  todos,
  lists,
  groups,
  activeListId,
  searchQuery,
  principles,
  onSelectList,
  onSearchChange,
  onCreateList,
  onCreateGroup,
  onDeleteList,
  onDeleteGroup,
  onRenameList,
  onRenameGroup,
  onToggleGroupCollapse,
  showPrinciplesEditor,
  onOpenPrinciples,
}: TodoSidebarProps) {
  const { language } = useTranslation();
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [principlesCollapsed, setPrinciplesCollapsed] = useState(false);

  const ui = useMemo(() => {
    if (language === 'ko') {
      return {
        smartSection: '스마트 목록',
        customSection: '내 목록',
        rename: '이름 변경',
        delete: '삭제',
        createList: '새 목록',
        createGroup: '새 그룹',
      };
    }

    return {
      smartSection: 'Smart Lists',
      customSection: 'My Lists',
      rename: 'Rename',
      delete: 'Delete',
      createList: 'New List',
      createGroup: 'New Group',
    };
  }, [language]);

  const smartLists: {
    id: SmartListId;
    name: string;
    icon: React.ReactNode;
    color: string;
    filter: (todo: ToDoItem) => boolean;
  }[] = useMemo(() => {
    const names = language === 'ko'
      ? {
        myDay: '오늘 할 일',
        important: '중요',
        planned: '계획된 일정',
        tasks: '작업',
      }
      : {
        myDay: 'My Day',
        important: 'Important',
        planned: 'Planned',
        tasks: 'Tasks',
      };

    return [
      {
        id: 'myDay',
        name: names.myDay,
        icon: <Sun size={18} />,
        color: 'text-yellow-400',
        filter: (todo) => !!todo.isMyDay && !todo.completed,
      },
      {
        id: 'important',
        name: names.important,
        icon: <Star size={18} />,
        color: 'text-red-400',
        filter: (todo) => todo.priority === 'high' && !todo.completed,
      },
      {
        id: 'planned',
        name: names.planned,
        icon: <CalendarDays size={18} />,
        color: 'text-blue-400',
        filter: (todo) => todo.dueDate != null && !todo.completed,
      },
      {
        id: 'tasks',
        name: names.tasks,
        icon: <Home size={18} />,
        color: 'text-th-accent',
        filter: (todo) => (!todo.listId || todo.listId === 'tasks') && !todo.completed,
      },
    ];
  }, [language]);

  const ungroupedLists = lists
    .filter((list) => !list.groupId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const sortedGroups = [...groups].sort((a, b) => a.sortOrder - b.sortOrder);

  const getListCount = (listId: string): number => {
    return todos.filter((todo) => todo.listId === listId && !todo.completed).length;
  };

  const renderListItem = (list: TodoList, indented = false) => {
    const count = getListCount(list.id);
    const isActive = !showPrinciplesEditor && activeListId === list.id;
    const isContextOpen = contextMenuId === list.id;

    return (
      <div
        key={list.id}
        className={`relative ${indented ? 'ml-2' : ''}`}
        onClick={() => setContextMenuId(null)}
      >
        <button
          onClick={(event) => {
            event.stopPropagation();
            onSelectList(list.id);
            setContextMenuId(null);
          }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all
            group/list ${isActive
              ? 'bg-th-accent-muted border-l-2 border-th-accent text-th-text font-bold'
              : 'text-th-text-secondary hover:bg-th-surface/50 hover:text-th-text'
            }`}
        >
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: list.color || 'var(--accent)' }}
          />
          <span className="flex-1 text-left truncate">{list.name}</span>
          {count > 0 && (
            <span className="bg-th-surface text-th-text-tertiary text-xs px-1.5 py-0.5 rounded-full font-mono">
              {count}
            </span>
          )}
          <button
            onClick={(event) => {
              event.stopPropagation();
              setContextMenuId(isContextOpen ? null : list.id);
            }}
            className="opacity-0 group-hover/list:opacity-100 flex-shrink-0 text-th-text-tertiary
              hover:text-th-text transition-opacity rounded-lg p-0.5 hover:bg-th-surface"
          >
            <MoreHorizontal size={14} />
          </button>
        </button>

        {isContextOpen && (
          <div
            className="apple-glass-panel absolute right-0 top-full mt-1 rounded-xl shadow-xl z-50 py-1
              min-w-[120px]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => {
                onRenameList(list.id);
                setContextMenuId(null);
              }}
              className="w-full px-3 py-2 text-left text-sm text-th-text-secondary hover:bg-th-surface
                flex items-center gap-2"
            >
              <Pencil size={14} /> {ui.rename}
            </button>
            <button
              onClick={() => {
                onDeleteList(list.id);
                setContextMenuId(null);
              }}
              className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-400/10
                flex items-center gap-2"
            >
              <Trash2 size={14} /> {ui.delete}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderGroupItem = (group: TodoGroup) => {
    const groupLists = lists
      .filter((list) => list.groupId === group.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const isContextOpen = contextMenuId === `group-${group.id}`;

    return (
      <div key={group.id} onClick={() => setContextMenuId(null)}>
        <div className="relative flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-th-surface/50
          cursor-pointer transition-colors group/grp"
        >
          <button
            onClick={(event) => {
              event.stopPropagation();
              onToggleGroupCollapse(group.id);
            }}
            className="flex-shrink-0 text-th-text-tertiary hover:text-th-text transition-colors"
          >
            {group.isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>

          <FolderOpen size={16} className="text-th-text-tertiary flex-shrink-0" />

          <span
            className="flex-1 text-sm text-th-text-secondary truncate"
            onClick={(event) => {
              event.stopPropagation();
              onToggleGroupCollapse(group.id);
            }}
          >
            {group.name}
          </span>

          <button
            onClick={(event) => {
              event.stopPropagation();
              setContextMenuId(isContextOpen ? null : `group-${group.id}`);
            }}
            className="opacity-0 group-hover/grp:opacity-100 flex-shrink-0 text-th-text-tertiary
              hover:text-th-text transition-opacity rounded-lg p-0.5 hover:bg-th-surface"
          >
            <MoreHorizontal size={14} />
          </button>

          {isContextOpen && (
            <div
              className="apple-glass-panel absolute right-0 top-full mt-1 rounded-xl shadow-xl z-50
                py-1 min-w-[120px]"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                onClick={() => {
                  onRenameGroup(group.id);
                  setContextMenuId(null);
                }}
                className="w-full px-3 py-2 text-left text-sm text-th-text-secondary hover:bg-th-surface
                  flex items-center gap-2"
              >
                <Pencil size={14} /> {ui.rename}
              </button>
              <button
                onClick={() => {
                  onDeleteGroup(group.id);
                  setContextMenuId(null);
                }}
                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-400/10
                  flex items-center gap-2"
              >
                <Trash2 size={14} /> {ui.delete}
              </button>
            </div>
          )}
        </div>

        {!group.isCollapsed && <div className="ml-4">{groupLists.map((list) => renderListItem(list))}</div>}
      </div>
    );
  };

  return (
    <div className="apple-glass-panel h-full flex flex-col border-r border-th-border" onClick={() => {
      setContextMenuId(null);
    }}>
      <div className="px-3 pt-4 pb-2 flex-shrink-0">
        <TodoSearchBar value={searchQuery} onChange={onSearchChange} />
      </div>

      {/* Principles card */}
      {(() => {
        const hasPrinciples = principles.length > 0;
        const todayPrinciple = hasPrinciples ? (() => {
          const now = new Date();
          const startOfYear = new Date(now.getFullYear(), 0, 0);
          const dayOfYear = Math.floor(
            (now.getTime() - startOfYear.getTime()) / 86400000,
          );
          return principles[dayOfYear % principles.length];
        })() : null;
        return (
          <div className="px-3 pb-2 flex-shrink-0">
            <button
              onClick={() => onOpenPrinciples()}
              className={`w-full text-left rounded-xl px-3 py-2.5 transition-all ${
                showPrinciplesEditor
                  ? 'bg-th-accent/15 ring-1 ring-th-accent/40 shadow-[0_0_12px_-3px] shadow-th-accent/20'
                  : 'border-l-[3px] border-th-accent bg-th-accent-muted/40 hover:bg-th-accent-muted/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-th-accent tracking-wide">
                  {language === 'ko'
                    ? '\u2726 \uC774\uAC83\uB9CC \uC9C0\uCF1C\uC918!'
                    : '\u2726 My Principles'}
                </span>
                {hasPrinciples && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPrinciplesCollapsed(prev => !prev);
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setPrinciplesCollapsed(prev => !prev); } }}
                    className="p-0.5 text-th-text-tertiary hover:text-th-text transition-colors cursor-pointer"
                  >
                    {principlesCollapsed
                      ? <ChevronRight size={14} />
                      : <ChevronDown size={14} />}
                  </span>
                )}
              </div>
              {hasPrinciples && !principlesCollapsed && todayPrinciple && (
                <div className="mt-1.5">
                  <p className="text-[10px] text-th-text-tertiary uppercase tracking-widest mb-0.5">
                    {language === 'ko' ? '\uC624\uB298\uC758 \uD3EC\uCEE4\uC2A4' : "Today's Focus"}
                  </p>
                  <p className="text-sm text-th-text font-medium leading-snug line-clamp-2">
                    {todayPrinciple.text}
                  </p>
                </div>
              )}
              {!hasPrinciples && (
                <p className="mt-1 text-xs text-th-text-tertiary">
                  {language === 'ko'
                    ? '탭해서 원칙 추가하기'
                    : 'Tap to add principles'}
                </p>
              )}
            </button>
          </div>
        );
      })()}

      <div className="flex-1 overflow-y-auto py-2 scrollbar-hide">
        <div className="px-3 mb-1">
          <p className="font-display text-[10px] tracking-widest uppercase text-th-text-tertiary px-3 mb-1">
            {ui.smartSection}
          </p>
          {smartLists.map((list) => {
            const count = todos.filter(list.filter).length;
            const isActive = !showPrinciplesEditor && activeListId === list.id;
            return (
              <button
                key={list.id}
                onClick={() => {
                  onSelectList(list.id);
                  setContextMenuId(null);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${isActive
                  ? 'bg-th-accent-muted text-th-text font-bold'
                  : 'text-th-text-secondary hover:bg-th-surface/50 hover:text-th-text'
                  }`}
              >
                <span className={`flex-shrink-0 ${isActive ? list.color : ''}`}>{list.icon}</span>
                <span className="flex-1 text-left truncate">{list.name}</span>
                {count > 0 && (
                  <span className="bg-th-surface text-th-text-tertiary text-xs px-1.5 py-0.5 rounded-full font-mono">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="border-t border-th-border mx-3 my-2" />

        {(ungroupedLists.length > 0 || sortedGroups.length > 0) && (
          <div className="px-3">
            <p className="font-display text-[10px] tracking-widest uppercase text-th-text-tertiary px-3 mb-1">
              {ui.customSection}
            </p>
            {ungroupedLists.map((list) => renderListItem(list))}
            {sortedGroups.map((group) => renderGroupItem(group))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 px-3 py-2.5 border-t border-th-border flex-shrink-0">
        <button
          onClick={onCreateList}
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-th-text-secondary
            hover:bg-th-surface hover:text-th-accent transition-colors"
        >
          <ListPlus size={16} /> {ui.createList}
        </button>
        <button
          onClick={onCreateGroup}
          className="p-2 rounded-lg text-th-text-secondary hover:bg-th-surface hover:text-th-accent transition-colors"
          title={ui.createGroup}
        >
          <FolderPlus size={16} />
        </button>
      </div>
    </div>
  );
}
