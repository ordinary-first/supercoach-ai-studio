import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

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

type VideoStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'unknown';

type VideoPayload = {
  durationSec: number;
  requestId: string;
  videoId?: string | null;
  videoUrl?: string | null;
  status?: VideoStatus;
  errorCode?: string;
  errorMessage?: string;
};

const createRequestId = (): string => {
  return `video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

function safePathSegment(value: string): string {
  const cleaned = String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || 'guest';
}

function clampDurationSec(input: unknown): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return 4;
  return Math.max(2, Math.min(6, Math.round(parsed)));
}

function asVideoStatus(input: unknown): VideoStatus {
  const normalized = String(input || '').toLowerCase();
  if (normalized === 'queued') return 'queued';
  if (normalized === 'in_progress') return 'in_progress';
  if (normalized === 'completed' || normalized === 'succeeded') return 'completed';
  if (normalized === 'failed') return 'failed';
  return 'unknown';
}

function pickVideoUrlFromJob(job: unknown): string | null {
  if (!job || typeof job !== 'object') return null;
  const source = job as Record<string, unknown>;
  const directCandidates = [source.url, source.video_url, source.result_url];
  for (const candidate of directCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }

  if (!Array.isArray(source.output)) return null;
  for (const entry of source.output) {
    if (entry && typeof entry === 'object' && typeof (entry as Record<string, unknown>).url === 'string') {
      return (entry as Record<string, unknown>).url as string;
    }
  }
  return null;
}

async function fetchProfileImageForVideo(
  avatarUrl: string,
  width: number,
  height: number,
): Promise<Buffer | null> {
  try {
    const response = await fetch(avatarUrl);
    if (!response.ok) return null;
    const raw = Buffer.from(await response.arrayBuffer());
    return sharp(raw).resize(width, height, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
  } catch {
    return null;
  }
}

async function uploadVideoToR2(key: string, buffer: Buffer): Promise<string> {
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: 'video/mp4',
    }),
  );
  return `${R2_PUBLIC_URL}/${key}`;
}

async function parseUpstreamError(response: Response): Promise<{ code: string; message: string }> {
  const fallbackCode = `UPSTREAM_HTTP_${response.status}`;
  const fallbackMessage = `Upstream request failed (${response.status})`;

  try {
    const payload = await response.json();
    const body = payload as Record<string, unknown>;
    const nestedError =
      body.error && typeof body.error === 'object'
        ? (body.error as Record<string, unknown>)
        : null;
    const message =
      typeof body.error === 'string'
        ? body.error
        : typeof body.message === 'string'
          ? body.message
          : fallbackMessage;
    const code =
      typeof body.code === 'string'
        ? body.code
        : nestedError && typeof nestedError.code === 'string'
          ? nestedError.code
          : fallbackCode;
    return { code, message };
  } catch {
    return { code: fallbackCode, message: fallbackMessage };
  }
}

function respondVideo(res: VercelResponse, payload: VideoPayload) {
  return res.status(200).json({
    videoUrl: payload.videoUrl || null,
    videoId: payload.videoId || null,
    status: payload.status || 'failed',
    durationSec: payload.durationSec,
    errorCode: payload.errorCode || null,
    errorMessage: payload.errorMessage || null,
    requestId: payload.requestId,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = createRequestId();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({
      errorCode: 'METHOD_NOT_ALLOWED',
      errorMessage: 'Method not allowed',
      requestId,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return res.status(500).json({
      errorCode: 'API_KEY_NOT_CONFIGURED',
      errorMessage: 'API key not configured',
      requestId,
    });
  }

  try {
    const { prompt, profile, videoId, userId, durationSec } = req.body || {};
    const effectiveDurationSec = clampDurationSec(durationSec);
    const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').trim();
    const authHeaders = { Authorization: `Bearer ${apiKey}` };

    if (videoId) {
      const pollRes = await fetch(`${baseUrl}/videos/${encodeURIComponent(String(videoId))}`, {
        method: 'GET',
        headers: authHeaders,
      });

      if (!pollRes.ok) {
        const upstream = await parseUpstreamError(pollRes);
        return respondVideo(res, {
          durationSec: effectiveDurationSec,
          requestId,
          videoId: String(videoId),
          status: 'failed',
          errorCode: `VIDEO_POLL_${upstream.code}`,
          errorMessage: upstream.message,
        });
      }

      const job = (await pollRes.json()) as Record<string, unknown>;
      const status = asVideoStatus(job.status);

      if (status === 'queued' || status === 'in_progress') {
        return respondVideo(res, {
          durationSec: effectiveDurationSec,
          requestId,
          videoId: String(videoId),
          status,
        });
      }

      if (status === 'failed') {
        return respondVideo(res, {
          durationSec: effectiveDurationSec,
          requestId,
          videoId: String(videoId),
          status: 'failed',
          errorCode: 'VIDEO_JOB_FAILED',
          errorMessage: 'Video generation job failed',
        });
      }

      if (status !== 'completed') {
        return respondVideo(res, {
          durationSec: effectiveDurationSec,
          requestId,
          videoId: String(videoId),
          status: 'failed',
          errorCode: 'VIDEO_STATUS_UNKNOWN',
          errorMessage: `Unknown video status: ${String(job.status || 'n/a')}`,
        });
      }

      const contentRes = await fetch(
        `${baseUrl}/videos/${encodeURIComponent(String(videoId))}/content`,
        { method: 'GET', headers: authHeaders },
      );

      if (!contentRes.ok) {
        const fallbackUrl = pickVideoUrlFromJob(job);
        if (fallbackUrl) {
          return respondVideo(res, {
            durationSec: effectiveDurationSec,
            requestId,
            videoId: String(videoId),
            videoUrl: fallbackUrl,
            status: 'completed',
          });
        }
        const upstream = await parseUpstreamError(contentRes);
        return respondVideo(res, {
          durationSec: effectiveDurationSec,
          requestId,
          videoId: String(videoId),
          status: 'failed',
          errorCode: `VIDEO_CONTENT_${upstream.code}`,
          errorMessage: upstream.message,
        });
      }

      const videoBuffer = Buffer.from(await contentRes.arrayBuffer());

      if (R2_PUBLIC_URL) {
        try {
          const owner = safePathSegment(String(userId || profile?.googleId || 'guest'));
          const key = `videos/${owner}/${safePathSegment(String(videoId))}.mp4`;
          const uploadedUrl = await uploadVideoToR2(key, videoBuffer);
          return respondVideo(res, {
            durationSec: effectiveDurationSec,
            requestId,
            videoId: String(videoId),
            videoUrl: uploadedUrl,
            status: 'completed',
          });
        } catch (uploadError: unknown) {
          const message =
            uploadError instanceof Error ? uploadError.message : 'R2 upload failed';
          console.error('[generate-video][r2-upload]', requestId, message);
        }
      }

      const dataUrl = `data:video/mp4;base64,${videoBuffer.toString('base64')}`;
      return respondVideo(res, {
        durationSec: effectiveDurationSec,
        requestId,
        videoId: String(videoId),
        videoUrl: dataUrl,
        status: 'completed',
      });
    }

    const promptText = String(prompt || '').trim();
    if (!promptText) {
      return respondVideo(res, {
        durationSec: effectiveDurationSec,
        requestId,
        status: 'failed',
        errorCode: 'EMPTY_PROMPT',
        errorMessage: 'prompt is required',
      });
    }

    const personDesc = profile
      ? `${profile.name}, a ${profile.age}yo person in ${profile.location}`
      : 'A determined person';
    const videoPrompt = `Cinematic scene of ${personDesc} living the reality of: "${promptText}". Aspirational, warm atmosphere. Smooth natural movement. Soft cinematic lighting.`;

    // 프로필 아바타가 있으면 input_reference로 전달 (이미지→비디오)
    const avatarUrl = typeof profile?.avatarUrl === 'string' ? profile.avatarUrl.trim() : '';
    const profileImage = avatarUrl
      ? await fetchProfileImageForVideo(avatarUrl, 1280, 720)
      : null;

    let createRes: Response;
    if (profileImage) {
      const formData = new FormData();
      formData.append('model', 'sora-2');
      formData.append('prompt', videoPrompt);
      formData.append('size', '1280x720');
      formData.append('seconds', String(effectiveDurationSec));
      formData.append(
        'input_reference',
        new Blob([new Uint8Array(profileImage)], { type: 'image/jpeg' }),
        'profile.jpg',
      );

      createRes = await fetch(`${baseUrl}/videos`, {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });
    } else {
      createRes = await fetch(`${baseUrl}/videos`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sora-2',
          prompt: videoPrompt,
          seconds: String(effectiveDurationSec),
          size: '1280x720',
        }),
      });
    }

    if (!createRes.ok) {
      const upstream = await parseUpstreamError(createRes);
      return respondVideo(res, {
        durationSec: effectiveDurationSec,
        requestId,
        status: 'failed',
        errorCode: `VIDEO_CREATE_${upstream.code}`,
        errorMessage: upstream.message,
      });
    }

    const created = (await createRes.json()) as Record<string, unknown>;
    const createdVideoId =
      typeof created.id === 'string'
        ? created.id
        : typeof created.video_id === 'string'
          ? created.video_id
          : null;
    const createdStatus = asVideoStatus(created.status || 'queued');

    if (!createdVideoId && createdStatus !== 'completed') {
      return respondVideo(res, {
        durationSec: effectiveDurationSec,
        requestId,
        status: 'failed',
        errorCode: 'VIDEO_ID_MISSING',
        errorMessage: 'Video ID is missing from create response',
      });
    }

    return respondVideo(res, {
      durationSec: effectiveDurationSec,
      requestId,
      videoId: createdVideoId,
      status: createdStatus === 'unknown' ? 'queued' : createdStatus,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Video generation failed';
    console.error('[generate-video]', requestId, errorMessage);
    return respondVideo(res, {
      durationSec: 4,
      requestId,
      status: 'failed',
      errorCode: 'VIDEO_GENERATION_EXCEPTION',
      errorMessage,
    });
  }
}
