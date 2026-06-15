# TIL — Today I Learned

## 2026-06-15: Gemini TTS는 한국어 오디오를 거부 → Cloud TTS로 대체
- **증상**: 시각화에서 오디오 생성이 항상 `오디오 생성 실패.`(502 SPEECH_GENERATION_FAILED). 영상은 항상 "대기 중"만 뜨고 안 나옴.
- **원인(오디오)**: `gemini-2.5-flash-preview-tts`가 **한국어 텍스트에 오디오를 안 만듦** — `finishReason: OTHER`(2.5)/`blockReason: PROHIBITED_CONTENT`(3.1). 영어는 정상. safetySettings·보이스·모델 무관하게 한국어 전부 실패. 코드의 `if(!audioData) throw`로 502.
- **원인(영상)**: fal Kling v3 파이프라인은 정상(키·모델·파라미터·폴링 URL·결과 `data.video.url` 전부 검증됨). 단 생성이 ~50초~3분인데 클라이언트 폴링 타임아웃이 45초라 항상 pending.
- **해결(오디오)**: Google Cloud Text-to-Speech(`texttospeech.googleapis.com`, `ko-KR-Neural2-A`)로 교체. LINEAR16@24000 → WAV 헤더 strip → raw PCM16@24k = 기존 Gemini 계약과 바이트 호환(다운스트림 무변경).
- **해결(영상)**: 클라이언트 폴링 타임아웃 45s → 90s.
- **함정**: 메인 `GOOGLE_API_KEY`는 Generative Language API로 제한돼 Cloud TTS 호출 시 403("method blocked"). 그래서 **TTS 전용 키 `GOOGLE_TTS_API_KEY`** 별도 발급 필요. Firebase SA(`coach-52bf4`)는 빌링이 없어 Cloud TTS 불가 — 빌링 있는 `292106435612`(GOOGLE_API_KEY 프로젝트)에 키 생성.
- **함정2(레드헤링)**: `vercel env pull`은 실제 개행을 리터럴 `\n`으로 이스케이프 → 받은 FAL_KEY가 401처럼 보였으나, 런타임에선 실제 개행이고 `getFalClient().trim()`이 제거 → 프로덕션 fal은 정상.
- **파일**: `server/api/generate-speech.ts`, `services/aiService.ts:494`

## 2026-03-26: Biome가 ESLint + Prettier를 완전 대체 가능
- **증상**: ESLint + Prettier 설정이 복잡하고 충돌 발생
- **원인**: 두 도구의 규칙 겹침, 설정 파일 3개 관리 필요
- **해결**: Biome 2.x 하나로 lint + format 통합. `biome.json` 하나로 관리
- **파일**: `biome.json`, `package.json` scripts

## 2026-03-25: Vercel 환경변수 전체 유실 사고
- **증상**: 프로덕션에서 모든 API 호출 실패, 결제 웹훅 안 옴
- **원인**: Vercel 대시보드에서 환경변수 13개가 전부 삭제되어 있었음 (원인 불명)
- **해결**: `.env.local` 기반으로 Vercel CLI로 13개 재설정
- **파일**: `.env.example`, Vercel 프로젝트 설정

## 2026-03-25: 취소 후 재구독 불가 버그
- **증상**: 구독 취소한 유저가 다시 구독하려 해도 "이미 구독 중" 표시
- **원인**: `cancelAtPeriodEnd=true`인 유저를 활성 구독자로 판정하는 로직
- **해결**: `cancelAtPeriodEnd`이면 비구독자로 처리 → 새 checkout 유도
- **파일**: `components/SettingsPage.tsx`, `api/cancel-subscription.ts`, `api/sync-subscription.ts`

## 2026-03-25: react-native-css-interop + reanimated 3 충돌
- **증상**: RN 빌드 시 `react-native-worklets/plugin` 못 찾음 에러
- **원인**: `react-native-css-interop@0.2.3`이 reanimated 4+ 전용 워클릿 플러그인 참조
- **해결**: patch-package로 babel.js에서 해당 플러그인 제거
- **파일**: `patches/react-native-css-interop+0.2.3.patch`

## 2026-03-25: Polar 조직명 혼동
- **증상**: Polar API 호출 시 404
- **원인**: 조직명이 `ordinaryx`가 아니라 `secret-coach`
- **해결**: 환경변수와 API 호출에서 조직명 확인
- **파일**: Polar 대시보드, `.env.local`
