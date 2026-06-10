import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

let cachedClient: GoogleGenAI | null = null;
let cachedOpenAiClient: OpenAI | null = null;

export const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';
const OPENAI_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-mini';

export function hasGenerativeApiKey(): boolean {
  return Boolean(
    (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY)
      ?.trim(),
  );
}

export function getGeminiClient(): GoogleGenAI {
  const apiKey = (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY)?.trim();
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY (or GEMINI_API_KEY) not configured');
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey });
  }
  return cachedClient;
}

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  if (!cachedOpenAiClient) {
    cachedOpenAiClient = new OpenAI({ apiKey });
  }
  return cachedOpenAiClient;
}

function canUseGemini(): boolean {
  return Boolean((process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY)?.trim());
}

function canUseOpenAI(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

async function openAiGenerate(
  systemPrompt: string,
  userContent: string,
): Promise<string> {
  const client = getOpenAIClient();
  const response = await client.responses.create({
    model: OPENAI_TEXT_MODEL,
    instructions: systemPrompt,
    input: userContent,
    max_output_tokens: 1200,
  });
  return response.output_text?.trim() || '';
}

const flattenHistory = (
  history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>,
): string => {
  return history
    .map((message) => {
      const role = message.role === 'model' ? 'Coach' : 'User';
      const text = message.parts.map((part) => part.text).filter(Boolean).join('\n');
      return text ? `${role}: ${text}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
};

async function openAiChat(
  systemPrompt: string,
  history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>,
  userContent: string | Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>,
): Promise<string> {
  const client = getOpenAIClient();
  const historyText = flattenHistory(history);

  if (typeof userContent === 'string') {
    const input = historyText
      ? `Previous conversation:\n${historyText}\n\nCurrent user message:\n${userContent}`
      : userContent;
    return openAiGenerate(systemPrompt, input);
  }

  const content: Array<
    | { type: 'input_text'; text: string }
    | { type: 'input_image'; image_url: string; detail: 'auto' }
  > = [];

  if (historyText) {
    content.push({ type: 'input_text', text: `Previous conversation:\n${historyText}` });
  }

  for (const part of userContent) {
    if (part.text) {
      content.push({ type: 'input_text', text: part.text });
    }
    if (part.inlineData) {
      content.push({
        type: 'input_image',
        image_url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
        detail: 'auto',
      });
    }
  }

  const response = await client.responses.create({
    model: OPENAI_TEXT_MODEL,
    instructions: systemPrompt,
    input: [{ role: 'user', content }],
    max_output_tokens: 1200,
  });
  return response.output_text?.trim() || '';
}

/**
 * Simple text generation with system instruction + user content.
 * Used by memory summarization and simple API endpoints.
 */
export async function geminiGenerate(
  systemPrompt: string,
  userContent: string,
): Promise<string> {
  if (!canUseGemini()) {
    return openAiGenerate(systemPrompt, userContent);
  }

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      config: { systemInstruction: systemPrompt },
      contents: userContent,
    });
    return response.text?.trim() || '';
  } catch (error) {
    if (!canUseOpenAI()) throw error;
    console.error('[ai] Gemini failed, falling back to OpenAI:', error);
    return openAiGenerate(systemPrompt, userContent);
  }
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
  if (!canUseGemini()) {
    return openAiChat(systemPrompt, history, userContent);
  }

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

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      config: { systemInstruction: systemPrompt },
      contents,
    });
    return response.text?.trim() || '';
  } catch (error) {
    if (!canUseOpenAI()) throw error;
    console.error('[ai] Gemini failed, falling back to OpenAI:', error);
    return openAiChat(systemPrompt, history, userContent);
  }
}
