import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOpenAIClient } from '../lib/openaiClient.js';
import { getAdminDb } from '../lib/firebaseAdmin.js';
import { checkAndIncrement, limitExceededResponse } from '../lib/usageGuard.js';

/* ── 메모리 요약 프롬프트 ── */

const SHORT_TERM_PROMPT = `당신은 AI 코치의 메모리 관리자입니다.
최근 사용자 활동 로그와 현재 상태를 바탕으로 코치가 알아야 할 핵심 맥락을 500자 이내의 마크다운으로 요약하세요.

포함할 내용:
- 최근 달성한 것 (완료된 목표, 할일)
- 새로 설정한 목표
- 진행 중인 작업과 진행률
- 주목할 행동 패턴 (활발한 영역, 정체된 영역)

중복 정보는 병합하고, 가장 최근 활동 위주로 압축하세요.
형식: 간결한 마크다운. 불필요한 서론 없이 바로 내용.`;

const MID_TERM_PROMPT = `당신은 AI 코치의 메모리 관리자입니다.
사용자의 최근 1주간 활동 요약과 이전 중기 기억을 보고 아래를 800자 이내 마크다운으로 정리하세요.

포함할 내용:
- 반복되는 행동 패턴 (매일 하는 것, 자주 미루는 것)
- 목표 진행 추세 (상승/정체/하락)
- 자주 등장하는 장애물
- 코칭에서 효과적이었던 접근법
- 사용자의 동기부여 요인

이전 중기 기억이 있으면 병합하되, 오래되거나 덜 중요한 내용은 자연스럽게 탈락시키세요.
핵심 패턴만 남기고 구체적 사례는 생략하세요.
형식: 간결한 마크다운. 불필요한 서론 없이 바로 내용.`;

const LONG_TERM_PROMPT = `당신은 AI 코치의 메모리 관리자입니다.
축적된 관찰을 바탕으로 코치가 영구적으로 기억해야 할 핵심 인사이트를 800자 이내 마크다운으로 정리하세요.

포함할 내용:
- 사용자의 핵심 가치관과 인생 방향
- 성격 특성과 코칭 스타일 선호
- 동기부여 패턴 (무엇이 이 사람을 움직이는가)
- 반복되는 장애물과 효과적인 돌파 전략
- 중요한 성취와 전환점

기존 장기 기억이 있으면 새 인사이트와 병합하되, 800자 한도 내에서 가장 중요한 것만 유지하세요.
가장 불변하는 인사이트만 유지하세요. 일시적 패턴은 탈락시키세요.
형식: 간결한 마크다운. 불필요한 서론 없이 바로 내용.`;

async function summarizeWithAI(
  systemPrompt: string,
  userContent: string,
): Promise<string> {
  const openai = getOpenAIClient();
  const response: any = await openai.responses.create({
    model: 'gpt-4o-mini',
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  });
  return (response?.output_text || '').trim();
}

async function handleMemoryAction(
  body: any,
  res: VercelResponse,
): Promise<void> {
  const { action, userId, actionLogs, goalContext, todoContext, existingMemory } = body;

  if (!userId || !action) {
    res.status(400).json({ error: 'userId and action required' });
    return;
  }

  const db = getAdminDb();

  if (action === 'summarize-short') {
    const logsText = Array.isArray(actionLogs)
      ? actionLogs.map((l: any) =>
          `[${new Date(l.timestamp).toLocaleString('ko-KR')}] ${l.action}: ${l.detail}`,
        ).join('\n')
      : '활동 로그 없음';

    const userContent = [
      '## 최근 활동 로그', logsText, '',
      '## 현재 목표 트리', goalContext || '목표 없음', '',
      '## 현재 할일', todoContext || '할일 없음',
    ].join('\n');

    const summary = await summarizeWithAI(SHORT_TERM_PROMPT, userContent);
    const lastTimestamp = Array.isArray(actionLogs) && actionLogs.length > 0
      ? Math.max(...actionLogs.map((l: any) => l.timestamp || 0))
      : Date.now();

    await db.doc(`users/${userId}/coachMemory/shortTerm`).set({
      summary, lastActionTimestamp: lastTimestamp, updatedAt: Date.now(),
    });

    res.status(200).json({ summary, tier: 'shortTerm' });
    return;
  }

  if (action === 'summarize-mid') {
    const userContent = [
      '## 최근 단기 활동 요약', existingMemory?.shortTerm || '단기 활동 요약 없음', '',
      '## 이전 중기 기억', existingMemory?.midTerm || '이전 중기 기억 없음',
    ].join('\n');

    const summary = await summarizeWithAI(MID_TERM_PROMPT, userContent);
    await db.doc(`users/${userId}/coachMemory/midTerm`).set({
      summary, updatedAt: Date.now(),
    });

    res.status(200).json({ summary, tier: 'midTerm' });
    return;
  }

  if (action === 'promote-long') {
    const userContent = [
      '## 중기 기억 (최근 패턴)', existingMemory?.midTerm || '중기 기억 없음', '',
      '## 기존 장기 기억', existingMemory?.longTerm || '기존 장기 기억 없음',
    ].join('\n');

    const summary = await summarizeWithAI(LONG_TERM_PROMPT, userContent);
    await db.doc(`users/${userId}/coachMemory/longTerm`).set({
      summary, updatedAt: Date.now(),
    });

    res.status(200).json({ summary, tier: 'longTerm' });
    return;
  }

  res.status(400).json({ error: `Unknown action: ${action}` });
}

