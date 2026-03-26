# TIL — Today I Learned

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
