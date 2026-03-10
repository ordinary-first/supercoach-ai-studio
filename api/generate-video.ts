import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getFalClient } from '../lib/falClient.js';
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

// 얼굴 사진 있으면 Subject Reference, 없으면 Text-to-Video
const MODEL_SUBJECT_REF = 'fal-ai/minimax/video-01-subject-reference';
const MODEL_TEXT_TO_VIDEO = 'fal-ai/minimax/video-01/text-to-video';

type VideoStatus = 'queued' | 'in_progress' | 'completed' | 'failed';

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

function pickFaceImageUrl(profile: unknown): string | null {
  if (!profile || typeof profile !== 'object') return null;
  const p = profile as Record<string, unknown>;
  if (Array.isArray(p.gallery) && p.gallery.length > 0) {
    const first = String(p.gallery[0]).trim();
    if (first) return first;
  }
  if (typeof p.avatarUrl === 'string' && p.avatarUrl.trim()) {
    return p.avatarUrl.trim();
  }
  return null;
}

function mapFalStatus(falStatus: string): VideoStatus {
  const s = (falStatus || '').toUpperCase();
  if (s === 'IN_QUEUE') return 'queued';
  if (s === 'IN_PROGRESS') return 'in_progress';
  if (s === 'COMPLETED') return 'completed';
  return 'failed';
}

