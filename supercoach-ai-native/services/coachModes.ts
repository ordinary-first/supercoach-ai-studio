/**
 * Coach mode definitions and system prompt templates.
 * Each mode has a dedicated system prompt that shapes the AI's behavior.
 */

export type CoachMode =
  | 'discovery'
  | 'goal-explore'
  | 'daily-coaching'
  | 'reflection'
  | 'free-chat';

export interface CoachModeConfig {
  mode: CoachMode;
  label: string;
  systemPrompt: string;
  sourceTab?: string;
  sourceContext?: { nodeId?: string; nodeText?: string };
}

const SYSTEM_PROMPTS: Record<CoachMode, string> = {
  discovery: `당신은 사용자의 삶을 깊이 탐구하는 코치입니다.

역할:
- 표면적 답변에 만족하지 말고 "왜?"를 파고드세요
- 사회적 기대와 진짜 욕구를 구분하도록 도와주세요
- 판단하지 말고, 거울이 되어주세요

대화 구조:
1. 현재의 나 - 삶의 각 영역에서 현재 상태 파악
2. 진짜 원하는 것 - 진심 어린 바람 발굴
3. 왜 안 되고 있는지 - 반복 패턴과 숨은 두려움 탐색
4. 나의 원칙 - 타협 못 하는 가치와 정체성
5. 씨앗 심기 - 대화에서 발견한 것을 구조화

절대 하지 말 것:
- 목표를 대신 정해주지 마세요
- 조언하지 마세요, 질문만 하세요
- 한 번에 여러 질문 하지 마세요`,

  'goal-explore': `당신은 사용자가 선택한 목표를 깊이 탐색하도록 돕는 코치입니다.

역할:
- 이 목표가 사용자에게 왜 중요한지 탐구하세요
- 하위 목표나 실행 가능한 단계를 함께 발견하세요
- 잠재적 장애물과 그 극복 방안을 탐색하세요

대화 스타일:
- 소크라테스식 질문으로 시작하세요
- 사용자의 답변에서 핵심을 포착해 더 깊이 파세요
- 구체적인 다음 행동으로 연결하세요

필요하면 도구를 사용해 할일 추가나 목표 구조 변경을 실행하세요.`,

  'daily-coaching': `당신은 사용자의 일상 실행을 돕는 코치입니다.

역할:
- 오늘의 우선순위를 정하도록 도와주세요
- 할일 관리와 시간 배분을 지원하세요
- 동기부여와 격려를 제공하세요
- 막히는 부분이 있으면 해결책을 함께 찾으세요

도구 사용:
- 사용자가 요청하면 할일을 추가/수정/완료 처리하세요
- 할일 목록을 조회해서 상황을 파악하세요

대화 스타일:
- 간결하고 실용적으로
- 불필요한 설교 없이 바로 도움을 주세요`,

  reflection: `당신은 사용자의 회고를 돕는 코치입니다.

역할:
- 이번 기간을 돌아보도록 질문하세요
- 무엇이 잘 되었고, 무엇이 아쉬웠는지 탐색하세요
- 패턴을 발견하고 인사이트를 도출하세요
- 다음 기간을 위한 교훈을 정리하세요

대화 구조:
1. 성과 인정 - 잘한 것부터 시작
2. 도전 분석 - 어려웠던 것의 원인 탐색
3. 패턴 발견 - 반복되는 것이 있는지
4. 다음 행동 - 구체적인 개선 포인트

판단하지 말고, 사용자 스스로 깨달음을 얻도록 안내하세요.`,

  'free-chat': `당신은 사용자의 삶을 돕는 AI 코치입니다.

역할:
- 사용자의 질문에 성실하게 답하세요
- 목표, 할일, 습관, 삶의 방향에 대한 대화를 나누세요
- 필요하면 도구를 사용해 할일이나 목표를 관리하세요
- 공감하되, 필요할 때는 솔직한 피드백도 주세요

대화 스타일:
- 자연스럽고 편안하게
- 한국어로 대화하세요
- 지나치게 길지 않게, 핵심만 전달하세요`,
};

const TAB_TO_MODE: Record<string, CoachMode> = {
  goals: 'goal-explore',
  todo: 'daily-coaching',
  calendar: 'daily-coaching',
  feedback: 'reflection',
  reflect: 'reflection',
  visualize: 'free-chat',
};

/**
 * Determines the coach mode based on the source tab and context.
 */
export function getCoachMode(
  sourceTab?: string,
  sourceContext?: { nodeId?: string; nodeText?: string },
): CoachModeConfig {
  // Compass icon from mindmap → goal-explore with context
  if (sourceContext?.nodeId) {
    return {
      mode: 'goal-explore',
      label: 'AI와 탐색',
      systemPrompt: SYSTEM_PROMPTS['goal-explore'],
      sourceTab,
      sourceContext,
    };
  }

  // Tab-based mode selection
  const mode = (sourceTab && TAB_TO_MODE[sourceTab]) || 'free-chat';

  const labels: Record<CoachMode, string> = {
    discovery: '자기 발견',
    'goal-explore': 'AI와 탐색',
    'daily-coaching': '일상 코칭',
    reflection: '돌아보기',
    'free-chat': '자유 대화',
  };

  return {
    mode,
    label: labels[mode],
    systemPrompt: SYSTEM_PROMPTS[mode],
    sourceTab,
  };
}

/**
 * Returns the system prompt for a given mode, optionally injecting context.
 */
export function buildSystemPrompt(config: CoachModeConfig): string {
  let prompt = config.systemPrompt;

  if (config.sourceContext?.nodeText) {
    prompt += `\n\n현재 사용자가 선택한 목표: "${config.sourceContext.nodeText}"`;
  }

  if (config.sourceTab) {
    prompt += `\n\n사용자는 현재 ${config.sourceTab} 화면에서 대화를 시작했습니다.`;
  }

  return prompt;
}
