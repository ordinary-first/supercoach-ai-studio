import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getAdminDb } from '../../lib/firebaseAdmin.js';
import { checkAndIncrement, limitExceededResponse } from '../../lib/usageGuard.js';
import { authenticateRequest } from '../../lib/authMiddleware.js';
import { setCorsHeaders } from '../../lib/corsHeaders.js';
import { safePathSegment } from '../../lib/safePathSegment.js';

const R2_ACCOUNT_ID = (process.env.R2_ACCOUNT_ID || '').trim();
const R2_ACCESS_KEY = (process.env.R2_ACCESS_KEY_ID || '').trim();
const R2_SECRET_KEY = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
const R2_BUCKET = (process.env.R2_BUCKET_NAME || 'secretcoach-images').trim();
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').trim();

// Cloud TTS는 별도 (TTS 전용) 키를 우선 사용. 메인 GOOGLE_API_KEY는 Generative
// Language API로 제한돼 있어 Cloud TTS 호출이 차단되므로 GOOGLE_TTS_API_KEY가 필요.
const TTS_API_KEY = (
  process.env.GOOGLE_TTS_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GEMINI_API_KEY ||
  ''
).trim();

const SAMPLE_RATE = 24000;
// Cloud TTS text 입력 한도(5000 bytes) 이내로 안전하게 자른다.
const MAX_TTS_BYTES = 4800;

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
  },
});
type S3Sender = { send(command: PutObjectCommand): Promise<unknown> };
const r2Client = r2 as unknown as S3Sender;

const createRequestId = (): string => {
  return `speech_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const pcm16ToWavBuffer = (pcmBuffer: Buffer, sampleRate: number = SAMPLE_RATE): Buffer => {
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

// Cloud TTS LINEAR16은 RIFF/WAVE 헤더 포함 WAV를 반환한다. 헤더를 벗겨 raw PCM16을
// 돌려주면 기존 Gemini TTS와 바이트 호환 (클라이언트 prepareFromPcm / 저장 경로 무변경).
const stripWavHeader = (wav: Buffer): Buffer => {
  if (
    wav.length >= 12 &&
    wav.toString('ascii', 0, 4) === 'RIFF' &&
    wav.toString('ascii', 8, 12) === 'WAVE'
  ) {
    let offset = 12;
    while (offset + 8 <= wav.length) {
      const chunkId = wav.toString('ascii', offset, offset + 4);
      const chunkSize = wav.readUInt32LE(offset + 4);
      if (chunkId === 'data') {
        return wav.subarray(offset + 8, offset + 8 + chunkSize);
      }
      offset += 8 + chunkSize + (chunkSize % 2);
    }
  }
  return wav; // WAV가 아니면 raw PCM으로 간주
};

const truncateToByteLimit = (text: string, maxBytes: number): string => {
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (Buffer.byteLength(text.slice(0, mid), 'utf8') <= maxBytes) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo);
};

// 한글(Hangul) 포함 여부로 보이스 선택. Gemini TTS가 한국어 합성을 거부(finishReason
// OTHER / PROHIBITED_CONTENT)하던 문제를 Google Cloud Text-to-Speech로 대체해 해결.
const pickVoice = (text: string): { languageCode: string; name: string } => {
  const hasHangul = /[가-힣ᄀ-ᇿ㄰-㆏ꥠ-꥿ힰ-퟿]/.test(text);
  return hasHangul
    ? { languageCode: 'ko-KR', name: 'ko-KR-Neural2-A' }
    : { languageCode: 'en-US', name: 'en-US-Neural2-C' };
};

const synthesizeSpeech = async (text: string): Promise<Buffer> => {
  const voice = pickVoice(text);
  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${TTS_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: truncateToByteLimit(text, MAX_TTS_BYTES) },
        voice,
        audioConfig: {
          audioEncoding: 'LINEAR16',
          sampleRateHertz: SAMPLE_RATE,
          speakingRate: 0.95,
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Cloud TTS ${response.status}: ${detail.slice(0, 200)}`);
  }

  const json = (await response.json()) as { audioContent?: string };
  if (!json.audioContent) {
    throw new Error('No audioContent in Cloud TTS response');
  }
  return stripWavHeader(Buffer.from(json.audioContent, 'base64'));
};

const uploadToR2 = async (key: string, body: Buffer): Promise<string> => {
    await r2Client.send(new PutObjectCommand({
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

  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({
      status: 'failed',
      errorCode: 'METHOD_NOT_ALLOWED',
      errorMessage: 'Method not allowed',
      requestId,
    });
  }

  const { user, error: authError } = await authenticateRequest(req);
  if (authError) return res.status(authError.status).json(authError.body);
  const uid = user!.uid;

  if (!TTS_API_KEY) {
    return res.status(500).json({
      status: 'failed',
      errorCode: 'API_KEY_NOT_CONFIGURED',
      errorMessage: 'Text-to-Speech API key not configured',
      requestId,
    });
  }

  try {
    const { text, visualizationId } = req.body || {};

    {
      const usage = await checkAndIncrement(uid, 'audioMinutes');
      if (!usage.allowed) {
        return res.status(429).json(limitExceededResponse('audioMinutes', usage));
      }
    }

    const cleanText = String(text || '').replace(/\*\*/g, '').trim();
    if (!cleanText) {
      return res.status(400).json({
        status: 'failed',
        errorCode: 'EMPTY_TEXT',
        errorMessage: 'text is required',
        requestId,
      });
    }

    const audioBuffer = await synthesizeSpeech(cleanText);
    if (!audioBuffer.length) {
      throw new Error('Empty audio from TTS');
    }

    const cleanVisualizationId = typeof visualizationId === 'string' ? visualizationId.trim() : '';

    if (R2_PUBLIC_URL && cleanVisualizationId) {
      try {
        const key = `visualizations/${safePathSegment(uid)}/${safePathSegment(cleanVisualizationId)}/audio.wav`;
        const wav = pcm16ToWavBuffer(audioBuffer);
        const audioUrl = await uploadToR2(key, wav);
        await saveGenerationResult(uid, cleanVisualizationId, audioUrl, requestId);
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

    if (cleanVisualizationId) {
      await saveGenerationResult(uid, cleanVisualizationId, null, requestId);
    }
    return res.status(200).json({
      status: 'completed',
      audioData: audioBuffer.toString('base64'),
      requestId,
    });
  } catch (error: unknown) {
    console.error('[generate-speech]', requestId, error);
    return res.status(502).json({
      status: 'failed',
      errorCode: 'SPEECH_GENERATION_FAILED',
      errorMessage: 'Internal server error',
      requestId,
    });
  }
}
