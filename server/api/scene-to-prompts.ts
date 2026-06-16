import type { VercelRequest, VercelResponse } from '@vercel/node';
import { geminiGenerateJson, hasGenerativeApiKey } from '../../lib/geminiClient.js';
import { authenticateRequest } from '../../lib/authMiddleware.js';
import { setCorsHeaders } from '../../lib/corsHeaders.js';

// 확정된 장면을 각 생성 매체(이미지/영상/음성)에 맞는 프롬프트로 변환한다.
// 텍스트(내레이션)는 별도 generate-narrative가 장면을 받아 처리하므로 여기선 다루지 않는다.
const SYSTEM_PROMPT = `너는 확정된 '이미 이룬 미래의 나' 장면을 각 생성 매체에 맞는 프롬프트로 변환하는 변환기다.
입력 JSON: { scene, settings:{ image, audio, video } }.
settings에서 true인 매체에 대해서만 채워라(나머지는 빈 문자열).

- imagePrompt: 이 장면을 사진 한 장으로 만들기 위한 시각 묘사. 인물의 표정·자세, 공간, 분위기,
  조명/색감, 구도를 구체적으로. 영어로, 사진적·영화적으로. 텍스트/워터마크 금지를 명시.
- videoPrompt: 4초 영상용. 카메라 움직임 + 인물의 동작 1~2비트 + 분위기. 영어로 간결하게.
- audioText: 이 장면을 1인칭·현재형으로 읊는 따뜻한 내레이션 2~3문장. scene과 같은 언어로.

출력은 JSON 객체 하나만:
{ "imagePrompt": "", "videoPrompt": "", "audioText": "" }`;

interface ScenePrompts {
  imagePrompt: string;
  videoPrompt: string;
  audioText: string;
}
const EMPTY: ScenePrompts = { imagePrompt: '', videoPrompt: '', audioText: '' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { error } = await authenticateRequest(req);
  if (error) return res.status(error.status).json(error.body);

  const { scene, settings } = req.body || {};
  const cleanScene = String(scene || '').trim();
  if (!cleanScene || !hasGenerativeApiKey()) return res.status(200).json(EMPTY);

  const userContent = JSON.stringify({
    scene: cleanScene,
    settings: {
      image: !!settings?.image,
      audio: !!settings?.audio,
      video: !!settings?.video,
    },
  });

  const parsed = await geminiGenerateJson<Partial<ScenePrompts>>(SYSTEM_PROMPT, userContent);
  if (!parsed) return res.status(200).json(EMPTY);

  return res.status(200).json({
    imagePrompt: String(parsed.imagePrompt || ''),
    videoPrompt: String(parsed.videoPrompt || ''),
    audioText: String(parsed.audioText || ''),
  });
}
