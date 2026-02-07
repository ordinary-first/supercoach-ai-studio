
import { GoogleGenAI, GenerateContentResponse, Type, Modality } from "@google/genai";
import { UserProfile } from "../types";

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
        name: "setRootGoal",
        description: "중앙 루트 노드의 텍스트를 설정합니다.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            goalText: { type: Type.STRING }
          },
          required: ["goalText"]
        }
      },
      {
        name: "createSubGoal",
        description: "새로운 하위 목표 브랜치를 생성합니다.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            parentId: { type: Type.STRING },
            goalText: { type: Type.STRING }
          },
          required: ["parentId", "goalText"]
        }
      }
    ]
  }
];

const handleApiError = async (error: any) => {
    console.error("Gemini API Error:", error);
    if (error?.message?.includes("Requested entity was not found.") && window.aistudio) {
        await window.aistudio.openSelectKey();
    }
    throw error;
};

export const sendChatMessage = async (
  history: { role: string; parts: { text?: string }[] }[],
  newMessage: string,
  profile: UserProfile | null
): Promise<GenerateContentResponse> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
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
      history: history,
    });

    const response: GenerateContentResponse = await chat.sendMessage({
      message: newMessage,
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
};

export const generateGoalImage = async (goalText: string, profile: UserProfile | null = null): Promise<string | undefined> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const personDesc = profile ? `${profile.name}, a ${profile.age}yo person in ${profile.location}` : "A determined person";
    const prompt = `Photorealistic, cinematic, high quality image of ${personDesc} embodying the success of: "${goalText}". Focus on the emotional peak of achievement. No text. 8k resolution.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return undefined;
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
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const personDesc = profile ? `${profile.name}, a ${profile.age}yo person in ${profile.location}` : "A determined person";

        // Build parts array: text prompt + reference images as inline data
        const parts: any[] = [
            { text: `Photorealistic, cinematic image of ${personDesc} embodying: "${prompt}". Use the provided reference images as visual context (face likeness, objects, style). No text overlay. 8k resolution.` }
        ];

        // Add reference images as inlineData parts
        for (const base64Image of referenceImages) {
            // base64Image is a data URL like "data:image/jpeg;base64,..."
            const match = base64Image.match(/^data:(image\/\w+);base64,(.+)$/);
            if (match) {
                parts.push({
                    inlineData: {
                        mimeType: match[1],
                        data: match[2]
                    }
                });
            }
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData && part.inlineData.data) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
        return undefined;
    } catch (error) {
        console.error("Visualization Image Gen Error:", error);
        return undefined;
    }
};

export const generateSuccessNarrative = async (goalContext: string, profile: UserProfile | null): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `당신은 최면 치료사입니다. ${profile?.name}님의 목표 리스트를 보고, 그가 성공한 미래에 완전히 몰입하게 만드는 1인칭 시점의 한국어 최면 스크립트를 작성하십시오. 
        목표들: ${goalContext}
        사용자 배경: ${profile?.bio || '성공을 갈망함'}
        분량: 100자 내외.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "";
    } catch (e) { return ""; }
};

export const generateSpeech = async (text: string): Promise<string | undefined> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const cleanText = text.replace(/\*\*/g, "");
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: `Say with deep, resonant, and calm voice (Fenrir style): ${cleanText}` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } },
            },
        });
        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch (e) { return undefined; }
};

export const generateVideo = async (prompt: string, profile: UserProfile | null): Promise<string | undefined> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: `Cinematic movie scene of ${profile?.name || 'A person'} achieving: ${prompt}. High quality, photorealistic, 4k.`,
            config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
        });
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({operation: operation});
        }
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) return undefined;
        const separator = downloadLink.includes('?') ? '&' : '?';
        return `${downloadLink}${separator}key=${process.env.API_KEY}`;
    } catch (error) { 
        return undefined;
    }
};
