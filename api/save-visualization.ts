import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../lib/firebaseAdmin.js';
import { authenticateRequest } from '../lib/authMiddleware.js';
import { setCorsHeaders } from '../lib/corsHeaders.js';

type VideoStatus = 'pending' | 'ready' | 'failed';

type SaveVisualizationPayload = {
  inputText: string;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  videoStatus?: VideoStatus;
  videoId?: string;
};

const VIDEO_STATUS_SET = new Set<VideoStatus>(['pending', 'ready', 'failed']);

const createRequestId = (): string => {
  return `vizsave_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const sanitizeString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  let normalized = value;
  try {
    normalized = Buffer.from(value, 'utf8').toString('utf8');
  } catch {
    normalized = value;
  }
  const trimmed = normalized
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[\uD800-\uDFFF]/g, '')
    .replace(/[\uFFFE\uFFFF]/g, '')
    .trim();
  return trimmed ? trimmed : undefined;
};

const sanitizeStorageUrl = (value: unknown): string | undefined => {
  const clean = sanitizeString(value);
  if (!clean) return undefined;
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) return undefined;
  return clean.slice(0, 4000);
};

const sanitizeVideoId = (value: unknown): string | undefined => {
  const clean = sanitizeString(value);
  if (!clean) return undefined;
  return clean.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
};

const sanitizePayload = (raw: unknown): SaveVisualizationPayload | null => {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const inputText = sanitizeString(source.inputText);
  if (!inputText) return null;

  const payload: SaveVisualizationPayload = { inputText };
  const text = sanitizeString(source.text);
  const imageUrl = sanitizeStorageUrl(source.imageUrl);
  const audioUrl = sanitizeStorageUrl(source.audioUrl);
  const videoUrl = sanitizeStorageUrl(source.videoUrl);
  const videoId = sanitizeVideoId(source.videoId);
  const videoStatusRaw = sanitizeString(source.videoStatus);

  if (text) payload.text = text.slice(0, 50000);
  if (imageUrl) payload.imageUrl = imageUrl;
  if (audioUrl) payload.audioUrl = audioUrl;
  if (videoUrl) payload.videoUrl = videoUrl;
  if (videoId) payload.videoId = videoId;
  if (videoStatusRaw && VIDEO_STATUS_SET.has(videoStatusRaw as VideoStatus)) {
    payload.videoStatus = videoStatusRaw as VideoStatus;
  }

  return payload;
};

const sanitizeVisualizationId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return cleaned || null;
};

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
  if (authError) return res.status(authError.status).json({ ...authError.body, requestId });
  const uid = user!.uid;

  try {

    const payload = sanitizePayload(req.body?.payload);
    if (!payload) {
      return res.status(400).json({
        errorCode: 'INVALID_PAYLOAD',
        errorMessage: 'payload.inputText is required',
        requestId,
      });
    }

    const now = Date.now();
    const id =
      sanitizeVisualizationId(req.body?.visualizationId) ||
      `${now}_${Math.random().toString(36).slice(2, 8)}`;

    const db = getAdminDb();
    const targetRef = db.doc(`users/${uid}/visualizations/${id}`);
    try {
      await targetRef.set({
        ...payload,
        timestamp: now,
        updatedAt: now,
      });
    } catch (writeError: any) {
      if (String(writeError?.code || '') !== 'invalid-argument') throw writeError;
      await targetRef.set({
        inputText: (payload.inputText || 'Visualization').slice(0, 1000),
        timestamp: now,
        updatedAt: now,
      });
    }

    return res.status(200).json({ id, savedAt: now, requestId });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[save-visualization]', requestId, 'SAVE_VISUALIZATION_FAILED', errorMessage);
    return res.status(500).json({
      errorCode: 'SAVE_VISUALIZATION_FAILED',
      errorMessage: 'Failed to save visualization',
      requestId,
    });
  }
}
