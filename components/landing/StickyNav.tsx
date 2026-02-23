import React, { useState, useEffect } from 'react';

interface StickyNavProps {
  onCTAClick: () => void;
}

export const StickyNav: React.FC<StickyNavProps> = ({ onCTAClick }) => {
  const [scrolled, setScrolled] = useState(false);

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

      {/* CTA Button */}
      <button
        onClick={onCTAClick}
        className={[
          'px-3 py-1.5 md:px-4 md:py-2 rounded-full text-[10px] md:text-sm font-semibold uppercase tracking-wider md:tracking-widest',
          'border transition-all duration-200 whitespace-nowrap shrink-0',
          'hover:bg-[#CCFF00] hover:text-black hover:scale-105',
        ].join(' ')}
        style={{
          color: '#CCFF00',
          borderColor: '#CCFF00',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        무료 체험 확인
      </button>
    </nav>
  );
};
