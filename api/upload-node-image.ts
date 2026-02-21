import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { authenticateRequest } from '../lib/authMiddleware.js';
import { setCorsHeaders } from '../lib/corsHeaders.js';
import { safePathSegment } from '../lib/safePathSegment.js';

// --- R2 Setup (trim env vars: vercel env add can include trailing newlines) ---
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

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const match = String(dataUrl).match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

async function compressToBuffer(base64Data: string): Promise<Buffer> {
  const buffer = Buffer.from(base64Data, 'base64');
  return sharp(buffer)
    .resize(400, 400, { fit: 'cover' })
    .jpeg({ quality: 70 })
    .toBuffer();
}

async function uploadToR2(key: string, buffer: Buffer): Promise<string> {
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'image/jpeg',
  }));
  return `${R2_PUBLIC_URL}/${key}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user, error: authError } = await authenticateRequest(req);
  if (authError) return res.status(authError.status).json(authError.body);
  const uid = user!.uid;

  try {
    const { imageDataUrl, nodeId } = req.body || {};
    if (!imageDataUrl) {
      return res.status(400).json({ error: 'imageDataUrl is required' });
    }

    const parsed = parseDataUrl(String(imageDataUrl));
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid image data URL' });
    }

    const compressed = await compressToBuffer(parsed.base64);

    if (nodeId && R2_PUBLIC_URL) {
      try {
        const key = `goals/${safePathSegment(uid)}/${safePathSegment(String(nodeId || ''))}.jpg`;
        const imageUrl = await uploadToR2(key, compressed);
        return res.status(200).json({ imageUrl });
      } catch (r2Err: unknown) {
        console.error('[upload-node-image][r2]', r2Err);
      }
    }

    return res.status(200).json({
      imageDataUrl: `data:image/jpeg;base64,${compressed.toString('base64')}`,
    });
  } catch (error: unknown) {
    console.error('[upload-node-image]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

