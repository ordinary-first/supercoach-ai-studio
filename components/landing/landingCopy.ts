import type { AppLanguage } from '../../i18n/types';
import type { LandingMediaKey } from './landingMedia';

interface HeroCopy {
  eyebrow: string;
  headline: string[];
  subline: string;
  cta: string;
  meta: string;
}

interface EmpathyBeat {
  kicker: string;
  title: string;
  body: string;
}

interface FeatureBlock {
  mediaKey: LandingMediaKey;
  indexLabel: string;
  title: string;
  description: string[];
  psychology: string;
}

interface MoonStoryCopy {
  eyebrow: string;
  title: string;
  intro: string;
  paragraphs: string[];
  expandLabel: string;
  collapseLabel: string;
  signature: string;
}

interface FinalCtaCopy {
  eyebrow: string;
  title: string;
  body: string;
  finePrint: string;
  cta: string;
}

export interface LandingCopy {
  navLabel: string;
  navCta: string;
  hero: HeroCopy;
  empathy: {
    eyebrow: string;
    title: string;
    beats: EmpathyBeat[];
    closing: string[];
  };
  features: {
    eyebrow: string;
    bridge: string[];
    items: FeatureBlock[];
  };
  moonStory: MoonStoryCopy;
  finalCta: FinalCtaCopy;
  mediaFallback: string;
}

