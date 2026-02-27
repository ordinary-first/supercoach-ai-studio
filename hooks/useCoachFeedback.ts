import { useState, useEffect, useCallback } from 'react';
import type { ToDoItem } from '../types';

const MORNING_START = 6;
const MORNING_END = 10;
const EVENING_START = 20;
const EVENING_END = 24;

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
  } catch { return false; }
};

const markDone = (slot: 'morning' | 'evening'): void => {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}-${todayKey()}-${slot}`, '1');
  } catch { /* ignore */ }
};

const MORNING_DIRECTIVE = `[아침 피드백 모드]
지금은 하루 시작 브리핑 시간입니다.
오늘의 일정과 할일을 자연스럽게 섞어서 칭찬과 함께 전달하세요.
그 다음 딱 2가지만 물어보세요:
1. 오늘 일정 중 조정이 필요한 게 있는지
2. 추가로 오늘 할 일이 있는지
절대 3가지 이상 묻지 마세요. 간결하고 따뜻하게.`;

const buildEveningDirective = (
  completed: string[],
  incomplete: string[],
): string => `[저녁 피드백 모드 - 오늘의 승리]
완료한 할일: ${completed.length > 0 ? completed.join(', ') : '없음'}
미완료 할일: ${incomplete.length > 0 ? incomplete.join(', ') : '없음'}

${incomplete.length === 0
    ? '모든 할일을 완료했습니다! 칭찬 폭탄 MAX로 마무리하세요.'
    : `1. 완료한 것 먼저 칭찬
2. 못 한 것 이유 부드럽게 물어보기
3. 목표 조정 여부 물어보기`}

대화가 자연스럽게 마무리되면, 마지막 응답에 오늘의 한줄 코멘트를 포함하세요.
형식: 응답 텍스트 마지막 줄에 <!-- COMMENT: 한줄 코멘트 내용 --> 로 삽입.`;

export type FeedbackSlot = 'morning' | 'evening' | null;

interface CoachFeedbackResult {
  pendingDirective: string | null;
  feedbackSlot: FeedbackSlot;
  markFeedbackDone: () => void;
}

export const useCoachFeedback = (
  isOpen: boolean,
  todos: ToDoItem[],
): CoachFeedbackResult => {
  const [pendingDirective, setPendingDirective] = useState<string | null>(null);
  const [feedbackSlot, setFeedbackSlot] = useState<FeedbackSlot>(null);

  useEffect(() => {
    if (!isOpen) {
      setPendingDirective(null);
      setFeedbackSlot(null);
      return;
    }

    const hour = new Date().getHours();

    if (hour >= MORNING_START && hour < MORNING_END && !wasDone('morning')) {
      setPendingDirective(MORNING_DIRECTIVE);
      setFeedbackSlot('morning');
      return;
    }

    if (hour >= EVENING_START && hour < EVENING_END && !wasDone('evening')) {
      const completed = todos.filter(t => t.completed).map(t => t.text);
      const incomplete = todos.filter(t => !t.completed).map(t => t.text);
      setPendingDirective(buildEveningDirective(completed, incomplete));
      setFeedbackSlot('evening');
      return;
    }

    setPendingDirective(null);
    setFeedbackSlot(null);
  }, [isOpen, todos]);

  const markFeedbackDone = useCallback(() => {
    if (feedbackSlot) {
      markDone(feedbackSlot);
      setPendingDirective(null);
      setFeedbackSlot(null);
    }
  }, [feedbackSlot]);

  return { pendingDirective, feedbackSlot, markFeedbackDone };
};
