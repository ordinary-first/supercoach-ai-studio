import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { goalContext, profile } = req.body;
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `당신은 최면 치료사입니다. ${profile?.name}님의 목표 리스트를 보고, 그가 성공한 미래에 완전히 몰입하게 만드는 1인칭 시점의 한국어 최면 스크립트를 작성하십시오.
        목표들: ${goalContext}
        사용자 배경: ${profile?.bio || '성공을 갈망함'}
        분량: 100자 내외.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return res.status(200).json({ text: response.text || '' });
  } catch (error: any) {
    console.error('Narrative Generation Error:', error);
    return res.status(200).json({ text: '' });
  }
}
