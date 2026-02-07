
import React from 'react';
import { Keyboard, Zap, MousePointer2 } from 'lucide-react';
import CloseButton from './CloseButton';

interface ShortcutsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShortcutsPanel: React.FC<ShortcutsPanelProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const sections = [
    {
      title: "마인드맵 조작",
      items: [
        { key: 'Tab', desc: '하위 목표 추가' },
        { key: 'Enter', desc: '형제 목표 추가' },
        { key: 'Del', desc: '선택 삭제' },
        { key: 'Space', desc: '화면 중앙 이동' },
      ]
    },
    {
      title: "탐색 제어",
      items: [
        { key: '1 - 5', desc: '탭 전환' },
        { key: 'Esc', desc: '닫기 / 선택 해제' },
        { key: 'K', desc: '단축키 패널 열기/닫기' },
      ]
    }
  ];

  return (
    <div className="fixed left-6 bottom-24 z-50 animate-slide-up origin-bottom-left max-h-[calc(100vh-150px)]">
      <div className="bg-black/80 backdrop-blur-2xl border border-neon-lime/30 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] p-6 w-80 overflow-y-auto max-h-[calc(100vh-150px)] relative">
        {/* Decorative corner accent */}
        <div className="absolute top-0 right-0 w-16 h-16 bg-neon-lime/5 rounded-bl-full pointer-events-none"></div>
        
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neon-lime/20 rounded-lg">
                <Zap size={16} className="text-neon-lime" />
            </div>
            <div className="flex flex-col">
                <span className="font-display font-bold text-xs tracking-widest text-white uppercase">단축키 안내</span>
                <span className="text-[8px] text-neon-lime/60 uppercase font-mono tracking-tighter">키보드 단축키 활성</span>
            </div>
          </div>
          <CloseButton onClick={onClose} size="sm" />
        </div>

        <div className="space-y-6">
          {sections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-3">
              <h4 className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] border-l-2 border-neon-lime/50 pl-2">
                {section.title}
              </h4>
              <div className="space-y-2">
                {section.items.map((item, iIdx) => (
                  <div key={iIdx} className="flex justify-between items-center group">
                    <span className="text-[11px] text-gray-400 group-hover:text-white transition-colors">{item.desc}</span>
                    <div className="flex gap-1">
                      {item.key.split(' ').map((k, kIdx) => (
                        <kbd key={kIdx} className="bg-white/5 border border-white/10 rounded-md px-2 py-0.5 font-mono text-[10px] text-neon-lime min-w-[24px] text-center shadow-inner">
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-center gap-2">
            <MousePointer2 size={12} className="text-gray-600" />
            <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">더블클릭으로 노드 편집</span>
        </div>
      </div>
    </div>
  );
};

export default ShortcutsPanel;
