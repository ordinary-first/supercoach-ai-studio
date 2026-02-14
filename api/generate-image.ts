import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

// --- R2 Setup (trim env vars — vercel env add can include trailing newlines) ---
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

async function uploadToR2(
  key: string, buffer: Buffer
): Promise<string> {
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'image/jpeg',
  }));
  return `${R2_PUBLIC_URL}/${key}`;
}

/** Compress raw base64 to 400x400 JPEG buffer */
async function compressToBuffer(base64Data: string): Promise<Buffer> {
  const buffer = Buffer.from(base64Data, 'base64');
  return sharp(buffer)
    .resize(400, 400, { fit: 'cover' })
    .jpeg({ quality: 70 })
    .toBuffer();
}

/** Extract first image from Gemini response parts */
function extractImageData(
  parts: any[] | undefined
): string | null {
  for (const part of parts || []) {
    if (part.inlineData?.data) return part.inlineData.data;
  }
  return null;
}

export default async function handler(
  req: VercelRequest, res: VercelResponse
) {
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
    const {
      prompt, profile, referenceImages, childTexts,
      userId, nodeId,
    } = req.body;
    const ai = new GoogleGenAI({ apiKey });

    const personDesc = profile
      ? `${profile.name}, a ${profile.age}yo person in ${profile.location}`
      : 'A determined person';

    const childContext = Array.isArray(childTexts) && childTexts.length > 0
      ? ` This goal encompasses these sub-goals: ${childTexts.join(', ')}.`
      : '';

    let rawBase64: string | null = null;

    if (referenceImages && referenceImages.length > 0) {
      // Visualization image with reference images
      const parts: any[] = [{
        text: `Photorealistic, cinematic image of ${personDesc} embodying: "${prompt}". Use the provided reference images as visual context (face likeness, objects, style). No text overlay. 8k resolution.`,
      }];

      for (const base64Image of referenceImages) {
        const match = base64Image.match(
          /^data:(image\/\w+);base64,(.+)$/
        );
        if (match) {
          parts.push({
            inlineData: { mimeType: match[1], data: match[2] },
          });
        }
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts },
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { aspectRatio: '1:1' },
        },
      });

      rawBase64 = extractImageData(
        response.candidates?.[0]?.content?.parts
      );
    } else {
      // Goal image
      const textPrompt = `Create a single photorealistic image that directly illustrates this personal goal: "${prompt}".${childContext} Show a concrete, specific scene — not abstract or metaphorical. The scene should feel aspirational and warm. Square composition, soft cinematic lighting. Absolutely no text, letters, words, or watermarks in the image.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: textPrompt }] },
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { aspectRatio: '1:1' },
        },
      });

      rawBase64 = extractImageData(
        response.candidates?.[0]?.content?.parts
      );
    }

    if (!rawBase64) {
      return res.status(200).json({ imageUrl: null, imageDataUrl: null });
    }

    // Compress image
    const compressed = await compressToBuffer(rawBase64);

    // Upload to R2 if userId+nodeId provided and R2 configured
    console.log('[R2 Debug]', {
      hasUserId: !!userId,
      hasNodeId: !!nodeId,
      R2_PUBLIC_URL: R2_PUBLIC_URL || '(empty)',
      R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID ? 'set' : 'missing',
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ? 'set' : 'missing',
      compressedSize: compressed.length,
    });

    if (userId && nodeId && R2_PUBLIC_URL) {
      try {
        const key = `goals/${userId}/${nodeId}.jpg`;
        const url = await uploadToR2(key, compressed);
        console.log('[R2 Upload] Success:', url);
        return res.status(200).json({ imageUrl: url });
      } catch (r2Err: any) {
        console.error('[R2 Upload] Failed:', r2Err?.message);
        // Fall through to base64 fallback
      }
    }

    // Fallback: return base64 (guest users or R2 not configured)
    const dataUrl =
      `data:image/jpeg;base64,${compressed.toString('base64')}`;
    console.log('[R2 Fallback] Returning base64, length:', dataUrl.length);
    return res.status(200).json({ imageDataUrl: dataUrl });
  } catch (error: any) {
    console.error('Image Generation Error:', error);
    return res.status(500).json({
      error: error?.message || 'Internal error',
    });
  }
}
