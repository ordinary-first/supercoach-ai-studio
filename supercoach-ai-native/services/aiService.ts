import type { UserProfile, CoachMemoryContext } from '../shared/types';
import { getAuthHeaders } from './authFetch';
import { API_BASE } from './config';

const authHeaders = async (): Promise<Record<string, string>> => {
  try {
    return await getAuthHeaders();
  } catch {
    return { 'Content-Type': 'application/json' };
  }
};

export interface ChatApiResponse {
  candidates?: {
    content?: {
      parts?: {
        text?: string;
      }[];
    };
  }[];
}

type ApiErrorPayload = {
  errorCode?: string | undefined;
  errorMessage?: string | undefined;
  requestId?: string | undefined;
};

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const parseJsonSafe = async <T = Record<string, unknown>>(
  response: Response,
): Promise<T> => {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const isRetryableStatus = (status: number): boolean => {
  return status === 429 || status >= 500;
};

const fetchWithRetry = async (
  input: RequestInfo | URL,
  init?: RequestInit,
  maxRetries: number = 1,
): Promise<Response> => {
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(input, init);
      if (isRetryableStatus(response.status) && attempt < maxRetries) {
        attempt += 1;
        await sleep(300 * attempt);
        continue;
      }
      return response;
    } catch (error) {
      if (attempt >= maxRetries) throw error;
      attempt += 1;
      await sleep(300 * attempt);
    }
  }

  throw new Error('Fetch retry failed');
};

const toApiError = (
  payload: Record<string, unknown>,
  statusCode: number,
  defaultCode: string,
  defaultMessage: string,
): Required<ApiErrorPayload> => {
  const errorCode =
    toOptionalString(payload.errorCode) ||
    toOptionalString(payload.code) ||
    `${defaultCode}_${statusCode}`;
  const errorMessage =
    toOptionalString(payload.errorMessage) ||
    toOptionalString(payload.message) ||
    defaultMessage;
  const requestId = toOptionalString(payload.requestId) || 'n/a';
  return { errorCode, errorMessage, requestId };
};

export const sendChatMessage = async (
  history: { role: string; parts: { text?: string }[] }[],
  newMessage: string,
  profile: UserProfile | null,
  memory: CoachMemoryContext,
  goalContext: string,
  todoContext: string,
  activeTab?: string,
  userId?: string,
  goalCount?: number,
  topicDirective?: string,
  imageDataUrl?: string,
): Promise<ChatApiResponse> => {
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        history,
        message: newMessage,
        profile,
        memory,
        goalContext,
        todoContext,
        activeTab,
        userId,
        goalCount,
        topicDirective,
        ...(imageDataUrl && { imageDataUrl }),
      }),
    });
    if (response.status === 429) {
      const data = await response.json();
      throw new Error(data.message || 'Monthly usage limit exceeded');
    }
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }
    return response.json();
  } catch (error) {
    console.error('Chat API Error:', error);
    throw error;
  }
};

export interface ImageGenerationResult {
  status: 'completed' | 'failed';
  imageUrl?: string;
  imageDataUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  requestId?: string;
}

export const generateGoalImage = async (
  goalText: string,
  profile: UserProfile | null = null,
  childTexts: string[] = [],
  userId?: string | null,
  nodeId?: string,
): Promise<string | undefined> => {
  try {
    const response = await fetch(`${API_BASE}/api/generate-image`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        prompt: goalText,
        profile,
        childTexts,
        userId,
        nodeId,
        imagePurpose: 'node',
      }),
    });
    if (!response.ok) return undefined;
    const data = await response.json();
    return data.imageUrl || data.imageDataUrl || undefined;
  } catch (error) {
    console.error('Image Gen Error:', error);
    return undefined;
  }
};

export const generateVisualizationImage = async (
  prompt: string,
  referenceImages: string[],
  profile: UserProfile | null = null,
  imageQuality: 'medium' | 'high' = 'medium',
  userId?: string | null,
  visualizationId?: string,
): Promise<ImageGenerationResult> => {
  try {
    const response = await fetchWithRetry(
      `${API_BASE}/api/generate-image`,
      {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          prompt,
          profile,
          referenceImages,
          userId,
          visualizationId,
          imagePurpose: 'visualization',
          imageQuality,
        }),
      },
      0,
    );

    const payload = await parseJsonSafe<Record<string, unknown>>(response);
    if (!response.ok) {
      const apiError = toApiError(
        payload,
        response.status,
        'IMAGE_API_ERROR',
        'Image generation failed.',
      );
      return {
        status: 'failed',
        errorCode: apiError.errorCode,
        errorMessage: apiError.errorMessage,
        requestId: apiError.requestId,
      };
    }

    const imageUrl =
      toOptionalString(payload.imageUrl) ||
      toOptionalString(payload.imageDataUrl);
    const imageDataUrl = toOptionalString(payload.imageDataUrl);
    const imageStatus = toOptionalString(payload.status);
    if (!imageUrl || (imageStatus && imageStatus !== 'completed')) {
      return {
        status: 'failed',
        errorCode: toOptionalString(payload.errorCode) || 'IMAGE_EMPTY_RESULT',
        errorMessage:
          toOptionalString(payload.errorMessage) ||
          'Image generation result is empty.',
        requestId: toOptionalString(payload.requestId),
      };
    }

    return {
      status: 'completed',
      imageUrl,
      imageDataUrl,
      requestId: toOptionalString(payload.requestId),
    };
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      status: 'failed',
      errorCode: 'IMAGE_NETWORK_ERROR',
      errorMessage: `Image generation failed: ${detail}`,
    };
  }
};

