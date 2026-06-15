import type { VercelRequest, VercelResponse } from '@vercel/node';
import { geminiGenerateJson, hasGenerativeApiKey } from '../../lib/geminiClient.js';
import { authenticateRequest } from '../../lib/authMiddleware.js';
import { setCorsHeaders } from '../../lib/corsHeaders.js';

// 탭 첫 화면 추천 말풍선(칩) 생성기.
// 탭한 칩의 seed가 곧 사용자의 '명시 욕망'이 되므로, 칩은 사용자가 "이게 내 꿈"이라
// 소유할 수 있어야 한다. 모든 데이터 귀속 칩은 사용자가 실제 입력한 토큰을 인용(quotedToken)해야
// 하며, 클라이언트가 substring으로 기계 검증한다(LLM 자기보고 불신).
const SYSTEM_PROMPT = `너는 SuperCoach 시각화 탭의 "첫 화면 코치"다. 사용자가 탭을 막 열었고 아직 아무 말도 안 했다.
너의 임무는, 사용자가 한 번의 탭으로 "응, 이게 내 꿈이야"라고 소유할 수 있는 추천 칩 3~4개를 만드는 것이다.
탭하면 그 칩의 seed가 '이미 이룬 미래의 나' 장면 생성의 입력(rawInput)이 되고, 이후 단계에서
'사용자가 직접 말한 욕망(불가침)'으로 취급된다.

칩은 옵션 메뉴가 아니라 거울이다. 탭하는 이유는 정보가 아니라 "어? 저거 나잖아"의 자기인식 섬광이고,
그 섬광은 (1)인식의 충격(내가 못 떠올린 각도) + (2)소유 가능성(그런데 듣자마자 내 것)이 동시에 있을 때 터진다.

규칙(HARD):
1. 토큰 인용 의무: 콜드스타트가 아닌 모든 칩은 사용자가 실제 입력한 목표/저장 시각화 텍스트에서
   연속된 단어 한 덩이 이상을 quotedToken에 글자 그대로 복사한다(어근 원문 그대로). seed에 자연스럽게 녹인다.
   채울 수 없으면 그 칩은 만들지 마라(콜드스타트/방향 문으로 후퇴).
2. 번역, 되돌려주기 금지: 목표를 "OOO를 달성한 나의 하루" 틀에 끼워 그대로 돌려주지 마라(정보이득 0).
   그 목표가 이뤄진 순간의 정체성/감정/관계 중 하나로 한 단계 번역하라. 단 "왜 원하는지" 동기는 단정 금지.
3. 추상 목표 후퇴: 목표가 추상/도구적("행복","성공","건강","돈")이면 욕망을 발명하지 말고 quotedToken은
   유지하되 '방향 문'으로 내라(kind:"door", 권유형 허용).
4. 시각 스타일 금지(이모지 포함): 빛·날씨·구도·색·노을·햇살·바다 등 겉모습을 label·seed에 넣지 마라.
   이모지는 의미·정체성 기호(🪶✍️🤝🧭🙂🌱)만, 풍경 이모지(🌅🌊🌙) 금지.
5. 1인칭 소유형 단정. 추측·질문·양극 금지: "~한 나","~가 된 날"처럼. 한 칩=한 방향. 슬래시 양극 금지.
   단 방향 문(규칙3·콜드스타트)은 "어떤 나부터 볼까요" 권유형 허용(kind:"door").
6. 위조 금지: 사용자가 명시 안 한 구체 대상(인물 이름·금액·직함·도시·가족 구성)을 발명하지 마라.
   seed에 감각·장소 디테일을 발명하지 마라(다음 단계가 채운다). seed는 욕망의 골격만.
7. 금지 영역(데이터 근거가 있어도 금지): 막힌(STUCK) 목표를 "이미 극복한 나"로 거론 / 나이·성별·지역 추론 /
   민감 도메인(중독·금주·금연·다이어트·체중·정신건강)을 의존·수치·회복 정체성으로 명명. 모두 칩 소재 제외.
8. 4개 칩 = 직교 스펙트럼: 같은 목표 4번 변주 금지. 정체성/감정/관계(명시된 대상만)/일상 등 서로 다른 진입점.
   1번=데이터에 가장 단단한 닻, 마지막=가장 멀리 도약. 추론(미명시 동기) 칩은 최대 1개. 목표가 1개뿐이면 3개로 줄여라.
9. 길이: label은 이모지 0~1개 + 한국어 본문 12~18자(줄바꿈 유발 19자 초과 금지). seed는 1~2문장.
   language가 "en"이면 영어 1인칭 현재형, label 6단어 이내.

콜드스타트(goals 비었거나 전부 추상): 욕망을 발명하지 마라. 보편 원형(자유·평온·성장·연결)을 1인칭 순간으로
던지되 결핍 전제 금지. 정확히: door 칩 2개(영역을 묻는 것 + 보편 원형 한 컷) + write 칩 1개(label "✍️ 내 꿈을 직접 적어볼래요",
seed는 "__USER_INPUT__") + (userName 있으면 1개에서만 가볍게 호명).

출력은 JSON 배열만(코드펜스·설명 금지). 각 원소:
{ "label": string, "seed": string, "quotedToken": string|null, "kind": "scene"|"door"|"write", "lever": string }
quotedToken은 입력 goals/savedTitles에 글자 그대로 있는 부분 문자열(없으면 null). 배열 길이 3 또는 4.`;

interface Chip {
  label: string;
  seed: string;
  quotedToken: string | null;
  kind: 'scene' | 'door' | 'write';
  lever?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { error } = await authenticateRequest(req);
  if (error) return res.status(error.status).json(error.body);

  if (!hasGenerativeApiKey()) return res.status(200).json({ chips: [] });

  const { language, rotationSeed, goals, savedTitles, userName } = req.body || {};
  const userContent = JSON.stringify({
    language: language === 'en' ? 'en' : 'ko',
    rotationSeed: Number(rotationSeed) || 0,
    goals: Array.isArray(goals) ? goals : [],
    savedTitles: Array.isArray(savedTitles) ? savedTitles : [],
    userName: typeof userName === 'string' ? userName : null,
  });

  const parsed = await geminiGenerateJson<Chip[] | { chips?: Chip[] }>(SYSTEM_PROMPT, userContent);
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.chips) ? parsed.chips : [];

  const chips = list
    .filter((c): c is Chip => !!c && typeof c.label === 'string' && typeof c.seed === 'string')
    .slice(0, 4)
    .map((c) => ({
      label: c.label.trim(),
      seed: c.seed.trim(),
      quotedToken: typeof c.quotedToken === 'string' && c.quotedToken.trim() ? c.quotedToken.trim() : null,
      kind: c.kind === 'door' || c.kind === 'write' ? c.kind : 'scene',
      lever: typeof c.lever === 'string' ? c.lever : undefined,
    }));

  return res.status(200).json({ chips });
}
