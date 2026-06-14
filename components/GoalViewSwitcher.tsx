import { useState, useRef, useEffect } from 'react';
import { LayoutGrid, Network, ListTree, LayoutTemplate } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import type { GoalsViewMode } from './BottomDock';
import type { LayoutMode } from './MindMap';

interface GoalViewSwitcherProps {
  viewMode: GoalsViewMode;
  onViewModeChange: (mode: GoalsViewMode) => void;
  mindmapLayout?: LayoutMode;
  onMindmapLayoutChange?: (layout: LayoutMode) => void;
}

/**
 * Always-visible view switcher for the Goals tab — replaces the hidden
 * long-press menu. Three lenses on the same data: vision board / mind map /
 * outline. When the mind map is active, a secondary control exposes its layouts.
 */
export default function GoalViewSwitcher({
  viewMode, onViewModeChange, mindmapLayout = 'mindMap', onMindmapLayoutChange,
}: GoalViewSwitcherProps) {
  const { t } = useTranslation();
  const [layoutOpen, setLayoutOpen] = useState(false);
  const layoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!layoutOpen) return;
    const onDown = (e: Event) => {
      if (layoutRef.current && !layoutRef.current.contains(e.target as Node)) {
        setLayoutOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLayoutOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [layoutOpen]);

  const views: { mode: GoalsViewMode; label: string; Icon: typeof LayoutGrid }[] = [
    { mode: 'visionboard', label: t.mindmap.visionBoard, Icon: LayoutGrid },
    { mode: 'mindmap', label: t.mindmap.mindMapLabel, Icon: Network },
    { mode: 'outline', label: t.mindmap.outlineLabel, Icon: ListTree },
  ];

  const layoutModes: { mode: LayoutMode; label: string }[] = [
    { mode: 'mindMap', label: t.mindmap.layoutModes.mindMap },
    { mode: 'logicalStructure', label: t.mindmap.layoutModes.logicalStructure },
    { mode: 'logicalStructureLeft', label: t.mindmap.layoutModes.logicalStructureLeft },
    { mode: 'organizationStructure', label: t.mindmap.layoutModes.organizationStructure },
  ];
  const activeLayoutLabel = layoutModes.find(l => l.mode === mindmapLayout)?.label ?? '';

  return (
    <div
      className="absolute top-2 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-1.5"
      style={{ marginTop: 'env(safe-area-inset-top)' }}
    >
      <div className="apple-glass-panel flex items-center gap-0.5 p-1 rounded-full shadow-lg">
        {views.map(({ mode, label, Icon }) => {
          const active = viewMode === mode;
          return (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              aria-label={label}
              aria-pressed={active}
              title={label}
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-all duration-200
                ${active
                  ? 'bg-th-accent text-white shadow-[0_0_16px_var(--shadow-glow)]'
                  : 'text-th-text-secondary hover:text-th-text hover:bg-th-surface/60'}`}
            >
              <Icon size={17} />
            </button>
          );
        })}
      </div>

      {viewMode === 'mindmap' && onMindmapLayoutChange && (
        <div ref={layoutRef} className="relative">
          <button
            onClick={() => setLayoutOpen(v => !v)}
            aria-label={`${t.mindmap.changeLayout}: ${activeLayoutLabel}`}
            aria-haspopup="menu"
            aria-expanded={layoutOpen}
            title={`${t.mindmap.changeLayout}: ${activeLayoutLabel}`}
            className="apple-glass-panel w-9 h-9 flex items-center justify-center rounded-full shadow-lg
              text-th-text-secondary hover:text-th-text transition-colors"
          >
            <LayoutTemplate size={16} />
          </button>
          {layoutOpen && (
            <div className="absolute top-full mt-1.5 right-0 apple-glass-panel
              rounded-xl shadow-2xl overflow-hidden min-w-[150px]">
              {layoutModes.map(({ mode, label }) => (
                <button
                  key={mode}
                  onClick={() => { onMindmapLayoutChange(mode); setLayoutOpen(false); }}
                  className={`w-full px-4 py-2.5 text-sm text-left transition-colors
                    ${mindmapLayout === mode
                      ? 'text-th-accent font-bold bg-th-surface'
                      : 'text-th-text-secondary hover:text-th-text hover:bg-th-surface'}`}
                >
                  {label}{mindmapLayout === mode && ' ✓'}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
