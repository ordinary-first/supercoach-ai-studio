import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { getFalClient } from '../lib/falClient.js';
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

async function compressToBuffer(input: Buffer, size = 400): Promise<Buffer> {
  return sharp(input)
    .resize(size, size, { fit: 'cover' })
    .jpeg({ quality: 70 })
    .toBuffer();
}

function pickFaceImageUrl(profile: unknown): string | null {
  if (!profile || typeof profile !== 'object') return null;
  const p = profile as Record<string, unknown>;
  // 갤러리 사진 우선 (사용자가 직접 올린 사진)
  if (Array.isArray(p.gallery) && p.gallery.length > 0) {
    const first = String(p.gallery[0]).trim();
    if (first) return first;
  }
  // 폴백: 아바타 URL
  if (typeof p.avatarUrl === 'string' && p.avatarUrl.trim()) {
    return p.avatarUrl.trim();
  }
  return null;
}

function buildPersonDescription(profile: unknown): string {
  if (!profile || typeof profile !== 'object') return 'A determined person';
  const p = profile as Record<string, unknown>;
  const parts = [typeof p.name === 'string' ? p.name : 'A person'];
  if (p.age) parts.push(`${p.age} years old`);
  if (typeof p.gender === 'string' && p.gender !== 'Other') {
    parts.push(p.gender.toLowerCase());
  }
  if (typeof p.location === 'string' && p.location) {
    parts.push(`in ${p.location}`);
  }
  return parts.join(', ');
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

  if (!process.env.FAL_KEY?.trim()) {
    return fail(res, requestId, 500, 'API_KEY_NOT_CONFIGURED', 'FAL_KEY not configured');
  }

  try {
    const {
      prompt,
      profile,
      childTexts,
      nodeId,
      visualizationId,
      imagePurpose,
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

    const fal = getFalClient();
    const cleanNodeId = typeof nodeId === 'string' ? nodeId.trim() : '';
    const cleanVisualizationId = typeof visualizationId === 'string' ? visualizationId.trim() : '';
    const cleanImagePurpose = typeof imagePurpose === 'string' ? imagePurpose.trim() : '';
    const isNodeImage = cleanImagePurpose === 'node' || (!!uid && !!cleanNodeId && !cleanVisualizationId);

    const faceUrl = pickFaceImageUrl(profile);
    const personDesc = buildPersonDescription(profile);

    const activities = Array.isArray(childTexts) && childTexts.length > 0
      ? childTexts.join(', ')
      : '';

    // Kontext Pro: 얼굴 사진 변환 지시문 (image-to-image)
    const kontextPrompt = activities
      ? `Transform this photo into a cinematic scene where the person is actively doing: ${activities}. The overall theme is "${cleanPrompt}". Full body or upper body visible, vivid real-world setting. Aspirational and energetic mood. Photorealistic, cinematic lighting. No text, no letters, no watermarks.`
      : `Transform this photo into a cinematic scene where the person is working towards: "${cleanPrompt}". Show them actively engaged in a concrete scene related to this goal, full body or upper body visible. Aspirational and warm mood. Photorealistic, cinematic lighting. No text, no letters, no watermarks.`;

    // FLUX 1.1 Pro: 텍스트 only (얼굴 사진 없을 때)
    const textPrompt = activities
      ? `Photorealistic image of ${personDesc} actively doing these activities: ${activities}. The overall theme is "${cleanPrompt}". Show the person in the middle of the action, full body or upper body visible, in a vivid real-world setting. Aspirational and energetic mood. Square composition, cinematic lighting. No text, no letters, no watermarks.`
      : `Photorealistic image of ${personDesc} working towards their goal: "${cleanPrompt}". Show the person actively engaged in a concrete scene related to this goal, full body or upper body visible. Aspirational and warm mood. Square composition, cinematic lighting. No text, no letters, no watermarks.`;

    let result: unknown;

    if (faceUrl) {
      // FLUX Kontext Pro — 얼굴 사진을 입력으로 꿈 장면 변환 (얼굴 보존)
      try {
        result = await fal.subscribe('fal-ai/flux-pro/kontext', {
          input: {
            prompt: kontextPrompt,
            image_url: faceUrl,
            guidance_scale: 4.0,
            output_format: 'jpeg',
            safety_tolerance: 4,
          },
          pollInterval: 2000,
        });
      } catch (kontextErr: unknown) {
        console.error('[generate-image][kontext-fallback]', requestId, kontextErr instanceof Error ? kontextErr.message : kontextErr);
        // Kontext 실패 → FLUX 1.1 Pro 텍스트 only 폴백
        result = await fal.subscribe('fal-ai/flux-pro/v1.1', {
          input: {
            prompt: textPrompt,
            image_size: 'square_hd',
          },
          pollInterval: 2000,
        });
      }
    } else {
      // 얼굴 사진 없음 — FLUX 1.1 Pro 텍스트 only (고품질)
      result = await fal.subscribe('fal-ai/flux-pro/v1.1', {
        input: {
          prompt: textPrompt,
          image_size: 'square_hd',
        },
        pollInterval: 2000,
      });
    }

    const rawImageUrl: string | null =
      (result as Record<string, unknown>)?.data
        ? ((result as any).data.images?.[0]?.url as string) || null
        : null;

    if (!rawImageUrl) {
      return fail(res, requestId, 502, 'IMAGE_EMPTY_RESULT', 'Image generation result is empty');
    }

    // fal.ai temp URL → 다운로드 → 압축 → R2 업로드
    const imgResponse = await fetch(rawImageUrl);
    if (!imgResponse.ok) {
      return fail(res, requestId, 502, 'IMAGE_DOWNLOAD_FAILED', 'Failed to download generated image');
    }
    const rawBuffer = Buffer.from(await imgResponse.arrayBuffer());
    const compressed = await compressToBuffer(rawBuffer);
    const dataUrl = `data:image/jpeg;base64,${compressed.toString('base64')}`;

    // 노드 이미지 → R2 (cache-bust: 재생성 시 동일 경로 덮어쓰므로 ?v= 추가)
    if (uid && cleanNodeId && R2_PUBLIC_URL) {
      try {
        const key = `goals/${safePathSegment(uid)}/${safePathSegment(cleanNodeId)}.jpg`;
        const rawUrl = await uploadToR2(key, compressed);
        const url = `${rawUrl}?v=${Date.now()}`;
        await saveGenerationResult(uid, cleanVisualizationId || cleanNodeId, url, dataUrl, requestId);
        return complete(res, requestId, url, dataUrl);
      } catch (r2Error: unknown) {
        const message = r2Error instanceof Error ? r2Error.message : 'R2 upload failed';
        console.error('[generate-image][node-r2]', requestId, message);
      }
    }

    // 시각화 이미지 → R2
    if (cleanImagePurpose === 'visualization' && uid && cleanVisualizationId && R2_PUBLIC_URL) {
      try {
        const key = `visualizations/${safePathSegment(uid)}/${safePathSegment(cleanVisualizationId)}/image.jpg`;
        const rawUrl = await uploadToR2(key, compressed);
        const url = `${rawUrl}?v=${Date.now()}`;
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
