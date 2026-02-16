import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminAuth, getAdminDb } from '../lib/firebaseAdmin.js';

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
  const maybeWellFormed = value as string & { toWellFormed?: () => string };
  const normalized =
    typeof maybeWellFormed.toWellFormed === 'function'
      ? maybeWellFormed.toWellFormed()
      : value;
  const trimmed = normalized
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .trim();
  return trimmed ? trimmed : undefined;
};

const sanitizePayload = (raw: unknown): SaveVisualizationPayload | null => {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const inputText = sanitizeString(source.inputText);
  if (!inputText) return null;

  const payload: SaveVisualizationPayload = { inputText };
  const text = sanitizeString(source.text);
  const imageUrl = sanitizeString(source.imageUrl);
  const audioUrl = sanitizeString(source.audioUrl);
  const videoUrl = sanitizeString(source.videoUrl);
  const videoId = sanitizeString(source.videoId);
  const videoStatusRaw = sanitizeString(source.videoStatus);

  if (text) payload.text = text;
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

const parseBearerToken = (headerValue: string | undefined): string | null => {
  if (!headerValue) return null;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = createRequestId();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({
      errorCode: 'METHOD_NOT_ALLOWED',
      errorMessage: 'Method not allowed',
      requestId,
    });
  }

  try {
    const token = parseBearerToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({
        errorCode: 'AUTH_HEADER_MISSING',
        errorMessage: 'Authorization bearer token is required',
        requestId,
      });
    }

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

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
    await db.doc(`users/${uid}/data/visualizations/${id}`).set({
      ...payload,
      timestamp: now,
      updatedAt: now,
    });

    return res.status(200).json({ id, savedAt: now, requestId });
  } catch (error: any) {
    const code = String(error?.code || '');
    const isAuthError = code.startsWith('auth/');
    const status = isAuthError ? 401 : 500;
    const errorCode = isAuthError ? 'AUTH_INVALID_TOKEN' : 'SAVE_VISUALIZATION_FAILED';
    const errorMessage = String(error?.message || 'Failed to save visualization');

    console.error('[save-visualization]', requestId, errorCode, errorMessage);
    return res.status(status).json({ errorCode, errorMessage, requestId });
  }
}
