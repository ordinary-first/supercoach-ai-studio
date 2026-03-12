import type { VercelRequest, VercelResponse } from '@vercel/node';
import { geminiGenerate } from '../lib/geminiClient.js';
import { checkAndIncrement, limitExceededResponse } from '../lib/usageGuard.js';
import { authenticateRequest } from '../lib/authMiddleware.js';
import { setCorsHeaders } from '../lib/corsHeaders.js';

const DECOMPOSE_SYSTEM_PROMPT = `당신은 목표 분해 전문가입니다.
주어진 목표를 SMART 원칙에 따라 3~5개의 하위 목표로 분해하세요.

SMART 원칙:
- S(구체적): 명확한 행동이 보이는 목표
- M(측정 가능): 달성 여부를 수치나 기준으로 확인 가능
- A(달성 가능): 현실적으로 실행 가능한 범위
- R(관련성): 상위 목표 달성에 직접 기여
- T(기한): 구체적 기간이 포함되거나 단계가 명확

규칙:
- JSON 배열로만 응답: ["하위목표1", "하위목표2", ...]
- 각 항목은 15자 이내
- 명사형 또는 동명사형으로 끝내기 (예: "주 3회 러닝", "영단어 50개 암기")
- 이미 존재하는 하위 목표와 중복되지 않게
- 상위 목표를 달성하기 위한 실질적이고 측정 가능한 단계로 구성
- JSON 외 다른 텍스트 절대 포함하지 마세요`.trim();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user, error: authError } = await authenticateRequest(req);
  if (authError) return res.status(authError.status).json(authError.body);
  const uid = user!.uid;

  if (!process.env.GOOGLE_API_KEY?.trim()) {
    return res.status(500).json({ error: 'Google API key not configured' });
  }

  try {
    const body = req.body || {};
    const parentText = String(body.parentText || '').trim();
    const childTexts: string[] = Array.isArray(body.childTexts) ? body.childTexts : [];

    if (!parentText) {
      return res.status(400).json({ error: 'parentText is required' });
    }

    const usage = await checkAndIncrement(uid, 'chatMessages');
    if (!usage.allowed) {
      return res.status(429).json(limitExceededResponse('chatMessages', usage));
    }

    const userContent = childTexts.length > 0
      ? `목표: "${parentText}"\n\n이미 존재하는 하위 목표 (중복 금지): ${childTexts.map(t => `"${t}"`).join(', ')}`
      : `목표: "${parentText}"`;

    const outputText = await geminiGenerate(DECOMPOSE_SYSTEM_PROMPT, userContent) || '[]';

    let suggestions: string[];
    try {
      const parsed = JSON.parse(outputText);
      suggestions = Array.isArray(parsed)
        ? parsed.filter((s: unknown) => typeof s === 'string' && s.trim()).map((s: string) => s.trim())
        : [];
    } catch {
      suggestions = [];
    }

    return res.status(200).json({ suggestions });
  } catch (error: unknown) {
    console.error('[decompose-goal]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
