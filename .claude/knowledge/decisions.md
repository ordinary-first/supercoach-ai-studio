# Decisions — 아키텍처 결정 기록 (ADR-light)

## 2026-03-26: ESLint+Prettier → Biome
- **결정**: Biome 2.x를 유일한 린터/포매터로 채택
- **이유**: 설정 단순화 (파일 3개→1개), 속도 향상, 충돌 제거
- **트레이드오프**: ESLint 생태계의 일부 커스텀 규칙 사용 불가
- **영향**: `biome.json` 추가

## 2026-03-26: Vercel AI SDK 도입 (멀티 프로바이더)
- **결정**: OpenAI SDK 직접 호출 → Vercel AI SDK + @ai-sdk/openai + @ai-sdk/anthropic
- **이유**: 스트리밍 표준화, 프로바이더 교체 용이, 도구 호출 통합 API
- **트레이드오프**: 추상화 레이어 추가 → 디버깅 시 한 단계 더 들어감
- **영향**: API 라우트 점진적 마이그레이션 필요

## 2026-03: Capacitor 8로 모바일 (Expo/RN 대신)
- **결정**: 웹앱을 Capacitor로 래핑하여 Android 지원
- **이유**: React 웹앱 코드 100% 재사용, 별도 RN 코드베이스 불필요
- **트레이드오프**: 네이티브 성능/UX 한계
- **영향**: `capacitor.config.json`, `android/`

## 2026-03: Firebase Auth + Firestore
- **결정**: Firebase를 인증 + DB로 사용
- **이유**: 빠른 프로토타이핑, 실시간 동기화, 무료 티어 충분
- **트레이드오프**: 벤더 락인, 복잡한 쿼리 제한, cold start

## 2026-03: Polar 결제 (Stripe 대신)
- **결정**: Polar SDK로 구독 결제 처리
- **이유**: 개인 개발자 친화적, 간단한 API, 합리적 수수료
- **트레이드오프**: Stripe 대비 기능 제한, 생태계 작음
