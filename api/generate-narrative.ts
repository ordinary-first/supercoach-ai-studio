import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOpenAIClient } from '../lib/openaiClient.js';

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
    const { goalContext, profile } = req.body || {};
    const openai = getOpenAIClient();

    const prompt = [
      '당신은 최면 치료사입니다.',
      '사용자의 목표 목록을 보고, 목표가 이미 달성된 미래를 1인칭 시점으로 생생하게 느끼게 하는 짧은 최면 스크립트를 작성하세요.',
      '조건:',
      '- 한국어',
      '- 1000자 이내',
      '- 지나친 과장/공포/의학적 진단 금지',
      '',
      `목표:\n${String(goalContext || '')}`,
      `사용자 배경:\n${String(profile?.bio || '')}`,
    ].join('\n');

    const response: any = await openai.responses.create({
      model: 'gpt-4o-mini',
      input: prompt,
    });

    return res.status(200).json({ text: response?.output_text || '' });
  } catch (error: any) {
    console.error('Narrative Generation Error:', error);
    return res.status(200).json({ text: '' });
  }
}

