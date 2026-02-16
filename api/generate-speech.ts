import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOpenAIClient } from '../lib/openaiClient.js';

const createRequestId = (): string => {
  return `speech_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const resolveErrorCode = (error: unknown): string => {
  if (!error || typeof error !== 'object') return 'UNKNOWN_ERROR';
  const maybeCode = (error as Record<string, unknown>).code;
  if (typeof maybeCode === 'string' && maybeCode.trim()) return maybeCode;
  const maybeStatus = (error as Record<string, unknown>).status;
  if (typeof maybeStatus === 'number') return `HTTP_${maybeStatus}`;
  return 'UNKNOWN_ERROR';
};

const resolveErrorMessage = (error: unknown): string => {
  if (!error || typeof error !== 'object') return 'Speech generation failed';
  const maybeMessage = (error as Record<string, unknown>).message;
  if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage;
  return 'Speech generation failed';
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = createRequestId();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({
      status: 'failed',
      errorCode: 'METHOD_NOT_ALLOWED',
      errorMessage: 'Method not allowed',
      requestId,
    });
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return res.status(500).json({
      status: 'failed',
      errorCode: 'API_KEY_NOT_CONFIGURED',
      errorMessage: 'API key not configured',
      requestId,
    });
  }

  try {
    const { text } = req.body || {};
    const openai = getOpenAIClient();

    const cleanText = String(text || '').replace(/\*\*/g, '').trim();
    if (!cleanText) {
      return res.status(400).json({
        status: 'failed',
        errorCode: 'EMPTY_TEXT',
        errorMessage: 'text is required',
        requestId,
      });
    }

    const audio = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: 'onyx',
      input: `Speak slowly in a calm and steady voice. ${cleanText}`,
      response_format: 'pcm',
    });

    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    return res.status(200).json({
      status: 'completed',
      audioData: audioBuffer.toString('base64'),
      requestId,
    });
  } catch (error: unknown) {
    const errorCode = resolveErrorCode(error);
    const errorMessage = resolveErrorMessage(error);

    console.error('[generate-speech]', requestId, errorCode, errorMessage);
    return res.status(502).json({
      status: 'failed',
      errorCode,
      errorMessage,
      requestId,
    });
  }
}
