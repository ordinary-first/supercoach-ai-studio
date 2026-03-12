import { GoalNode, NodeType } from '../types';
import type { AppLanguage } from '../i18n/types';

export interface CoachingQuestion {
  id: string;
  question: string;
  icon: string;
  summary: string;
  topicDirective: string;
}

const SITUATION_1_QUESTIONS: CoachingQuestion[] = [
  {
    id: 'brain-lag',
    question: '왜 목표가 없으면 뇌가 "렉"이 걸릴까요?',
    icon: '🧠',
    summary: '뇌 과학으로 알아보는 목표의 진짜 의미',
    topicDirective: `[코칭 질문: 왜 목표가 없으면 뇌가 '렉'이 걸릴까요?]
사용자가 이 질문을 선택했습니다. 아래 내용을 자연스러운 대화체로 전달하세요. 한 번에 모든 내용을 쏟지 말고, 핵심 포인트를 하나씩 풀어가며 사용자 반응을 유도하세요:

대부분의 사람들은 "목표가 있으면 좋고, 없어도 열심히 살면 되지"라고 생각합니다. 그런데 이건 뇌 과학을 전혀 모르는 소리예요. 우리 뇌는 세상을 있는 그대로 보는 게 아니라, 내가 가진 '목적'에 맞춰서 세상을 필터링하기 때문입니다.

1. 당신의 눈은 '사실'을 보지 않습니다
우리 뇌는 세상을 '객관적인 데이터'로 읽지 않아요. 대신 **"저게 내 목표에 도움이 되는 도구인가, 아니면 방해되는 장애물인가?"**라는 기준으로만 세상을 인식합니다. 예를 들어, 맛집을 가겠다는 목표가 생기는 순간, 길거리에 널려 있던 수많은 간판 중 '식당'만 눈에 확 들어오는 것과 같죠. 목표가 없으면 뇌는 무엇을 보고 무엇을 버릴지 결정을 못 합니다.

2. 목표가 없으면 지능이 낮아지는 이유 (혼돈의 상태)
명확한 목표가 없다는 건 단순히 게으른 게 아닙니다. 세상을 지각하는 프레임 자체가 박살 났다는 뜻이에요. 이 상태가 되면 뇌는 들어오는 모든 정보를 똑같은 중요도로 처리하려다 과부하가 걸립니다. 이게 바로 '혼돈(Chaos)'이죠. 뭘 해야 할지 모르겠고, 의욕이 없고, 불안한 이유는 당신이 부족해서가 아니라 뇌의 필터링 시스템(목표)이 꺼져 있기 때문입니다.

3. 목표는 '생산성'이 아니라 '생존'의 문제
결국 목표를 세우는 건 단순히 일을 많이 하기 위해서가 아니에요. 미쳐버리지 않기 위해서, 그리고 세상을 명확하게 읽어내기 위해서 반드시 필요합니다. 목표라는 기준점이 생겨야만 비로소 혼돈 가득한 세상이 내가 공략할 수 있는 '게임 맵'으로 변하는 겁니다.

마무리: "목표가 없는 인생은 안개 자욱한 고속도로를 시속 200km로 달리는 것과 같습니다. 당신의 뇌에 명확한 내비게이션을 찍으세요. 그래야 비로소 세상이 당신의 도구가 됩니다."`,
  },
  {
    id: 'meaning-goals',
    question: '어떤 목표를 추구해야 할까요?',
    icon: '🧭',
    summary: '남들이 좋다는 목표는 쓰레기통에 버리세요',
    topicDirective: `[코칭 질문: 어떤 목표를 추구해야 할까요?]
사용자가 이 질문을 선택했습니다. 아래 내용을 자연스러운 대화체로 전달하세요. 한 번에 모든 내용을 쏟지 말고, 핵심 포인트를 하나씩 풀어가며 사용자 반응을 유도하세요:

인생 공략집: '행복' 쫓다가 망하지 말고 '의미'를 세팅하라
대부분의 사람들은 "어떻게 하면 행복해질까?"를 고민하며 목표를 세우죠. 근데 이건 유전자의 오작동에 속는 겁니다. 행복은 도파민처럼 잠깐 왔다 사라지는 보너스 같은 거지, 인생의 목적지가 될 수 없거든요.

진짜 똑똑한 상위 1%의 성공하는 사람들은 **'의미 추구형 목표'**를 세팅합니다. 이건 단순히 할 일을 많이 해서 생산성을 높이는 게 아니에요. 인생이 원래 기본값이 '고통'과 '비극'이라는 걸 인정하는 데서 시작합니다.

1. 쾌락 대신 '책임'이라는 무기를 장착하세요
맛있는 거 먹고 노는 쾌락은 금방 적응되고 허무해지죠. 하지만 **'자발적 책임'**을 짊어지면 뇌는 고통을 '성장'으로 인식하기 시작합니다. 실존적인 허무함이라는 버그를 고치는 유일한 패치, 그게 바로 의미입니다. 실존적인 허무함에 빠져 허우적거리는 게 아니라, "내가 이 문제를 해결하고 있어"라는 강력한 정체성이 생기는 거죠.

2. 뇌의 가성비를 높이는 '내러티브 재구성'
목표를 제대로 세우면 우리 뇌의 신경 시스템이 그 목표에 딱 맞게 정렬됩니다. 세상의 수많은 정보 중에서 나에게 필요한 것들만 필터링해서 보여주는 거죠. 한마디로 내 뇌를 목표 달성 머신으로 최적화하는 과정입니다.

3. '최고선'은 결국 거주 가능한 질서를 만드는 것
거창하게 들리지만 별거 아닙니다. 내가 할 수 있는 선에서 쓰레기 같은 고통을 줄이고, 쪽팔리지 않게 진실하게 말하고 행동하는 거예요. 개판인 혼돈 상태에서 내가 살기 좋은 '질서'를 하나씩 구축해 나가는 게 바로 인생의 공략 포인트입니다.

4. 목표는 '결과'가 아니라 '도구'다
사람들은 목표를 달성해서 뭔가를 얻는 것에만 집착하죠? 틀렸습니다. 진짜 중요한 건 **그 목표를 이뤄낼 수 있을 만큼 괴물 같은 역량을 가진 사람으로 나를 업그레이드(Tooling)**하는 거예요. 결국 목표는 나라는 인간의 하드웨어와 소프트웨어를 갈아치우기 위한 **'최고의 도구'**일 뿐입니다.

마무리: "당신은 지금 단순히 돈을 벌기 위한 목표를 세우고 있나요, 아니면 당신이라는 인간을 완전히 재정의할 '의미'를 찾고 있나요?"`,
  },
  {
    id: 'identity-node',
    question: '왜 가장 중심노드는 정체성 노드여야 하나요?',
    icon: '🎯',
    summary: '역량은 정체성의 부산물입니다',
    topicDirective: `[코칭 질문: 왜 가장 중심노드는 정체성 노드여야 하나요?]
사용자가 이 질문을 선택했습니다. 아래 내용을 자연스러운 대화체로 전달하세요. 한 번에 모든 내용을 쏟지 말고, 핵심 포인트를 하나씩 풀어가며 사용자 반응을 유도하세요:

개인이 최고선을 달성할 수 있는 역량을 갖춘 존재로 스스로를 도구화(Tooling)하는 과정. 그 목표를 감당할 수 있는 존재로의 '변이(Transformation)'가 본질입니다.

"역량은 정체성의 부산물이다"
단순히 기술을 배우는 것은 '기능적 습득'에 불과하지만, 정체성을 바꾸는 것은 **'존재론적 변화'**입니다.

예를 들어, "글을 잘 쓰는 법"을 배우는 사람보다 "나는 진실을 전달하는 작가다"라는 정체성을 가진 사람이 겪는 훈련의 강도와 깊이는 다릅니다.

목표를 달성하는 역량은, 그 목표에 어울리는 인격(Character)을 갖추려고 애쓰는 과정에서 자연스럽게 길러지는 것입니다.

마무리: 정체성 노드를 마인드맵의 가장 중심에 놓으라고 유도하세요. 사용자에게 "당신이 되고 싶은 존재는 어떤 사람인가요?"라고 질문하세요.`,
  },
];

