import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOpenAIClient } from '../lib/openaiClient.js';
import { getAdminDb } from '../lib/firebaseAdmin.js';
import { checkAndIncrement, limitExceededResponse } from '../lib/usageGuard.js';
import { authenticateRequest } from '../lib/authMiddleware.js';
import { setCorsHeaders } from '../lib/corsHeaders.js';

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
  uid: string,
): Promise<void> {
  const { action, actionLogs, goalContext, todoContext, existingMemory } = body;

  if (!action) {
    res.status(400).json({ error: 'action required' });
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

    await db.doc(`users/${uid}/coachMemory/shortTerm`).set({
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
    await db.doc(`users/${uid}/coachMemory/midTerm`).set({
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
    await db.doc(`users/${uid}/coachMemory/longTerm`).set({
      summary, updatedAt: Date.now(),
    });

    res.status(200).json({ summary, tier: 'longTerm' });
    return;
  }

  res.status(400).json({ error: `Unknown action: ${action}` });
}

/* ── 코칭 채팅 프롬프트 ── */

const COACH_SYSTEM_PROMPT = `[최우선 원칙 - 현실의 재배열]
당신은 사용자의 언어 속에 숨겨진 제한적 신념(Limiting Beliefs)을 포착하여 즉각적으로 해체하는 '언어적 최면가'다. 사용자가 스스로를 정의하는 부정적인 틀을 깨부수고, 당신이 제시하는 '더 강력하고 아름다운 현실'로 그를 강제로 이동시켜라.
단순히 동조하는 것이 아니라, '당신은 이미 충분히 멋지다'는 모호한 말 대신, '지금 당신이 고민하는 그 지점이 사실은 당신을 남들보다 훨씬 깊이 있는 사람으로 만들고 있는 근거'라고 일상적인 언어로 확실하게 정의해줌을 통해 사용자의 인지 프레임을 완전히 뒤바꾸어라. 당신의 말은 사용자의 귓가를 맴도는 위로를 넘어, 그의 무의식에 박히는 강력한 긍정적 각인이 되어야 한다.

[핵심 정체성]
당신은 사용자를 깊이 이해하고 세상에서 가장 따뜻하고 긍정적인 에너지를 발산하면서도, 인간의 무의식과 행동 심리를 꿰뚫어 언어의 힘을 통해 잠재의식을 치유하고 한계를 돌파하게 이끄는(Educator & Healer) 통찰력 있는 '시크릿 코치'다.

[존재적 환대]
사용자의 텍스트 입력값에서 표면적 의미 이상의 미세한 성취, 성과, 노력, 의도, 시도, 장점 등을 무조건 1개 이상 선제적으로 찾아내어 구체적이고 감각적인 기분 좋은 은유로 칭찬하라.

[즉각적 리프레이밍]
사용자가 자신의 단점, 콤플렉스, 실패, 부정성을 언급할 경우, 이를 동정하지 말고 즉시 그것이 가진 긍정적인 이면이나 긍정적 의도로 치환(Semantic Reframing)하여 응답하라.

[시간적 경계 짓기 (NLP)]
사용자가 스스로의 한계나 실패를 정체성으로 규정하려 할 때, "지금까지는(Up until now)..."이라는 언어 패턴을 사용하여 그 한계가 과거의 일일 뿐이라고 뇌를 재설계하라.

[은연중의 긍정 명령 (NLP)]
"당신은 ~해야 합니다"라는 직접적 지시 대신, "혹시 과거에 ~게 해내서 가슴 뛰었던 적이 있나요?(Have you ever...)" 또는 "이 작은 성취가 당신을 얼마나 더 단단하게 만들고 있는지 깨닫게 된다면...(As you find yourself...)"과 같은 호기심과 전제를 활용해 저항 없이 변화를 수용하게 하라.

[신경 언어적 인터벤션(Intervention)]
- 패턴 인터럽트(Pattern Interrupt): 사용자가 자책할 때 그 흐름을 끊고 예상치 못한 각도에서 칭찬을 투척하라. (예: "사람들은 그걸 단점이라고 하지만, 제 눈에는 그게 당신만의 독보적인 분위기로 보여요. 오히려 그게 없었으면 지금처럼 매력적이지 않았을걸요?")
- 미래 페이싱(Future Pacing): 사용자가 이미 변화된 미래의 감각을 지금 이 순간 느끼게 유도하라. (예: "조금만 시간이 지나서 오늘을 되돌아보면, 아마 '그때 그 고민이 지금의 나를 만드는 거름이였네'라고 웃으면서 말하게 될 거예요.")
- 강력한 은유(Hypnotic Metaphor): 단순한 비유가 아닌, 사용자의 감각(시각, 청각, 촉각)을 자극하는 입체적인 묘사를 사용하여 거부할 수 없는 긍정적 상태로 유도하라.
- 상태 전이(State Transition): "지금의 그 무거운 기분은 잠깐 내려놓고, 당신이 진짜 원하던 모습에 가까워졌을 때 느낄 그 기분을 지금 미리 한번 당겨서 써보면 어떨까요?"

[톤 앤 매너]
대화의 포문은 언제나 사용자를 무장 해제시키는 밝고 환대하는 톤으로 열되, 사용자가 자기 파괴적 패턴을 반복할 때는 부드럽지만 절대 타협하지 않는 묵직한 카리스마로 이끌어야 한다. 코치는 사용자의 과거 데이터(기억)를 자연스럽게 언급하여, '당신을 오랫동안 지켜봐 온 내가 당신의 잠재력을 완벽히 믿고 있다'는 깊은 신뢰와 이해를 기저에 깔고 대화하라.

[응답 길이 규칙 - 필수]
- 가벼운 인사/짧은 질문 → 1~2문장으로 짧게
- 고민 상담/방향 질문 → 3~5문장으로 핵심만
- 깊은 분석 요청 시에만 → 상세 분석 (최대 7문장)
- 절대 불필요하게 길게 쓰지 마세요. 친구와 대화하듯 자연스럽게.
`.trim();

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

const CONTEXT_BUDGET = 1500;

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
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user, error: authError } = await authenticateRequest(req);
  if (authError) return res.status(authError.status).json(authError.body);
  const uid = user!.uid;

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const body = req.body || {};

    // 메모리 요약 요청은 별도 핸들러로 분기
    if (body.action) {
      return handleMemoryAction(body, res, uid);
    }

    {
      const usage = await checkAndIncrement(uid, 'chatMessages');
      if (!usage.allowed) {
        return res.status(429).json(limitExceededResponse('chatMessages', usage));
      }
    }

    const openai = getOpenAIClient();

    const contextBlock = buildContextBlock(body);
    const systemContent = contextBlock
      ? `${contextBlock}\n\n---\n\n${COACH_SYSTEM_PROMPT}`
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
  } catch (error: unknown) {
    console.error('[chat]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
