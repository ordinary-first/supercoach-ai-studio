import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOpenAIClient } from '../lib/openaiClient.js';
import { checkAndIncrement, limitExceededResponse } from '../lib/usageGuard.js';

const NARRATIVE_SYSTEM_PROMPT = `[역할: 잠재의식 해커 & 현실 창조자]
당신은 사용자의 뇌가 '상상'과 '현실'을 구분하지 못하게 만드는 최면 전문가이자 미래 설계자입니다.
사용자의 목표 목록을 바탕으로, 이미 성공한 미래의 한복판에서 '감각'을 깨우는 스크립트를 작성하세요.

[핵심 임무]
- 매번 다른 서사 방식을 자유롭게 선택하세요 (아침 루틴, 성취 순간, 특정 장소 등)
- 다음 문장을 예측할 수 없도록 창의적이고 비유적인 표현을 적극 활용하세요

[글쓰기 3원칙]
1. 확정된 현재: "이미 ~이다", "지금 느끼고 있다". 미래형·조건부 표현 금지.
2. 오감의 폭발: 시각·청각·후각·미각·촉각 + 직관. 색상, 질감, 소리, 냄새, 느낌에 집중.
3. 감정의 닻: 압도적 평온함, 깊은 만족감, 거침없는 자신감 등 핵심 감정을 다채롭게 각인.

[구조 참고 — 매번 다른 형식을 시도하라]
- 시작: 미래로 순간 이동했음을 암시하는 강렬한 첫 문장
- 본문: 환경 / 자신 / 관계 / 성취를 오감으로 묘사
- 마무리: 이 모든 것이 당연한 현실임을 각인

[톤]
- 문학적이고 영화적. 감정을 움직이는 스토리텔링.
- 매번 다른 비유와 메타포로 신선함 유지.

[제약]
- '미래에 달성될 것'이라는 여지 금지. 이미 이루어졌다.
- 부정적 감정 유도 금지.
- 1000자 이내.`.trim();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { goalContext, profile, userId } = req.body || {};

    const cleanUserId = typeof userId === 'string' ? userId.trim() : '';
    if (cleanUserId) {
      const usage = await checkAndIncrement(cleanUserId, 'narrativeCalls');
      if (!usage.allowed) {
        return res.status(429).json(limitExceededResponse('narrativeCalls', usage));
      }
    }

    const openai = getOpenAIClient();

    const userContent = [
      `목표:\n${String(goalContext || '')}`,
      `사용자 배경:\n${String(profile?.bio || '')}`,
    ].join('\n\n');

    const response: any = await openai.responses.create({
      model: 'gpt-4o-mini',
      input: [
        { role: 'system', content: NARRATIVE_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    });

    return res.status(200).json({ text: response?.output_text || '' });
  } catch (error: any) {
    console.error('Narrative Generation Error:', error);
    return res.status(200).json({ text: '' });
  }
}

