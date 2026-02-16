
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
        return data.imageDataUrl || undefined;
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

export const generateVideo = async (prompt: string, profile: UserProfile | null): Promise<string | undefined> => {
    try {
        const userId = profile?.googleId || null;

        const createResponse = await fetch('/api/generate-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, profile, userId }),
        });
        if (!createResponse.ok) return undefined;

        const created = await createResponse.json();
        if (created?.videoUrl) return created.videoUrl;
        const videoId = created?.videoId;
        if (!videoId) return undefined;

        const startedAt = Date.now();
        const TIMEOUT_MS = 3 * 60 * 1000;

        while (Date.now() - startedAt < TIMEOUT_MS) {
            await new Promise((r) => setTimeout(r, 5000));

            const pollResponse = await fetch('/api/generate-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoId, userId }),
            });
            if (!pollResponse.ok) return undefined;

            const polled = await pollResponse.json();
            if (polled?.videoUrl) return polled.videoUrl;
            if (polled?.status === 'failed') return undefined;
        }

        return undefined;
    } catch (error) {
        return undefined;
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
