import { UserProfile } from '../types';

export interface ChatApiResponse {
  candidates?: {
    content?: {
      parts?: {
        text?: string;
        functionCall?: {
          name: string;
          args?: Record<string, unknown>;
        };
      }[];
    };
  }[];
}

type ApiErrorPayload = {
  errorCode?: string | null;
  errorMessage?: string | null;
  requestId?: string | null;
};

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const parseJsonSafe = async <T = Record<string, unknown>>(response: Response): Promise<T> => {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
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
): Promise<ChatApiResponse> => {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history, message: newMessage, profile }),
    });
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

export const generateGoalImage = async (
  goalText: string,
  profile: UserProfile | null = null,
  childTexts: string[] = [],
  userId?: string | null,
  nodeId?: string,
): Promise<string | undefined> => {
  try {
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
): Promise<string | undefined> => {
  try {
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        profile,
        referenceImages,
        imagePurpose: 'visualization',
        imageQuality,
      }),
    });
    if (!response.ok) return undefined;
    const data = await response.json();
    return data.imageUrl || data.imageDataUrl || undefined;
  } catch (error) {
    console.error('Visualization Image Gen Error:', error);
    return undefined;
  }
};

export const generateSuccessNarrative = async (
  goalContext: string,
  profile: UserProfile | null,
): Promise<string> => {
  try {
    const response = await fetch('/api/generate-narrative', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalContext, profile }),
    });
    if (!response.ok) return '';
    const data = await response.json();
    return data.text || '';
  } catch {
    return '';
  }
};

export interface AudioGenerationResult {
  status: 'completed' | 'failed';
  audioData?: string;
  errorCode?: string;
  errorMessage?: string;
  requestId?: string;
}

export const generateSpeech = async (text: string): Promise<AudioGenerationResult> => {
  try {
    const response = await fetch('/api/generate-speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    const payload = await parseJsonSafe<Record<string, unknown>>(response);
    if (!response.ok) {
      const apiError = toApiError(
        payload,
        response.status,
        'SPEECH_API_ERROR',
        '오디오 생성에 실패했습니다.',
      );
      return {
        status: 'failed',
        errorCode: apiError.errorCode,
        errorMessage: apiError.errorMessage,
        requestId: apiError.requestId,
      };
    }

    if (toOptionalString(payload.status) !== 'completed' || !toOptionalString(payload.audioData)) {
      return {
        status: 'failed',
        errorCode: toOptionalString(payload.errorCode) || 'SPEECH_EMPTY_AUDIO',
        errorMessage:
          toOptionalString(payload.errorMessage) || '오디오 생성 결과가 비어 있습니다.',
        requestId: toOptionalString(payload.requestId),
      };
    }

    return {
      status: 'completed',
      audioData: toOptionalString(payload.audioData),
      requestId: toOptionalString(payload.requestId),
    };
  } catch {
    return {
      status: 'failed',
      errorCode: 'SPEECH_NETWORK_ERROR',
      errorMessage: '오디오 생성 요청 중 네트워크 오류가 발생했습니다.',
    };
  }
};

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
): VideoGenerationResult => {
  return {
    videoUrl: toOptionalString(payload.videoUrl),
    videoId: toOptionalString(payload.videoId),
    status: toVideoStatus(payload.status),
    durationSec: Number(payload.durationSec || fallbackDurationSec || 4),
    errorCode: toOptionalString(payload.errorCode),
    errorMessage: toOptionalString(payload.errorMessage),
    requestId: toOptionalString(payload.requestId),
  };
};

export const pollVideoStatus = async (
  videoId: string,
  userId?: string | null,
  durationSec: number = 4,
): Promise<VideoGenerationResult> => {
  try {
    const response = await fetch('/api/generate-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, userId, durationSec }),
    });

    const payload = await parseJsonSafe<Record<string, unknown>>(response);
    if (!response.ok) {
      const apiError = toApiError(
        payload,
        response.status,
        'VIDEO_POLL_ERROR',
        '영상 상태 조회에 실패했습니다.',
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
  } catch {
    return {
      videoId,
      status: 'failed',
      durationSec,
      errorCode: 'VIDEO_POLL_NETWORK_ERROR',
      errorMessage: '영상 상태 조회 중 네트워크 오류가 발생했습니다.',
    };
  }
};

export const generateVideo = async (
  prompt: string,
  profile: UserProfile | null,
  durationSec: number = 4,
): Promise<VideoGenerationResult> => {
  try {
    const userId = profile?.googleId || null;

    const createResponse = await fetch('/api/generate-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, profile, userId, durationSec }),
    });

    const createPayload = await parseJsonSafe<Record<string, unknown>>(createResponse);
    if (!createResponse.ok) {
      const apiError = toApiError(
        createPayload,
        createResponse.status,
        'VIDEO_CREATE_ERROR',
        '영상 생성 시작에 실패했습니다.',
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
        errorMessage: created.errorMessage || '영상 ID를 받지 못했습니다.',
      };
    }

    const startedAt = Date.now();
    const TIMEOUT_MS = 3 * 60 * 1000;
    let lastResult: VideoGenerationResult = created;

    while (Date.now() - startedAt < TIMEOUT_MS) {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const polled = await pollVideoStatus(created.videoId, userId, durationSec);
      lastResult = polled;
      if (polled.videoUrl) return polled;
      if (polled.status === 'failed') return polled;
    }

    return lastResult;
  } catch {
    return {
      status: 'failed',
      durationSec,
      errorCode: 'VIDEO_CLIENT_EXCEPTION',
      errorMessage: '영상 생성 요청 중 예외가 발생했습니다.',
    };
  }
};

export const uploadNodeImage = async (
  imageDataUrl: string,
  userId?: string | null,
  nodeId?: string,
): Promise<string | undefined> => {
  try {
    const response = await fetch('/api/upload-node-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrl, userId, nodeId }),
    });
    if (!response.ok) return undefined;
    const data = await response.json();
    return data.imageUrl || data.imageDataUrl || undefined;
  } catch {
    return undefined;
  }
};

export const uploadProfileGalleryImage = async (
  imageDataUrl: string,
  userId: string,
  slot: 'avatar' | 'gallery' = 'gallery',
): Promise<string | undefined> => {
  try {
    const response = await fetch('/api/upload-profile-gallery-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrl, userId, slot }),
    });
    if (!response.ok) return undefined;
    const data = await response.json();
    return data.imageUrl || undefined;
  } catch {
    return undefined;
  }
};

type VisualizationAssetType = 'image' | 'audio' | 'video';

export const uploadVisualizationAsset = async (
  assetType: VisualizationAssetType,
  userId: string,
  visualizationId: string,
  payload: { dataUrl?: string; audioData?: string },
): Promise<string | undefined> => {
  try {
    const response = await fetch('/api/upload-visualization-asset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
