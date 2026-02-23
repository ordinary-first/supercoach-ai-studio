import { GoalNode, NodeType, CoachingTopicId } from '../types';

export interface CoachingTopicDef {
  id: CoachingTopicId;
  label: string;
  icon: string;
  description: string;
  topicDirective: string | null;
}

const ALL_TOPICS: CoachingTopicDef[] = [
  {
    id: 'meaning-seeking-goals',
    label: '의미추구 목표 설정이란?',
    icon: '🧭',
    description: '목표의 진정한 의미를 발견하세요',
    topicDirective: `[코칭 토픽: 의미추구 목표 설정]
사용자가 "의미추구 목표 설정이란?"을 선택했습니다.
강의가 아닌 자연스러운 대화로 아래 핵심을 전달하세요. 한 번에 한 가지만 다루고 사용자 반응을 기다리세요:

1. 목표 설정은 단순한 생산성 향상이 아닌, 인간 존재의 의미 구조를 세우는 것
2. 명확한 목표 없이는 세상을 인식하는 인지적 프레임이 붕괴되어 혼돈에 빠진다
3. 최고선(Highest Good): 피할 수 있는 고통을 줄이고, 진실한 언행으로 혼돈 속에서 거주 가능한 질서를 이끌어내는 과정
4. 목표 달성은 결과 획득이 아닌, 그 목표를 감당할 수 있는 존재로 자신을 벼리는(도구화하는) 과정
5. "역량은 정체성의 부산물이다" - 기술 습득은 기능적이지만, 정체성 변화는 존재론적 변화

첫 메시지에서 따뜻하게 환영하며 대화를 시작하세요. 사용자가 왜 이 주제에 관심을 가졌는지 물어보는 것도 좋습니다.`,
  },
  {
    id: 'discover-identity',
    label: '나의 정체성 발견하기',
    icon: '🔍',
    description: '깊은 질문으로 진짜 나를 찾기',
    topicDirective: `[코칭 토픽: 정체성 발견]
사용자가 "나의 정체성 발견하기"를 선택했습니다.
아래 5가지 질문을 대화 형태로, 하나씩 순서대로 진행하세요. 각 질문에 대한 사용자의 답변을 깊이 경청하고 리프레이밍한 뒤 다음 질문으로 넘어가세요:

1. "당신이 누군가를 보며 '부럽다' 혹은 '질투 난다'고 느꼈던 순간은 언제인가요? 그 사람의 '돈'이 아니라 그가 가진 어떤 '성품'이나 '영향력'이 당신의 가슴을 뛰게 합니까?"
2. "만약 당신이 충분히 강하다면, 당신의 가족이나 공동체를 위해 짊어지고 싶은 '가장 가치 있는 것'은 무엇입니까? 당신이 그 짐을 짊어질 때, 사람들은 당신을 무엇이라 부를까요?"
3. "현재 당신의 모습 중 '이것은 진짜 내가 아니다'라고 느껴지는 행동이나 습관은 무엇입니까? 그것을 완전히 걷어냈을 때 남겨지는 '가장 순수한 당신의 모습'은 어떤 모습입니까?"
4. "당신 주변의 세상에서 가장 고쳐지지 않는 것은 무엇입니까? 당신이 가진 재능을 발휘해 그 혼돈을 '아름다운 질서'로 바꿀 수 있다면, 당신은 어떤 능력을 갖춘 존재여야만 합니까?"
5. "당신이 죽음 직전에 삶을 되돌아본다고 가정합시다. '그때 힘들었지만, 이 사람으로 살았던 것만큼은 정말 자랑스럽다'고 말할 수 있는 그 인격체는 어떤 특징을 가지고 있습니까?"

첫 메시지에서 따뜻하게 환영하고 간단히 정체성 노드의 의미를 설명한 뒤, 질문 1번만 자연스럽게 던지세요.
"정체성 노드"란: 역량은 정체성의 부산물이다. 기술을 배우는 건 기능적 습득이지만, 정체성을 바꾸는 건 존재론적 변화. 목표를 달성하는 역량은 그 목표에 어울리는 인격을 갖추려 애쓰는 과정에서 자연스럽게 길러진다.`,
  },
  {
    id: 'free-chat',
    label: '자유 대화',
    icon: '💬',
    description: '코치와 자유롭게 대화하기',
    topicDirective: null,
  },
];

export function getAvailableTopics(nodes: GoalNode[]): CoachingTopicDef[] {
  const hasSubNodes = nodes.some(n => n.type === NodeType.SUB);

  if (hasSubNodes) {
    return ALL_TOPICS.filter(t => t.id === 'free-chat');
  }

  const hasRoot = nodes.some(n => n.type === NodeType.ROOT && n.text?.trim());
  if (hasRoot) {
    return ALL_TOPICS.filter(t =>
      t.id === 'discover-identity' || t.id === 'free-chat'
    );
  }

  return ALL_TOPICS;
}
