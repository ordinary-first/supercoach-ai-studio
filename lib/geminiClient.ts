import { GoogleGenAI } from '@google/genai';

let cachedClient: GoogleGenAI | null = null;

export const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY not configured');
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey });
  }
  return cachedClient;
}

/**
 * Simple text generation with system instruction + user content.
 * Used by memory summarization and simple API endpoints.
 */
export async function geminiGenerate(
  systemPrompt: string,
  userContent: string,
): Promise<string> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    config: { systemInstruction: systemPrompt },
    contents: userContent,
  });
  return response.text?.trim() || '';
}

/**
 * Multi-turn chat generation with system instruction + history + user message.
 * Used by coaching chat and dream chat.
 */
export async function geminiChat(
  systemPrompt: string,
  history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>,
  userContent: string | Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>,
): Promise<string> {
  const ai = getGeminiClient();

  const contents: any[] = [];

  // Add history
  for (const msg of history) {
    contents.push({
      role: msg.role,
      parts: msg.parts,
    });
  }

  // Add current user message
  if (typeof userContent === 'string') {
    contents.push({ role: 'user', parts: [{ text: userContent }] });
  } else {
    contents.push({ role: 'user', parts: userContent });
  }

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    config: { systemInstruction: systemPrompt },
    contents,
  });
  return response.text?.trim() || '';
}
