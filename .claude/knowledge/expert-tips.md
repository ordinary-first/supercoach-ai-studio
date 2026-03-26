# Expert Tips — 외부 고수 팁 모음

## [Agent Workflow] Karpathy의 에이전트 코딩 패턴
- **출처**: @karpathy (Andrej Karpathy)
- **핵심**: AutoResearch 패턴 — 모델이 가정하지 않고, 의도를 명세하고, 자동 반복으로 수렴
- **적용**: `/build` 스킬의 7단계 파이프라인이 이 패턴 기반. 기준 정의 → 구현 → 리뷰 루프

## [Claude Code] .claude/ 폴더 구조 최적화
- **출처**: @AkshayPachaar
- **핵심**: Skills > Commands (2026 표준), CLAUDE.md 200줄 이하, rules/로 모듈화
- **적용**: commands/ → skills/ 마이그레이션, rules/ 분리, CLAUDE.md 슬림화

## [Knowledge] 지식 기반 선행 원칙
- **출처**: @aaborashguptaol (Aakash Gupta)
- **핵심**: 프롬프트 전에 지식 기반부터 구축. 서브에이전트 역할 분리
- **적용**: knowledge/ 디렉토리가 이 원칙의 구현체. 작업 전 TIL/패턴 참조 (knowledge-first 규칙)

## [Session] 세션 간 지식 전파
- **출처**: Citadel 패턴
- **핵심**: Discovery relay — 500토큰 브리프로 세션 간 컨텍스트 전달
- **적용**: SCRATCHPAD.md가 이 역할. knowledge/는 영구 지식, SCRATCHPAD는 휘발성 컨텍스트

## [AI SDK] Vercel AI SDK 멀티 프로바이더 스트리밍
- **출처**: Vercel AI SDK 공식 문서
- **핵심**: `ai` 패키지로 OpenAI/Anthropic 통합, streamText/generateText로 프로바이더 교체 가능
- **적용**: 기존 OpenAI 직접 호출 → Vercel AI SDK로 마이그레이션 진행 중 (2026-03-26)

## [Firebase] uid 불일치 주의
- **출처**: 프로젝트 실제 경험 (2026-03-25)
- **핵심**: Polar external_id와 Firebase Auth uid가 다를 수 있음. 계정 삭제/재생성 시 uid 변경
- **적용**: 결제 코드에서 uid 하드코딩 금지, 항상 auth.currentUser.uid 사용
