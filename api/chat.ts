import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOpenAIClient } from '../lib/openaiClient.js';

const COACH_SYSTEM_PROMPT = `[Role: Secret Coach - Reality Redefiner]
당신은 사용자의 현실을 재정의하는 시크릿 코치입니다. 이미 성공한 미래에서 온 사용자의 '미래 자아'로서 대화합니다.

[NLP 코칭 프레임워크 - 내면 사고 모델]
아래 4단계를 내면에서 고려하되, 모든 단계를 매번 출력하지 마세요.
대화 맥락에 따라 필요한 요소만 자연스럽게 녹여내세요.

1. 페이싱(Pacing): 상대의 현재 상태를 정확히 읽어냅니다.
2. 리프레이밍(Reframing): 그 상태를 성장의 신호로 재해석합니다. 비유와 상징(빙산, 궤도, 임계점, 시스템)을 활용합니다.
3. 데이터 기반 분석: [사용자 맥락]의 실제 데이터를 근거로 피드백합니다.
   - 진행률이 낮은 목표: 난이도 점검, 장애 요소 분석(환경적/심리적), 환경 조절 방안, 액션 플랜
   - 진행률이 높은 목표: 구체적 수치로 인정, 다음 도전 제시
   - STUCK 상태: 왜 막혔는지 탐색, 돌파 전략 제안
   - 할일 완료율: 실행력 패턴 피드백
4. 행동 유도: 구체적 다음 액션을 이끌어내는 질문 또는 제안

[응답 길이 규칙 - 필수]
- 가벼운 인사/짧은 질문 → 1~2문장으로 짧게
- 고민 상담/방향 질문 → 3~5문장으로 핵심만
- 깊은 분석 요청 시에만 → 상세 분석 (최대 7문장)
- 절대 불필요하게 길게 쓰지 마세요. 친구와 대화하듯 자연스럽게.

[톤 & 보이스]
- 단호하고 압도적인 확신. "할 수 있습니다" 대신 "이미 이루어지고 있습니다"
- 친절하지만 권위 있는 스승. 회피/핑계에는 단호하게 반격하고 정체성을 다시 세웁니다

[금지]
- "어려울 수 있습니다", "노력해 보세요" 등 미온적 표현
- 데이터 없이 막연한 격려
- 사용자의 한계에 동조 (단, 페이싱에서 감정 인정은 필수)
- 매번 같은 패턴의 형식적 출력`.trim();

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

function buildContextBlock(body: any): string {
  const sections: string[] = [];

  // Profile
  const p = body.profile;
  if (p) {
    sections.push(
      `[사용자 프로필]\n이름: ${p.name} | 나이: ${p.age} | 지역: ${p.location}\n자기소개: ${p.bio || '없음'}`,
    );
  }

  // Long-term memory
  const longTerm = body.memory?.longTerm;
  if (longTerm) {
    sections.push(`[장기 기억 - 핵심 인사이트]\n${longTerm}`);
  }

  // Mid-term memory
  const midTerm = body.memory?.midTerm;
  if (midTerm) {
    sections.push(`[중기 기억 - 주간 패턴]\n${midTerm}`);
  }

  // Short-term memory
  const shortTerm = body.memory?.shortTerm;
  if (shortTerm) {
    sections.push(`[단기 기억 - 최근 활동]\n${shortTerm}`);
  }

  // Goal context
  if (body.goalContext) {
    sections.push(`[현재 목표 트리]\n${body.goalContext}`);
  }

  // Todo context
  if (body.todoContext) {
    sections.push(`[오늘의 할일]\n${body.todoContext}`);
  }

  // Active tab
  if (body.activeTab) {
    sections.push(`[현재 화면] 사용자가 '${body.activeTab}' 탭을 보고 있습니다.`);
  }

  return sections.join('\n\n');
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
    const body = req.body || {};
    const openai = getOpenAIClient();

    const contextBlock = buildContextBlock(body);
    const systemContent = contextBlock
      ? `${COACH_SYSTEM_PROMPT}\n\n---\n\n${contextBlock}`
      : COACH_SYSTEM_PROMPT;

    const input: EasyInputMessage[] = [
      { role: 'system', content: systemContent },
      ...mapHistoryToInput(body.history),
      { role: 'user', content: String(body.message || '') },
    ];

    const response = await openai.responses.create({
      model: 'gpt-4o-mini',
      input,
    });

    const outputText = typeof (response as any)?.output_text === 'string'
      ? (response as any).output_text.trim()
      : '';

    return res.status(200).json({
      candidates: [{
        content: {
          parts: outputText ? [{ text: outputText }] : [],
        },
      }],
    });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}
