import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getOpenAIClient } from '../lib/openaiClient.js';
import { getAdminDb } from '../lib/firebaseAdmin.js';

const R2_ACCOUNT_ID = (process.env.R2_ACCOUNT_ID || '').trim();
const R2_ACCESS_KEY = (process.env.R2_ACCESS_KEY_ID || '').trim();
const R2_SECRET_KEY = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
const R2_BUCKET = (process.env.R2_BUCKET_NAME || 'secretcoach-images').trim();
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').trim();

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
  },
});

const createRequestId = (): string => {
  return `speech_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const safePathSegment = (value: unknown): string => {
  const cleaned = String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || 'unknown';
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

const pcm16ToWavBuffer = (pcmBuffer: Buffer, sampleRate: number = 24000): Buffer => {
  const channels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
};

const uploadToR2 = async (key: string, body: Buffer): Promise<string> => {
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: 'audio/wav',
  }));
  return `${R2_PUBLIC_URL}/${key}`;
};

const saveGenerationResult = async (
  userId: string,
  generationId: string,
  audioUrl: string | null,
  requestId: string,
): Promise<void> => {
  try {
    const db = getAdminDb();
    await db.doc(`users/${userId}/generationResults/${generationId}_audio`).set({
      type: 'audio',
      audioUrl,
      requestId,
      createdAt: Date.now(),
    });
  } catch { /* best effort */ }
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
    const { text, userId, visualizationId } = req.body || {};
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

    const cleanUserId = typeof userId === 'string' ? userId.trim() : '';
    const cleanVisualizationId = typeof visualizationId === 'string' ? visualizationId.trim() : '';

    if (R2_PUBLIC_URL && cleanUserId && cleanVisualizationId) {
      try {
        const key = `visualizations/${safePathSegment(cleanUserId)}/${safePathSegment(cleanVisualizationId)}/audio.wav`;
        const wav = pcm16ToWavBuffer(audioBuffer);
        const audioUrl = await uploadToR2(key, wav);
        await saveGenerationResult(cleanUserId, cleanVisualizationId, audioUrl, requestId);
        return res.status(200).json({
          status: 'completed',
          audioUrl,
          requestId,
        });
      } catch (r2Error: unknown) {
        const message = r2Error instanceof Error ? r2Error.message : 'R2 upload failed';
        console.error('[generate-speech][r2-upload]', requestId, message);
      }
    }

    if (cleanUserId && cleanVisualizationId) {
      await saveGenerationResult(cleanUserId, cleanVisualizationId, null, requestId);
    }
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
