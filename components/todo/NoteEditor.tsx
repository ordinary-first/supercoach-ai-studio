import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Underline from '@tiptap/extension-underline';
import {
  ArrowLeft, Trash2, Pin, PinOff,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, List, ListOrdered, CheckSquare, Quote, Minus, Code,
} from 'lucide-react';
import { NoteItem } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';

interface NoteEditorProps {
  note: NoteItem;
  onUpdate: (id: string, updates: Partial<NoteItem>) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

export default function NoteEditor({ note, onUpdate, onDelete, onBack }: NoteEditorProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(note.title);
  const titleRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteIdRef = useRef(note.id);

  // Reset when note changes
  useEffect(() => {
    if (noteIdRef.current !== note.id) {
      noteIdRef.current = note.id;
      setTitle(note.title);
      editor?.commands.setContent(note.content as any);
    }
  }, [note.id]);

  const debouncedSave = useCallback((updates: Partial<NoteItem>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onUpdate(note.id, { ...updates, updatedAt: Date.now() });
    }, 800);
  }, [note.id, onUpdate]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: t.notes.placeholder,
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Underline,
    ],
    content: note.content as any,
    onUpdate: ({ editor }) => {
      debouncedSave({ content: editor.getJSON() });
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] px-4 py-3',
      },
    },
  });

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setTitle(v);
    debouncedSave({ title: v });
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      editor?.commands.focus('start');
    }
  };

  const handleDelete = () => {
    onDelete(note.id);
    onBack();
  };

  const handleTogglePin = () => {
    onUpdate(note.id, { isPinned: !note.isPinned, updatedAt: Date.now() });
  };

  if (!editor) return null;

  const ToolbarButton = ({ active, onClick, children, title: btnTitle }: {
    active?: boolean; onClick: () => void; children: React.ReactNode; title?: string;
  }) => (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`p-1.5 rounded-md transition-colors ${active
        ? 'bg-th-accent/20 text-th-accent'
        : 'text-th-text-tertiary hover:text-th-text hover:bg-th-surface-hover'
      }`}
      title={btnTitle}
    >
      {children}
    </button>
  );

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="apple-glass-header h-11 md:h-12 flex items-center justify-between px-3 md:px-4 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-th-surface-hover text-th-text-secondary hover:text-th-text transition-colors">
            <ArrowLeft size={18} />
          </button>
          <span className="text-xs text-th-text-tertiary font-medium uppercase tracking-wider">{t.notes.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleTogglePin} className={`p-1.5 rounded-lg transition-colors ${note.isPinned ? 'text-yellow-400 hover:bg-yellow-400/10' : 'text-th-text-tertiary hover:bg-th-surface-hover hover:text-th-text'}`}>
            {note.isPinned ? <PinOff size={16} /> : <Pin size={16} />}
          </button>
          <button onClick={handleDelete} className="p-1.5 rounded-lg text-th-text-tertiary hover:text-red-400 hover:bg-red-400/10 transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="px-4 pt-4 pb-2">
        <input
          ref={titleRef}
          value={title}
          onChange={handleTitleChange}
          onKeyDown={handleTitleKeyDown}
          placeholder={t.notes.untitled}
          className="w-full text-2xl font-bold text-th-text bg-transparent border-none outline-none placeholder:text-th-text-tertiary/50"
        />
      </div>

      {/* Toolbar */}
      <div className="px-3 pb-2 flex items-center gap-0.5 flex-wrap border-b border-th-border/20">
        <ToolbarButton active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="H1">
          <Heading1 size={15} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="H2">
          <Heading2 size={15} />
        </ToolbarButton>
        <div className="w-px h-4 bg-th-border/30 mx-1" />
        <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
          <Italic size={15} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
          <UnderlineIcon size={15} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
          <Strikethrough size={15} />
        </ToolbarButton>
        <div className="w-px h-4 bg-th-border/30 mx-1" />
        <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List">
          <List size={15} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List">
          <ListOrdered size={15} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Checklist">
          <CheckSquare size={15} />
        </ToolbarButton>
        <div className="w-px h-4 bg-th-border/30 mx-1" />
        <ToolbarButton active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote">
          <Quote size={15} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code">
          <Code size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">
          <Minus size={15} />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
