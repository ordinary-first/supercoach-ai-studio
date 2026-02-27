import React, { useState } from 'react';
import { X, Sun, Moon } from 'lucide-react';
import type { TranslationStrings } from '../../i18n/types';

interface FeedbackSettingsSheetProps {
  t: TranslationStrings;
  onClose: () => void;
}

const TIME_OPTIONS = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30',
  '09:00', '09:30', '10:00', '10:30', '11:00',
];

const EVENING_OPTIONS = [
  '19:00', '19:30', '20:00', '20:30', '21:00', '21:30',
  '22:00', '22:30', '23:00',
];

const formatTime = (time: string): string => {
  const [h, m] = time.split(':').map(Number);
  const period = h < 12 ? '오전' : '오후';
  const hour = h > 12 ? h - 12 : h;
  return `${period} ${hour}:${String(m).padStart(2, '0')}`;
};

export const FeedbackSettingsSheet: React.FC<FeedbackSettingsSheetProps> = ({
  t,
  onClose,
}) => {
  const [morningTime, setMorningTime] = useState('08:00');
  const [eveningTime, setEveningTime] = useState('21:00');
  const [morningEnabled, setMorningEnabled] = useState(false);
  const [eveningEnabled, setEveningEnabled] = useState(false);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70 animate-fade-in" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-[#141414] rounded-t-3xl max-h-[70vh] flex flex-col animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-base font-bold text-white/90">{t.feedback.settings}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5">
            <X size={16} className="text-white/40" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-6">
          {/* Morning */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sun size={14} className="text-amber-400" />
              <span className="text-[13px] font-semibold text-white/80">{t.feedback.morningAlarm}</span>
            </div>
            <p className="text-[11px] text-white/40">{t.feedback.morningDesc}</p>

            <select
              value={morningTime}
              onChange={(e) => setMorningTime(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-[13px] text-white/70 focus:outline-none focus:border-th-accent/50 appearance-none"
            >
              {TIME_OPTIONS.map((time) => (
                <option key={time} value={time}>{formatTime(time)}</option>
              ))}
            </select>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-[12px] text-white/50">
                {morningEnabled ? t.feedback.alarmOn : t.feedback.alarmOff}
              </span>
              <div
                onClick={() => setMorningEnabled(!morningEnabled)}
                className={`w-10 h-5 rounded-full transition-colors relative ${morningEnabled ? 'bg-th-accent' : 'bg-white/10'}`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${morningEnabled ? 'translate-x-5' : 'translate-x-0.5'}`}
                />
              </div>
            </label>
          </div>

          <div className="border-t border-white/[0.06]" />

          {/* Evening */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Moon size={14} className="text-indigo-400" />
              <span className="text-[13px] font-semibold text-white/80">{t.feedback.eveningAlarm}</span>
            </div>
            <p className="text-[11px] text-white/40">{t.feedback.eveningDesc}</p>

            <select
              value={eveningTime}
              onChange={(e) => setEveningTime(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-[13px] text-white/70 focus:outline-none focus:border-th-accent/50 appearance-none"
            >
              {EVENING_OPTIONS.map((time) => (
                <option key={time} value={time}>{formatTime(time)}</option>
              ))}
            </select>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-[12px] text-white/50">
                {eveningEnabled ? t.feedback.alarmOn : t.feedback.alarmOff}
              </span>
              <div
                onClick={() => setEveningEnabled(!eveningEnabled)}
                className={`w-10 h-5 rounded-full transition-colors relative ${eveningEnabled ? 'bg-th-accent' : 'bg-white/10'}`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${eveningEnabled ? 'translate-x-5' : 'translate-x-0.5'}`}
                />
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