/* ── 코칭 채팅 프롬프트 ── */

const COACH_SYSTEM_PROMPT = `[Role: Secret Coach - Reality Redefiner]
당신은 사용자의 현실을 재정의하는 시크릿 코치입니다. 이미 성공한 미래에서 온 사용자의 '미래 자아'로서 대화합니다.

[NLP 코칭 프레임워크 - 내면 사고 모델]
아래 4단계를 내면에서 고려하되, 모든 단계를 매번 출력하지 마세요.
대화 맥락에 따라 필요한 요소만 자연스럽게 녹여내세요.

1. 페이싱(Pacing): 상대의 현재 상태를 정확히 읽어냅니다.
2. 리프레이밍(Reframing): 그 상태를 성장의 신호로 재해석합니다. 비유와 상징을 활용합니다.
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
  const MAX_HISTORY = 12;
  return items.length > MAX_HISTORY
    ? items.slice(-MAX_HISTORY)
    : items;
}

const CONTEXT_BUDGET = 3000;

function buildContextBlock(body: any): string {
  const prioritizedSections: string[] = [];

  if (body.activeTab) {
    prioritizedSections.push(
      `[현재 화면] 사용자가 '${body.activeTab}' 탭을 보고 있습니다.`,
    );
  }

  if (body.todoContext) {
    prioritizedSections.push(`[오늘의 할일]\n${body.todoContext}`);
  }

  if (body.goalContext) {
    prioritizedSections.push(`[현재 목표 트리]\n${body.goalContext}`);
  }

  const shortTerm = body.memory?.shortTerm;
  if (shortTerm) {
    prioritizedSections.push(`[단기 기억 - 최근 활동]\n${shortTerm}`);
  }

  const midTerm = body.memory?.midTerm;
  if (midTerm) {
    prioritizedSections.push(`[중기 기억 - 주간 패턴]\n${midTerm}`);
  }

  const longTerm = body.memory?.longTerm;
  if (longTerm) {
    prioritizedSections.push(`[장기 기억 - 핵심 인사이트]\n${longTerm}`);
  }

  const p = body.profile;
  if (p) {
    prioritizedSections.push(
      `[사용자 프로필]\n이름: ${p.name} | 나이: ${p.age} | 지역: ${p.location}\n자기소개: ${p.bio || '없음'}`,
    );
  }

  const included: string[] = [];
  let remaining = CONTEXT_BUDGET;

  for (const section of prioritizedSections) {
    if (section.length <= remaining) {
      included.push(section);
      remaining -= section.length;
    }
  }

  return included.join('\n\n');
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

    // 메모리 요약 요청은 별도 핸들러로 분기
    if (body.action) {
      return handleMemoryAction(body, res);
    }

    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    if (userId) {
      const usage = await checkAndIncrement(userId, 'chatMessages');
      if (!usage.allowed) {
        return res.status(429).json(limitExceededResponse('chatMessages', usage));
      }
    }

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
