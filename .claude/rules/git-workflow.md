# Git Workflow

## 브랜치 전략
- `master` — 프로덕션, 직접 커밋 금지 (PreToolUse 훅으로 차단됨)
- `harness/*` — 하네스 엔지니어링 (.claude/ 설정, 규칙, 스킬)
- `web/*` — 웹앱 기능 개발
- `native/*` — 모바일 관련
- `landing-page` — 랜딩 페이지 작업
- `fix/*` — 버그 수정

## 커밋 규칙
- Conventional Commits: `feat:`, `fix:`, `harness:`, `refactor:`, `docs:`
- 한 커밋에 한 가지 변경
- 커밋 메시지는 "왜"를 포함

## 머지 전략
- 기능 브랜치 → master: 리뷰 후 머지
- harness 브랜치 → master: 바로 머지 (인프라)
- 다른 브랜치들은 master에서 rebase로 하네스 변경 수신
