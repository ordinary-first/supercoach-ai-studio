import { useState, useCallback, useRef } from 'react';
import {
  fetchDreamScene,
  fetchRefineButtons,
  fetchSceneVariant,
  type RefineButton,
  type RefineResult,
} from '../services/aiService';
import type { AppLanguage } from '../i18n/types';

export interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
  type: 'scene' | 'user-input' | 'welcome';
}

// 갈림길: 현재 장면(원본) vs 수정 버튼으로 만든 변형. 사용자가 한쪽을 고른다.
export interface SceneBranch {
  original: string;
  variant: string;
  anchor: string;
  label: string;
}

const getWelcomeMessage = (lang: AppLanguage) =>
  lang === 'ko'
    ? '안녕하세요! 어떤 장면을 시각화해 볼까요? 아래에서 마음에 드는 주제를 선택하거나 직접 입력해 주세요.'
    : 'Hello! What scene would you like to visualize? Choose a topic below or type your own.';

const getErrorMessage = (lang: AppLanguage) =>
  lang === 'ko'
    ? '죄송해요, 잠시 오류가 발생했어요. 다시 시도해 주세요.'
    : 'Sorry, an error occurred. Please try again.';

const makeId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const EMPTY_REFINE: RefineResult = { mode: 'refine', isFinalReady: false, buttons: [] };

export function useDreamChat(language: AppLanguage = 'ko') {
  const welcomeMessage = getWelcomeMessage(language);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: makeId(), role: 'ai', content: welcomeMessage, type: 'welcome' },
  ]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [currentScene, setCurrentScene] = useState('');
  const [refine, setRefine] = useState<RefineResult>(EMPTY_REFINE);
  const [branch, setBranch] = useState<SceneBranch | null>(null);

  // async 콜백에서 최신값을 읽기 위한 refs (state 비동기 문제 회피)
  const sceneRef = useRef('');
  const rawInputRef = useRef('');
  const roundRef = useRef(1);
  const usedAnchorsRef = useRef<string[]>([]);
  const userPicksRef = useRef<string[]>([]);
  const branchRef = useRef<SceneBranch | null>(null);
  const pendingRef = useRef<{ anchor: string; label: string } | null>(null);

  const addMessage = useCallback(
    (role: ChatMessage['role'], content: string, type: ChatMessage['type']) => {
      setMessages((prev) => [...prev, { id: makeId(), role, content, type }]);
    },
    [],
  );

  const loadRefine = useCallback(async (scene: string, round: number) => {
    const res = await fetchRefineButtons({
      scene,
      rawInput: rawInputRef.current,
      round,
      usedAnchors: usedAnchorsRef.current,
      userPicks: userPicksRef.current,
    });
    setRefine(res);
  }, []);

  // 사용자가 직접 입력하거나 칩을 탭(seed) → 1차 장면 생성, 또는 현재 장면 수정
  const sendMessage = useCallback(
    async (text: string, goals: string[] = []) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const isFirst = !sceneRef.current;

      addMessage('user', trimmed, 'user-input');
      setIsAiTyping(true);
      setBranch(null);
      branchRef.current = null;

      try {
        const scene = await fetchDreamScene(trimmed, goals, isFirst ? undefined : sceneRef.current);
        if (!scene) {
          addMessage('ai', getErrorMessage(language), 'scene');
          return;
        }
        sceneRef.current = scene;
        setCurrentScene(scene);
        addMessage('ai', scene, 'scene');

        if (isFirst) {
          rawInputRef.current = trimmed;
          roundRef.current = 1;
          usedAnchorsRef.current = [];
          userPicksRef.current = [];
        }
        await loadRefine(scene, roundRef.current);
      } catch {
        addMessage('ai', getErrorMessage(language), 'scene');
      } finally {
        setIsAiTyping(false);
      }
    },
    [addMessage, language, loadRefine],
  );

  // 수정 버튼 탭 → 변형 장면 생성 → 갈림길(원본 vs 변형) 띄움
  const tapRefine = useCallback(async (button: RefineButton) => {
    const base = sceneRef.current;
    if (!base) return;
    setIsRefining(true);
    pendingRef.current = { anchor: button.anchor || button.label, label: button.label };
    try {
      const variant = await fetchSceneVariant(base, button.transform);
      const next: SceneBranch = {
        original: base,
        variant,
        anchor: button.anchor || button.label,
        label: button.label,
      };
      branchRef.current = next;
      setBranch(next);
    } finally {
      setIsRefining(false);
    }
  }, []);

  // 갈림길에서 한쪽 선택 → 현재 장면 확정 → 새 수정 버튼 로드
  const pickBranch = useCallback(
    async (which: 'original' | 'variant') => {
      const b = branchRef.current;
      if (!b) return;
      const chosen = which === 'variant' ? b.variant : b.original;

      sceneRef.current = chosen;
      setCurrentScene(chosen);
      if (which === 'variant') addMessage('ai', chosen, 'scene');

      usedAnchorsRef.current = [...usedAnchorsRef.current, b.anchor];
      if (which === 'variant') userPicksRef.current = [...userPicksRef.current, b.anchor];

      roundRef.current += 1;
      setBranch(null);
      branchRef.current = null;
      pendingRef.current = null;

      setIsAiTyping(true);
      try {
        await loadRefine(chosen, roundRef.current);
      } finally {
        setIsAiTyping(false);
      }
    },
    [addMessage, loadRefine],
  );

  const dismissBranch = useCallback(() => {
    setBranch(null);
    branchRef.current = null;
    pendingRef.current = null;
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([{ id: makeId(), role: 'ai', content: welcomeMessage, type: 'welcome' }]);
    setCurrentScene('');
    setRefine(EMPTY_REFINE);
    setBranch(null);
    sceneRef.current = '';
    rawInputRef.current = '';
    roundRef.current = 1;
    usedAnchorsRef.current = [];
    userPicksRef.current = [];
    branchRef.current = null;
    pendingRef.current = null;
  }, [welcomeMessage]);

  const getCurrentScene = useCallback((): string => sceneRef.current, []);

  return {
    messages,
    currentScene,
    isAiTyping,
    isRefining,
    refine,
    branch,
    sendMessage,
    tapRefine,
    pickBranch,
    dismissBranch,
    clearMessages,
    getCurrentScene,
  };
}
