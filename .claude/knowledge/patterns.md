# Patterns — 프로젝트 고유 패턴/관례

## AI 호출
- Vercel AI SDK (`ai` 패키지) 사용이 표준
- `streamText()` / `generateText()`로 프로바이더 교체 가능
- 레거시: 일부 API 라우트가 아직 `openaiClient` 직접 호출 (마이그레이션 대상)

## 인증
- 클라이언트: `useAuth()` 훅 → Firebase Auth
- 서버(API): `lib/authMiddleware.ts` → Firebase Admin으로 토큰 검증
- 개발모드: `?dev=1` 쿼리 → 자동 익명 로그인 (팝업 불가 환경용)

## 상태 관리
- Zustand 스토어만 사용 (Redux 금지)
- 스토어 위치: `stores/`, 훅을 통해 접근 (`hooks/`)

## 파일 업로드
- 클라이언트 → `/api/upload-*` → Cloudflare R2 (S3 호환)
- 직접 R2 호출 금지, 반드시 API 엔드포인트 경유

## 코치 메모리
- 3-tier: short-term / mid-term / long-term
- `services/coachMemoryService.ts`에 전체 로직
- Firestore에 저장, 세션 단위로 관리

## 결제 (Polar)
- 조직명: `secret-coach` (ordinaryx 아님!)
- 웹훅: `/api/polar-webhook`
- `cancelAtPeriodEnd`이면 비구독자로 처리

## 버전
- 형식: `V{MM}.{DD}r{revision}`, `package.json`의 `displayVersion`
- 같은 날 여러 빌드 시 revision 증가

## i18n
- 모든 UI 텍스트는 `t()` 함수 필수
- `i18n/ko.ts`, `i18n/en.ts` 동시 업데이트, 하드코딩 금지
