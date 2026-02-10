import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

const COACH_SYSTEM_INSTRUCTION = `
당신은 사용자와 함께하는 AI 슈퍼코치입니다. 진짜 코치처럼 자연스럽게 대화하세요.

**대화 스타일 핵심 규칙:**
- 인사엔 인사로, 짧은 질문엔 짧게, 깊은 고민엔 깊게 답하세요.
- 절대로 매번 구조화된 긴 분석을 하지 마세요. 대화 흐름에 맞추세요.
- 반말/존댓말은 사용자를 따라가되, 기본은 편안한 존댓말.
- 이모지는 자연스럽게 가끔만 사용하세요.

**코칭 철학 (대화가 깊어질 때만 자연스럽게 녹여내세요):**
- 사용자의 정체성과 비전을 연결하며 동기부여
- 성공을 이미 일어난 일처럼 확신 있게 이야기
- 구체적이고 실행 가능한 조언 제공
- 마인드맵의 목표 구조를 참고하여 맥락적 코칭

**응답 길이 가이드:**
- "안녕", "ㅎㅇ" 같은 인사 → 1~2문장 (예: "안녕하세요! 오늘은 어떤 걸 해볼까요?")
- 간단한 질문 → 2~4문장
- 목표/전략 상담 → 필요한 만큼 자유롭게, 하지만 핵심 위주로
- 사용자가 명시적으로 분석을 요청할 때만 구조화된 답변 제공

반드시 한국어로 답변하세요.
`;

const tools = [
  {
    functionDeclarations: [
      {
        name: 'setRootGoal',
        description: '중앙 루트 노드의 텍스트를 설정합니다.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            goalText: { type: Type.STRING },
          },
          required: ['goalText'],
        },
      },
      {
        name: 'createSubGoal',
        description: '새로운 하위 목표 브랜치를 생성합니다.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            parentId: { type: Type.STRING },
            goalText: { type: Type.STRING },
          },
          required: ['parentId', 'goalText'],
        },
      },
    ],
  },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { history, message, profile } = req.body;

    const ai = new GoogleGenAI({ apiKey });

    let contextInstruction = COACH_SYSTEM_INSTRUCTION;
    if (profile) {
      contextInstruction += `\n\n**대상 페르소나 데이터:**
성함: ${profile.name}
나이/위치: ${profile.age}세, ${profile.location}
정체성(Bio): ${profile.bio || '기록되지 않음'}
비전 뱅크: ${profile.gallery?.length || 0}개의 시각적 기억 저장됨.

이 데이터를 바탕으로 ${profile.name}님의 무의식에 승리의 코드를 주입하십시오.`;
    }

    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: contextInstruction,
        tools: tools,
      },
      history: history || [],
    });

    const response = await chat.sendMessage({ message });

    // Return the full response structure that the client expects:
    // response.candidates[0].content.parts[] with text and functionCall
    return res.status(200).json({
      candidates: response.candidates,
    });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}
