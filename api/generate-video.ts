import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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

function safePathSegment(value: string): string {
  const cleaned = String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || 'guest';
}

async function uploadVideoToR2(key: string, buffer: Buffer): Promise<string> {
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'video/mp4',
  }));
  return `${R2_PUBLIC_URL}/${key}`;
}

function pickVideoUrlFromJob(job: any): string | null {
  const direct = [job?.url, job?.video_url, job?.result_url].find(
    (value) => typeof value === 'string' && value.length > 0,
  );
  if (direct) return direct;

  const outputArray = Array.isArray(job?.output) ? job.output : [];
  const nested = outputArray.find((item: any) => typeof item?.url === 'string');
  return nested?.url || null;
}

type VideoStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'unknown';

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

function respondVideo(
  res: VercelResponse,
  payload: {
    durationSec: number;
    videoId?: string | null;
    videoUrl?: string | null;
    status?: VideoStatus;
  },
) {
  return res.status(200).json({
    videoUrl: payload.videoUrl || null,
    videoId: payload.videoId || null,
    status: payload.status || 'unknown',
    durationSec: payload.durationSec,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { prompt, profile, videoId, userId, durationSec } = req.body || {};
    const effectiveDurationSec = clampDurationSec(durationSec);
    const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').trim();
    const authHeaders = { Authorization: `Bearer ${apiKey}` };

    // Poll existing job
    if (videoId) {
      const jobRes = await fetch(`${baseUrl}/videos/${encodeURIComponent(String(videoId))}`, {
        method: 'GET',
        headers: authHeaders,
      });
      if (!jobRes.ok) {
        return respondVideo(res, {
          durationSec: effectiveDurationSec,
          videoId: String(videoId),
          status: 'unknown',
        });
      }

      const job: any = await jobRes.json();
      const status = asVideoStatus(job?.status);

      if (status !== 'completed') {
        return respondVideo(res, {
          durationSec: effectiveDurationSec,
          videoId: String(videoId),
          status,
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
            videoId: String(videoId),
            videoUrl: fallbackUrl,
            status,
          });
        }
        return respondVideo(res, {
          durationSec: effectiveDurationSec,
          videoId: String(videoId),
          status,
        });
      }

      const videoBuffer = Buffer.from(await contentRes.arrayBuffer());

      if (R2_PUBLIC_URL) {
        try {
          const owner = safePathSegment(userId || profile?.googleId || 'guest');
          const key = `videos/${owner}/${safePathSegment(String(videoId))}.mp4`;
          const url = await uploadVideoToR2(key, videoBuffer);
          return respondVideo(res, {
            durationSec: effectiveDurationSec,
            videoId: String(videoId),
            videoUrl: url,
            status,
          });
        } catch (r2Err: any) {
          console.error('[R2 Upload] Failed:', r2Err?.message);
        }
      }

      const dataUrl = `data:video/mp4;base64,${videoBuffer.toString('base64')}`;
      return respondVideo(res, {
        durationSec: effectiveDurationSec,
        videoId: String(videoId),
        videoUrl: dataUrl,
        status,
      });
    }

    // Create new job
    const name = profile?.name || 'A person';
    const videoPrompt = `Cinematic movie scene of ${name} achieving: ${String(prompt || '')}. High quality, photorealistic, 4k.`;

    const createdRes = await fetch(`${baseUrl}/videos`, {
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

    if (!createdRes.ok) {
      return respondVideo(res, { durationSec: effectiveDurationSec, status: 'unknown' });
    }

    const created: any = await createdRes.json();

    const createdVideoId = created?.id || created?.video_id || null;
    return respondVideo(res, {
      durationSec: effectiveDurationSec,
      videoId: createdVideoId,
      status: asVideoStatus(created?.status || 'queued'),
    });
  } catch (error: any) {
    console.error('Video Generation Error:', error);
    return respondVideo(res, { durationSec: 4, status: 'unknown' });
  }
}
