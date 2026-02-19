import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { verifyAuth } from '../lib/apiAuth.js';
import { setCorsHeaders } from '../lib/apiCors.js';

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

function safePathSegment(value: string): string {
  const cleaned = String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || 'unknown';
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

async function compressImage(base64Data: string): Promise<Buffer> {
  const buffer = Buffer.from(base64Data, 'base64');
  return sharp(buffer)
    .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
}

function pcm16ToWavBuffer(pcmBase64: string, sampleRate: number = 24000): Buffer {
  const pcm = Buffer.from(pcmBase64, 'base64');
  const channels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcm.length;
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

  return Buffer.concat([header, pcm]);
}

async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<string> {
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  return `${R2_PUBLIC_URL}/${key}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCorsHeaders(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authUser = await verifyAuth(req, res);
  if (!authUser) return;

  try {
    const {
      assetType,
      visualizationId,
      dataUrl,
      audioData,
    } = req.body || {};

    if (!assetType) {
      return res.status(400).json({ error: 'assetType is required' });
    }
    if (!R2_PUBLIC_URL) {
      return res.status(500).json({ error: 'R2 public url is not configured' });
    }

    const owner = safePathSegment(authUser.uid);
    const viz = safePathSegment(String(visualizationId || Date.now()));

    if (assetType === 'image') {
      if (!dataUrl) return res.status(400).json({ error: 'dataUrl required for image' });
      const parsed = parseDataUrl(String(dataUrl));
      if (!parsed || !parsed.mimeType.startsWith('image/')) {
        return res.status(400).json({ error: 'Invalid image data URL' });
      }
      const compressed = await compressImage(parsed.base64);
      const key = `visualizations/${owner}/${viz}/image.jpg`;
      const assetUrl = await uploadToR2(key, compressed, 'image/jpeg');
      return res.status(200).json({ assetUrl, key });
    }

    if (assetType === 'audio') {
      if (!audioData) return res.status(400).json({ error: 'audioData required for audio' });
      const wav = pcm16ToWavBuffer(String(audioData));
      const key = `visualizations/${owner}/${viz}/audio.wav`;
      const assetUrl = await uploadToR2(key, wav, 'audio/wav');
      return res.status(200).json({ assetUrl, key });
    }

    if (assetType === 'video') {
      if (!dataUrl) return res.status(400).json({ error: 'dataUrl required for video' });
      const parsed = parseDataUrl(String(dataUrl));
      if (!parsed || !parsed.mimeType.startsWith('video/')) {
        return res.status(400).json({ error: 'Invalid video data URL' });
      }
      const videoBuffer = Buffer.from(parsed.base64, 'base64');
      const key = `visualizations/${owner}/${viz}/video.mp4`;
      const assetUrl = await uploadToR2(key, videoBuffer, 'video/mp4');
      return res.status(200).json({ assetUrl, key });
    }

    return res.status(400).json({ error: 'Unsupported assetType' });
  } catch (error: any) {
    console.error('Upload Visualization Asset Error:', error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}
