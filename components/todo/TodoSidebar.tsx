import React, { useState } from 'react';
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
import { ToDoItem, TodoList, TodoGroup, SmartListId } from '../../types';
import TodoSearchBar from './TodoSearchBar';

const SMART_LISTS: {
  id: SmartListId;
  name: string;
  icon: React.ReactNode;
  color: string;
  filter: (t: ToDoItem) => boolean;
}[] = [
  {
    id: 'myDay',
    name: '오늘 할 일',
    icon: <Sun size={18} />,
    color: 'text-yellow-400',
    filter: (t) => !!t.isMyDay && !t.completed,
  },
  {
    id: 'important',
    name: '중요',
    icon: <Star size={18} />,
    color: 'text-red-400',
    filter: (t) => t.priority === 'high' && !t.completed,
  },
  {
    id: 'planned',
    name: '계획된 일정',
    icon: <CalendarDays size={18} />,
    color: 'text-blue-400',
    filter: (t) => t.dueDate != null && !t.completed,
  },
  {
    id: 'tasks',
    name: '작업',
    icon: <Home size={18} />,
    color: 'text-neon-lime',
    filter: (t) => (!t.listId || t.listId === 'tasks') && !t.completed,
  },
];

interface TodoSidebarProps {
  todos: ToDoItem[];
  lists: TodoList[];
  groups: TodoGroup[];
  activeListId: string;
  searchQuery: string;
  onSelectList: (listId: string) => void;
  onSearchChange: (query: string) => void;
  onCreateList: () => void;
  onCreateGroup: () => void;
  onDeleteList: (id: string) => void;
  onDeleteGroup: (id: string) => void;
  onRenameList: (id: string) => void;
  onRenameGroup: (id: string) => void;
  onToggleGroupCollapse: (id: string) => void;
}

