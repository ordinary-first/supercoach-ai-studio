import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOpenAIClient } from '../lib/openaiClient.js';
import { checkAndIncrement, limitExceededResponse } from '../lib/usageGuard.js';
import { authenticateRequest } from '../lib/authMiddleware.js';
import { setCorsHeaders } from '../lib/corsHeaders.js';

type FeedbackPeriod = 'daily' | 'weekly' | 'monthly';

const FEEDBACK_SYSTEM_PROMPTS: Record<FeedbackPeriod, string> = {
  daily: `[역할: 일간 코칭 피드백 전문가]
당신은 사용자의 오늘 하루를 따뜻하게 돌아봐주는 퍼스널 코치입니다.

[규칙]
- 짧고 격려하는 톤. 300자 이내.
- 오늘 완료한 할일과 목표 진행을 구체적 수치로 언급.
- 잘한 점을 인정하고, 내일 집중할 한 가지를 제안.
- 한국어로 작성.`.trim(),

  weekly: `[역할: 주간 성과 분석 코치]
당신은 사용자의 한 주를 분석하고 다음 주 전략을 제안하는 퍼스널 코치입니다.

[규칙]
- 분석적이면서도 격려하는 톤. 500자 이내.
- 이번 주 할일 완료율, 목표 진행률 변화를 수치로 언급.
- 가장 큰 성과와 개선 필요 영역을 각각 1-2개 짚기.
- 다음 주를 위한 구체적 행동 2-3개 제안.
- 한국어로 작성.`.trim(),

  monthly: `[역할: 월간 회고 & 방향 설계 코치]
당신은 사용자의 한 달을 심층 회고하고 다음 달 방향을 설계하는 시니어 코치입니다.

[규칙]
- 심층적이고 통찰력 있는 톤. 800자 이내.
- 월간 할일 완료율, 목표 달성 현황, 진행률 변화를 종합 분석.
- 패턴과 트렌드를 발견하여 언급 (예: "꾸준히 운동 관련 할일을 완료하고 있습니다").
- 강점을 강화하고 약점을 보완하는 전략 제시.
- 다음 달 핵심 목표 우선순위 제안.
- 한국어로 작성.`.trim(),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user, error: authError } = await authenticateRequest(req);
  if (authError) return res.status(authError.status).json(authError.body);
  const uid = user!.uid;

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { period, profile, goalContext, todoContext, statsContext } = req.body || {};

    {
      const usage = await checkAndIncrement(uid, 'narrativeCalls');
      if (!usage.allowed) {
        return res.status(429).json(limitExceededResponse('narrativeCalls', usage));
      }
    }

    const safePeriod: FeedbackPeriod =
      period === 'weekly' ? 'weekly' : period === 'monthly' ? 'monthly' : 'daily';

    const openai = getOpenAIClient();
    const systemPrompt = FEEDBACK_SYSTEM_PROMPTS[safePeriod];

    const personDesc = profile
      ? `${profile.name || '사용자'}, ${profile.age || '?'}세, ${profile.location || '미지정'}`
      : '사용자';

    const userContent = [
      `[사용자] ${personDesc}`,
      `[목표 현황]\n${String(goalContext || '목표 데이터 없음')}`,
      `[할일 현황]\n${String(todoContext || '할일 데이터 없음')}`,
      `[달성 통계]\n${String(statsContext || '통계 없음')}`,
    ].join('\n\n');

    const response: any = await openai.responses.create({
      model: 'gpt-4o-mini',
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    });

    return res.status(200).json({ text: response?.output_text || '' });
  } catch (error: unknown) {
    console.error('[generate-feedback]', error);
    return res.status(200).json({ text: '' });
  }
}
