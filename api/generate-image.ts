import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { toFile } from 'openai/uploads';
import { getOpenAIClient } from '../lib/openaiClient.js';
import { getAdminDb } from '../lib/firebaseAdmin.js';
import { checkAndIncrement, limitExceededResponse } from '../lib/usageGuard.js';
import { authenticateRequest } from '../lib/authMiddleware.js';
import { setCorsHeaders } from '../lib/corsHeaders.js';
import { safePathSegment } from '../lib/safePathSegment.js';

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
  return `image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const fail = (
  res: VercelResponse,
  requestId: string,
  statusCode: number,
  errorCode: string,
  errorMessage: string,
) => {
  return res.status(statusCode).json({
    status: 'failed',
    imageUrl: null,
    imageDataUrl: null,
    errorCode,
    errorMessage,
    requestId,
  });
};

const complete = (
  res: VercelResponse,
  requestId: string,
  imageUrl?: string | null,
  imageDataUrl?: string | null,
) => {
  return res.status(200).json({
    status: 'completed',
    imageUrl: imageUrl || null,
    imageDataUrl: imageDataUrl || null,
    requestId,
  });
};

async function uploadToR2(key: string, buffer: Buffer): Promise<string> {
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'image/jpeg',
  }));
  return `${R2_PUBLIC_URL}/${key}`;
}

const saveGenerationResult = async (
  userId: string,
  generationId: string,
  imageUrl: string | null,
  imageDataUrl: string | null,
  requestId: string,
): Promise<void> => {
  try {
    const db = getAdminDb();
    await db.doc(`users/${userId}/generationResults/${generationId}`).set({
      type: 'image',
      imageUrl,
      imageDataUrl,
      requestId,
      createdAt: Date.now(),
    });
  } catch { /* best effort */ }
};

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

async function collectProfileImageBuffers(profile: any): Promise<Buffer[]> {
  const urls: string[] = [];
  if (typeof profile?.avatarUrl === 'string' && profile.avatarUrl.trim()) {
    urls.push(profile.avatarUrl);
  }
  if (Array.isArray(profile?.gallery)) {
    for (const u of profile.gallery) {
      if (typeof u === 'string' && u.trim()) urls.push(u);
    }
  }
  const buffers: Buffer[] = [];
  for (const url of urls) {
    const b64 = await loadImageAsBase64FromUrl(url);
    if (b64) buffers.push(Buffer.from(b64, 'base64'));
  }
  return buffers;
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

type GeneratedImagePayload = {
  b64: string | null;
  url: string | null;
};

async function generateWithPrompt(
  openai: any,
  model: string,
  quality: 'low' | 'medium' | 'high',
  prompt: string,
): Promise<GeneratedImagePayload> {
  const response: any = await openai.images.generate({
    model,
    prompt,
    size: '1024x1024',
    quality,
  });

  return {
    b64: response?.data?.[0]?.b64_json || null,
    url: response?.data?.[0]?.url || null,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = createRequestId();

  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return fail(res, requestId, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  const { user, error: authError } = await authenticateRequest(req);
  if (authError) return res.status(authError.status).json(authError.body);
  const uid = user!.uid;

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return fail(res, requestId, 500, 'API_KEY_NOT_CONFIGURED', 'API key not configured');
  }

  try {
    const {
      prompt,
      profile,
      referenceImages,
      childTexts,
      nodeId,
      visualizationId,
      imagePurpose,
      imageQuality,
    } = req.body || {};

    const cleanPrompt = String(prompt || '').trim();
    if (!cleanPrompt) {
      return fail(res, requestId, 400, 'EMPTY_PROMPT', 'prompt is required');
    }

    {
      const usage = await checkAndIncrement(uid, 'imageCredits');
      if (!usage.allowed) {
        return res.status(429).json(limitExceededResponse('imageCredits', usage));
      }
    }

    const openai = getOpenAIClient();
    const cleanNodeId = typeof nodeId === 'string' ? nodeId.trim() : '';
    const cleanVisualizationId = typeof visualizationId === 'string' ? visualizationId.trim() : '';
    const cleanImagePurpose = typeof imagePurpose === 'string' ? imagePurpose.trim() : '';

    const policy = resolveImagePolicy({
      imagePurpose: cleanImagePurpose,
      imageQuality,
      userId: uid,
      nodeId: cleanNodeId || undefined,
    });

    const personDesc = profile
      ? `${profile.name}, a ${profile.age}yo person in ${profile.location}`
      : 'A determined person';

    const childContext = Array.isArray(childTexts) && childTexts.length > 0
      ? ` This goal encompasses these sub-goals: ${childTexts.join(', ')}.`
      : '';

    const textPrompt = `Create a single photorealistic image that directly illustrates this personal goal: "${cleanPrompt}".${childContext} Show a concrete, specific scene, not abstract or metaphorical. The scene should feel aspirational and warm. Square composition, soft cinematic lighting. Absolutely no text, letters, words, or watermarks in the image.`;

    let rawBase64: string | null = null;
    let rawImageUrl: string | null = null;

    if (!policy.isNodeImage) {
      const files: any[] = [];

      // 수동 레퍼런스 이미지 (VisualizationModal에서 업로드)
      if (Array.isArray(referenceImages)) {
        for (let i = 0; i < referenceImages.length; i += 1) {
          const parsed = parseDataUrl(referenceImages[i]);
          if (!parsed) continue;
          const buf = Buffer.from(parsed.base64, 'base64');
          files.push(await toFile(buf, `ref-${i}.png`, { type: parsed.mimeType }));
        }
      }

      // 프로필 이미지 자동 포함 (avatarUrl + gallery)
      const profileBuffers = await collectProfileImageBuffers(profile);
      for (let i = 0; i < profileBuffers.length; i += 1) {
        files.push(await toFile(profileBuffers[i], `profile-${i}.jpg`, { type: 'image/jpeg' }));
      }

      if (files.length > 0) {
        const response: any = await openai.images.edit({
          model: policy.model,
          image: files,
          prompt: `Photorealistic, cinematic image of ${personDesc} embodying: "${cleanPrompt}". Match the person's face and appearance from the reference photos. Scene should feel aspirational and warm. Soft cinematic lighting. No text, letters, or watermarks.`,
          size: '1024x1024',
          quality: policy.quality,
        });

        rawBase64 = response?.data?.[0]?.b64_json || null;
        rawImageUrl = response?.data?.[0]?.url || null;
      } else {
        const result = await generateWithPrompt(openai, policy.model, policy.quality, textPrompt);
        rawBase64 = result.b64;
        rawImageUrl = result.url;
      }
    } else {
      const result = await generateWithPrompt(openai, policy.model, policy.quality, textPrompt);
      rawBase64 = result.b64;
      rawImageUrl = result.url;
    }

    if (!rawBase64 && !rawImageUrl) {
      const fallback = await generateWithPrompt(openai, 'gpt-image-1', 'medium', textPrompt);
      rawBase64 = fallback.b64;
      rawImageUrl = fallback.url;
    }

    if (!rawBase64 && rawImageUrl) {
      rawBase64 = await loadImageAsBase64FromUrl(rawImageUrl);
    }

    if (!rawBase64) {
      return fail(res, requestId, 502, 'IMAGE_EMPTY_RESULT', 'Image generation result is empty');
    }

    const compressed = await compressToBuffer(rawBase64);
    const dataUrl = `data:image/jpeg;base64,${compressed.toString('base64')}`;

    if (uid && cleanNodeId && R2_PUBLIC_URL) {
      try {
        const key = `goals/${safePathSegment(uid)}/${safePathSegment(cleanNodeId)}.jpg`;
        const url = await uploadToR2(key, compressed);
        await saveGenerationResult(uid, cleanVisualizationId || cleanNodeId, url, dataUrl, requestId);
        return complete(res, requestId, url, dataUrl);
      } catch (r2Error: unknown) {
        const message = r2Error instanceof Error ? r2Error.message : 'R2 upload failed';
        console.error('[generate-image][node-r2]', requestId, message);
      }
    }

    if (
      cleanImagePurpose === 'visualization' &&
      uid &&
      cleanVisualizationId &&
      R2_PUBLIC_URL
    ) {
      try {
        const key = `visualizations/${safePathSegment(uid)}/${safePathSegment(cleanVisualizationId)}/image.jpg`;
        const url = await uploadToR2(key, compressed);
        await saveGenerationResult(uid, cleanVisualizationId, url, dataUrl, requestId);
        return complete(res, requestId, url, dataUrl);
      } catch (r2Error: unknown) {
        const message = r2Error instanceof Error ? r2Error.message : 'R2 upload failed';
        console.error('[generate-image][viz-r2]', requestId, message);
      }
    }

    if (uid && cleanVisualizationId) {
      await saveGenerationResult(uid, cleanVisualizationId, null, dataUrl, requestId);
    }
    return complete(res, requestId, null, dataUrl);
  } catch (error: unknown) {
    console.error('[generate-image]', requestId, error);
    return fail(res, requestId, 500, 'IMAGE_GENERATION_FAILED', 'Internal server error');
  }
}