export const landingContent: Record<AppLanguage, LandingCopy> = {
  en: {
    navLabel: 'Psychology-backed behavior design for people tired of starting over.',
    navCta: 'Enter Secret Coach',
    hero: {
      eyebrow: 'Identity. Structure. Evidence.',
      headline: ['Willpower runs out.', 'Systems do not.'],
      subline: 'Five proven behavior-change principles, in one app.',
      cta: 'Enter Secret Coach',
      meta: 'Private beta. Guided 3-day experience.',
    },
    empathy: {
      eyebrow: 'Have you ever felt this?',
      title: 'This is not a motivation problem.',
      beats: [
        {
          kicker: '01',
          title: 'You read a book or watch a self-improvement video and feel on fire.',
          body: 'It feels like you can do anything. A few days later, that version of you is gone again.',
        },
        {
          kicker: '02',
          title: '“I am going to become completely different.” You have said it for years.',
          body: 'The problem is not willpower. The problem is that there was no system.',
        },
        {
          kicker: '03',
          title: 'Even after trying hard, your inner critic becomes more severe.',
          body: 'We are not being comforted. Most tools measure what is missing, not what is growing.',
        },
      ],
      closing: [
        'This is not your fault.',
        'Your brain works that way.',
        'Secret Coach uses that mechanism in your favor.',
      ],
    },
    features: {
      eyebrow: 'How psychology becomes daily behavior',
      bridge: [
        'Elite visualization. Meaning-first goal setting. NLP.',
        'Now applied to your actual daily goals.',
      ],
      items: [
        {
          mediaKey: 'mindmap-decompose',
          indexLabel: '01',
          title: 'Start from who you want to become.',
          description: [
            'Most apps ask you to write goals like money, output, or status. Even when you achieve them, they can still feel empty.',
            'Secret Coach begins with identity. AI starts from the person you want to become, then connects that identity to life areas, vision, and this week’s action.',
          ],
          psychology: 'Jordan Peterson value hierarchy: competence follows identity.',
        },
        {
          mediaKey: 'todo-conquer',
          indexLabel: '02',
          title: 'Not 3 tasks left. 7 wins conquered today.',
          description: [
            'Ordinary task apps frame the day through deficiency: overdue, remaining, incomplete.',
            'Secret Coach frames the same data as visible victory. The day feels like progress, not accusation.',
          ],
          psychology: 'Bandura self-efficacy: visible success compounds belief.',
        },
        {
          mediaKey: 'future-self-visualization',
          indexLabel: '03',
          title: "Don't just imagine it. See it, hear it, read it.",
          description: [
            'Olympic athletes rehearse success vividly before the real event. The brain responds to vivid rehearsal more seriously than vague wishing.',
            'Secret Coach turns your future self into text, image, voice, and video so present action stays attached to a living destination.',
          ],
          psychology: 'Hershfield future-self continuity: a vivid future changes present behavior.',
        },
        {
          mediaKey: 'feedback-coverflow',
          indexLabel: '04',
          title: 'Open your progress like an old notebook.',
          description: [
            'Digital checkboxes rarely feel like evidence. Physical planners do, because you can feel accumulation.',
            'Secret Coach recreates that feeling digitally. Your days and weeks stack into proof you can revisit years later.',
          ],
          psychology: 'Goal gradient effect: visible evidence makes “a little more” automatic.',
        },
        {
          mediaKey: 'coach-chat',
          indexLabel: '05',
          title: 'You are harsh on yourself because no one is on your side.',
          description: [
            'When results are slow, the inner critic gets louder. It rarely notices how much effort you actually gave.',
            'Secret Coach acts like the ally most people never had: supportive, specific, warm, and present every day.',
          ],
          psychology: 'CBT + motivational interviewing + NLP: support before pressure.',
        },
      ],
    },
    moonStory: {
      eyebrow: 'Letter from MOON',
      title: 'I built the app I wanted when I kept collapsing in private.',
      intro: 'This is not brand copy. It is the reason the product exists.',
      paragraphs: [
        'We read self-help books because we want change and success. They help. They inspire us and make us feel like we can do anything. But the feeling does not last more than a few days.',
        'I hate the feeling of wasting a precious life by scrolling YouTube Shorts without meaning.',
        'Before sleeping, I want to fall asleep with excitement, even if I am moving slowly, because I know I am going in the direction of the life I want.',
        'It has been a long time since I felt that kind of excitement. I think I got soaked in cheap dopamine. I make plans, then another three-day collapse. After enough repetition, deep inside, self-distrust takes root.',
        'But every human being should live a life that moves toward what they truly want. Some lives are prisons even without bars. A slow life with belief is completely different from a fast life without belief.',
        'We all deserve that kind of life.',
        'I made this app completely for myself. From the wish that something could solve the exact reasons I kept failing. If it was deeply necessary for one person, it will probably speak to someone else too.',
      ],
      expandLabel: "Read MOON's full note",
      collapseLabel: 'Close note',
      signature: '— MOON, Secret Coach Developer',
    },
    finalCta: {
      eyebrow: 'One deliberate move',
      title: 'Do one thing today.',
      body: 'This is where your system begins.',
      finePrint: 'Private beta. Guided 3-day experience.',
      cta: 'Begin Your System',
    },
    mediaFallback: 'R2 video placeholder',
  },
  ko: {
    navLabel: '심리학이 증명한 행동변화 설계를 당신의 일상에.',
    navCta: 'Secret Coach 입장하기',
    hero: {
      eyebrow: '정체성. 구조. 증거.',
      headline: ['의지력은 고갈됩니다.', '시스템은 고갈되지 않습니다.'],
      subline: '심리학이 증명한 5가지 행동변화 원리를 하나의 앱에.',
      cta: 'Secret Coach 입장하기',
      meta: '프라이빗 베타. 3일 가이드 경험 제공.',
    },
    empathy: {
      eyebrow: '혹시 이런 적 있으신가요?',
      title: '이건 동기부여의 문제가 아닙니다.',
      beats: [
        {
          kicker: '01',
          title: '자기계발 영상이나 책을 읽으며 불타오릅니다.',
          body: '무엇이든 해낼 것 같습니다. 하지만 며칠 뒤 그랬던 자신은 온데간데 없습니다.',
        },
        {
          kicker: '02',
          title: '"난 완전히 달라질 거야." 몇 년째 같은 말을 하고 있습니다.',
          body: '문제는 의지력이 아닙니다. 시스템이 없어서입니다.',
        },
        {
          kicker: '03',
          title: '열심히 했는데도 내 안의 비판자는 더 혹독하게 나를 몰아붙입니다.',
          body: '우리는 정말 위로받지 못하고 있습니다. 대부분의 도구는 부족한 것만 보여주기 때문입니다.',
        },
      ],
      closing: [
        '이건 당신의 잘못이 아닙니다.',
        '뇌가 원래 그렇게 작동합니다.',
        'Secret Coach는 그 작동 방식을 역이용합니다.',
      ],
    },
    features: {
      eyebrow: '심리학이 작동하는 방식',
      bridge: [
        '프로 선수들이 쓰는 강력한 시각화, 조던 피터슨의 의미추구 목표설정, 신경언어학의 NLP.',
        '이제 당신의 일상 목표에 적용됩니다.',
      ],
      items: [
        {
          mediaKey: 'mindmap-decompose',
          indexLabel: '01',
          title: '목표가 아니라 “되고 싶은 사람”부터 시작합니다.',
          description: [
            '대부분의 앱은 연봉, 체중, 성과 같은 목표를 씁니다. 달성해도 공허할 수 있습니다. 그게 당신이 원하는 삶이 아니었기 때문입니다.',
            'Secret Coach는 다릅니다. 중심엔 항상 “내가 되고 싶은 사람”이 있고, AI가 그 정체성에서 출발해 비전에서 이번 주 할 일까지 자동으로 연결합니다.',
          ],
          psychology: 'Jordan Peterson 가치 위계 이론: 역량은 정체성의 부산물이다.',
        },
        {
          mediaKey: 'todo-conquer',
          indexLabel: '02',
          title: '"남은 할 일 3개"가 아니라 "오늘 7개 정복"으로 보여줍니다.',
          description: [
            '기존 앱은 항상 부족한 것을 보여줍니다. 남은 과제, 마감 지남, 미완료 항목. 볼수록 자기효능감이 깎입니다.',
            'Secret Coach는 같은 데이터를 정반대로 프레이밍합니다. 완료된 항목은 빛나는 전리품이고, 당신은 매일 퀘스트를 클리어하는 주인공이 됩니다.',
          ],
          psychology: 'Bandura 자기효능감 이론: 성공 경험의 가시적 축적이 자기효능감을 강화한다.',
        },
        {
          mediaKey: 'future-self-visualization',
          indexLabel: '03',
          title: '상상하지 마세요. 직접 보고, 듣고, 읽으세요.',
          description: [
            '올림픽 선수들은 경기 전 성공 장면을 생생하게 시각화합니다. 뇌는 생생한 리허설을 막연한 소망보다 더 진지하게 받아들입니다.',
            'Secret Coach의 AI는 당신의 목표를 기반으로 텍스트, 이미지, 음성, 영상으로 미래 자아를 만들어냅니다.',
          ],
          psychology: 'Hershfield 미래 자아 연속성 연구: 생생한 미래가 현재 행동을 바꾼다.',
        },
        {
          mediaKey: 'feedback-coverflow',
          indexLabel: '04',
          title: '낡은 수첩 넘기듯 당신의 진전을 꺼내볼 수 있습니다.',
          description: [
            '디지털 체크박스엔 축적감이 없습니다. 물리적 플래너를 쓰는 사람이 꽉 찬 페이지를 넘기며 느끼는 감각이 있죠.',
            'Secret Coach의 피드백 탭은 그걸 디지털로 재현합니다. 매일 완료한 것들이 카드로 쌓이고, 주간 앨범처럼 넘겨볼 수 있습니다.',
          ],
          psychology: 'Goal Gradient Effect: "이만큼 했다"가 보일수록 "조금만 더"가 자동으로 활성화된다.',
        },
        {
          mediaKey: 'coach-chat',
          indexLabel: '05',
          title: '열심히 했는데 왜 자책하고 있나요. 당신 편인 코치가 없어서입니다.',
          description: [
            '내 안의 비판자는 내가 고군분투할 때 가장 혹독합니다. 결과가 없다는 이유로.',
            'Secret Coach의 AI 코치는 다릅니다. 당신이 오늘 해낸 미세한 것들을 포착해서, 당신이 얼마나 대단한지를 당신보다 먼저 알아봅니다.',
          ],
          psychology: 'CBT + 동기부여 면담 + NLP: 비요청 조언 없음, 당신이 원할 때만 가이드합니다.',
        },
      ],
    },
    moonStory: {
      eyebrow: 'MOON의 편지',
      title: '아무도 모르게 무너지던 시절, 정말 있었으면 했던 앱을 만들었습니다.',
      intro: '이건 브랜드 카피가 아니라, 제품이 태어난 이유입니다.',
      paragraphs: [
        '변화와 성공을 바라고 자기계발서를 읽습니다. 분명 도움이 됩니다. 영감을 주고 용기를 주죠. 무엇이든 다 이룰 것만 같습니다. 하지만 며칠 가지 못합니다.',
        '매일 의미없이 유튜브 쇼츠를 스크롤하며 소중한 인생을 허비하는 것 같은 느낌이 정말 싫습니다.',
        '잠자기 전에, 느릴지라도 내가 원하는 인생의 방향으로 나아가고 있다는 설렘과 기대감으로 잠들고 싶습니다.',
        '그런 설렘을 느낀 지도 오래고, 이제는 싸구려 도파민에 절여진 것 같습니다. 계획을 세워도 또 작심삼일. 반복되는 결과에 이제는 마음속 깊은 곳에 자기불신이 자리 잡았나 봅니다.',
        '하지만 인간은 누구나 자신이 원하는 방향으로 나아가는 삶을 살아야 합니다. 창살이 없어도 감옥인 삶이 있습니다. 느릴지라도 자신이 원하는 것을 언젠가 달성할 수 있다는 믿음이 있는 삶과 없는 삶은 완전히 다릅니다.',
        '우리는 모두 그런 삶을 살아야 합니다.',
        '이 앱은 완전히 저를 위해 만들었습니다. 제가 실패했던 이유들, 그 이유들을 해결해주는 게 있다면 참 좋겠다는 마음에서. 한 사람에게 깊이 필요했던 부분은 다른 사람에게도 통하는 부분이 있을 거예요.',
      ],
      expandLabel: 'MOON의 전체 메모 읽기',
      collapseLabel: '메모 닫기',
      signature: '— MOON, Secret Coach 개발자',
    },
    finalCta: {
      eyebrow: '단 하나의 의식적인 선택',
      title: '오늘 딱 하나만 해보세요.',
      body: '시스템은 여기서부터 시작됩니다.',
      finePrint: '프라이빗 베타. 3일 가이드 경험 제공.',
      cta: '내 시스템 시작하기',
    },
    mediaFallback: 'R2 영상 플레이스홀더',
  },
};
