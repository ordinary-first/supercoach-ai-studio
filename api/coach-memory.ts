import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOpenAIClient } from '../lib/openaiClient.js';
import { getAdminDb } from '../lib/firebaseAdmin.js';

const SHORT_TERM_PROMPT = `당신은 AI 코치의 메모리 관리자입니다.
최근 사용자 활동 로그와 현재 상태를 바탕으로 코치가 알아야 할 핵심 맥락을 1000자 이내의 마크다운으로 요약하세요.

포함할 내용:
- 최근 달성한 것 (완료된 목표, 할일)
- 새로 설정한 목표
- 진행 중인 작업과 진행률
- 주목할 행동 패턴 (활발한 영역, 정체된 영역)

형식: 간결한 마크다운. 불필요한 서론 없이 바로 내용.`;

const MID_TERM_PROMPT = `당신은 AI 코치의 메모리 관리자입니다.
사용자의 최근 1주간 활동 요약과 이전 중기 기억을 보고 아래를 2000자 이내 마크다운으로 정리하세요.

포함할 내용:
- 반복되는 행동 패턴 (매일 하는 것, 자주 미루는 것)
- 목표 진행 추세 (상승/정체/하락)
- 자주 등장하는 장애물
- 코칭에서 효과적이었던 접근법
- 사용자의 동기부여 요인

이전 중기 기억이 있으면 병합하되, 오래되거나 덜 중요한 내용은 자연스럽게 탈락시키세요.
형식: 간결한 마크다운. 불필요한 서론 없이 바로 내용.`;

const LONG_TERM_PROMPT = `당신은 AI 코치의 메모리 관리자입니다.
축적된 관찰을 바탕으로 코치가 영구적으로 기억해야 할 핵심 인사이트를 2000자 이내 마크다운으로 정리하세요.

포함할 내용:
- 사용자의 핵심 가치관과 인생 방향
- 성격 특성과 코칭 스타일 선호
- 동기부여 패턴 (무엇이 이 사람을 움직이는가)
- 반복되는 장애물과 효과적인 돌파 전략
- 중요한 성취와 전환점

기존 장기 기억이 있으면 새 인사이트와 병합하되, 2000자 한도 내에서 가장 중요한 것만 유지하세요.
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
    const { action, userId, actionLogs, goalContext, todoContext, existingMemory } = req.body || {};

    if (!userId || !action) {
      return res.status(400).json({ error: 'userId and action required' });
    }

    const db = getAdminDb();

    if (action === 'summarize-short') {
      const logsText = Array.isArray(actionLogs)
        ? actionLogs.map((l: any) => `[${new Date(l.timestamp).toLocaleString('ko-KR')}] ${l.action}: ${l.detail}`).join('\n')
        : '활동 로그 없음';

      const userContent = [
        '## 최근 활동 로그',
        logsText,
        '',
        '## 현재 목표 트리',
        goalContext || '목표 없음',
        '',
        '## 현재 할일',
        todoContext || '할일 없음',
      ].join('\n');

      const summary = await summarizeWithAI(SHORT_TERM_PROMPT, userContent);
      const lastTimestamp = Array.isArray(actionLogs) && actionLogs.length > 0
        ? Math.max(...actionLogs.map((l: any) => l.timestamp || 0))
        : Date.now();

      await db.doc(`users/${userId}/coachMemory/shortTerm`).set({
        summary,
        lastActionTimestamp: lastTimestamp,
        updatedAt: Date.now(),
      });

      return res.status(200).json({ summary, tier: 'shortTerm' });
    }

    if (action === 'summarize-mid') {
      const shortTermSummary = existingMemory?.shortTerm || '';
      const prevMidTerm = existingMemory?.midTerm || '';

      const userContent = [
        '## 최근 단기 활동 요약',
        shortTermSummary || '단기 활동 요약 없음',
        '',
        '## 이전 중기 기억',
        prevMidTerm || '이전 중기 기억 없음',
      ].join('\n');

      const summary = await summarizeWithAI(MID_TERM_PROMPT, userContent);

      await db.doc(`users/${userId}/coachMemory/midTerm`).set({
        summary,
        updatedAt: Date.now(),
      });

      return res.status(200).json({ summary, tier: 'midTerm' });
    }

    if (action === 'promote-long') {
      const midTermSummary = existingMemory?.midTerm || '';
      const prevLongTerm = existingMemory?.longTerm || '';

      const userContent = [
        '## 중기 기억 (최근 패턴)',
        midTermSummary || '중기 기억 없음',
        '',
        '## 기존 장기 기억',
        prevLongTerm || '기존 장기 기억 없음',
      ].join('\n');

      const summary = await summarizeWithAI(LONG_TERM_PROMPT, userContent);

      await db.doc(`users/${userId}/coachMemory/longTerm`).set({
        summary,
        updatedAt: Date.now(),
      });

      return res.status(200).json({ summary, tier: 'longTerm' });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error: any) {
    console.error('[coach-memory]', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}
