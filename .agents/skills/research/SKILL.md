---
name: research
description: X/웹에서 현재 작업 관련 최신 정보를 검색하고 .Codex/knowledge/expert-tips.md에 기록. 주제를 인자로 전달.
---

# /research — 외부 리서치 스킬

사용자가 `/research [주제]`를 호출하면 웹에서 최신 정보를 검색하고 유용한 것을 `expert-tips.md`에 기록한다.

## 실행 흐름

### 1. 주제 확인

$ARGUMENTS가 없으면 사용자에게 "무엇을 검색할까요?" 질문.

### 2. 기존 지식 확인

`.Codex/knowledge/expert-tips.md`를 읽어서 이 주제에 대해 이미 알고 있는 것 확인.

### 3. 웹 검색

WebSearch 도구로 3-5개 검색 실행:
- `"[주제] best practices 2026"`
- `"[주제] site:x.com tips"`
- `"[주제] Codex / AI agent workflow"`
- 주제에 맞는 추가 쿼리

### 4. 필터링

검색 결과에서 유용한 팁을 선별:
- 이 프로젝트에 **적용 가능한** 것만
- 출처가 **신뢰할 수 있는** 것 (verified accounts, 공식 문서, 유명 개발자)
- **구체적이고 실행 가능한** 조언 (추상적 철학 제외)

### 5. 기록

선별된 팁을 `expert-tips.md`에 추가:

```markdown
## [카테고리] 팁 제목
- **출처**: @username (URL)
- **핵심**: 한 줄 요약
- **적용**: 이 프로젝트에서 어떻게 쓰는지
```

### 6. 요약 출력

```
리서치 완료: [주제]
- 검색 쿼리 {N}개 실행
- 유용한 팁 {M}개 발견 → expert-tips.md에 추가
- 주요 발견:
  1. {팁 1 한 줄 요약}
  2. {팁 2 한 줄 요약}
```
