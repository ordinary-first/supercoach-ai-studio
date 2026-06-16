import { UserProfile, CoachMemoryContext, CoachSignals } from '../types';
import { recoverGenerationResult } from './firebaseService';
import { getAuthHeaders } from './authFetch';

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
  signals?: CoachSignals,
  imageDataUrl?: string,
): Promise<ChatApiResponse> => {
  try {
    const response = await fetch('/api/chat', {
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
        ...(signals && { signals }),
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
    const response = await fetchWithRetry('/api/generate-image', {
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
    }, 0);

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

    const imageUrl = toOptionalString(payload.imageUrl) || toOptionalString(payload.imageDataUrl);
    const imageDataUrl = toOptionalString(payload.imageDataUrl);
    const imageStatus = toOptionalString(payload.status);
    if (!imageUrl || (imageStatus && imageStatus !== 'completed')) {
      return {
        status: 'failed',
        errorCode: toOptionalString(payload.errorCode) || 'IMAGE_EMPTY_RESULT',
        errorMessage:
          toOptionalString(payload.errorMessage) || 'Image generation result is empty.',
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
    if (userId && visualizationId) {
      await sleep(5000);
      const recovered = await recoverGenerationResult(String(userId), visualizationId, 'image');
      if (recovered) {
        return {
          status: 'completed',
          imageUrl: typeof recovered.imageUrl === 'string' ? recovered.imageUrl : undefined,
          imageDataUrl: typeof recovered.imageDataUrl === 'string' ? recovered.imageDataUrl : undefined,
          requestId: typeof recovered.requestId === 'string' ? recovered.requestId : undefined,
        };
      }
    }
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
    const response = await fetch('/api/generate-narrative', {
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

export interface ImageGenerationResult {
  status: 'completed' | 'failed';
  imageUrl?: string;
  imageDataUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  requestId?: string;
}

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
    const response = await fetchWithRetry('/api/generate-speech', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ text, userId, visualizationId }),
    }, 0);

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
    if (toOptionalString(payload.status) !== 'completed' || (!audioUrl && !audioData)) {
      return {
        status: 'failed',
        errorCode: toOptionalString(payload.errorCode) || 'SPEECH_EMPTY_AUDIO',
        errorMessage: toOptionalString(payload.errorMessage) || 'Audio generation result is empty.',
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
    if (userId && visualizationId) {
      await sleep(5000);
      const recovered = await recoverGenerationResult(String(userId), visualizationId, 'audio');
      if (recovered) {
        return {
          status: 'completed',
          audioUrl: typeof recovered.audioUrl === 'string' ? recovered.audioUrl : undefined,
          requestId: typeof recovered.requestId === 'string' ? recovered.requestId : undefined,
        };
      }
    }
    const detail = error instanceof Error ? error.message : String(error);
    return {
      status: 'failed',
      errorCode: 'SPEECH_NETWORK_ERROR',
      errorMessage: `Audio generation failed: ${detail}`,
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
    const response = await fetchWithRetry('/api/generate-video', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ videoId, userId, durationSec }),
    }, 1);

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

export const generateVideo = async (
  prompt: string,
  profile: UserProfile | null,
  durationSec: number = 4,
): Promise<VideoGenerationResult> => {
  try {
    const userId = profile?.googleId || null;

    const createResponse = await fetchWithRetry('/api/generate-video', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ prompt, profile, userId, durationSec }),
    }, 0);

    const createPayload = await parseJsonSafe<Record<string, unknown>>(createResponse);
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
    // Kling v3 Pro 생성은 보통 ~50초~3분. 45초는 거의 항상 타임아웃→pending이라
    // 인세션에서 영상이 안 보였다. 90초로 늘려 흔한 케이스를 잡고, 더 긴 건
    // 저장 후 refreshPendingVideo가 마저 가져온다.
    const TIMEOUT_MS = 90 * 1000;
    let lastResult: VideoGenerationResult = created;

    while (Date.now() - startedAt < TIMEOUT_MS) {
      await sleep(5000);

      const polled = await pollVideoStatus(created.videoId, userId, durationSec);
      lastResult = polled;
      if (polled.videoUrl) return polled;
      if (polled.status === 'failed' && !isTransientVideoError(polled.errorCode)) return polled;
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

export const generateFeedback = async (
  period: 'daily' | 'weekly' | 'monthly',
  profile: UserProfile | null,
  goalContext: string,
  todoContext: string,
  statsContext: string,
  userId?: string | null,
): Promise<string> => {
  try {
    const response = await fetch('/api/generate-feedback', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ period, profile, goalContext, todoContext, statsContext, userId: userId || undefined }),
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

export const uploadNodeImage = async (
  imageDataUrl: string,
  userId?: string | null,
  nodeId?: string,
): Promise<string | undefined> => {
  try {
    const response = await fetch('/api/upload-node-image', {
      method: 'POST',
      headers: await authHeaders(),
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
      headers: await authHeaders(),
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

/* ── 시각화: 장면 / 추천 칩 / 수정 버튼 / 분기 / 매체 변환 ── */

export interface DreamChip {
  label: string;
  seed: string;
  quotedToken: string | null;
  kind: 'scene' | 'door' | 'write';
  lever?: string;
}

export interface RefineButton {
  label: string;
  anchor?: string;
  kind?: string;
  transform: string;
}

export interface RefineResult {
  mode: 'refine' | 'explore' | 'reframe';
  isFinalReady: boolean;
  buttons: RefineButton[];
}

export interface ScenePrompts {
  imagePrompt: string;
  videoPrompt: string;
  audioText: string;
}

// write 칩의 seed 센티넬 — 전송 대신 입력창에 포커스만 준다.
export const USER_INPUT_SENTINEL = '__USER_INPUT__';

// 겉모습(시각 스타일) 누출 차단용 금지어 — 칩 라벨/씨앗에서 걸러낸다.
const VISUAL_STYLE_WORDS =
  /(노을|햇살|햇빛|일출|일몰|새벽빛|황금빛|조명|색감|색조|채도|구도|앵글|화각|클로즈업|카메라|필터|화풍|🌅|🌊|🌙|🌄|🌇)/;

/** 1차 장면 생성 (또는 현재 장면을 사용자 요청대로 수정). */
export const fetchDreamScene = async (
  message: string,
  goals: string[] = [],
  currentScene?: string,
): Promise<string> => {
  const response = await fetch('/api/dream-chat', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ message, goals, currentScene }),
  });
  if (response.status === 429) {
    const data = await parseJsonSafe<{ message?: string }>(response);
    throw new Error(data.message || 'Monthly usage limit exceeded');
  }
  if (!response.ok) throw new Error('Scene generation failed');
  const data = await parseJsonSafe<{ scene?: string }>(response);
  return (data.scene || '').trim();
};

/** 추천 칩. quotedToken substring·길이·시각스타일을 클라이언트에서 기계 검증한다. */
export const fetchDreamChips = async (payload: {
  language: string;
  rotationSeed: number;
  goals: string[];
  savedTitles: string[];
  userName: string | null;
}): Promise<DreamChip[]> => {
  try {
    const response = await fetch('/api/dream-chips', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) return [];
    const data = await parseJsonSafe<{ chips?: DreamChip[] }>(response);
    const chips = Array.isArray(data.chips) ? data.chips : [];
    const haystack = [...payload.goals, ...payload.savedTitles].join('  ');
    return chips.filter((chip) => {
      if (!chip.label || !chip.seed) return false;
      if (chip.label.length > 22) return false;
      if (VISUAL_STYLE_WORDS.test(chip.label) || VISUAL_STYLE_WORDS.test(chip.seed)) return false;
      if (chip.kind === 'write' || chip.kind === 'door') return true;
      // scene 칩은 quotedToken이 실제 입력에 존재해야 한다 (환각·제너릭 차단).
      return !!chip.quotedToken && haystack.includes(chip.quotedToken);
    });
  } catch {
    return [];
  }
};

/** 장면 아래 수정 버튼. */
export const fetchRefineButtons = async (payload: {
  scene: string;
  rawInput: string;
  round: number;
  usedAnchors: string[];
  userPicks: string[];
}): Promise<RefineResult> => {
  const empty: RefineResult = { mode: 'refine', isFinalReady: false, buttons: [] };
  try {
    const response = await fetch('/api/refine-buttons', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) return empty;
    const data = await parseJsonSafe<RefineResult>(response);
    return {
      mode: data.mode === 'explore' || data.mode === 'reframe' ? data.mode : 'refine',
      isFinalReady: data.isFinalReady === true,
      buttons: Array.isArray(data.buttons)
        ? data.buttons.filter((b) => b && b.label && b.transform)
        : [],
    };
  } catch {
    return empty;
  }
};

/** 수정 버튼 탭 → 변형 장면 생성 (갈림길의 한쪽). */
export const fetchSceneVariant = async (scene: string, transform: string): Promise<string> => {
  try {
    const response = await fetch('/api/scene-variant', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ scene, transform }),
    });
    if (!response.ok) return scene;
    const data = await parseJsonSafe<{ scene?: string }>(response);
    return (data.scene || scene).trim();
  } catch {
    return scene;
  }
};

/** 확정 장면 → 매체별(이미지/영상/음성) 프롬프트 변환. */
export const fetchScenePrompts = async (
  scene: string,
  settings: { image: boolean; audio: boolean; video: boolean },
): Promise<ScenePrompts> => {
  const empty: ScenePrompts = { imagePrompt: '', videoPrompt: '', audioText: '' };
  try {
    const response = await fetch('/api/scene-to-prompts', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ scene, settings }),
    });
    if (!response.ok) return empty;
    const data = await parseJsonSafe<ScenePrompts>(response);
    return {
      imagePrompt: String(data.imagePrompt || ''),
      videoPrompt: String(data.videoPrompt || ''),
      audioText: String(data.audioText || ''),
    };
  } catch {
    return empty;
  }
};

/* ── 목표 분해 ── */

export const decomposeGoal = async (
  parentText: string,
  childTexts: string[],
  userId?: string | null,
): Promise<string[]> => {
  try {
    const headers = await authHeaders();
    const response = await fetchWithRetry('/api/decompose-goal', {
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
