import { useState, useEffect, useCallback } from 'react';
import type { ToDoItem } from '../types';
import type { AppLanguage } from '../i18n/types';

const todayKey = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const STORAGE_PREFIX = 'secretcoach-feedback-done';

const wasDone = (slot: 'morning' | 'evening'): boolean => {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}-${todayKey()}-${slot}`) === '1';
  } catch {
    return false;
  }
};

const markDone = (slot: 'morning' | 'evening'): void => {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}-${todayKey()}-${slot}`, '1');
  } catch {
    // ignore
  }
};

const getMorningDirective = (lang: AppLanguage): string =>
  lang === 'ko'
    ? `[아침 피드백 모드]
지금은 하루 시작 브리핑 시간입니다.
오늘 예정 할일을 먼저 짧게 정리하고 칭찬을 1문장 포함하세요.
그 다음 질문은 딱 2개만 하세요.
1) 오늘 일정/할일에서 조정할 것이 있는지
2) 오늘 새로 추가할 할일이 있는지
문장은 짧고 따뜻하게 유지하세요.`
    : `[Morning Feedback Mode]
This is the start-of-day briefing.
Summarize today's planned tasks first and include one short praise sentence.
Then ask exactly two questions:
1) Any adjustments needed for today's schedule or tasks?
2) Any extra tasks to add for today?
Keep it concise and warm.`;

const buildEveningDirective = (
  completed: string[],
  incomplete: string[],
  lang: AppLanguage,
): string => {
  if (lang === 'ko') {
    return `[저녁 피드백 모드 - 오늘의 승리]
완료한 할일: ${completed.length > 0 ? completed.join(', ') : '없음'}
미완료 할일: ${incomplete.length > 0 ? incomplete.join(', ') : '없음'}

대화 순서:
1) 완료한 항목을 먼저 칭찬
2) 미완료 항목의 이유/사정을 부드럽게 질문
3) 필요하면 내일 계획 조정 제안

대화가 마무리되는 마지막 응답 끝에 아래 형식을 추가하세요.
<!-- COMMENT: 오늘의 승리 한줄 요약 -->`;
  }

  return `[Evening Feedback Mode - Today's Wins]
Completed todos: ${completed.length > 0 ? completed.join(', ') : 'None'}
Incomplete todos: ${incomplete.length > 0 ? incomplete.join(', ') : 'None'}

Conversation order:
1) Praise completed items first
2) Gently ask reasons for incomplete items
3) Suggest plan adjustment for tomorrow if needed

When wrapping up, append:
<!-- COMMENT: one-line summary of today's win -->`;
};

export type FeedbackSlot = 'morning' | 'evening' | null;

interface CoachFeedbackResult {
  pendingDirective: string | null;
  feedbackSlot: FeedbackSlot;
  markFeedbackDone: () => void;
}

export const useCoachFeedback = (
  isOpen: boolean,
  todos: ToDoItem[],
  language: AppLanguage = 'ko',
  forcedSlot: FeedbackSlot = null,
): CoachFeedbackResult => {
  const [pendingDirective, setPendingDirective] = useState<string | null>(null);
  const [feedbackSlot, setFeedbackSlot] = useState<FeedbackSlot>(null);

  useEffect(() => {
    if (!isOpen) {
      setPendingDirective(null);
      setFeedbackSlot(null);
      return;
    }
    if (pendingDirective) return;

    // Only trigger from alarm click (forcedSlot), never from time-based auto-detection
    if (!forcedSlot || wasDone(forcedSlot)) {
      setFeedbackSlot(null);
      return;
    }

    if (forcedSlot === 'morning') {
      setPendingDirective(getMorningDirective(language));
      setFeedbackSlot('morning');
      return;
    }

    const completed = todos.filter((t) => t.completed).map((t) => t.text);
    const incomplete = todos.filter((t) => !t.completed).map((t) => t.text);
    setPendingDirective(buildEveningDirective(completed, incomplete, language));
    setFeedbackSlot('evening');
  }, [isOpen, todos, language, forcedSlot, pendingDirective]);

  const markFeedbackDone = useCallback(() => {
    if (!feedbackSlot) return;
    markDone(feedbackSlot);
    setPendingDirective(null);
    setFeedbackSlot(null);
  }, [feedbackSlot]);

  return { pendingDirective, feedbackSlot, markFeedbackDone };
};
