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

## [Productivity] Boris Cherny 팀 — 병렬 워크트리가 최대 생산성 향상
- **출처**: @bcherny (Boris Cherny, Claude Code 창시자) via ToolScout 2026-03-26
- **핵심**: 3-5개 git worktree 병렬 세션이 가장 큰 생산성 향상
- **적용**: 독립적 기능은 워크트리 분리 후 병렬 에이전트 디스패치

## [Mindset] Karpathy — vibe coding ≠ professional AI-assisted engineering
- **출처**: @karpathy via ToolScout 2026-03-26
- **핵심**: 컨텍스트 전부 채우기 → diff 직접 확인 → 테스트 검증. 느슨한 코딩과 전문 AI 코딩은 다름
- **적용**: /build 파이프라인에서 리뷰 게이트 + 빌드 검증 필수화

## [Mindset] levelsio — 기술 스택은 가장 덜 중요
- **출처**: @levelsio (Peter Levels) via ToolScout 2026-03-26
- **핵심**: 고객이 돈 내는 제품이 핵심. 기술 스택 고민에 시간 낭비 금지
- **적용**: 기술 결정 시 "이게 유저에게 가치를 주나?"를 첫 번째 질문으로

## [Tool] Cursor 2.0 — parallel agents + 동작 확인 녹화
- **출처**: Cursor 2.0 발표 via ToolScout 2026-03-26
- **핵심**: 병렬 에이전트 + 코드 변경 후 동작 확인 녹화 (long-running code agent)
- **적용**: /build Phase 4에서 병렬 빌더 디스패치와 유사한 패턴

## [Browser] 기존 브라우저 로그인 세션을 헤드리스에서 재활용
- **출처**: gstack `setup-browser-cookies` 스킬 (설치 완료)
- **핵심**: 실제 Chromium 브라우저(Edge, Chrome, Arc, Brave, Comet)의 쿠키를 복호화 → Playwright 헤드리스 세션에 로드. 로그인 다시 안 해도 됨
- **적용**: QA 테스트나 인증 필요한 페이지 자동화 전에 `/setup-browser-cookies` 실행. `$B cookie-import-browser`로 도메인 선택 UI 열림. 특정 도메인만: `$B cookie-import-browser edge --domain secretcoach.ai`

## [Browser] CDP로 기존 로그인 브라우저에 직접 연결
- **출처**: 프로젝트 실제 경험 + feedback_env_optimization 메모리
- **핵심**: Edge를 `--remote-debugging-port=9222`로 실행하면 CDP로 기존 로그인 세션(Gmail, GCP, Vercel 등) 그대로 접근 가능
- **적용**: 로그인 필요한 외부 서비스 자동화 시 CDP 연결 우선 시도. Playwright MCP의 `browser_navigate`로 localhost:9222에 연결

## [리서치 소스] X(Twitter) AI 큐레이션 리스트
- **출처**: ToolScout config (2026-03-25 구축)
- **핵심**: 15명의 X 큐레이터 + 8개 검색 쿼리 로테이션
- **적용**: `/research` 스킬이나 막혔을 때 `~/.claude/projects/C--Users-moon/memory/toolscout/config.md` 참조. 주요 소스: @karpathy, @bcherny, @steipete, @levelsio, @rowancheung, @ClaudeCodeLog
