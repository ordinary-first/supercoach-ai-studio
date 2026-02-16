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
    const { text } = req.body || {};
    const openai = getOpenAIClient();

    const cleanText = String(text || '').replace(/\*\*/g, '').trim();
    if (!cleanText) return res.status(200).json({ audioData: null });

    // The client expects raw PCM16 at 24kHz (base64-encoded) and decodes it manually.
    const audio = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: 'onyx',
      input: `깊고 차분한 목소리로 천천히 말해줘: ${cleanText}`,
      response_format: 'pcm',
    });

    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    return res.status(200).json({ audioData: audioBuffer.toString('base64') });
  } catch (error: any) {
    console.error('Speech Generation Error:', error);
    return res.status(200).json({ audioData: null });
  }
}
