# Knowledge-First Rule

## 작업 시작 전 (필수)
1. `.claude/knowledge/til.md` — 관련 문제가 이미 해결된 적 있는지 확인
2. `.claude/knowledge/patterns.md` — 프로젝트 관례 확인
3. `.claude/knowledge/expert-tips.md` — 적용 가능한 팁 확인
4. `.claude/knowledge/decisions.md` — 관련 아키텍처 결정 확인

## 막혔을 때 (적극적 검색)
knowledge/에 답이 없으면 **즉시 인터넷 검색**:
1. WebSearch로 에러 메시지, 기술 문제 검색
2. X(Twitter)에서 최신 AI/개발 트렌드 검색 — `~/.claude/projects/C--Users-moon/memory/toolscout/config.md`의 큐레이션 소스와 검색 쿼리 참조
3. Context7 MCP로 라이브러리 최신 문서 조회
4. 검색으로 해결한 내용은 반드시 `til.md` 또는 `expert-tips.md`에 기록

**"모르겠다"고 말하기 전에 최소 3가지 검색을 시도하라.**

## 작업 완료 후 (해당 시)
1. 새로 배운 것 → `til.md`에 기록
2. 새 패턴 발견 → `patterns.md`에 기록
3. 외부 유용한 정보 → `expert-tips.md`에 기록
4. 중요한 기술 결정 → `decisions.md`에 기록

## 판단 기준
- "다음에 같은 문제를 만나면 이걸 알았으면 좋겠다" → 기록
- 코드를 읽으면 알 수 있는 것 → 기록 안 함
- "왜 이렇게 했는지"가 코드에서 안 보이는 것 → 기록
