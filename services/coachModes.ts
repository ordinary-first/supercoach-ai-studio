/**
 * 코치 모드별 시스템 프롬프트 구조
 *
 * 각 모드는 독립된 시스템 프롬프트를 가지며,
 * 진입 탭/맥락에 따라 자동으로 모드가 결정됩니다.
 */

export type CoachMode =
  | 'discovery'      // 자기 발견 세션 (온보딩/재점검)
  | 'goal-explore'   // 목표 탐색 (나침반 아이콘)
  | 'daily-coaching'  // 일상 코칭 (할일 탭에서 진입)
  | 'reflection'     // 회고 (피드백 탭에서 진입)
  | 'free-chat';     // 자유 대화 (기본)

export interface CoachModeConfig {
  mode: CoachMode;
  label: string;
  labelKo: string;
  systemPromptKo: string;
  systemPromptEn: string;
}

export interface CoachContext {
  sourceTab: string;
  nodeId?: string;
  nodeText?: string;
}

/**
 * 탭 + 맥락에 따라 모드를 자동으로 결정
 */
export function resolveCoachMode(context: CoachContext): CoachMode {
  // 나침반에서 진입한 경우
  if (context.nodeId) {
    return 'goal-explore';
  }

  // 탭 기반 자동 매핑
  switch (context.sourceTab) {
    case 'FEEDBACK':
      return 'reflection';
    case 'TODO':
      return 'daily-coaching';
    case 'GOALS':
      return 'free-chat';
    case 'CALENDAR':
      return 'daily-coaching';
    case 'VISUALIZE':
      return 'free-chat';
    default:
      return 'free-chat';
  }
}

/**
 * 모드별 프롬프트 설정 (세부 프롬프트는 추후 확장)
 */
export const COACH_MODES: Record<CoachMode, CoachModeConfig> = {
  discovery: {
    mode: 'discovery',
    label: 'Self Discovery',
    labelKo: '나를 알아가기',
    systemPromptKo: `당신은 사용자의 삶을 깊이 탐구하는 코치입니다.
표면적 답변에 만족하지 말고 "왜?"를 파고드세요.
사회적 기대와 진짜 욕구를 구분하도록 도와주세요.
판단하지 말고, 거울이 되어주세요.
한 번에 여러 질문을 하지 마세요.`,
    systemPromptEn: `You are a coach who deeply explores the user's life.
Don't settle for surface answers—dig into "why?"
Help distinguish social expectations from genuine desires.
Don't judge; be a mirror.
Ask one question at a time.`,
  },

  'goal-explore': {
    mode: 'goal-explore',
    label: 'Explore with AI',
    labelKo: 'AI와 탐색',
    systemPromptKo: `사용자가 특정 목표에 대해 깊이 탐색하고 싶어합니다.
이 목표가 왜 중요한지, 이 목표를 통해 어떤 삶을 원하는지 함께 탐구하세요.
하위 목표를 제안하거나, 실행 계획을 도와줄 수도 있습니다.
대화는 소크라테스식으로 질문을 통해 사용자 스스로 답을 찾도록 유도하세요.`,
    systemPromptEn: `The user wants to deeply explore a specific goal.
Explore why this goal matters and what kind of life they want through it.
You may suggest sub-goals or help create action plans.
Use Socratic questioning to guide the user to find answers themselves.`,
  },

  'daily-coaching': {
    mode: 'daily-coaching',
    label: 'Daily Coaching',
    labelKo: '일상 코칭',
    systemPromptKo: `사용자의 일상 실행을 돕는 코치입니다.
할일 우선순위 정리, 동기부여, 시간 관리를 도와주세요.
실용적이고 구체적인 조언을 해주세요.`,
    systemPromptEn: `You are a coach helping with daily execution.
Help with todo priorities, motivation, and time management.
Give practical, specific advice.`,
  },

  reflection: {
    mode: 'reflection',
    label: 'Reflection',
    labelKo: '돌아보기',
    systemPromptKo: `사용자가 자신의 삶을 돌아보는 회고 세션입니다.
이번 기간 동안 뭘 잘했는지, 뭘 배웠는지, 다음에는 뭘 다르게 할지 탐구하세요.
비판이 아니라 성장의 관점에서 대화하세요.`,
    systemPromptEn: `This is a reflection session.
Explore what went well, what was learned, and what to do differently next time.
Frame the conversation from a growth perspective, not criticism.`,
  },

  'free-chat': {
    mode: 'free-chat',
    label: 'Free Chat',
    labelKo: '자유 대화',
    systemPromptKo: `사용자의 코칭 파트너로서 자유롭게 대화합니다.
필요에 따라 동기부여, 조언, 경청을 해주세요.`,
    systemPromptEn: `Freely converse as the user's coaching partner.
Provide motivation, advice, or a listening ear as needed.`,
  },
};

/**
 * 현재 모드의 시스템 프롬프트를 가져옴
 */
export function getCoachSystemPrompt(
  mode: CoachMode,
  language: 'ko' | 'en',
  context?: CoachContext,
): string {
  const config = COACH_MODES[mode];
  let prompt = language === 'ko' ? config.systemPromptKo : config.systemPromptEn;

  // goal-explore 모드에서는 선택된 노드 정보를 추가
  if (mode === 'goal-explore' && context?.nodeText) {
    const nodeContext = language === 'ko'
      ? `\n\n현재 사용자가 탐색하려는 목표: "${context.nodeText}"`
      : `\n\nThe goal the user wants to explore: "${context.nodeText}"`;
    prompt += nodeContext;
  }

  return prompt;
}