export default function TodoSidebar({
  todos,
  lists,
  groups,
  activeListId,
  searchQuery,
  onSelectList,
  onSearchChange,
  onCreateList,
  onCreateGroup,
  onDeleteList,
  onDeleteGroup,
  onRenameList,
  onRenameGroup,
  onToggleGroupCollapse,
}: TodoSidebarProps) {
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);

  const ungroupedLists = lists
    .filter((l) => !l.groupId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const sortedGroups = [...groups].sort((a, b) => a.sortOrder - b.sortOrder);

  function getListCount(listId: string): number {
    return todos.filter((t) => t.listId === listId && !t.completed).length;
  }

  function renderListItem(list: TodoList, indented = false) {
    const count = getListCount(list.id);
    const isActive = activeListId === list.id;
    const isContextOpen = contextMenuId === list.id;

    return (
      <div
        key={list.id}
        className={`relative ${indented ? 'ml-2' : ''}`}
        onClick={() => setContextMenuId(null)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelectList(list.id);
            setContextMenuId(null);
          }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group/list ${
            isActive
              ? 'bg-white/10 border-l-2 border-neon-lime text-white'
              : 'text-gray-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: list.color || '#CCFF00' }}
          />
          <span className="flex-1 text-left truncate">{list.name}</span>
          {count > 0 && (
            <span className="bg-white/10 text-gray-400 text-xs px-1.5 py-0.5 rounded-full font-mono">
              {count}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setContextMenuId(isContextOpen ? null : list.id);
            }}
            className="opacity-0 group-hover/list:opacity-100 flex-shrink-0 text-gray-500 hover:text-white transition-opacity rounded-lg p-0.5 hover:bg-white/10"
          >
            <MoreHorizontal size={14} />
          </button>
        </button>

        {isContextOpen && (
          <div
            className="absolute right-0 top-full mt-1 bg-[#0a0a10] border border-white/10 rounded-xl shadow-xl z-50 py-1 min-w-[120px]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                onRenameList(list.id);
                setContextMenuId(null);
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-white/10 flex items-center gap-2"
            >
              <Pencil size={14} /> 이름 변경
            </button>
            <button
              onClick={() => {
                onDeleteList(list.id);
                setContextMenuId(null);
              }}
              className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-400/10 flex items-center gap-2"
            >
              <Trash2 size={14} /> 삭제
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderGroupItem(group: TodoGroup) {
    const groupLists = lists
      .filter((l) => l.groupId === group.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const isContextOpen = contextMenuId === `group-${group.id}`;

    return (
      <div key={group.id} onClick={() => setContextMenuId(null)}>
        <div className="relative flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/10 cursor-pointer transition-colors group/grp">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleGroupCollapse(group.id);
            }}
            className="flex-shrink-0 text-gray-500 hover:text-white transition-colors"
          >
            {group.isCollapsed ? (
              <ChevronRight size={16} />
            ) : (
              <ChevronDown size={16} />
            )}
          </button>

          <FolderOpen size={16} className="text-gray-500 flex-shrink-0" />

          <span
            className="flex-1 text-sm text-gray-300 truncate"
            onClick={(e) => {
              e.stopPropagation();
              onToggleGroupCollapse(group.id);
            }}
          >
            {group.name}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setContextMenuId(isContextOpen ? null : `group-${group.id}`);
            }}
            className="opacity-0 group-hover/grp:opacity-100 flex-shrink-0 text-gray-500 hover:text-white transition-opacity rounded-lg p-0.5 hover:bg-white/10"
          >
            <MoreHorizontal size={14} />
          </button>

          {isContextOpen && (
            <div
              className="absolute right-0 top-full mt-1 bg-[#0a0a10] border border-white/10 rounded-xl shadow-xl z-50 py-1 min-w-[120px]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  onRenameGroup(group.id);
                  setContextMenuId(null);
                }}
                className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-white/10 flex items-center gap-2"
              >
                <Pencil size={14} /> 이름 변경
              </button>
              <button
                onClick={() => {
                  onDeleteGroup(group.id);
                  setContextMenuId(null);
                }}
                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-400/10 flex items-center gap-2"
              >
                <Trash2 size={14} /> 삭제
              </button>
            </div>
          )}
        </div>

        {!group.isCollapsed && (
          <div className="ml-4">
            {groupLists.map((list) => renderListItem(list, false))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="h-full flex flex-col bg-[#050B14] border-r border-white/10"
      onClick={() => setContextMenuId(null)}
    >
      {/* Search */}
      <div className="px-3 pt-4 pb-2 flex-shrink-0">
        <TodoSearchBar value={searchQuery} onChange={onSearchChange} />
      </div>

      {/* Scrollable list area */}
      <div className="flex-1 overflow-y-auto py-2 scrollbar-hide">
        {/* Smart Lists */}
        <div className="px-3 mb-1">
          <p className="font-display text-[10px] tracking-widest uppercase text-gray-600 px-3 mb-1">
            스마트 목록
          </p>
          {SMART_LISTS.map((sl) => {
            const count = todos.filter(sl.filter).length;
            const isActive = activeListId === sl.id;
            return (
              <button
                key={sl.id}
                onClick={() => {
                  onSelectList(sl.id);
                  setContextMenuId(null);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span
                  className={`flex-shrink-0 ${isActive ? sl.color : ''}`}
                >
                  {sl.icon}
                </span>
                <span className="flex-1 text-left truncate">{sl.name}</span>
                {count > 0 && (
                  <span className="bg-white/10 text-gray-400 text-xs px-1.5 py-0.5 rounded-full font-mono">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 mx-3 my-2" />

        {/* Custom Lists */}
        {(ungroupedLists.length > 0 || sortedGroups.length > 0) && (
          <div className="px-3">
            <p className="font-display text-[10px] tracking-widest uppercase text-gray-600 px-3 mb-1">
              내 목록
            </p>

            {/* Ungrouped lists */}
            {ungroupedLists.map((list) => renderListItem(list))}

            {/* Groups */}
            {sortedGroups.map((group) => renderGroupItem(group))}
          </div>
        )}
      </div>

      {/* Bottom action buttons */}
      <div className="px-3 py-3 border-t border-white/10 space-y-1 flex-shrink-0">
        <button
          onClick={onCreateList}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-400 hover:bg-white/10 hover:text-neon-lime transition-colors"
        >
          <ListPlus size={16} /> 새 목록
        </button>
        <button
          onClick={onCreateGroup}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-400 hover:bg-white/10 hover:text-neon-lime transition-colors"
        >
          <FolderPlus size={16} /> 새 그룹
        </button>
      </div>
    </div>
  );
}
