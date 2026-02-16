import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOpenAIClient } from '../lib/openaiClient.js';

const COACH_SYSTEM_INSTRUCTION = `
당신은 사용자의 목표/습관/일정/할 일을 돕는 AI 슈퍼코치입니다.
말투는 자연스러운 한국어. 불필요한 장문 분석은 피합니다.

원칙:
- 먼저 1~2문장 공감 + 상황 확인 질문 1개.
- 조언은 구체적이고 실행 가능한 형태로.
- 사용자의 선택을 존중하되, 회피/핑계를 부드럽게 끊고 행동을 이끕니다.
- 필요할 때만 짧게 구조화(체크리스트, 3단계 등)합니다.

마인드맵 도구 사용:
- 사용자가 루트 목표(핵심 비전)를 바꾸려 하면 setRootGoal을 호출합니다.
- 사용자가 하위 목표를 추가/구체화하려 하면 createSubGoal을 호출합니다.
  - parentId가 불명확하면 기본값은 "root"로 가정하거나, 먼저 질문으로 확인합니다.
`.trim();

const tools = [
  {
    type: 'function',
    name: 'setRootGoal',
    description: '마인드맵의 루트 목표 텍스트를 설정한다.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        goalText: { type: 'string' },
      },
      required: ['goalText'],
    },
  },
  {
    type: 'function',
    name: 'createSubGoal',
    description: '마인드맵에 하위 목표 노드를 생성한다.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        parentId: { type: 'string' },
        goalText: { type: 'string' },
      },
      required: ['parentId', 'goalText'],
    },
  },
] as const;

type InputRole = 'user' | 'assistant' | 'system' | 'developer';
type EasyInputMessage = { role: InputRole; content: string };

function mapHistoryToInput(history: unknown): EasyInputMessage[] {
  if (!Array.isArray(history)) return [];
  const items: EasyInputMessage[] = [];

  for (const h of history as any[]) {
    const role: InputRole = h?.role === 'model' ? 'assistant' : 'user';
    const text = h?.parts?.[0]?.text;
    if (!text) continue;
    items.push({ role, content: String(text) });
  }

  return items;
}

function toClientCandidates(response: any) {
  const parts: { text?: string; functionCall?: { name: string; args?: any } }[] = [];

  const outputText = typeof response?.output_text === 'string'
    ? response.output_text.trim()
    : '';
  if (outputText) {
    parts.push({ text: outputText });
  }

  const outputItems = Array.isArray(response?.output) ? response.output : [];
  for (const item of outputItems) {
    if (!item || typeof item !== 'object') continue;
    if (item.type !== 'function_call') continue;
    if (typeof item.name !== 'string') continue;

    let args: Record<string, any> | undefined;
    if (typeof item.arguments === 'string' && item.arguments.trim()) {
      try {
        args = JSON.parse(item.arguments);
      } catch {
        args = undefined;
      }
    }

    parts.push({
      functionCall: { name: item.name, args },
    });
  }

  return { candidates: [{ content: { parts } }] };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { history, message, profile } = req.body || {};
    const openai = getOpenAIClient();

    let contextInstruction = COACH_SYSTEM_INSTRUCTION;
    if (profile) {
      contextInstruction += `

사용자 정보:
- 이름: ${profile.name}
- 나이/지역: ${profile.age} / ${profile.location}
- 자기소개: ${profile.bio || '없음'}
- 비전 이미지/기록: ${profile.gallery?.length || 0}개

위 정보를 바탕으로 ${profile.name}에게 맞춘 현실적인 코칭을 제공합니다.`.trim();
    }

    const input: EasyInputMessage[] = [
      { role: 'system', content: contextInstruction },
      ...mapHistoryToInput(history),
      { role: 'user', content: String(message || '') },
    ];

    const response = await openai.responses.create({
      model: 'gpt-4o-mini',
      input,
      tools: tools as any,
    });

    return res.status(200).json(toClientCandidates(response));
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}
