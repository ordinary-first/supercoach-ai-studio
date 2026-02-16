import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { toFile } from 'openai/uploads';
import { getOpenAIClient } from '../lib/openaiClient.js';

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

async function uploadToR2(key: string, buffer: Buffer): Promise<string> {
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'image/jpeg',
  }));
  return `${R2_PUBLIC_URL}/${key}`;
}

/** Compress raw image bytes (base64) to 400x400 JPEG buffer */
async function compressToBuffer(base64Data: string): Promise<Buffer> {
  const buffer = Buffer.from(base64Data, 'base64');
  return sharp(buffer)
    .resize(400, 400, { fit: 'cover' })
    .jpeg({ quality: 70 })
    .toBuffer();
}

async function loadImageAsBase64FromUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.toString('base64');
  } catch {
    return null;
  }
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const match = String(dataUrl).match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

function resolveImagePolicy(input: {
  imagePurpose?: string;
  imageQuality?: string;
  userId?: string;
  nodeId?: string;
}) {
  const inferredNodeImage = !!input.userId && !!input.nodeId;
  const isNodeImage = input.imagePurpose === 'node' || inferredNodeImage;
  if (isNodeImage) {
    return {
      model: 'gpt-image-1-mini',
      quality: 'low' as const,
      isNodeImage: true,
    };
  }

  const quality = input.imageQuality === 'high' ? 'high' : 'medium';
  return {
    model: 'gpt-image-1.5',
    quality: quality as 'medium' | 'high',
    isNodeImage: false,
  };
}

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
    const {
      prompt,
      profile,
      referenceImages,
      childTexts,
      userId,
      nodeId,
      imagePurpose,
      imageQuality,
    } = req.body || {};

    const openai = getOpenAIClient();
    const policy = resolveImagePolicy({
      imagePurpose,
      imageQuality,
      userId,
      nodeId,
    });

    const personDesc = profile
      ? `${profile.name}, a ${profile.age}yo person in ${profile.location}`
      : 'A determined person';

    const childContext = Array.isArray(childTexts) && childTexts.length > 0
      ? ` This goal encompasses these sub-goals: ${childTexts.join(', ')}.`
      : '';

    let rawBase64: string | null = null;
    let rawImageUrl: string | null = null;

    if (!policy.isNodeImage && Array.isArray(referenceImages) && referenceImages.length > 0) {
      // Visualization image with reference images (edits endpoint)
      const files: any[] = [];
      for (let i = 0; i < referenceImages.length; i++) {
        const parsed = parseDataUrl(referenceImages[i]);
        if (!parsed) continue;
        const buf = Buffer.from(parsed.base64, 'base64');
        files.push(await toFile(buf, `ref-${i}.png`, { type: parsed.mimeType }));
      }

      const response: any = await openai.images.edit({
        model: policy.model,
        image: files,
        prompt: `Photorealistic, cinematic image of ${personDesc} embodying: "${String(prompt || '')}". Use the provided reference images as visual context (face likeness, objects, style). No text overlay. 8k resolution.`,
        size: '1024x1024',
        quality: policy.quality,
      });

      rawBase64 = response?.data?.[0]?.b64_json || null;
      rawImageUrl = response?.data?.[0]?.url || null;
    } else {
      // Goal image
      const textPrompt = `Create a single photorealistic image that directly illustrates this personal goal: "${String(prompt || '')}".${childContext} Show a concrete, specific scene — not abstract or metaphorical. The scene should feel aspirational and warm. Square composition, soft cinematic lighting. Absolutely no text, letters, words, or watermarks in the image.`;

      const response: any = await openai.images.generate({
        model: policy.model,
        prompt: textPrompt,
        size: '1024x1024',
        quality: policy.quality,
      });

      rawBase64 = response?.data?.[0]?.b64_json || null;
      rawImageUrl = response?.data?.[0]?.url || null;
    }

    if (!rawBase64 && rawImageUrl) {
      rawBase64 = await loadImageAsBase64FromUrl(rawImageUrl);
    }

    if (!rawBase64) {
      return res.status(200).json({ imageUrl: null, imageDataUrl: null });
    }

    // Compress image
    const compressed = await compressToBuffer(rawBase64);

    // Upload to R2 if userId+nodeId provided and R2 configured
    if (userId && nodeId && R2_PUBLIC_URL) {
      try {
        const key = `goals/${userId}/${nodeId}.jpg`;
        const url = await uploadToR2(key, compressed);
        return res.status(200).json({ imageUrl: url });
      } catch (r2Err: any) {
        console.error('[R2 Upload] Failed:', r2Err?.message);
        // Fall through to base64 fallback
      }
    }

    // Fallback: return base64 (guest users or R2 not configured)
    const dataUrl = `data:image/jpeg;base64,${compressed.toString('base64')}`;
    return res.status(200).json({ imageDataUrl: dataUrl });
  } catch (error: any) {
    console.error('Image Generation Error:', error);
    return res.status(500).json({
      error: error?.message || 'Internal error',
    });
  }
}
