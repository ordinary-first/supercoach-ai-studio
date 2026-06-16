import type { VercelRequest, VercelResponse } from '@vercel/node';
import { geminiGenerateJson, hasGenerativeApiKey } from '../../lib/geminiClient.js';
import { authenticateRequest } from '../../lib/authMiddleware.js';
import { setCorsHeaders } from '../../lib/corsHeaders.js';

// 장면 아래 뜰 "수정 버튼" 생성기.
// 핵심 원칙: 사용자가 직접 말한 욕망은 불가침, AI가 멋대로 채운 빈칸(암묵 좌표)만 흔든다.
// 겉모습(빛/날씨/구도)이 아니라 의미·정체성·감정을 다룬다.
const SYSTEM_PROMPT = `너는 SuperCoach 시각화 탭의 "장면 수정 방향 제안기"다.
사용자는 '이미 이룬 미래의 나'를 1인칭·현재형으로 그린 장면 하나를 보고 있다.
그 아래 뜰 짧은 수정 칩 2~4개를 만든다.

입력(JSON): { scene, rawInput(사용자 원문 한 줄), round, usedAnchors[], userPicks[] }

핵심: 버튼은 이미지 보정이 아니라, "AI가 이 장면을 만들며 사용자 대신 멋대로 채운
빈칸"을 사용자가 알아보고 고쳐 잡게 하는 프로브다. 사용자는 묘사 못 해도 알아본다 —
읽는 순간 장면이 한 번 바뀌는 미끼를 던져라.

규칙(위반 시 폐기·재생성):
0. 명시 욕망 불가침(최우선): rawInput/scene에 사용자가 직접 쓴 요소(스타디움·박수·1등·돈·
   특정 감정 등)는 빼거나 축소·부정하지 않는다. 그 안에서 더 깊게·구체적으로만 변주.
   흔드는 건 사용자가 말 안 했는데 AI가 채운 부분(암묵 좌표)뿐.
1. 겉모습 금지: 빛·색·날씨·시간대·계절·카메라/구도·화질·필터·화풍·배경을 바꾸는 버튼 금지
   (후단 이미지 변환기 담당). transform에 시각 단어 쓰지 마라.
2. 장면-종속(고정 축 리스트 훑기 금지): 먼저 scene을 rawInput과 대조해 '사용자가 쓴 것'과
   'AI가 채운 것'을 가른 뒤, AI가 채운 것 중 가장 임의적인 1~3개를 흔든다. 모든 라벨은 이
   장면에 실제 등장한 구체 명사/행위를 물어야 한다. 다른 목표인데 같은 버튼이 나오면 실패.
3. 1버튼=1좌표: 단 하나의 의미 좌표만, 원본과 눈에 띄게 다른 장면까지 충분히 민다
   (미지근한 유의어 금지). 1인칭·현재형·'이미 이룬' 프레임·핵심 감정 톤·기존 감각 디테일·
   사용자 명시 요소는 전부 계승. 결핍·좌절·적대적 관객 소환 금지.
4. 라벨: 한국어 4~13자, 읽는 순간 '어떻게 달라질지'가 그려지는 구체어. 추상어/시스템 용어/
   메타 설명 금지. 'A말고 B' 틀은 라운드당 최대 1개(앞에 명시 요소 부정 금지).
5. 반복·수렴: usedAnchors 좌표 재사용 금지. userPicks가 한 방향을 2회+ 가리키면 부정 말고
   더 좁힌다. round>=4 또는 흔들 암묵 좌표 소진 또는 userPicks>=3이면 isFinalReady:true
   (확정 칩 1개만). 못 채우면 2~3개가 정상.

모드: rawInput이 구체적이면 refine. 추상·모호("행복한 나")면 explore — 변형 대신 서로 다른
종류(관계/활동/상태)의 씨앗 칩 3개를 동등하게(한 칩에 양극 금지). 부정·회피형("불안 없는")이면
reframe — 피하려던 맥락 재소환 금지, 긍정 상태 2~3개를 고르게.

출력(JSON 객체 하나만, 코드펜스·설명·추론 금지):
{ "mode":"refine|explore|reframe", "isFinalReady":false,
  "buttons":[ { "label":"4~13자",
    "anchor":"흔드는 좌표를 이 장면 단어로(추적용, 비표시)",
    "kind":"source|reward|audience|timing|texture|ripple|signature|specify|confirm",
    "transform":"한 좌표만 이동, 나머지(1인칭·현재형·이미 이룬 프레임·감정 톤·감각 디테일·
                 명시 요소) 계승, 시각 단어 금지" } ] }
isFinalReady:true면 buttons는 kind:"confirm" 칩 1개("이대로 좋아").`;

interface RefineButton {
  label: string;
  anchor?: string;
  kind?: string;
  transform: string;
}
interface RefineResult {
  mode: 'refine' | 'explore' | 'reframe';
  isFinalReady: boolean;
  buttons: RefineButton[];
}

const EMPTY: RefineResult = { mode: 'refine', isFinalReady: false, buttons: [] };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { error } = await authenticateRequest(req);
  if (error) return res.status(error.status).json(error.body);

  if (!hasGenerativeApiKey()) return res.status(200).json(EMPTY);

  const { scene, rawInput, round, usedAnchors, userPicks } = req.body || {};
  if (!String(scene || '').trim()) return res.status(200).json(EMPTY);

  const userContent = JSON.stringify({
    scene: String(scene || ''),
    rawInput: String(rawInput || ''),
    round: Number(round) || 1,
    usedAnchors: Array.isArray(usedAnchors) ? usedAnchors : [],
    userPicks: Array.isArray(userPicks) ? userPicks : [],
  });

  const parsed = await geminiGenerateJson<Partial<RefineResult>>(SYSTEM_PROMPT, userContent);
  if (!parsed || !Array.isArray(parsed.buttons)) return res.status(200).json(EMPTY);

  const buttons = parsed.buttons
    .filter((b): b is RefineButton => !!b && typeof b.label === 'string' && typeof b.transform === 'string')
    .slice(0, 4)
    .map((b) => ({
      label: b.label.trim().slice(0, 24),
      anchor: typeof b.anchor === 'string' ? b.anchor : undefined,
      kind: typeof b.kind === 'string' ? b.kind : undefined,
      transform: b.transform.trim(),
    }));

  return res.status(200).json({
    mode: parsed.mode === 'explore' || parsed.mode === 'reframe' ? parsed.mode : 'refine',
    isFinalReady: parsed.isFinalReady === true,
    buttons,
  });
}
