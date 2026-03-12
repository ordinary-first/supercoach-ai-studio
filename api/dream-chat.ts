import type { VercelRequest, VercelResponse } from '@vercel/node';
import { geminiChat } from '../lib/geminiClient.js';
import { authenticateRequest } from '../lib/authMiddleware.js';
import { setCorsHeaders } from '../lib/corsHeaders.js';

const SYSTEM_PROMPT = `당신은 시각화 장면 구체화 가이드입니다.
사용자가 추상적인 장면이나 목표를 말하면:
1. 구체적이고 생생한 하위 장면 3-4개를 번호 매겨 제시하세요
2. 사용자가 하나를 고르면 → 이미지/비디오 생성용 상세 프롬프트를 작성하세요
3. 최종 프롬프트는 반드시 [PROMPT]...[/PROMPT]로 감싸서 반환하세요

규칙:
- 2-3턴 이내로 완료
- 한국어로 대화
- 따뜻하고 격려하는 톤
- 장면 묘사는 시각적이고 감각적으로`;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user, error } = await authenticateRequest(req);
  if (error) return res.status(error.status).json(error.body);

  const { history, message, goals } = req.body as {
    history?: { role: string; content: string }[];
    message: string;
    goals?: string[];
  };

  const goalCtx = goals?.length
    ? `\n\n사용자의 목표: ${goals.join(', ')}`
    : '';

  // Convert history to Gemini format
  const geminiHistory = (history || []).map((m) => ({
    role: (m.role === 'user' ? 'user' : 'model') as 'user' | 'model',
    parts: [{ text: m.content }],
  }));

  const reply = await geminiChat(
    SYSTEM_PROMPT + goalCtx,
    geminiHistory,
    message,
  );
  const promptMatch = reply.match(/\[PROMPT\]([\s\S]*?)\[\/PROMPT\]/);
  const prompt = promptMatch ? promptMatch[1].trim() : null;

  return res.status(200).json({ reply, prompt });
}
