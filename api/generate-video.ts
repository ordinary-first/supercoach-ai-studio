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
    const { prompt, profile, videoId, userId } = req.body || {};
    const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').trim();
    const authHeaders = { Authorization: `Bearer ${apiKey}` };

    // Poll existing job
    if (videoId) {
      const jobRes = await fetch(`${baseUrl}/videos/${encodeURIComponent(String(videoId))}`, {
        method: 'GET',
        headers: authHeaders,
      });
      if (!jobRes.ok) {
        return res.status(200).json({ videoUrl: null, videoId: String(videoId), status: 'unknown' });
      }

      const job: any = await jobRes.json();
      const status = String(job?.status || 'unknown');

      if (status !== 'completed' && status !== 'succeeded') {
        return res.status(200).json({ videoUrl: null, videoId: String(videoId), status });
      }

      const contentRes = await fetch(
        `${baseUrl}/videos/${encodeURIComponent(String(videoId))}/content`,
        { method: 'GET', headers: authHeaders },
      );
      if (!contentRes.ok) {
        const fallbackUrl = pickVideoUrlFromJob(job);
        if (fallbackUrl) {
          return res.status(200).json({ videoUrl: fallbackUrl, videoId: String(videoId), status });
        }
        return res.status(200).json({ videoUrl: null, videoId: String(videoId), status });
      }

      const videoBuffer = Buffer.from(await contentRes.arrayBuffer());

      if (R2_PUBLIC_URL) {
        try {
          const owner = safePathSegment(userId || profile?.googleId || 'guest');
          const key = `videos/${owner}/${safePathSegment(String(videoId))}.mp4`;
          const url = await uploadVideoToR2(key, videoBuffer);
          return res.status(200).json({ videoUrl: url, videoId: String(videoId), status });
        } catch (r2Err: any) {
          console.error('[R2 Upload] Failed:', r2Err?.message);
        }
      }

      const dataUrl = `data:video/mp4;base64,${videoBuffer.toString('base64')}`;
      return res.status(200).json({ videoUrl: dataUrl, videoId: String(videoId), status });
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
        seconds: '8',
        size: '1280x720',
      }),
    });

    if (!createdRes.ok) {
      return res.status(200).json({ videoUrl: null });
    }

    const created: any = await createdRes.json();

    const createdVideoId = created?.id || created?.video_id || null;
    return res.status(200).json({
      videoUrl: null,
      videoId: createdVideoId,
      status: created?.status || 'queued',
    });
  } catch (error: any) {
    console.error('Video Generation Error:', error);
    return res.status(200).json({ videoUrl: null });
  }
}