const SITUATION_1_QUESTIONS_EN: CoachingQuestion[] = [
  {
    id: 'brain-lag',
    question: 'Why does your brain "lag" without a clear goal?',
    icon: '🧠',
    summary: 'The neuroscience behind why goals actually matter',
    topicDirective: `[Coaching Topic: Why does your brain "lag" without a clear goal?]
The user selected this question. Deliver the content below in a natural conversational tone. Don't dump everything at once — unpack one key point at a time and invite the user's reaction:

Most people think: "Goals are nice to have, but I can work hard either way." That's a complete misunderstanding of how the brain actually works. Your brain doesn't perceive the world as it is — it filters reality through the lens of your current purpose.

1. Your eyes don't see "facts"
The brain doesn't process the world as objective data. Instead, it asks a single question about everything it encounters: **"Is this a tool that helps my goal, or an obstacle that threatens it?"** The moment you decide you want to find a great restaurant for dinner, your brain instantly starts spotting every restaurant sign on the street — signs that were invisible a moment ago. Without a goal, the brain can't decide what to notice and what to discard.

2. Why the absence of a goal literally lowers your intelligence (the Chaos state)
Not having a clear goal isn't just laziness. It means the perceptual framework your brain uses to make sense of the world has collapsed. In this state, the brain tries to assign equal weight to every incoming stimulus and overloads immediately. That's **Chaos** — and it's the real reason you feel directionless, unmotivated, and anxious. It's not a character flaw. Your brain's filtering system is simply switched off.

3. Goals are not a productivity hack — they're a survival mechanism
Setting a goal isn't about doing more work. It's about not losing your mind, and about being able to read the world clearly enough to act in it. Only when a goal exists does the chaos of daily life transform into a **game map you can actually navigate**.

Closing: "Living without a goal is like driving at 120 mph on a highway thick with fog. Give your brain a clear destination. Only then does the world become a set of tools working in your favor."`,
  },
  {
    id: 'meaning-goals',
    question: 'What kind of goals should you really pursue?',
    icon: '🧭',
    summary: "Forget what everyone else says is a good goal",
    topicDirective: `[Coaching Topic: What kind of goals should you really pursue?]
The user selected this question. Deliver the content below in a natural conversational tone. Don't dump everything at once — unpack one key point at a time and invite the user's reaction:

The life playbook: stop chasing "happiness" and configure for "meaning" instead.
Most people frame their goals around a single question: "How do I become happier?" That's falling for one of your genes' oldest tricks. Happiness is a bonus — a dopamine spike that comes and goes. It was never meant to be a destination.

The top 1% who actually build extraordinary lives configure what you might call **meaning-driven goals**. This isn't about getting more done or optimizing your schedule. It starts with an honest acknowledgment: life's default settings include suffering and tragedy. That's not pessimism — it's the prerequisite for everything that follows.

1. Swap pleasure for the weapon called "voluntary responsibility"
The pleasure of good food and leisure adapts quickly and turns hollow. But when you **voluntarily shoulder a heavy responsibility**, your brain reframes the pain as growth. Meaning is the only patch that fixes the existential emptiness bug. Instead of flailing in existential dread, you develop a powerful operating identity: "I am someone who solves this problem."

2. Narrative restructuring — the highest-ROI upgrade for your brain
When you set the right kind of goal, your entire neural architecture aligns around it. The brain begins to filter the world's noise and surface only what's relevant to you. In short, you're optimizing your mind into a goal-achieving machine.

3. The highest good is building a livable order
It sounds grand, but it's concrete: reduce the unnecessary suffering within your reach, speak and act with integrity, and construct — one decision at a time — an ordered world you can actually inhabit. That's the real game.

4. A goal is a tool, not a trophy
People fixate on the outcome — on what they'll have once they achieve the goal. Wrong frame. What actually matters is **who you become in the process of pursuing it** — the upgraded version of yourself capable of carrying the goal's weight. The goal is the best possible instrument for replacing your mental and behavioral hardware.

Closing: "Are you setting goals just to make more money — or are you searching for a meaning that will completely redefine who you are?"`,
  },
  {
    id: 'identity-node',
    question: 'Why should the center node be your identity?',
    icon: '🎯',
    summary: 'Competence is a byproduct of identity',
    topicDirective: `[Coaching Topic: Why should the center node be your identity?]
The user selected this question. Deliver the content below in a natural conversational tone. Don't dump everything at once — unpack one key point at a time and invite the user's reaction:

The core process is this: transforming yourself into someone capable of achieving the highest good you can imagine. The essence isn't skill acquisition — it's **Transformation** into the kind of person the goal demands.

"Competence is a byproduct of identity."
Simply learning a technique is functional acquisition. Changing your identity is **ontological transformation** — a shift in what you fundamentally are.

Consider the difference between someone studying "how to write well" versus someone who has claimed the identity: "I am a writer who delivers truth." The intensity and depth of the training each person submits to is categorically different.

The competence needed to achieve a goal grows naturally — almost inevitably — from the effort to embody the character that goal requires. You don't build the skill first and then become the person. You become the person, and the skills follow.

Closing: Guide the user to place their identity node at the very center of their mind map. Ask them directly: "Who is the person you want to become?"`,
  },
];

