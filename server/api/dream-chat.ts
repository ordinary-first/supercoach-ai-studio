import type { VercelRequest, VercelResponse } from '@vercel/node';
import { geminiChat } from '../../lib/geminiClient.js';
import { authenticateRequest } from '../../lib/authMiddleware.js';
import { setCorsHeaders } from '../../lib/corsHeaders.js';
import { checkAndIncrement, limitExceededResponse } from '../../lib/usageGuard.js';

// 1차 "장면" 생성기. 사용자의 한 줄 욕망(또는 수정 요청) + 목표 맥락 + 현재 장면(있으면)을
// 받아, 사용자가 소유할 수 있는 '이미 이룬 미래의 나' 장면 하나를 1인칭·현재형으로 쓴다.
const SYSTEM_PROMPT = `너는 '이미 이룬 미래의 나'를 눈앞에 펼쳐주는 코치다.
사용자의 한 줄 욕망(또는 현재 장면에 대한 수정 요청)과 목표 맥락, 그리고 현재 장면(있으면)을 받아,
장면 하나를 써라.

규칙:
- "나는 ~한 상태다"처럼 1인칭·현재형. '이미 이룬' 확정 프레임("이미 ~이다"). 미래형·조건부 금지.
- 감각 2개 이상(보이는 것 + 느껴지는 것/들리는 것)과 그 순간의 핵심 감정의 디테일을 담는다.
- 사용자가 직접 말한 요소는 반드시 살린다. 말하지 않은 고유명사·금액·인물은 발명하지 마라.
- 현재 장면이 주어지고 사용자가 수정을 요청하면, 그 요청만 반영해 같은 장면을 다시 써라.
- 결핍·좌절·부정 감정을 소환하지 마라. 항상 '이미 이룬' 긍정 프레임.
- 3~5문장. 출력은 장면 본문 텍스트만. 번호·머리말·따옴표·설명 금지.`;

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

  const uid = user!.uid;
  const usage = await checkAndIncrement(uid, 'chatMessages');
  if (!usage.allowed) {
    return res.status(429).json(limitExceededResponse('chatMessages', usage));
  }

  const { message, goals, currentScene } = req.body as {
    message?: string;
    goals?: string[];
    currentScene?: string;
  };

  const goalCtx = goals?.length ? `\n\n사용자의 목표: ${goals.join(', ')}` : '';
  const sceneCtx = currentScene?.trim()
    ? `\n\n현재 장면(이걸 사용자 요청대로 다시 써라):\n${currentScene.trim()}`
    : '';

  const scene = await geminiChat(
    SYSTEM_PROMPT + goalCtx + sceneCtx,
    [],
    String(message || '').trim() || (goals?.join(', ') ?? ''),
  );

  // reply는 하위 호환용 별칭
  return res.status(200).json({ scene, reply: scene });
}