export const generateSuccessNarrative = async (
  goalContext: string,
  profile: UserProfile | null,
  userId?: string,
): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE}/api/generate-narrative`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ goalContext, profile, userId }),
    });
    if (response.status === 429) {
      const data = await response.json();
      throw new Error(data.message || 'Monthly usage limit exceeded');
    }
    if (!response.ok) return '';
    const data = await response.json();
    return data.text || '';
  } catch (err) {
    if (err instanceof Error && err.message.includes('usage limit')) throw err;
    return '';
  }
};

export interface AudioGenerationResult {
  status: 'completed' | 'failed';
  audioUrl?: string;
  audioData?: string;
  errorCode?: string;
  errorMessage?: string;
  requestId?: string;
}

export const generateSpeech = async (
  text: string,
  userId?: string | null,
  visualizationId?: string,
): Promise<AudioGenerationResult> => {
  try {
    const response = await fetchWithRetry(
      `${API_BASE}/api/generate-speech`,
      {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ text, userId, visualizationId }),
      },
      0,
    );

    const payload = await parseJsonSafe<Record<string, unknown>>(response);
    if (!response.ok) {
      const apiError = toApiError(
        payload,
        response.status,
        'SPEECH_API_ERROR',
        'Audio generation failed.',
      );
      return {
        status: 'failed',
        errorCode: apiError.errorCode,
        errorMessage: apiError.errorMessage,
        requestId: apiError.requestId,
      };
    }

    const audioUrl = toOptionalString(payload.audioUrl);
    const audioData = toOptionalString(payload.audioData);
    if (
      toOptionalString(payload.status) !== 'completed' ||
      (!audioUrl && !audioData)
    ) {
      return {
        status: 'failed',
        errorCode:
          toOptionalString(payload.errorCode) || 'SPEECH_EMPTY_AUDIO',
        errorMessage:
          toOptionalString(payload.errorMessage) ||
          'Audio generation result is empty.',
        requestId: toOptionalString(payload.requestId),
      };
    }

    return {
      status: 'completed',
      audioUrl,
      audioData,
      requestId: toOptionalString(payload.requestId),
    };
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      status: 'failed',
      errorCode: 'SPEECH_NETWORK_ERROR',
      errorMessage: `Audio generation failed: ${detail}`,
    };
  }
};

export interface DreamChatResponse {
  reply: string;
  prompt: string | null;
}

export const sendDreamChatMessage = async (
  history: { role: string; content: string }[],
  message: string,
  goals: string[] = [],
): Promise<DreamChatResponse> => {
  const response = await fetch(`${API_BASE}/api/dream-chat`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ history, message, goals }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Dream chat request failed');
  }
  return response.json();
};

export const generateFeedback = async (
  period: 'daily' | 'weekly' | 'monthly',
  profile: UserProfile | null,
  goalContext: string,
  todoContext: string,
  statsContext: string,
  userId?: string | null,
): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE}/api/generate-feedback`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        period,
        profile,
        goalContext,
        todoContext,
        statsContext,
        userId: userId || undefined,
      }),
    });
    if (response.status === 429) {
      const data = await response.json();
      throw new Error(data.message || 'Usage limit exceeded');
    }
    if (!response.ok) return '';
    const data = await response.json();
    return data.text || '';
  } catch (err) {
    if (err instanceof Error && err.message.includes('usage limit')) throw err;
    return '';
  }
};

export const decomposeGoal = async (
  parentText: string,
  childTexts: string[],
  userId?: string | null,
): Promise<string[]> => {
  try {
    const headers = await authHeaders();
    const response = await fetchWithRetry(`${API_BASE}/api/decompose-goal`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ parentText, childTexts, userId }),
    });

    if (!response.ok) return [];
    const data = await parseJsonSafe<{ suggestions?: string[] }>(response);
    return Array.isArray(data.suggestions) ? data.suggestions : [];
  } catch {
    return [];
  }
};

// ---------- Video Generation ----------

export type VideoGenerationStatus =
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'unknown';

export interface VideoGenerationResult {
  videoUrl?: string;
  videoId?: string;
  status: VideoGenerationStatus;
  durationSec: number;
  errorCode?: string;
  errorMessage?: string;
  requestId?: string;
}