// videoId 형식: "subref:{request_id}" 또는 "t2v:{request_id}"
function parseVideoId(videoId: string): { model: string; requestId: string } {
  if (videoId.startsWith('subref:')) {
    return { model: MODEL_SUBJECT_REF, requestId: videoId.slice(7) };
  }
  if (videoId.startsWith('t2v:')) {
    return { model: MODEL_TEXT_TO_VIDEO, requestId: videoId.slice(4) };
  }
  // 레거시 호환: prefix 없으면 subject ref로 시도
  return { model: MODEL_SUBJECT_REF, requestId: videoId };
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

  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({
      errorCode: 'METHOD_NOT_ALLOWED',
      errorMessage: 'Method not allowed',
      requestId,
    });
  }

  const { user, error: authError } = await authenticateRequest(req);
  if (authError) return res.status(authError.status).json(authError.body);
  const uid = user!.uid;

  if (!process.env.FAL_KEY?.trim()) {
    return res.status(500).json({
      errorCode: 'API_KEY_NOT_CONFIGURED',
      errorMessage: 'FAL_KEY not configured',
      requestId,
    });
  }

  try {
    const { prompt, profile, videoId } = req.body || {};
    const DURATION = 6; // MiniMax 고정 ~6초

    const fal = getFalClient();

    // ── 폴링 (기존 영상 상태 확인) ──
    if (videoId) {
      const { model, requestId: falRequestId } = parseVideoId(String(videoId));

      try {
        const statusRes = await fal.queue.status(model, {
          requestId: falRequestId,
          logs: false,
        });

        const status = mapFalStatus((statusRes as any).status);

        if (status === 'queued' || status === 'in_progress') {
          return respondVideo(res, {
            durationSec: DURATION,
            requestId,
            videoId: String(videoId),
            status,
          });
        }

        if (status !== 'completed') {
          return respondVideo(res, {
            durationSec: DURATION,
            requestId,
            videoId: String(videoId),
            status: 'failed',
            errorCode: 'VIDEO_JOB_FAILED',
            errorMessage: 'Video generation failed',
          });
        }

        // 완료 → 결과 가져오기
        const result = await fal.queue.result(model, {
          requestId: falRequestId,
        });

        const videoUrl: string | null =
          (result as any)?.data?.video?.url || null;

        if (!videoUrl) {
          return respondVideo(res, {
            durationSec: DURATION,
            requestId,
            videoId: String(videoId),
            status: 'failed',
            errorCode: 'VIDEO_EMPTY_RESULT',
            errorMessage: 'Video result is empty',
          });
        }

        // fal.ai temp URL → 다운로드 → R2 업로드
        const vidResponse = await fetch(videoUrl);
        if (!vidResponse.ok) {
          // R2 실패 시 fal.ai temp URL 직접 반환
          return respondVideo(res, {
            durationSec: DURATION,
            requestId,
            videoId: String(videoId),
            videoUrl,
            status: 'completed',
          });
        }

        const videoBuffer = Buffer.from(await vidResponse.arrayBuffer());

        if (R2_PUBLIC_URL) {
          try {
            const key = `videos/${safePathSegment(uid)}/${safePathSegment(falRequestId)}.mp4`;
            const uploadedUrl = await uploadVideoToR2(key, videoBuffer);
            return respondVideo(res, {
              durationSec: DURATION,
              requestId,
              videoId: String(videoId),
              videoUrl: uploadedUrl,
              status: 'completed',
            });
          } catch (uploadErr: unknown) {
            console.error('[generate-video][r2]', requestId, uploadErr);
          }
        }

        // R2 실패 폴백: fal.ai temp URL
        return respondVideo(res, {
          durationSec: DURATION,
          requestId,
          videoId: String(videoId),
          videoUrl,
          status: 'completed',
        });
      } catch (pollErr: unknown) {
        console.error('[generate-video][poll]', requestId, pollErr);
        return respondVideo(res, {
          durationSec: DURATION,
          requestId,
          videoId: String(videoId),
          status: 'failed',
          errorCode: 'VIDEO_POLL_ERROR',
          errorMessage: pollErr instanceof Error ? pollErr.message : 'Poll failed',
        });
      }
    }

    // ── 신규 생성 ──
    const usage = await checkAndIncrement(uid, 'videoGenerations');
    if (!usage.allowed) {
      return res.status(429).json(limitExceededResponse('videoGenerations', usage));
    }

    const promptText = String(prompt || '').trim();
    if (!promptText) {
      return respondVideo(res, {
        durationSec: DURATION,
        requestId,
        status: 'failed',
        errorCode: 'EMPTY_PROMPT',
        errorMessage: 'prompt is required',
      });
    }

    const faceUrl = pickFaceImageUrl(profile);
    const p = (profile || {}) as Record<string, unknown>;
    const personDesc = p.name
      ? `${p.name}, ${p.age ? `${p.age}yo` : ''} ${typeof p.gender === 'string' ? p.gender.toLowerCase() : ''} in ${p.location || 'a beautiful setting'}`
      : 'A determined person';

    const videoPrompt = `Cinematic scene of ${personDesc} living the reality of: "${promptText}". Aspirational, warm atmosphere. Smooth natural movement. Soft cinematic lighting.`;

    let submitted: unknown;
    let prefixedId: string;

    if (faceUrl) {
      // 얼굴 사진 있음 → MiniMax Subject Reference (얼굴 보존)
      submitted = await fal.queue.submit(MODEL_SUBJECT_REF, {
        input: {
          prompt: videoPrompt,
          subject_reference_image_url: faceUrl,
          prompt_optimizer: true,
        },
      });
      const reqId = (submitted as any)?.request_id;
      if (!reqId) {
        return respondVideo(res, {
          durationSec: DURATION,
          requestId,
          status: 'failed',
          errorCode: 'VIDEO_ID_MISSING',
          errorMessage: 'No request ID returned',
        });
      }
      prefixedId = `subref:${reqId}`;
    } else {
      // 얼굴 사진 없음 → MiniMax Text-to-Video (일반 영상)
      submitted = await fal.queue.submit(MODEL_TEXT_TO_VIDEO, {
        input: {
          prompt: videoPrompt,
          prompt_optimizer: true,
        },
      });
      const reqId = (submitted as any)?.request_id;
      if (!reqId) {
        return respondVideo(res, {
          durationSec: DURATION,
          requestId,
          status: 'failed',
          errorCode: 'VIDEO_ID_MISSING',
          errorMessage: 'No request ID returned',
        });
      }
      prefixedId = `t2v:${reqId}`;
    }

    return respondVideo(res, {
      durationSec: DURATION,
      requestId,
      videoId: prefixedId,
      status: 'queued',
    });
  } catch (error: unknown) {
    console.error('[generate-video]', requestId, error);
    return respondVideo(res, {
      durationSec: 6,
      requestId,
      status: 'failed',
      errorCode: 'VIDEO_GENERATION_EXCEPTION',
      errorMessage: 'Internal server error',
    });
  }
}
