import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';

interface StickyNavProps {
  onCTAClick: () => void;
}

export const StickyNav: React.FC<StickyNavProps> = ({ onCTAClick }) => {
  const [scrolled, setScrolled] = useState(false);
  const { language, setLanguage } = useTranslation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={[
        'fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between',
        'transition-all duration-300 ease-in-out',
        scrolled
          ? 'bg-black/80 backdrop-blur-xl border-b border-white/10'
          : 'bg-transparent',
      ].join(' ')}
    >
      {/* Logo */}
      <div className="flex items-center gap-0.5 select-none min-w-0">
        <span
          className="text-white text-base md:text-2xl tracking-wider md:tracking-widest uppercase"
          style={{ fontFamily: 'Orbitron, sans-serif' }}
        >
          SECRET
        </span>
        <span
          className="text-base md:text-2xl tracking-wider md:tracking-widest uppercase italic font-bold"
          style={{ fontFamily: 'Orbitron, sans-serif', color: '#CCFF00' }}
        >
          COACH
        </span>
      </div>

      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <div className="inline-flex items-center rounded-full border border-white/20 bg-black/40 p-0.5 backdrop-blur-md">
          <button
            onClick={() => setLanguage('en')}
            className={[
              'min-w-[34px] rounded-full px-2 py-1 text-[10px] md:text-xs font-bold tracking-wider transition-all',
              language === 'en'
                ? 'bg-[#CCFF00] text-black'
                : 'text-gray-300 hover:text-white',
            ].join(' ')}
            style={{ fontFamily: 'Inter, sans-serif' }}
            aria-label="Switch language to English"
            aria-pressed={language === 'en'}
          >
            EN
          </button>
          <button
            onClick={() => setLanguage('ko')}
            className={[
              'min-w-[34px] rounded-full px-2 py-1 text-[10px] md:text-xs font-bold tracking-wider transition-all',
              language === 'ko'
                ? 'bg-[#CCFF00] text-black'
                : 'text-gray-300 hover:text-white',
            ].join(' ')}
            style={{ fontFamily: 'Inter, sans-serif' }}
            aria-label="언어를 한국어로 변경"
            aria-pressed={language === 'ko'}
          >
            KO
          </button>
        </div>

        {/* CTA Button */}
        <button
          onClick={onCTAClick}
          className={[
            'px-3 py-1.5 md:px-4 md:py-2 rounded-full text-[10px] md:text-sm font-semibold uppercase tracking-wider md:tracking-widest',
            'border transition-all duration-200 whitespace-nowrap',
            'hover:bg-[#CCFF00] hover:text-black hover:scale-105',
          ].join(' ')}
          style={{
            color: '#CCFF00',
            borderColor: '#CCFF00',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {language === 'ko' ? '무료 시작' : 'Start Free'}
        </button>
      </div>
    </nav>
  );
};
