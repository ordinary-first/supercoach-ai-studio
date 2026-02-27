import { type FC } from 'react';

interface DreamPillSwitcherProps {
  activeTab: 'create' | 'gallery';
  onTabChange: (tab: 'create' | 'gallery') => void;
}

const TABS = [
  { key: 'create' as const, label: '드림생성' },
  { key: 'gallery' as const, label: '내 드림' },
];

const DreamPillSwitcher: FC<DreamPillSwitcherProps> = ({ activeTab, onTabChange }) => {
  const activeIndex = activeTab === 'create' ? 0 : 1;

  return (
    <div
      className="relative flex items-center mx-auto"
      style={{
        height: 32,
        borderRadius: 999,
        background: 'rgba(255,255,255,0.08)',
        padding: 2,
        width: 'fit-content',
      }}
    >
      {/* Sliding indicator */}
      <div
        className="absolute top-0.5 bottom-0.5"
        style={{
          width: 'calc(50% - 2px)',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.16)',
          transform: `translateX(${activeIndex * 100}%)`,
          transition: 'transform 150ms ease',
          left: 2,
        }}
      />

      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onTabChange(tab.key)}
          className="relative z-10 flex items-center justify-center cursor-pointer"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: activeTab === tab.key
              ? 'rgba(255,255,255,0.95)'
              : 'rgba(255,255,255,0.45)',
            padding: '0 20px',
            height: '100%',
            background: 'transparent',
            border: 'none',
            transition: 'color 150ms ease',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default DreamPillSwitcher;