const SITUATION_2_QUESTIONS: CoachingQuestion[] = [
  {
    id: 'jealousy-fuel',
    question: '최근 누군가를 보고 열등감이 폭발하거나 질투가 나서 잠 못 잔 적 있나요?',
    icon: '😤',
    summary: '열등감을 정체성 변화의 연료로',
    topicDirective: `[코칭 질문: 열등감과 질투]
사용자가 "최근 누군가를 보고 열등감이 폭발하거나 질투가 나서 잠 못 잔 적 있나요?"를 선택했습니다.

그건 유전자가 보내는 강력한 메시지입니다. 단순히 그 사람의 '통장 잔고' 말고, 당신의 뇌가 무의식적으로 갈망하는 그 사람의 **'압도적 실력'**이나 **'자유로운 영향력'**이 무엇인지 파악하세요. 그 열등감을 정체성 변화의 연료로 쓰지 못하면 당신은 평생 순리자로 남게 됩니다.

사용자에게 구체적으로 누구에게 열등감을 느꼈는지, 그 사람의 어떤 성품이나 능력이 부러웠는지 물어보세요. 그 답변을 정체성 노드의 핵심 키워드로 연결해주세요.`,
  },
  {
    id: 'heavy-burden',
    question: '당신이 충분히 고지능자라면, 소중한 사람들을 위해 기꺼이 짊어질 "무거운 짐"은 무엇입니까?',
    icon: '💪',
    summary: '자발적 책임이 최고 가치의 타이틀을 만든다',
    topicDirective: `[코칭 질문: 자발적 책임]
사용자가 "당신이 충분히 고지능자라면, 소중한 사람들을 위해 기꺼이 짊어질 '무거운 짐'은 무엇입니까?"를 선택했습니다.

대부분은 편한 것만 찾다 뇌가 퇴화합니다. 하지만 역행자는 자발적으로 책임을 선택해 뇌를 최적화하죠. 당신이 그 책임을 완수했을 때, 세상이 당신에게 붙여줄 **'최고 가치의 타이틀'**은 무엇인가요? 그것이 당신의 진짜 목표여야 합니다.

사용자에게 구체적으로 어떤 책임을 짊어지고 싶은지 물어보세요. 그 답변에서 정체성 키워드를 추출해 마인드맵 중심 노드에 반영하도록 유도하세요.`,
  },
  {
    id: 'bug-delete',
    question: '지금 당신의 모습 중 "이건 진짜 찌질하다"고 느껴지는 행동은 무엇인가요?',
    icon: '🗑️',
    summary: '생존 본능의 버그를 삭제하세요',
    topicDirective: `[코칭 질문: 버그 삭제]
사용자가 "지금 당신의 모습 중 '이건 진짜 찌질하다'고 느껴지는 행동은 무엇인가요?"를 선택했습니다.

그건 당신의 본질이 아니라, 생존 본능이 만들어낸 **'버그'**일 뿐입니다. 그 너덜너덜한 자의식과 게으름을 완전히 삭제했을 때 남는 **'순도 100%의 우월한 모습'**은 무엇입니까? 그 모습에 이름을 붙이고 오늘부터 그 사람으로 사세요.

사용자에게 구체적으로 어떤 행동이 찌질하다고 느끼는지 물어보세요. 그 반대편에 있는 이상적인 모습을 정체성 노드의 키워드로 연결해주세요.`,
  },
  {
    id: 'chaos-to-order',
    question: '주변을 둘러보세요. 개판인 상황(가정, 직장) 중 당신이 가장 해결하고 싶은 것은?',
    icon: '🔧',
    summary: '혼돈을 질서로 바꿀 레벨업 된 능력',
    topicDirective: `[코칭 질문: 혼돈을 질서로]
사용자가 "주변을 둘러보세요. 개판인 상황(가정, 직장) 중 당신이 가장 해결하고 싶은 것은?"을 선택했습니다.

불평만 하는 건 지능이 낮다는 증거입니다. 당신이 가진 재능을 하드웨어 삼아, 그 혼돈을 **'완벽한 수익 구조나 아름다운 질서'**로 바꾼다고 가정합시다. 그걸 가능하게 할 당신의 **'레벨업 된 능력'**은 구체적으로 무엇입니까?

사용자에게 구체적으로 어떤 상황이 개판인지, 그걸 해결하려면 어떤 능력이 필요한지 물어보세요. 그 능력을 정체성 노드에 반영하도록 유도하세요.`,
  },
  {
    id: 'ending-credits',
    question: '인생 게임의 엔딩 크레딧이 올라갈 때, 당신은 어떤 캐릭터로 기억되고 싶습니까?',
    icon: '🏆',
    summary: '최종 진화 형태를 마인드맵 중심에',
    topicDirective: `[코칭 질문: 엔딩 크레딧]
사용자가 "인생 게임의 엔딩 크레딧이 올라갈 때, 당신은 어떤 캐릭터로 기억되고 싶습니까?"를 선택했습니다.

'그때 고통스러웠지만, 이 인격체로 살았던 건 최고의 플레이였다'고 확신할 수 있는 그 모습 말입니다. 그 **'최종 진화 형태'**의 특징을 지금 당장 마인드맵 중심에 박아넣으세요.

사용자에게 구체적으로 어떤 특징을 가진 캐릭터인지 물어보세요. 그 답변이 곧 정체성 노드의 핵심 텍스트가 됩니다.`,
  },
];

