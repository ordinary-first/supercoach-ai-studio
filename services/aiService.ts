
import { UserProfile } from "../types";

// Response type matching the shape returned by /api/chat
// This mirrors the relevant parts of GenerateContentResponse from @google/genai
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

export const generateGoalImage = async (goalText: string, profile: UserProfile | null = null): Promise<string | undefined> => {
  try {
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: goalText, profile }),
    });
    if (!response.ok) return undefined;
    const data = await response.json();
    return data.imageDataUrl || undefined;
  } catch (error) {
    console.error("Image Gen Error:", error);
    return undefined;
  }
};

export const generateVisualizationImage = async (
    prompt: string,
    referenceImages: string[],
    profile: UserProfile | null = null
): Promise<string | undefined> => {
    try {
        const response = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, profile, referenceImages }),
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
        const response = await fetch('/api/generate-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, profile }),
        });
        if (!response.ok) return undefined;
        const data = await response.json();
        return data.videoUrl || undefined;
    } catch (error) {
        return undefined;
    }
};
