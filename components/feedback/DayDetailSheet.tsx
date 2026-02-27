import React, { useState, useCallback } from 'react';
import { X, Pencil, Check, Circle, ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import type { FeedbackCard } from '../../types';
import type { TranslationStrings } from '../../i18n/types';

interface DayDetailSheetProps {
  date: Date;
  card: FeedbackCard | null;
  t: TranslationStrings;
  onClose: () => void;
  onSave: (card: FeedbackCard) => void;
}

const getDayName = (date: Date, t: TranslationStrings): string => {
  const idx = (date.getDay() + 6) % 7;
  return t.feedback.dayNames[idx];
};

const formatDate = (date: Date): string => {
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

export const DayDetailSheet: React.FC<DayDetailSheetProps> = ({
  date,
  card,
  t,
  onClose,
  onSave,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showIncomplete, setShowIncomplete] = useState(false);
  const [editComment, setEditComment] = useState(card?.coachComment ?? '');
  const [editCompleted, setEditCompleted] = useState<string[]>(card?.completedTodos ?? []);
  const [editIncomplete, setEditIncomplete] = useState<string[]>(card?.incompleteTodos ?? []);

  const dayName = getDayName(date, t);
  const dateStr = formatDate(date);
  const title = t.feedback.dayWins.replace('{day}', dayName);

  const handleSave = useCallback(() => {
    if (!card) return;
    const updated: FeedbackCard = {
      ...card,
      completedTodos: editCompleted,
      incompleteTodos: editIncomplete,
      coachComment: editComment || undefined,
      userEdited: true,
      updatedAt: Date.now(),
    };
    onSave(updated);
    setIsEditing(false);
  }, [card, editCompleted, editIncomplete, editComment, onSave]);

  const toggleItem = (item: string, fromCompleted: boolean) => {
    if (!isEditing) return;
    if (fromCompleted) {
      setEditCompleted((prev) => prev.filter((i) => i !== item));
      setEditIncomplete((prev) => [...prev, item]);
    } else {
      setEditIncomplete((prev) => prev.filter((i) => i !== item));
      setEditCompleted((prev) => [...prev, item]);
    }
  };

  const noData = !card || (card.completedTodos.length === 0 && card.incompleteTodos.length === 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-[#141414] rounded-t-3xl max-h-[85vh] flex flex-col animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <div>
            <h2 className="text-base font-bold text-white/90">{title}</h2>
            <p className="text-[11px] text-white/40 mt-0.5">{dateStr}</p>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && card && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 rounded-full hover:bg-white/5 transition-colors"
              >
                <Pencil size={14} className="text-white/50" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/5 transition-colors"
            >
              <X size={16} className="text-white/40" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-6">
          {noData ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-[13px] text-white/30 text-center whitespace-pre-line">
                {t.feedback.emptyRecordHint}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Completed */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Trophy size={14} className="text-th-accent" />
                  <span className="text-[12px] font-semibold text-white/70 uppercase tracking-wider">
                    {t.feedback.completed}
                  </span>
                </div>
                <div className="space-y-2">
                  {(isEditing ? editCompleted : card?.completedTodos ?? []).map((item, i) => (
                    <button
                      key={`c-${i}`}
                      onClick={() => toggleItem(item, true)}
                      className="flex items-start gap-2.5 w-full text-left group"
                    >
                      <Check
                        size={12}
                        className={`mt-0.5 shrink-0 ${isEditing ? 'text-th-accent group-hover:text-red-400' : 'text-th-accent'}`}
                      />
                      <span className="text-[13px] text-white/75 leading-snug">{item}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Incomplete Toggle */}
              {(isEditing ? editIncomplete : card?.incompleteTodos ?? []).length > 0 && (
                <div>
                  <button
                    onClick={() => setShowIncomplete(!showIncomplete)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] text-[11px] text-white/40 hover:text-white/60 transition-colors"
                  >
                    {showIncomplete ? t.feedback.hideIncomplete : t.feedback.showIncomplete}
                    {showIncomplete ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>

                  {showIncomplete && (
                    <div className="space-y-2 mt-3 animate-expand">
                      {(isEditing ? editIncomplete : card?.incompleteTodos ?? []).map((item, i) => (
                        <button
                          key={`i-${i}`}
                          onClick={() => toggleItem(item, false)}
                          className="flex items-start gap-2.5 w-full text-left group"
                        >
                          <Circle
                            size={12}
                            className={`mt-0.5 shrink-0 ${isEditing ? 'text-white/30 group-hover:text-th-accent' : 'text-white/30'}`}
                          />
                          <span className="text-[13px] text-white/40 leading-snug">{item}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Coach Comment */}
              <div className="border-t border-white/[0.06] pt-4">
                <p className="text-[11px] text-white/40 mb-2">{t.feedback.coachComment}</p>
                {isEditing ? (
                  <textarea
                    value={editComment}
                    onChange={(e) => setEditComment(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-[13px] text-white/80 resize-none focus:outline-none focus:border-th-accent/50"
                    rows={2}
                    placeholder="코치의 한줄 코멘트..."
                  />
                ) : (
                  card?.coachComment && (
                    <p className="text-[13px] text-white/50 italic">
                      &ldquo;{card.coachComment}&rdquo;
                    </p>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        {isEditing && (
          <div className="px-5 pb-5 pt-2">
            <button
              onClick={handleSave}
              className="w-full py-3 rounded-2xl bg-th-accent text-th-text-inverse font-bold text-sm transition-all hover:opacity-90"
            >
              {t.feedback.save}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