const toVideoStatus = (value: unknown): VideoGenerationStatus => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'queued') return 'queued';
  if (normalized === 'in_progress') return 'in_progress';
  if (normalized === 'completed') return 'completed';
  if (normalized === 'failed') return 'failed';
  return 'unknown';
};

const toVideoResult = (
  payload: Record<string, unknown>,
  fallbackDurationSec: number,
): VideoGenerationResult => ({
  videoUrl: toOptionalString(payload.videoUrl),
  videoId: toOptionalString(payload.videoId),
  status: toVideoStatus(payload.status),
  durationSec: Number(payload.durationSec || fallbackDurationSec || 4),
  errorCode: toOptionalString(payload.errorCode),
  errorMessage: toOptionalString(payload.errorMessage),
  requestId: toOptionalString(payload.requestId),
});

const isTransientVideoError = (errorCode?: string): boolean => {
  if (!errorCode) return false;
  if (errorCode.includes('NETWORK')) return true;
  return /(?:^|_)(429|5\d\d)$/.test(errorCode);
};

export const pollVideoStatus = async (
  videoId: string,
  userId?: string | null,
  durationSec: number = 4,
): Promise<VideoGenerationResult> => {
  try {
    const response = await fetchWithRetry(
      `${API_BASE}/api/generate-video`,
      {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ videoId, userId, durationSec }),
      },
      1,
    );

    const payload = await parseJsonSafe<Record<string, unknown>>(response);
    if (!response.ok) {
      const apiError = toApiError(
        payload,
        response.status,
        'VIDEO_POLL_ERROR',
        'Video status check failed.',
      );
      return {
        videoId,
        status: 'failed',
        durationSec,
        errorCode: apiError.errorCode,
        errorMessage: apiError.errorMessage,
        requestId: apiError.requestId,
      };
    }

    const result = toVideoResult(payload, durationSec);
    if (!result.videoId) result.videoId = videoId;
    return result;
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      videoId,
      status: 'failed',
      durationSec,
      errorCode: 'VIDEO_POLL_NETWORK_ERROR',
      errorMessage: `Video status check failed: ${detail}`,
    };
  }
};

const TIMEOUT_MS = 90_000;

export const generateVideo = async (
  prompt: string,
  profile: UserProfile | null,
  durationSec: number = 4,
): Promise<VideoGenerationResult> => {
  try {
    const userId = profile?.googleId || null;

    const createResponse = await fetchWithRetry(
      `${API_BASE}/api/generate-video`,
      {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ prompt, profile, userId, durationSec }),
      },
      0,
    );

    const createPayload =
      await parseJsonSafe<Record<string, unknown>>(createResponse);
    if (!createResponse.ok) {
      const apiError = toApiError(
        createPayload,
        createResponse.status,
        'VIDEO_CREATE_ERROR',
        'Video generation failed.',
      );
      return {
        status: 'failed',
        durationSec,
        errorCode: apiError.errorCode,
        errorMessage: apiError.errorMessage,
        requestId: apiError.requestId,
      };
    }

    const created = toVideoResult(createPayload, durationSec);
    if (created.videoUrl) return created;
    if (created.status === 'failed') return created;
    if (!created.videoId) {
      return {
        ...created,
        status: 'failed',
        errorCode: created.errorCode || 'VIDEO_ID_MISSING',
        errorMessage: created.errorMessage || 'No video ID received.',
      };
    }

    const startedAt = Date.now();
    let lastResult: VideoGenerationResult = created;

    while (Date.now() - startedAt < TIMEOUT_MS) {
      await sleep(5000);

      const polled = await pollVideoStatus(created.videoId, userId, durationSec);
      lastResult = polled;
      if (polled.videoUrl) return polled;
      if (
        polled.status === 'failed' &&
        !isTransientVideoError(polled.errorCode)
      )
        return polled;
    }

    if (
      lastResult.videoId &&
      (lastResult.status === 'queued' ||
        lastResult.status === 'in_progress' ||
        lastResult.status === 'unknown' ||
        isTransientVideoError(lastResult.errorCode))
    ) {
      return {
        ...lastResult,
        status: lastResult.status === 'queued' ? 'queued' : 'in_progress',
      };
    }

    return lastResult;
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      status: 'failed',
      durationSec,
      errorCode: 'VIDEO_CLIENT_EXCEPTION',
      errorMessage: `Video generation error: ${detail}`,
    };
  }
};

// ---------- Visualization Asset Upload ----------

type VisualizationAssetType = 'image' | 'audio' | 'video';

export const uploadVisualizationAsset = async (
  assetType: VisualizationAssetType,
  userId: string,
  visualizationId: string,
  payload: { dataUrl?: string; audioData?: string },
): Promise<string | undefined> => {
  try {
    const response = await fetch(`${API_BASE}/api/upload-visualization-asset`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        assetType,
        userId,
        visualizationId,
        dataUrl: payload.dataUrl,
        audioData: payload.audioData,
      }),
    });
    if (!response.ok) return undefined;
    const data = await response.json();
    return data.assetUrl || undefined;
  } catch {
    return undefined;
  }
};
