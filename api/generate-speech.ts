import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Modality } from '@google/genai';

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
    const { text } = req.body;
    const ai = new GoogleGenAI({ apiKey });

    const cleanText = text.replace(/\*\*/g, '');
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [
        {
          parts: [
            {
              text: `Say with deep, resonant, and calm voice (Fenrir style): ${cleanText}`,
            },
          ],
        },
      ],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Fenrir' },
          },
        },
      },
    });

    const audioData =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    return res.status(200).json({ audioData: audioData || null });
  } catch (error: any) {
    console.error('Speech Generation Error:', error);
    return res.status(200).json({ audioData: null });
  }
}
