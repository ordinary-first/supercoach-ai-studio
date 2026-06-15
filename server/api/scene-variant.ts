import type { VercelRequest, VercelResponse } from '@vercel/node';
import { geminiGenerate, hasGenerativeApiKey } from '../../lib/geminiClient.js';
import { authenticateRequest } from '../../lib/authMiddleware.js';
import { setCorsHeaders } from '../../lib/corsHeaders.js';

// 수정 버튼을 눌렀을 때, 현재 장면을 '변환 지시(transform)'대로 한 축만 바꾼 변형 장면을 만든다.
// 갈림길(원본 vs 변형)에서 사용자가 고르게 하기 위한 분기 생성기.
const SYSTEM_PROMPT = `너는 '이미 이룬 미래의 나' 장면을 다듬는 작가다.
현재 장면(scene)과 변환 지시(transform)를 받는다. 지시대로 단 하나의 의미 축만 바꾸고,
나머지는 그대로 계승해 새 장면을 다시 써라.

계승해야 할 것: 1인칭·현재형, '이미 이룬' 확정 프레임, 핵심 감정 톤, 기존 감각 디테일,
사용자가 직접 쓴 모든 요소, 목표의 동일성.
금지: 빛·색·날씨·시간대·구도 같은 시각 겉모습 단어를 새로 지정하는 것(다음 단계가 처리).
결핍·좌절·부정·적대적 관객 소환 금지.

출력은 새 장면 본문 텍스트만. 머리말·설명·따옴표 금지. 3~5문장.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { error } = await authenticateRequest(req);
  if (error) return res.status(error.status).json(error.body);

  const { scene, transform } = req.body || {};
  const cleanScene = String(scene || '').trim();
  const cleanTransform = String(transform || '').trim();
  if (!cleanScene || !cleanTransform || !hasGenerativeApiKey()) {
    return res.status(200).json({ scene: cleanScene });
  }

  const userContent = `현재 장면:\n${cleanScene}\n\n변환 지시:\n${cleanTransform}`;
  const variant = await geminiGenerate(SYSTEM_PROMPT, userContent);

  return res.status(200).json({ scene: variant.trim() || cleanScene });
}