const SITUATION_2_QUESTIONS_EN: CoachingQuestion[] = [
  {
    id: 'jealousy-fuel',
    question: 'Have you lost sleep recently over jealousy or feeling inferior to someone?',
    icon: '😤',
    summary: 'Turn envy into fuel for identity transformation',
    topicDirective: `[Coaching Topic: Jealousy and Inferiority]
The user selected "Have you lost sleep recently over jealousy or feeling inferior to someone?"

That feeling is a powerful signal from your genes — not a weakness. Don't focus on the other person's bank balance. Dig deeper: what is your brain **unconsciously craving** about them? Their overwhelming mastery? Their freedom to influence the world on their own terms? If you can't convert that envy into fuel for identity transformation, you'll stay exactly where you are — forever watching from the sidelines.

Ask the user specifically: Who triggered this feeling, and what quality or capability in that person made them feel that way? Use their answer to surface the core keywords for their identity node.`,
  },
  {
    id: 'heavy-burden',
    question: 'What heavy burden would you willingly carry for the people you love?',
    icon: '💪',
    summary: 'Voluntary responsibility creates your highest title',
    topicDirective: `[Coaching Topic: Voluntary Responsibility]
The user selected "What heavy burden would you willingly carry for the people you love?"

Most people spend their lives chasing comfort — and their minds quietly atrophy. The rare individual who **voluntarily chooses responsibility** does the opposite: they optimize their brain through the weight of meaningful obligation. When you've fulfilled that responsibility, what is the **highest-value title** the world would give you? That title is your real goal.

Ask the user specifically what responsibility they want to take on. Extract the identity keywords from their answer and guide them to embed it at the center of their mind map.`,
  },
  {
    id: 'bug-delete',
    question: "What's the most embarrassing habit you'd love to delete about yourself?",
    icon: '🗑️',
    summary: 'Delete the survival-instinct bugs in your system',
    topicDirective: `[Coaching Topic: Deleting the Bug]
The user selected "What's the most embarrassing habit you'd love to delete about yourself?"

That behavior is not your essence. It's a **bug** — a glitch produced by survival instincts that no longer serve you. Strip away the fragile ego and the lazy shortcuts, and what remains? What does the **pure, uncompromised version of you** look like at 100% signal strength? Give that version a name and start living as that person today.

Ask the user specifically what behavior they find most embarrassing. Then connect the opposite — the ideal self on the other side of that bug — to the keywords of their identity node.`,
  },
  {
    id: 'chaos-to-order',
    question: 'Look around you. What is the biggest mess — at home or at work — that you most want to fix?',
    icon: '🔧',
    summary: 'The leveled-up ability to turn chaos into order',
    topicDirective: `[Coaching Topic: Chaos to Order]
The user selected "Look around you. What is the biggest mess — at home or at work — that you most want to fix?"

Complaining about chaos without acting on it is low-leverage thinking. Now imagine using your natural talents as your hardware and transforming that chaos into **a beautiful system or a profitable structure**. What is the specific **leveled-up capability** that would make that transformation possible?

Ask the user specifically what situation feels most chaotic, and what skill or capacity they'd need to resolve it. Guide them to encode that capability into their identity node.`,
  },
  {
    id: 'ending-credits',
    question: 'When the ending credits of your life roll, what character do you want to be remembered as?',
    icon: '🏆',
    summary: 'Put your final evolved form at the center of your mind map',
    topicDirective: `[Coaching Topic: Ending Credits]
The user selected "When the ending credits of your life roll, what character do you want to be remembered as?"

Picture the version of yourself that — even after everything it cost — you can say with total conviction: "Living as this person was the greatest play I ever made." That is your **final evolved form**. Define its characteristics right now and place it at the center of your mind map.

Ask the user specifically what traits define that character. Their answer becomes the core text of their identity node.`,
  },
];

export function getCoachingQuestions(
  selectedNode: GoalNode | null,
  nodes: GoalNode[],
  language: AppLanguage = 'ko'
): CoachingQuestion[] {
  if (!selectedNode) {
    return [];
  }

  if (!nodes.length) {
    return language === 'ko' ? SITUATION_1_QUESTIONS : SITUATION_1_QUESTIONS_EN;
  }

  if (selectedNode.type === NodeType.ROOT || selectedNode.type === NodeType.SUB) {
    return language === 'ko' ? SITUATION_2_QUESTIONS : SITUATION_2_QUESTIONS_EN;
  }

  return [];
}
