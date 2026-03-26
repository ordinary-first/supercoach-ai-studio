---
name: review
description: 기준 기반 코드 리뷰. 변경된 코드를 글로벌(Layer 1) + 도메인(Layer 2) 기준으로 Pass/Fail 판정. 자동 수정 없이 보고만.
---

# /review — 기준 기반 코드 리뷰

현재 변경된 코드를 글로벌(Layer 1) + 도메인(Layer 2) 기준으로 Pass/Fail 판정합니다.
자동 수정 없음 (보고만). 수동 수정 후 빠르게 체크할 때 사용.

## 실행 흐름

### 1. 변경 파일 감지

```bash
git diff --cached --name-only 2>/dev/null || git diff --name-only
```

`/review {파일경로}` — $ARGUMENTS가 있으면 해당 파일만 리뷰.

### 2. 리뷰어 디스패치

| 변경 파일 | 리뷰어 |
|-----------|--------|
| components/**/*.tsx | code-standards + domain-fit |
| api/*.ts | code-standards + security + domain-fit |
| hooks/*.ts | code-standards + domain-fit |
| services/*.ts | code-standards + security + domain-fit |
| stores/*.ts | code-standards + domain-fit |
| i18n/*.ts | domain-fit |
| types.ts | code-standards |

Agent tool로 디스패치. feature-acceptance는 사용하지 않음 (설계 문서 없으므로).

### 3. 결과 요약

```markdown
## 리뷰 결과 요약

### Layer 1 (글로벌) — {pass}/{total} Pass
### Layer 2 (도메인) — {pass}/{total} Pass
### 보안 — {pass}/{total} Pass (해당 시)

### 전체 판정: PASS / FAIL

### 수정 필요 항목
1. `{file}:{line}` — {수정 내용}
```

자동 수정하지 않음. 변경되지 않은 파일은 리뷰하지 않음.
