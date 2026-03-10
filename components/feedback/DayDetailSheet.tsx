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
        className="absolute inset-0 bg-th-overlay/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-th-elevated rounded-t-3xl max-h-[85vh] flex flex-col animate-slide-up shadow-2xl border-t border-th-border/50">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-th-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <div>
            <h2 className="text-base font-bold text-th-text">{title}</h2>
            <p className="text-[11px] text-th-text-tertiary mt-0.5">{dateStr}</p>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && card && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 rounded-full hover:bg-th-surface-hover transition-colors"
              >
                <Pencil size={14} className="text-th-text-tertiary" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-th-surface-hover transition-colors"
            >
              <X size={16} className="text-th-text-tertiary" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5" style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
          {noData ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-[13px] text-th-text-muted text-center whitespace-pre-line">
                {t.feedback.emptyRecordHint}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Completed */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Trophy size={14} className="text-th-accent" />
                  <span className="text-[12px] font-semibold text-th-text-secondary uppercase tracking-wider">
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
                      <span className="text-[13px] text-th-text leading-snug">{item}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Incomplete Toggle */}
              {(isEditing ? editIncomplete : card?.incompleteTodos ?? []).length > 0 && (
                <div>
                  <button
                    onClick={() => setShowIncomplete(!showIncomplete)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-th-surface text-[11px] text-th-text-tertiary border border-th-border hover:bg-th-surface-hover transition-colors"
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
                            className={`mt-0.5 shrink-0 ${isEditing ? 'text-th-text-tertiary group-hover:text-th-accent' : 'text-th-text-tertiary'}`}
                          />
                          <span className="text-[13px] text-th-text-tertiary leading-snug">{item}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Coach Comment */}
              <div className="border-t border-th-border/50 pt-4">
                <p className="text-[11px] text-th-text-tertiary mb-2">{t.feedback.coachComment}</p>
                {isEditing ? (
                  <textarea
                    value={editComment}
                    onChange={(e) => setEditComment(e.target.value)}
                    className="w-full bg-th-surface border border-th-border rounded-xl px-3 py-2 text-[13px] text-th-text resize-none focus:outline-none focus:border-th-accent/50"
                    rows={2}
                    placeholder="코치의 한줄 코멘트..."
                  />
                ) : (
                  card?.coachComment && (
                    <p className="text-[13px] text-th-text-secondary italic">
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
          <div className="px-5 pt-2" style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}>
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
