import { type FC, useMemo } from 'react';
import { useTranslation } from '../../i18n/useTranslation';

interface DreamPillSwitcherProps {
  activeTab: 'create' | 'gallery';
  onTabChange: (tab: 'create' | 'gallery') => void;
}

const DreamPillSwitcher: FC<DreamPillSwitcherProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation();
  const tabs = useMemo(() => {
    return [
      { key: 'create' as const, label: t.visualization.dreamCreate },
      { key: 'gallery' as const, label: t.visualization.myDreams },
    ];
  }, [t]);

  const activeIndex = activeTab === 'create' ? 0 : 1;

  return (
    <div className="apple-chip relative flex items-center mx-auto h-8 px-0.5">
      <div
        className="absolute top-0.5 bottom-0.5 left-0.5 rounded-full bg-th-accent shadow-sm transition-transform duration-200"
        style={{ width: 'calc(50% - 2px)', transform: `translateX(${activeIndex * 100}%)` }}
      />

      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onTabChange(tab.key)}
          className={`relative z-10 px-5 h-full text-[13px] transition-colors ${activeTab === tab.key ? 'text-th-text-inverse font-semibold' : 'text-th-text-tertiary hover:text-th-text-secondary'
            }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default DreamPillSwitcher;
