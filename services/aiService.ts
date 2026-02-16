
import { UserProfile } from "../types";

// Response type matching the shape returned by /api/chat
// This mirrors the response shape the client expects (historically Gemini-like).
export interface ChatApiResponse {
  candidates?: {
    content?: {
      parts?: {
        text?: string;
        functionCall?: {
          name: string;
          args?: Record<string, any>;
        };
      }[];
    };
  }[];
}

export const sendChatMessage = async (
  history: { role: string; parts: { text?: string }[] }[],
  newMessage: string,
  profile: UserProfile | null
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
    console.error("Chat API Error:", error);
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
    console.error("Image Gen Error:", error);
    return undefined;
  }
};

export const generateVisualizationImage = async (
    prompt: string,
    referenceImages: string[],
    profile: UserProfile | null = null,
    imageQuality: 'medium' | 'high' = 'medium'
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
        console.error("Visualization Image Gen Error:", error);
        return undefined;
    }
};

export const generateSuccessNarrative = async (goalContext: string, profile: UserProfile | null): Promise<string> => {
    try {
        const response = await fetch('/api/generate-narrative', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goalContext, profile }),
        });
        if (!response.ok) return "";
        const data = await response.json();
        return data.text || "";
    } catch (e) { return ""; }
};

export const generateSpeech = async (text: string): Promise<string | undefined> => {
    try {
        const response = await fetch('/api/generate-speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });
        if (!response.ok) return undefined;
        const data = await response.json();
        return data.audioData || undefined;
    } catch (e) { return undefined; }
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
}

const toVideoResult = (payload: any, fallbackDurationSec: number): VideoGenerationResult => {
  const rawStatus = String(payload?.status || 'unknown').toLowerCase();
  const status: VideoGenerationStatus = (
    rawStatus === 'queued'
    || rawStatus === 'in_progress'
    || rawStatus === 'completed'
    || rawStatus === 'failed'
    || rawStatus === 'unknown'
  ) ? rawStatus : 'unknown';

  return {
    videoUrl: payload?.videoUrl || undefined,
    videoId: payload?.videoId || undefined,
    status,
    durationSec: Number(payload?.durationSec || fallbackDurationSec || 4),
  };
};

export const pollVideoStatus = async (
  videoId: string,
  userId?: string | null,
  durationSec: number = 4,
): Promise<VideoGenerationResult> => {
  try {
    const pollResponse = await fetch('/api/generate-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, userId, durationSec }),
    });
    if (!pollResponse.ok) {
      return { videoId, status: 'unknown', durationSec };
    }
    const payload = await pollResponse.json();
    const result = toVideoResult(payload, durationSec);
    if (!result.videoId) result.videoId = videoId;
    return result;
  } catch {
    return { videoId, status: 'unknown', durationSec };
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
        if (!createResponse.ok) {
          return { status: 'unknown', durationSec };
        }

        const created = toVideoResult(await createResponse.json(), durationSec);
        if (created.videoUrl) return created;
        const videoId = created.videoId;
        if (!videoId) return created;

        const startedAt = Date.now();
        const TIMEOUT_MS = 3 * 60 * 1000;
        let lastResult: VideoGenerationResult = created;

        while (Date.now() - startedAt < TIMEOUT_MS) {
            await new Promise((r) => setTimeout(r, 5000));

            const polled = await pollVideoStatus(videoId, userId, durationSec);
            lastResult = polled;
            if (polled.videoUrl) return polled;
            if (polled.status === 'failed') return polled;
        }

        return lastResult;
    } catch {
        return { status: 'unknown', durationSec };
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
