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
그 다음 아래 두 가지를 자연스럽게 물어보세요.
1) 오늘 일정/할일에서 조정할 것이 있는지
2) 오늘 새로 추가할 할일이 있는지
문장은 짧고 따뜻하게 유지하세요.`
    : `[Morning Feedback Mode]
This is the start-of-day briefing.
Summarize today's planned tasks first and include one short praise sentence.
Then naturally weave in these two topics:
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

대화 원칙:
1) 먼저 "오늘 하루는 어떠셨나요?"처럼 열린 질문으로 시작해서 사용자가 편하게 말하게 하라.
2) 사용자 답변을 충분히 들은 뒤에만 완료 항목을 자연스럽게 언급/칭찬하라. 답변에서 이미 나온 내용은 반복하지 마라.
3) 미완료 항목은 심문하듯 캐묻지 마라. 사용자가 스스로 꺼내지 않으면 굳이 지적하지 말고, 언급하더라도 "왜 못했어요"가 아니라 "오늘 무슨 일이 있었어요?" 식으로 비난 없는 톤을 써라. 매번 반드시 물어야 하는 건 아니다.
4) 필요하다고 느껴질 때만 내일 계획 조정을 제안하라. 매번 제안할 필요는 없다.

이번 응답은 대화의 시작(오프닝)입니다. 사용자가 아직 아무 답도 하지 않았으니, 이번 응답 끝에는 <!-- COMMENT --> 형식을 절대 붙이지 마세요.`;
  }

  return `[Evening Feedback Mode - Today's Wins]
Completed todos: ${completed.length > 0 ? completed.join(', ') : 'None'}
Incomplete todos: ${incomplete.length > 0 ? incomplete.join(', ') : 'None'}

Conversation principles:
1) Start with an open question like "How was your day today?" so the user can share freely first.
2) Only after hearing their response, naturally mention or praise completed items. Don't repeat what they already said.
3) Don't interrogate about incomplete items. If they don't bring it up themselves, don't push it. If you do mention it, avoid "why didn't you" phrasing — use a non-judgmental tone like "What got in the way today?" You don't need to ask this every time.
4) Only suggest adjusting tomorrow's plan when it feels needed — not every time.

This response is the opening of the conversation. The user hasn't replied yet, so do NOT append the <!-- COMMENT --> format at the end of this response.`;
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
